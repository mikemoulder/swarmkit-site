import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { submitStoredRoundEvent, resumeRound } from 'near-swarmkit';

/** Integration recipe: one authenticated identity per token, supplied by the host.
 * Bind to loopback for local work; put TLS and your identity system in front of any public deployment.
 * Never accept an actor identity from an untrusted request body.
 */
export function createAgentService({ store, credentials, clock = Date.now, mechanism = undefined }) {
  if (!Array.isArray(credentials) || !credentials.length || credentials.some(c => !c.id || typeof c.token !== 'string' || !c.token || !['buyer', 'seller'].includes(c.role))
    || new Set(credentials.map(c => c.token)).size !== credentials.length) throw new Error('Configure distinct nonempty participant credentials');
  return createServer(async (req, res) => {
    const respond = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    const url = new URL(req.url, 'http://localhost');
    if (!((req.method === 'POST' && url.pathname === '/command') || (req.method === 'GET' && url.pathname === '/round'))) return respond(404, { error: 'Unknown endpoint' });
    const supplied = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') ?? '');
    const identity = credentials.find(({ token }) => { const expected = Buffer.from(token); return supplied.length === expected.length && timingSafeEqual(supplied, expected); });
    if (!identity) return respond(401, { error: 'Unknown participant' });
    try {
      if (req.method === 'GET') {
        const saved = await store.read(url.searchParams.get('roundId'));
        if (!saved || ![...saved.spec.buyers, ...saved.spec.sellers].includes(identity.id)) return respond(404, { error: 'Round not found for this participant' });
        return respond(200, (await resumeRound(saved, clock, mechanism)).snapshot());
      }
      let body = '';
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) return respond(413, { error: 'Command too large' }); }
      const { roundId, type, request, hash, bid } = JSON.parse(body);
      if (typeof roundId !== 'string') return respond(400, { error: 'Round ID required' });
      const command = type === 'demand' && identity.role === 'buyer' ? { type, buyerId: identity.id, request }
        : type === 'commitment' && identity.role === 'seller' ? { type, sellerId: identity.id, hash }
        : type === 'reveal' && identity.role === 'seller' ? { type, sellerId: identity.id, bid } : null;
      if (!command) return respond(403, { error: 'Command not permitted for this participant role' });
      const result = await submitStoredRoundEvent(roundId, command, store, clock, mechanism);
      if (result.status === 'conflict') return respond(409, { error: 'Revision conflict: read current phase and reconsider your command' });
      if (result.status === 'rejected') return respond(422, { error: 'Command rejected by phase, participant or bid validation' });
      const round = await resumeRound(result.transcript, clock, mechanism);
      return respond(200, { status: 'accepted', snapshot: round.snapshot() });
    } catch (error) { return respond(400, { error: 'Invalid command or unavailable round' }); }
  });
}
