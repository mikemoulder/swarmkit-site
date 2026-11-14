import { commitBid, createRound } from "./round.js";
import { resumeRound, replayRound } from "./replay.js";
/** Start an empty simulation. No strategies execute until advanceSimulation is called. */
export function startSimulation(options) {
    if (!Number.isSafeInteger(options.seed))
        throw new Error("Seed must be a safe integer");
    const spec = { ...options.spec, buyers: options.buyers.map(({ id }) => id), sellers: options.sellers.map(({ id }) => id) };
    const round = createRound(spec, () => spec.demandCloses - 1, options.mechanism);
    return { version: 1, stage: "ready", randomState: options.seed >>> 0, transcript: round.transcript(), sealedOffers: [] };
}
/** Advance exactly one stage. Persist the returned checkpoint before calling again.
 * Strategies must be side-effect-free: an uncommitted attempt may be retried.
 * The supplied callbacks may be asynchronous; clocks are logical simulation time.
 */
export async function advanceSimulation(input, strategies) {
    const next = structuredClone(input);
    if (next.version !== 1 || !["ready", "demand", "commit", "reveal", "closed"].includes(next.stage)
        || !Number.isInteger(next.randomState) || next.randomState < 0 || next.randomState > 0xffffffff
        || !Array.isArray(next.sealedOffers))
        throw new Error("Invalid simulation checkpoint");
    const spec = next.transcript.spec;
    if (JSON.stringify(spec.buyers) !== JSON.stringify(strategies.buyers.map(({ id }) => id))
        || JSON.stringify(spec.sellers) !== JSON.stringify(strategies.sellers.map(({ id }) => id))) {
        throw new Error("Simulation participants differ from checkpoint");
    }
    await replayRound(next.transcript, strategies.mechanism);
    if (next.stage === "closed")
        return next;
    let now = next.transcript.observedAt;
    const round = await resumeRound(next.transcript, () => now, strategies.mechanism);
    function word() { next.randomState = (Math.imul(next.randomState, 1664525) + 1013904223) >>> 0; return next.randomState; }
    const context = () => ({ resource: { ...spec.resource }, asset: spec.asset, random: () => word() / 2 ** 32 });
    if (next.stage === "ready") {
        for (const buyer of strategies.buyers) {
            if (!round.submitDemand(buyer.id, await buyer.demand(context())))
                throw new Error(`Invalid demand from ${buyer.id}`);
        }
        next.stage = "demand";
    }
    else if (next.stage === "demand") {
        now = spec.demandCloses;
        const quantity = round.snapshot().quantity;
        if (quantity !== "0")
            for (const seller of strategies.sellers) {
                const offer = await seller.offer({ ...context(), pooledQuantity: quantity });
                if (!offer)
                    continue;
                const bid = { ...offer, salt: Array.from({ length: 8 }, () => word().toString(16).padStart(8, "0")).join("") };
                if (!round.submitCommitment(seller.id, await commitBid(spec.id, seller.id, bid)))
                    throw new Error(`Invalid commitment from ${seller.id}`);
                next.sealedOffers.push({ sellerId: seller.id, bid, reveal: seller.reveal !== false });
            }
        next.stage = "commit";
    }
    else if (next.stage === "commit") {
        now = spec.commitCloses;
        for (const offer of next.sealedOffers)
            if (offer.reveal) {
                if (!await round.revealBid(offer.sellerId, offer.bid))
                    throw new Error(`Invalid stored reveal from ${offer.sellerId}`);
            }
        next.sealedOffers = [];
        next.stage = "reveal";
    }
    else {
        now = spec.revealCloses;
        round.snapshot();
        next.stage = "closed";
    }
    next.transcript = round.transcript();
    return next;
}
/** Explain the recorded outcome without claiming the heuristic proves infeasibility. */
export function explainAllocation(snapshot) {
    if (snapshot.phase !== "closed")
        throw new Error("Allocation explanations require a closed round");
    const lines = snapshot.splitAllocation?.lines ?? snapshot.allocation?.shares.map((share) => ({
        ...share, sellerId: snapshot.allocation.sellerId, unitPrice: snapshot.allocation.unitPrice,
    })) ?? [];
    return {
        outcome: lines.length ? "allocated" : "no-sale",
        reason: lines.length ? "All demand filled within buyer caps and seller capacity."
            : snapshot.quantity === "0" ? "No buyer demand."
                : snapshot.splitAllocation !== undefined ? "The configured allocator returned no complete allocation. This does not prove no feasible allocation exists."
                    : "No revealed seller could cover the complete pool within every buyer cap.",
        buyers: snapshot.buyers.map((buyer) => {
            const shares = lines.filter((line) => line.buyerId === buyer.buyerId);
            const spent = shares.reduce((total, line) => total + BigInt(line.amount), 0n);
            return { ...buyer, spent: String(spent), remainingBudget: String(BigInt(buyer.budget) - spent), lines: shares };
        }),
        sellers: snapshot.bids.map((bid) => ({
            sellerId: bid.sellerId,
            reason: bid.rejection ?? (lines.some((line) => line.sellerId === bid.sellerId) ? "allocated"
                : !bid.reveal ? "missing-reveal" : lines.length ? "not-selected-by-mechanism" : "no-complete-allocation"),
            quantity: String(lines.filter((line) => line.sellerId === bid.sellerId).reduce((sum, line) => sum + BigInt(line.quantity), 0n)),
        })),
    };
}
