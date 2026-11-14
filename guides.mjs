export const guidePages = [
  ['concepts', 'Understand the coordination model', 'Learn the objects, trust boundaries and guarantees before connecting real agents.', `
<h2>One round, one resource, one asset</h2><p>A round freezes a participant roster, a resource description, a payment asset and three deadlines. Quantities and amounts are canonical integer strings. Arithmetic uses bigint. A resource label can describe GPU hours, inference credits or dataset seats; it does not implement resource delivery.</p>
<table class="doc-table"><thead><tr><th>Object</th><th>Contract</th></tr></thead><tbody><tr><td>Demand</td><td>A positive quantity and a total spend cap. The buyer may replace or withdraw it before demand closes.</td></tr><tr><td>Bid</td><td>A positive capacity, unit price and 32-byte salt. The commitment binds these to the round and seller.</td></tr><tr><td>Allocation</td><td>Complete buyer fulfillment within budgets and seller capacity. Split lines identify both buyer and seller.</td></tr><tr><td>Transcript</td><td>Versioned accepted commands and observation time. Replay recomputes the outcome.</td></tr><tr><td>Settlement plan</td><td>Exact amounts and stable payment IDs derived from the closed allocation.</td></tr></tbody></table>
<h2>Time is part of the protocol</h2><p>The live coordinator defaults to Date.now(), in Unix milliseconds. Windows are half-open: demand is accepted before demandCloses, commitments from demandCloses up to commitCloses, and reveals from commitCloses up to revealCloses. At a closing timestamp, a submission is late. The clock must never move backwards. Simulations supply logical timestamps instead.</p>
<h2>What SwarmKit enforces</h2><p>The SDK checks participant membership, phases, immutable commitments, reveal hashes, allocation totals, capacity and budgets. Its runner enforces supplied approvals and binds split payment plans to a journal. Applications authenticate identities, protect keys, persist state atomically and pin custom mechanism implementations.</p>
<h2>What replay proves</h2><p>A transcript can be internally consistent while omitting a submission. Replay checks the recorded inputs; it does not establish their completeness or origin. Store the transcript in a trusted service or add an external attestation layer if your application needs stronger provenance.</p>
<h2>Current boundaries</h2><p>SwarmKit currently implements procurement. It does not supply escrow, atomic all-buyer settlement, refunds, delivery verification, arbitrary negotiations, compatibility matching or a production identity provider. Python bindings and additional economic protocols remain future work. The deliveryWindow field is descriptive, not an enforced fulfillment deadline.</p>`],
  ['mechanisms', 'Choose and extend allocation rules', 'Use single-seller procurement or split fulfillment, and understand exactly what can be customized.', `
<h2>Lowest-price procurement</h2><p>The default lowest-price-v1 rule selects one seller. Before selection, the SDK rejects offers that cannot fill the complete pool or exceed any buyer’s total cap. The cheapest eligible unit price wins; ASCII seller ID breaks ties. Charges use the selected seller’s quoted price.</p>
<h2>Split fulfillment</h2><pre><code>import { cheapestCapacity, createRound } from "near-swarmkit";
const round = createRound({ ...spec, mechanismId: cheapestCapacity.id });</code></pre><p>cheapest-capacity-v1 orders buyers by budget per unit, tightest first, then draws inventory from sellers in ascending price order. The result must fill all admitted demand. A null result is no sale. This is a greedy heuristic; failure does not prove that no feasible allocation exists.</p>
<h2>A custom winner rule</h2><pre><code>const mostCapacity = {
  id: "capacity-first-v1",
  selectWinner(offers) {
    return [...offers].sort((a, b) =&gt; {
      const delta = BigInt(b.capacity) - BigInt(a.capacity);
      return delta &lt; 0n ? -1 : delta &gt; 0n ? 1
        : a.sellerId &lt; b.sellerId ? -1 : a.sellerId &gt; b.sellerId ? 1 : 0;
    })[0]?.sellerId ?? null;
  },
};
const round = createRound({ ...spec, mechanismId: mostCapacity.id }, Date.now, mostCapacity);</code></pre>
<h2>A custom split rule</h2><p>Implement allocate(buyers, offers) instead of selectWinner. Return null or an array of { buyerId, sellerId, quantity }. Each buyer–seller pair must be unique. The SDK computes amounts at the revealed bid prices, verifies every buyer is filled exactly, and rejects over-budget or over-capacity results. It does not accept custom payment prices through this interface.</p>
<h2>Keep replay deterministic</h2><p>Give each implementation a versioned ID and supply the same implementation to createRound, replayRound, resumeRound, settlementPlanFromTranscript and auditSettlement. Never silently change an implementation behind an old ID. Avoid wall clocks, random tie-breaking or network calls inside allocation functions.</p>
<h2>Inspect the decision</h2><pre><code>const decision = explainAllocation(round.snapshot());
console.log(decision.reason);
console.table(decision.buyers); // spend, unused budget, fulfillment lines
console.table(decision.sellers); // allocation or rejection reason</code></pre><p>Call this only on a closed round. “Not selected by mechanism” does not imply a bid was invalid. The explanation reports the recorded outcome without pretending to expose the internal reasoning of arbitrary custom plugins.</p>`],
  ['simulation', 'Run and resume agent simulations', 'Execute policies one stage at a time and keep a private checkpoint across restarts.', `
<h2>Two execution styles</h2><p>simulateProcurement runs a complete deterministic round and returns its stage snapshots, transcript, payment plan and synthetic receipts. Use it for unit tests and experiments. startSimulation creates an empty checkpoint; advanceSimulation executes exactly one stage. Use the incremental API for a scheduler or interactive reference application.</p>
<pre><code>import { startSimulation, advanceSimulation, replayRound } from "near-swarmkit";
let checkpoint = startSimulation(options); // no callbacks invoked
checkpoint = await advanceSimulation(checkpoint, options); // buyer demands
checkpoint = await advanceSimulation(checkpoint, options); // seller commitments
// Persist checkpoint atomically before progressing.
checkpoint = await advanceSimulation(checkpoint, options); // reveals
checkpoint = await advanceSimulation(checkpoint, options); // closed allocation
const publicSnapshot = await replayRound(checkpoint.transcript);</code></pre>
<h2>Asynchronous policies</h2><p>Buyer demand and seller offer callbacks may return promises. A seller sees the pooled quantity; both receive the resource, asset and seeded random function. Policies may close over application history, balances or inventory. Keep them free of external side effects: if a host crashes before committing the returned checkpoint, a callback can run again. Hosts should impose timeouts and cancellation around external computations.</p>
<h2>Private checkpoints, public transcripts</h2><p>A SimulationSession includes unrevealed seller offers. It is trusted private state, not an interchange format to accept from strangers. Publish only its transcript or replayed snapshot. The built-in simulation salts are deterministic and must not be used for live hidden bids.</p>
<h2>A working economy</h2><p>The Market reference applies the SDK to 20 GPU buyers and five sellers, or a smaller inference market. It maintains inventory, work consumption, earned income, replenishment costs and utilization-based seller quotes. The same controller runs against IndexedDB in the browser and SQLite in the local service. The tests kill a process after recording a simulated broadcast and recover it in a new process.</p>
<pre><code>git clone https://github.com/mikemoulder/swarmkit-market
cd swarmkit-market
npm ci
npm test
npm run experiment -- 12
npm run build
npm run serve</code></pre><p>All these economy runs are simulation. Synthetic receipts and synthetic buyer approvals cannot move real funds. The experiment retains its SQLite database across invocations; use a new database path as the second argument for an independent run.</p>
<h2>Runnable example</h2><p><a href="../examples/incremental-market.mjs">Download incremental-market.mjs</a>. Run it from a project with near-swarmkit installed. It demonstrates serialization and async policies; the reference application supplies actual durable storage.</p>`],
  ['storage', 'Persist rounds and payment journals', 'Choose atomic storage semantics that survive concurrent writers and process restarts.', `
<h2>RoundStore</h2><pre><code>type RoundStore = {
  read(roundId: string): Promise&lt;RoundTranscript | undefined&gt;;
  compareAndSet(next: RoundTranscript, expectedRevision: number | null): Promise&lt;boolean&gt;;
};</code></pre><p>The revision is the number of accepted events. null means “insert only if absent.” A non-null revision means “update only if the stored event count still matches.” Do not implement this as a separate read followed by an unconditional write.</p>
<pre><code>const store = sqliteRoundStore("./rounds.sqlite");
await openStoredRound(spec, store);
const result = await submitStoredRoundEvent(spec.id, {
  type: "demand", buyerId: authenticatedBuyerId,
  request: { quantity: "2", budget: "10" },
}, store);
if (result.status === "conflict") {
  // Read the current round, recheck its phase, then decide whether to retry.
}</code></pre><p><a href="../examples/sqlite-round-store.mjs">The complete SQLite adapter</a> uses an atomic conditional UPDATE, WAL and FULL synchronization. Node 22.18’s built-in SQLite API is experimental. Applications may implement the same interface with another database.</p>
<h2>SettlementJournal</h2><p>read retrieves a payment entry. reserve atomically inserts a candidate if absent and returns the existing winner otherwise. The entry contains the payment and signed bytes/hash. bindPlan atomically stores or matches the complete plan fingerprint. Split settlement requires bindPlan; its absence is an error.</p>
<pre><code>const journal = {
  read: async scope =&gt; loadEntry(scope),
  reserve: async (scope, candidate) =&gt; insertOrReadAtomically(scope, candidate),
  bindPlan: async (scope, fingerprint) =&gt; insertOrCompareAtomically(scope, fingerprint),
};</code></pre><p>The snippet states the required adapter contract; loadEntry and the two atomic functions are your database operations, not SDK exports. The reference market contains implemented IndexedDB and SQLite stores and a durable simulation journal. Its Intents CLI contains a separate file journal for live execution.</p>
<h2>Order of durability</h2><ol><li>Freeze the allocation and bind the payment plan.</li><li>Authorize, prepare the transaction and durably reserve its signed bytes.</li><li>Inspect the stored hash, then broadcast only those bytes if allowed.</li><li>Record finalized receipts and apply application ledger changes once per payment ID.</li></ol><p>A transport exception must not cause you to discard the journal and prepare a replacement. A pending transaction can already have been broadcast. Reconcile it first. Independent payments can settle partially.</p>
<h2>Storage ownership</h2><p>Keep one trusted storage namespace per environment. Protect journals like credentials: their signed bytes may still be broadcastable. Browser simulation storage is suitable for synthetic activity, not for custody of live keys. Use unique round IDs and retain the journal for recovery.</p>`],
  ['agents', 'Connect an independent agent', 'Build a participant that can submit commands without impersonating another buyer or seller.', `
<h2>Choose the integration boundary</h2><p>For simulation, implement BuyerStrategy.demand and SellerStrategy.offer. For live off-chain participation, your service authenticates the caller, maps it to a registered identity and submits a RoundCommand. Do not accept buyerId or sellerId as proof of identity.</p>
<pre><code>const buyer = {
  id: "research-agent",
  async demand() {
    const quantity = Math.min(workQueue.length, Math.floor(balance / unitCap));
    return quantity ? { quantity: String(quantity), budget: String(quantity * unitCap) } : null;
  },
};</code></pre><p>Here workQueue, balance and unitCap are application state. The callback proposes demand; coordinator validation and settlement approval remain separate enforcement steps.</p>
<h2>A complete service recipe</h2><p><a href="../examples/agent-service.mjs">agent-service.mjs</a> exposes POST /command, derives the actor from a bearer credential, checks its buyer/seller role, limits request size, and delegates phase and commitment validation to submitStoredRoundEvent. Combine it with the <a href="../examples/sqlite-round-store.mjs">SQLite store</a>. The test uses a separate HTTP client, rejects a buyer attempting a seller command, and verifies durable identity attribution.</p>
<pre><code>const store = sqliteRoundStore("./rounds.sqlite");
await openStoredRound(spec, store);
const service = createAgentService({ store, credentials: [
  { token: process.env.BUYER_TOKEN, id: "buyer.example.testnet", role: "buyer" },
  { token: process.env.SELLER_TOKEN, id: "seller.example.testnet", role: "seller" },
] });
service.listen(4100, "127.0.0.1");</code></pre><p>Import the two example factories from the files you downloaded; openStoredRound comes from near-swarmkit. Validate your token configuration before starting. This local recipe does not provide user signup, credential rotation or public TLS hosting.</p>
<h2>Submit demand</h2><pre><code>POST /command
Authorization: Bearer &lt;buyer-token&gt;
Content-Type: application/json

{"roundId":"round-01","type":"demand","request":{"quantity":"3","budget":"15"}}</code></pre>
<h2>Commit, then reveal</h2><p>The seller generates a fresh 32-byte cryptographic salt, keeps the bid private, computes commitBid(roundId, sellerId, bid), and submits a commitment command during the commit window. During the reveal window it submits the original bid. Persist the salt privately so a process restart does not lose the reveal. An unrevealed bid cannot receive an allocation.</p>
<h2>Handle responses deliberately</h2><table class="doc-table"><thead><tr><th>Status</th><th>Agent action</th></tr></thead><tbody><tr><td>200</td><td>Command accepted. Keep the returned snapshot.</td></tr><tr><td>401 / 403</td><td>Fix authentication or role. Do not retry under an invented identity.</td></tr><tr><td>409</td><td>Re-read current state and reconsider the command before retrying.</td></tr><tr><td>422</td><td>Inspect deadline, roster and bid validity. Do not automatically raise a buyer cap.</td></tr></tbody></table>
<h2>Separate spending permission</h2><p>An accepted demand is not a signature authorizing a transfer. Review the closed plan, create a SpendingPolicy, sign spendingPolicyMessage(policy) with the buyer’s Ed25519 key, and give the runner a trusted buyer-to-public-key resolver. The application must still authorize the transport’s actual signing keys.</p>
<h2>Instructions for coding agents</h2><p><a href="../llms-full.txt">Full machine-readable documentation</a> includes the public contracts and guides. Preserve integer strings, never put live signing keys in a browser, never raise caps to make a payment pass, and distinguish simulation from native testnet transfers and Intents execution.</p>`],
  ['settlement', 'Authorize and recover NEAR settlement', 'Carry an allocation into payments with explicit approval, durable identity and independent receipt checks.', `
<h2>Prepare from the recorded round</h2><pre><code>const plan = await settlementPlanFromTranscript(transcript, customMechanism);
const result = await executeWithSpendingPolicies(plan, {
  transport, journal, approvals, resolveBuyerKey,
});
console.log(result.summary); // confirmed, pending, failed, paid</code></pre><p>Omit customMechanism for a built-in rule. Every payment carries a canonical integer amount. Version 1 IDs bind round and buyer; version 2 binds round, buyer and seller. Split plans must be atomically bound before execution.</p>
<h2>Buyer-signed spending policy</h2><pre><code>const policy = {
  roundId: plan.roundId,
  buyerId: "buyer.example.testnet",
  asset: plan.asset,
  transportScope: transport.scope,
  sellers: ["seller.example.testnet"],
  maxAmount: "1000000000000000000000",
  expiresAt: Date.now() + 300_000,
};
const bytes = spendingPolicyMessage(policy);
// Sign bytes with the trusted buyer Ed25519 approval key.
// Pass { policy, signature: Uint8Array } in approvals.</code></pre><p>The signature binds round, buyer, asset, transport, seller allowlist, cumulative cap and expiry. The runner checks approval before preparation and again before broadcasting. Trust the resolver, not a public key supplied by an agent request. These are application-enforced policies, not NEAR restricted access keys or an on-chain spending contract.</p>
<h2>Native testnet NEAR</h2><p>nearTestnetTransport accepts your exact-payment signer. The signer constructs one native transfer from buyer to seller. The transport checks finalized sender, recipient, amount and action before confirming. Use the native testnet asset constant and named testnet accounts. The packaged SDK’s main runtime has zero dependencies; the separate live example uses near-api-js.</p>
<h2>Run the reference testnet validation</h2><p>From the swarmkit-market repository, install dependencies and run:</p><pre><code>npm run testnet -- --faucet-testnet --gpu
npm run testnet -- --faucet-testnet --split
npm run testnet:audit -- .market/testnet/&lt;printed-account&gt;/evidence.json</code></pre><p>The first run provisions 20 buyers and five sellers; the second allocates one buyer across two sellers. Both use disposable faucet accounts, incremental SDK stages and actual native testnet transfers. The runner interrupts after journaling the first signed transaction, resumes, and audits each finalized sender, recipient and amount. Evidence and signed journals remain under ignored .market/testnet; only public evidence should be shared. Keys are memory-only: this bounded validation tool is not a persistent wallet service. No mainnet tokens are needed.</p><p>The 14 November validation finalized all 20 GPU payments (0.036 testnet NEAR) and both split payments (0.0014 testnet NEAR). These validate coordination-to-native-payment integration, not resource delivery or Intents. The browser credit economy remains separate.</p><h2>NEAR Intents</h2><p>nearIntentsTransport operates on supported NEP-141 balances held in the mainnet Verifier. Buyers need funded Verifier balances and recognized signing keys. A buyer callback signs the exact NEP-413 message; a relayer callback signs the execute_intents transaction. The adapter simulates each transfer before requesting the relayer signature, then checks finalized execution against the approved payment.</p>
<pre><code>const transport = nearIntentsTransport({
  asset: "nep141:wrap.near",
  relayerId: "your-relayer.near",
  signIntent: buyerNep413Signer,
  signTransaction: relayerTransactionSigner,
});</code></pre><p>The callbacks above are application implementations. The <a href="https://github.com/mikemoulder/swarmkit-market/blob/main/scripts/intents.mjs">operator CLI</a> provides an implementation using near-api-js. A recipient receives a Verifier balance; withdrawing it is a separate operation. This adapter does not offer cross-chain routing or solver optimization.</p>
<h2>Recovery states</h2><table class="doc-table"><thead><tr><th>Observation</th><th>Behavior</th></tr></thead><tbody><tr><td>No journal entry</td><td>Check authorization before preparing.</td></tr><tr><td>Pending recorded hash</td><td>Inspect it; rebroadcast only the same stored bytes if still authorized.</td></tr><tr><td>Final confirmed payment</td><td>Reconcile it; do not sign again.</td></tr><tr><td>Final failed payment</td><td>Report failure. Replacement is a separate explicit workflow.</td></tr><tr><td>Expired / ambiguous transaction</td><td>Retain the journal and reconcile. The runner does not automatically replace it.</td></tr></tbody></table>
<h2>Independent audit</h2><pre><code>const report = await auditSettlement(transcript, receipts, {
  verifier: transport,
});
console.log(report.claimedSummary, report.verifiedSummary);
console.table(report.checks);</code></pre><p>Without a verifier, the report checks recorded claims only. With one, it compares observed status and rejects reused transaction hashes. Independent transfers can settle partially; SwarmKit does not reverse a confirmed payment or guarantee resource delivery.</p>`],
  ['architecture', 'Architecture and market rules', 'See what the SDK owns, what the reference application owns and where NEAR executes.', `
<h2>Three repositories, one SDK boundary</h2><pre><code>swarmkit-site             swarmkit-market
documentation            UI / policies / economy controller
       |                       |
       +---- near-swarmkit -----+
             rounds / mechanisms / replay
             approvals / settlement runner / audit
                      |
            application-provided adapters
         storage / participant auth / signing
                      |
            NEAR testnet or Intents Verifier</code></pre>
<h2>SDK responsibilities</h2><p>src/swarm holds the round engine, mechanisms, replay/storage contracts, simulation APIs, spending policies, settlement runner and NEAR adapters. It does not hold application credentials, request handlers or resource delivery logic. Its standalone package excludes the root Next.js dashboard dependencies.</p>
<h2>Reference economy responsibilities</h2><p>The market’s economy controller defines work demand, capacity consumption, seller quote policies, replenishment, money flows and event history. Its browser host uses IndexedDB with Web Locks; its local HTTP host uses SQLite, an operator token and conditional revision updates. Both consume the packaged SDK. The local host is a simulation coordinator, not a public production custody service.</p>
<h2>Economic rules</h2><ol><li>Collect replaceable buyer demand before demand closes.</li><li>Bind each seller’s immutable offer with a SHA-256 commitment.</li><li>Verify reveals against that commitment during the reveal window.</li><li>Fill the complete pool within every buyer cap and every seller capacity, or make no allocation.</li><li>Charge the quoted unit price for each allocated line.</li><li>Settle independent buyer–seller payments. Preserve partial outcomes and reconcile uncertain transactions.</li></ol><p>Single-seller procurement and split procurement use different clearing rules; see <a href="../mechanisms/">Mechanisms</a>. The GPU market remains the original reference; inference and dataset examples exercise reuse.</p>
<h2>On-chain boundary</h2><p>Auction inputs, clearing and resource delivery remain off-chain. Native testnet evidence proves the recorded transfers. Intents execution moves balances in the Verifier. Neither proves delivery of the purchased resource. No SwarmKit escrow contract is deployed.</p>
<h2>Releases and compatibility</h2><p>The package remains an unpublished 0.1.0 release candidate. Build and install the tarball from source. Transcript version 1, settlement plan versions 1 and 2, and simulation checkpoint version 1 are distinct formats. Do not rewrite saved payment identities or silently swap mechanism versions. The old root dashboard remains a minimal SDK example; the standalone Market is the primary reference application.</p>`],
  ['errors', 'Diagnose failures without losing state', 'Use the failure boundary to decide whether to retry, reconcile or correct configuration.', `
<h2>Round commands</h2><p>Direct coordinator methods return false for rejected submissions. The stored coordinator returns accepted, rejected or conflict. Invalid configuration, backwards clocks, invalid replay and invalid plugin outputs throw errors. There is no stable exported error-code enum yet; do not build critical recovery logic around matching message strings.</p>
<h2>Allocation</h2><p>A no-sale result is a valid economic outcome. Inspect missing reveals, capacity, buyer caps and the selected mechanism. The split heuristic can return null without proving infeasibility. Never increase buyer authorization simply to force a sale.</p>
<h2>Storage conflict</h2><p>Re-read the latest state, revalidate the phase and reconstruct the intended command. Do not retry an unconditional write. A failed persistence operation must prevent progress to the next execution step.</p>
<h2>Settlement uncertainty</h2><p>Keep the same journal, transport scope, round ID and relayer. A broadcast exception can mean the request succeeded but the response was lost. Reconcile the saved transaction hash. A mismatch between a finalized transfer and the approved payment is an error requiring investigation, not a retry signal.</p>
<h2>RPC failures</h2><p>The testnet adapter bounds HTTP 429 retries. The Intents adapter currently has request timeouts but no automatic HTTP 429 retry loop. Hosts should surface RPC errors and schedule bounded reconciliation attempts. Signer callback correctness and durable storage remain application responsibilities.</p>
<h2>Browser storage</h2><p>The Market requires IndexedDB and Web Locks on HTTPS or localhost. If storage is unavailable, it displays an error instead of silently using volatile memory. Clearing site data removes the local simulation. Exported public records contain transcripts and receipt claims, not the private checkpoint needed to resume sealed offers.</p>`],
];

