import { startSimulation, advanceSimulation, replayRound, explainAllocation, cheapestCapacity } from 'near-swarmkit';

const options = {
  seed: 42,
  spec: { id: 'storage-01', resource: { label: 'Storage', unit: 'block', deliveryWindow: 'This round' },
    asset: 'simulation:credits', mechanismId: cheapestCapacity.id,
    demandCloses: 10, commitCloses: 20, revealCloses: 30 },
  buyers: [{ id: 'indexer', demand: async () => ({ quantity: '5', budget: '20' }) }],
  sellers: [
    { id: 'archive', offer: async () => ({ capacity: '3', unitPrice: '2' }) },
    { id: 'backup', offer: async () => ({ capacity: '3', unitPrice: '3' }) },
  ],
};
let checkpoint = startSimulation(options);
while (checkpoint.stage !== 'closed') {
  checkpoint = await advanceSimulation(checkpoint, options);
  // A real host must atomically persist this PRIVATE checkpoint before advancing.
  checkpoint = JSON.parse(JSON.stringify(checkpoint));
  console.log(checkpoint.stage, (await replayRound(checkpoint.transcript)).quantity);
}
console.log(explainAllocation(await replayRound(checkpoint.transcript)));
