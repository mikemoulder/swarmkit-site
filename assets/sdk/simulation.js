import { commitBid, createRound } from "./round.js";
import { createSettlementPlan, summarizeSettlement } from "./settlement.js";
export async function simulateProcurement(options) {
    if (!Number.isSafeInteger(options.seed))
        throw new Error("Seed must be a safe integer");
    const spec = structuredClone({
        ...options.spec,
        buyers: options.buyers.map(({ id }) => id),
        sellers: options.sellers.map(({ id }) => id),
    });
    let now = spec.demandCloses - 1;
    const round = createRound(spec, () => now, options.mechanism);
    let state = options.seed >>> 0;
    function randomWord() {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state;
    }
    function context() {
        return { resource: { ...spec.resource }, asset: spec.asset, random: () => randomWord() / 2 ** 32 };
    }
    for (const buyer of options.buyers) {
        if (!round.submitDemand(buyer.id, await buyer.demand(context()))) {
            throw new Error(`Invalid demand from ${buyer.id}`);
        }
    }
    const demand = round.snapshot();
    const offers = new Map();
    now = spec.demandCloses;
    if (demand.quantity !== "0") {
        for (const seller of options.sellers) {
            const offer = await seller.offer({ ...context(), pooledQuantity: demand.quantity });
            if (!offer)
                continue;
            const salt = Array.from({ length: 8 }, () => randomWord().toString(16).padStart(8, "0")).join("");
            const bid = { ...offer, salt };
            round.submitCommitment(seller.id, await commitBid(spec.id, seller.id, bid));
            if (seller.reveal !== false)
                offers.set(seller.id, bid);
        }
    }
    const committed = round.snapshot();
    now = spec.commitCloses;
    for (const [sellerId, bid] of offers)
        await round.revealBid(sellerId, bid);
    const revealed = round.snapshot();
    now = spec.revealCloses;
    const result = round.snapshot();
    const plan = createSettlementPlan(result);
    const receipts = plan.payments.map((payment) => ({
        paymentId: payment.id,
        status: options.paymentOutcome?.({ ...payment }) ?? "confirmed",
    }));
    return {
        mode: "simulation",
        transcript: round.transcript(),
        stages: [demand, committed, revealed, result],
        plan,
        settlement: summarizeSettlement(plan, receipts),
        payments: plan.payments.map(({ buyerId, amount }, index) => ({
            buyerId, amount, status: receipts[index].status === "confirmed" ? "simulated" : receipts[index].status,
        })),
    };
}
