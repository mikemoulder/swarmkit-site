import { simulateProcurement } from "near-swarmkit";

const { plan } = await simulateProcurement({
  seed: 42,
  spec: {
    id: "inference-credits-01",
    resource: { label: "Inference credits", unit: "credit", deliveryWindow: "Today" },
    asset: "demo-credits",
    demandCloses: 10,
    commitCloses: 20,
    revealCloses: 30,
  },
  buyers: [
    { id: "research", demand: () => ({ quantity: "3", budget: "15" }) },
    { id: "indexer", demand: () => ({ quantity: "2", budget: "10" }) },
  ],
  sellers: [
    { id: "fastlane", offer: () => ({ capacity: "4", unitPrice: "3" }) },
    { id: "northstar", offer: () => ({ capacity: "5", unitPrice: "4" }) },
  ],
});

console.log(plan.payments.map(({ buyerId, amount }) => [buyerId, amount]));
