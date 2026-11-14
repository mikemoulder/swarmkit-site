import { startSimulation, advanceSimulation, replayRound, cheapestCapacity } from './assets/sdk/index.js';
const button = document.getElementById('play-step'), select = document.getElementById('play-resource'), output = document.getElementById('play-output');
let session, agents;
function reset() {
  agents = { seed: 42, spec: { id: 'website-demo', mechanismId: cheapestCapacity.id,
    resource: { label: select.value, unit: 'unit', deliveryWindow: 'Now' }, asset: 'simulation:credits', demandCloses: 10, commitCloses: 20, revealCloses: 30 },
    buyers: [{ id: 'research', demand: async () => ({ quantity: '3', budget: '15' }) }, { id: 'indexer', demand: async () => ({ quantity: '2', budget: '10' }) }],
    sellers: [{ id: 'atlas', offer: async () => ({ capacity: '3', unitPrice: '2' }) }, { id: 'harbor', offer: async () => ({ capacity: '4', unitPrice: '4' }) }] };
  session = startSimulation(agents); output.textContent = 'Ready · 2 buyers / 2 sellers. Policies have not run.'; button.textContent = 'Collect demand'; button.disabled = false;
}
button.addEventListener('click', async () => {
  button.disabled = true; select.disabled = true;
  try {
    if (session.stage === 'closed') { reset(); return; }
    session = await advanceSimulation(session, agents);
    const snapshot = await replayRound(session.transcript);
    output.textContent = session.stage === 'demand' ? `${snapshot.quantity} units requested · two individual spend caps.`
      : session.stage === 'commit' ? `${snapshot.bids.length} SHA-256 commitments · prices are still sealed.`
      : session.stage === 'reveal' ? snapshot.bids.map(b => `${b.sellerId}: ${b.reveal.capacity} units at ${b.reveal.unitPrice} credits`).join(' · ')
      : `${snapshot.splitAllocation.lines.length} allocation lines · ${snapshot.splitAllocation.total} credits total · full demand filled.`;
    button.textContent = ({ demand: 'Commit offers', commit: 'Reveal bids', reveal: 'Clear allocation', closed: 'Run again' })[session.stage];
  } catch { output.textContent = 'The example could not advance. Select a market to restart.'; }
  finally { button.disabled = false; select.disabled = false; }
});
select.addEventListener('change', reset); reset();
