function comparePrice(a, b) {
    const difference = BigInt(a.unitPrice) - BigInt(b.unitPrice);
    return difference < 0n ? -1 : difference > 0n ? 1 : a.sellerId < b.sellerId ? -1 : Number(a.sellerId !== b.sellerId);
}
export const cheapestCapacity = Object.freeze({
    id: "cheapest-capacity-v1",
    allocate(buyers, offers) {
        const inventory = [...offers].sort(comparePrice).map((offer) => ({ ...offer, left: BigInt(offer.capacity) }));
        const ordered = [...buyers].sort((a, b) => {
            const difference = BigInt(a.budget) * BigInt(b.quantity) - BigInt(b.budget) * BigInt(a.quantity);
            return difference < 0n ? -1 : difference > 0n ? 1 : a.buyerId < b.buyerId ? -1 : 1;
        });
        const lines = [];
        for (const buyer of ordered) {
            let remaining = BigInt(buyer.quantity);
            let spent = 0n;
            for (const seller of inventory) {
                const quantity = seller.left < remaining ? seller.left : remaining;
                if (!quantity)
                    continue;
                lines.push({ buyerId: buyer.buyerId, sellerId: seller.sellerId, quantity: String(quantity) });
                seller.left -= quantity;
                remaining -= quantity;
                spent += quantity * BigInt(seller.unitPrice);
                if (!remaining)
                    break;
            }
            if (remaining || spent > BigInt(buyer.budget))
                return null;
        }
        return lines;
    },
});
export function validateSplit(buyers, offers, lines) {
    const demand = new Map(buyers.map((buyer) => [buyer.buyerId, { ...buyer, filled: 0n, spent: 0n }]));
    const supply = new Map(offers.map((offer) => [offer.sellerId, { ...offer, used: 0n }]));
    const pairs = new Set();
    let total = 0n;
    const priced = lines.map(({ buyerId, sellerId, quantity }) => {
        const buyer = demand.get(buyerId);
        const seller = supply.get(sellerId);
        const pair = JSON.stringify([buyerId, sellerId]);
        if (!buyer || !seller || pairs.has(pair) || typeof quantity !== "string" || !/^[1-9][0-9]*$/.test(quantity)) {
            throw new Error("Invalid split fulfillment line");
        }
        pairs.add(pair);
        const units = BigInt(quantity);
        const amount = units * BigInt(seller.unitPrice);
        buyer.filled += units;
        buyer.spent += amount;
        seller.used += units;
        if (buyer.filled > BigInt(buyer.quantity) || buyer.spent > BigInt(buyer.budget)
            || seller.used > BigInt(seller.capacity))
            throw new Error("Split fulfillment exceeds demand, budget or capacity");
        total += amount;
        return { buyerId, sellerId, quantity, unitPrice: seller.unitPrice, amount: String(amount) };
    });
    if ([...demand.values()].some((buyer) => buyer.filled !== BigInt(buyer.quantity))) {
        throw new Error("Split fulfillment must fill every buyer");
    }
    return { lines: priced, total: String(total) };
}
export const lowestPrice = Object.freeze({
    id: "lowest-price-v1",
    selectWinner(offers) {
        const ordered = [...offers].sort((a, b) => {
            const difference = BigInt(a.unitPrice) - BigInt(b.unitPrice);
            return difference < 0n ? -1 : difference > 0n ? 1 : a.sellerId < b.sellerId ? -1 : 1;
        });
        return ordered[0]?.sellerId ?? null;
    },
});
