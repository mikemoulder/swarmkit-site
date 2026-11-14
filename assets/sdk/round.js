import { cheapestCapacity, lowestPrice, validateSplit } from "./mechanism.js";
const positiveDecimal = /^[1-9][0-9]*$/;
const accountId = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const digest = /^[0-9a-f]{64}$/;
function validBid(bid) {
    return typeof bid.capacity === "string" && positiveDecimal.test(bid.capacity)
        && typeof bid.unitPrice === "string" && positiveDecimal.test(bid.unitPrice)
        && typeof bid.salt === "string" && digest.test(bid.salt);
}
export async function commitBid(roundId, sellerId, bid) {
    if (!validBid(bid))
        throw new Error("Invalid bid");
    const encoded = new TextEncoder().encode(JSON.stringify([
        "swarmkit-bid-v1", roundId, sellerId, bid.capacity, bid.unitPrice, bid.salt,
    ]));
    const hash = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function createRound(input, clock = Date.now, mechanism = input.mechanismId === cheapestCapacity.id ? cheapestCapacity : lowestPrice) {
    const spec = structuredClone(input);
    const mechanismId = mechanism.id;
    const allocate = "allocate" in mechanism ? mechanism.allocate : undefined;
    const selectWinner = "selectWinner" in mechanism ? mechanism.selectWinner : undefined;
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(mechanismId)
        || mechanismId !== (spec.mechanismId ?? lowestPrice.id)
        || (typeof selectWinner !== "function") === (typeof allocate !== "function")) {
        throw new Error("Round requires a matching procurement mechanism");
    }
    const participants = [...spec.buyers, ...spec.sellers];
    if (typeof spec.id !== "string" || !spec.id
        || participants.some((id) => typeof id !== "string" || !accountId.test(id))
        || new Set(participants).size !== participants.length
        || ![spec.demandCloses, spec.commitCloses, spec.revealCloses].every(Number.isSafeInteger)
        || spec.demandCloses >= spec.commitCloses || spec.commitCloses >= spec.revealCloses)
        throw new Error("Invalid round configuration");
    const demand = new Map();
    const commitments = new Map();
    const reveals = new Map();
    const events = [];
    let observedTime = -Infinity;
    function phase() {
        const time = clock();
        if (!Number.isFinite(time) || time < observedTime)
            throw new Error("Invalid round clock");
        observedTime = time;
        if (time < spec.demandCloses)
            return "demand";
        if (demand.size === 0)
            return "closed";
        if (time < spec.commitCloses)
            return "commit";
        if (time < spec.revealCloses)
            return "reveal";
        return "closed";
    }
    function submitDemand(buyerId, request) {
        if (phase() !== "demand" || !spec.buyers.includes(buyerId))
            return false;
        if (request === null) {
            demand.delete(buyerId);
            events.push({ type: "demand", at: observedTime, buyerId, request: null });
            return true;
        }
        if (typeof request.quantity !== "string" || !positiveDecimal.test(request.quantity)
            || typeof request.budget !== "string" || !/^(0|[1-9][0-9]*)$/.test(request.budget))
            return false;
        const accepted = { quantity: request.quantity, budget: request.budget };
        demand.set(buyerId, accepted);
        events.push({ type: "demand", at: observedTime, buyerId, request: accepted });
        return true;
    }
    function submitCommitment(sellerId, hash) {
        if (phase() !== "commit" || !spec.sellers.includes(sellerId)
            || commitments.has(sellerId) || !digest.test(hash))
            return false;
        commitments.set(sellerId, hash);
        events.push({ type: "commitment", at: observedTime, sellerId, hash });
        return true;
    }
    async function revealBid(sellerId, bid) {
        const commitment = commitments.get(sellerId);
        if (phase() !== "reveal" || !commitment || reveals.has(sellerId) || !validBid(bid))
            return false;
        const submitted = { capacity: bid.capacity, unitPrice: bid.unitPrice, salt: bid.salt };
        const hash = await commitBid(spec.id, sellerId, submitted);
        if (phase() !== "reveal" || reveals.has(sellerId) || hash !== commitment)
            return false;
        reveals.set(sellerId, submitted);
        events.push({ type: "reveal", at: observedTime, sellerId, bid: submitted });
        return true;
    }
    function snapshot() {
        const current = phase();
        const buyers = Array.from(demand, ([buyerId, request]) => ({ buyerId, ...request }));
        const quantity = buyers.reduce((sum, buyer) => sum + BigInt(buyer.quantity), 0n);
        const bids = Array.from(commitments, ([sellerId, commitment]) => {
            const bid = reveals.get(sellerId);
            let rejection = null;
            if (current === "closed") {
                if (!bid)
                    rejection = "missing-reveal";
                else if (!allocate && BigInt(bid.capacity) < quantity)
                    rejection = "insufficient-capacity";
                else if (!allocate && buyers.some((buyer) => BigInt(buyer.quantity) * BigInt(bid.unitPrice) > BigInt(buyer.budget))) {
                    rejection = "buyer-budget";
                }
            }
            return { sellerId, commitment, reveal: bid ? { ...bid } : null, rejection };
        });
        let allocation = null;
        let splitAllocation = null;
        if (current === "closed" && quantity > 0n) {
            const eligible = bids.flatMap(({ sellerId, reveal, rejection }) => reveal && !rejection ? [{ sellerId, unitPrice: reveal.unitPrice, capacity: reveal.capacity }] : []);
            if (allocate && eligible.length) {
                const lines = allocate(structuredClone(buyers), structuredClone(eligible));
                if (lines !== null)
                    splitAllocation = validateSplit(buyers, eligible, lines);
            }
            const winnerId = eligible.length && selectWinner ? selectWinner(structuredClone(eligible)) : null;
            if (winnerId !== null) {
                const winner = eligible.find(({ sellerId }) => sellerId === winnerId);
                if (!winner)
                    throw new Error("Mechanism selected an ineligible seller");
                const unitPrice = BigInt(winner.unitPrice);
                allocation = {
                    sellerId: winner.sellerId,
                    unitPrice: unitPrice.toString(),
                    total: (unitPrice * quantity).toString(),
                    shares: buyers.map(({ buyerId, quantity }) => ({
                        buyerId, quantity, amount: (BigInt(quantity) * unitPrice).toString(),
                    })),
                };
            }
        }
        return {
            spec: structuredClone(spec),
            phase: current,
            buyers,
            quantity: quantity.toString(),
            bids,
            allocation,
            ...(allocate ? { splitAllocation } : {}),
        };
    }
    function transcript() {
        phase();
        return structuredClone({ version: 1, spec, events, observedAt: observedTime });
    }
    return { submitDemand, submitCommitment, revealBid, snapshot, transcript };
}
