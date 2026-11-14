import { startSimulation, advanceSimulation, replayRound, cheapestCapacity } from './assets/sdk/index.js';

const button = document.getElementById('play-step');
const select = document.getElementById('play-resource');
const output = document.getElementById('play-output');
const stages = [...document.querySelectorAll('.play__stages li')];
const order = ['demand', 'commit', 'reveal', 'closed'];
const labels = { demand: 'Commit offers', commit: 'Reveal bids', reveal: 'Clear the round', closed: 'Run it again' };
let session, agents;

function mark(stage) {
  const at = stage ? order.indexOf(stage) : -1;
  stages.forEach((li, i) => { li.classList.toggle('is-done', i < at || (stage === 'closed' && i === at)); li.classList.toggle('is-now', i === at && stage !== 'closed'); });
}

function reset() {
  agents = {
    seed: 42,
    spec: { id: 'website-demo', mechanismId: cheapestCapacity.id, resource: { label: select.value, unit: 'unit', deliveryWindow: 'Now' },
      asset: 'simulation:credits', demandCloses: 10, commitCloses: 20, revealCloses: 30 },
    buyers: [
      { id: 'research', demand: async () => ({ quantity: '3', budget: '15' }) },
      { id: 'indexer', demand: async () => ({ quantity: '2', budget: '10' }) },
    ],
    sellers: [
      { id: 'atlas', offer: async () => ({ capacity: '3', unitPrice: '2' }) },
      { id: 'harbor', offer: async () => ({ capacity: '4', unitPrice: '4' }) },
    ],
  };
  session = startSimulation(agents);
  mark(null);
  output.textContent = 'Two buyers and two sellers are ready. No policy has run yet.';
  button.textContent = 'Collect demand';
  button.disabled = false;
}

button.addEventListener('click', async () => {
  button.disabled = true; select.disabled = true;
  try {
    if (session.stage === 'closed') { reset(); return; }
    session = await advanceSimulation(session, agents);
    const snapshot = await replayRound(session.transcript);
    mark(session.stage);
    if (session.stage === 'demand') output.textContent = `${snapshot.quantity} units requested under two separate spend caps.`;
    else if (session.stage === 'commit') output.textContent = `${snapshot.bids.length} SHA-256 commitments received. Prices are still sealed.`;
    else if (session.stage === 'reveal') output.textContent = snapshot.bids.map(b => `${b.sellerId}: ${b.reveal.capacity} units at ${b.reveal.unitPrice}`).join(' · ');
    else output.textContent = `${snapshot.splitAllocation.lines.length} allocation lines, ${snapshot.splitAllocation.total} credits in total. All demand filled.`;
    button.textContent = labels[session.stage];
  } catch {
    output.textContent = 'The round could not advance. Pick a resource to start again.';
  } finally {
    button.disabled = false; select.disabled = false;
  }
});

select.addEventListener('change', reset);
reset();
