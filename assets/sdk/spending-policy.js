import { paymentIdFor, summarizeSettlement } from "./settlement.js";
import { executeSettlement } from "./execute.js";
export function spendingPolicyMessage(policy) {
    if (![policy.roundId, policy.buyerId, policy.asset, policy.transportScope].every((field) => typeof field === "string" && field.length > 0) || !Array.isArray(policy.sellers) || !policy.sellers.length
        || !policy.sellers.every((seller) => typeof seller === "string" && seller.length > 0 && seller !== policy.buyerId)
        || new Set(policy.sellers).size !== policy.sellers.length
        || typeof policy.maxAmount !== "string" || !/^[1-9][0-9]*$/.test(policy.maxAmount)
        || !Number.isSafeInteger(policy.expiresAt) || policy.expiresAt <= 0) {
        throw new Error("Invalid spending policy");
    }
    return new TextEncoder().encode(JSON.stringify([
        "swarmkit-spending-policy-v1", policy.roundId, policy.buyerId, policy.asset,
        policy.transportScope, [...policy.sellers].sort(), policy.maxAmount, policy.expiresAt,
    ]));
}
export async function authorizeWithSpendingPolicies(input, transportScope, approvals, resolveBuyerKey, clock = Date.now) {
    const plan = structuredClone(input);
    summarizeSettlement(plan, []);
    if ((plan.version !== 1 && plan.version !== 2) || !plan.roundId || !transportScope) {
        throw new Error("Invalid spending context");
    }
    const payments = new Map(plan.payments.map((payment) => [payment.id, payment]));
    const totals = new Map();
    const sellersByBuyer = new Map();
    for (const payment of plan.payments) {
        totals.set(payment.buyerId, (totals.get(payment.buyerId) ?? 0n) + BigInt(payment.amount));
        const sellers = sellersByBuyer.get(payment.buyerId) ?? new Set();
        sellers.add(payment.sellerId);
        sellersByBuyer.set(payment.buyerId, sellers);
    }
    const policies = new Map();
    for (const { policy, signature } of structuredClone(approvals)) {
        const message = spendingPolicyMessage(policy);
        if (policy.roundId !== plan.roundId || policy.asset !== plan.asset
            || policy.transportScope !== transportScope || policies.has(policy.buyerId)) {
            throw new Error("Spending policy does not match the plan or is duplicated");
        }
        const key = await resolveBuyerKey(policy.buyerId);
        if (!key || key.type !== "public" || key.algorithm.name !== "Ed25519"
            || !await crypto.subtle.verify("Ed25519", key, new Uint8Array(signature), message)) {
            throw new Error(`Invalid buyer signature: ${policy.buyerId}`);
        }
        policies.set(policy.buyerId, policy);
    }
    let lastTime = -Infinity;
    return (payment) => {
        const time = clock();
        if (!Number.isFinite(time) || time < lastTime)
            throw new Error("Invalid authorization clock");
        lastTime = time;
        const approved = payments.get(payment.id);
        const policy = policies.get(payment.buyerId);
        return !!approved && !!policy && payment.id === paymentIdFor(plan.version, plan.roundId, payment.buyerId, payment.sellerId)
            && approved.buyerId === payment.buyerId && approved.sellerId === payment.sellerId
            && approved.amount === payment.amount && time < policy.expiresAt
            && [...sellersByBuyer.get(payment.buyerId)].every((seller) => policy.sellers.includes(seller))
            && totals.get(payment.buyerId) <= BigInt(policy.maxAmount);
    };
}
export async function executeWithSpendingPolicies(input, options) {
    const plan = structuredClone(input);
    const { transport, journal, approvals, resolveBuyerKey, clock } = options;
    const authorize = await authorizeWithSpendingPolicies(plan, transport.scope, approvals, resolveBuyerKey, clock);
    return executeSettlement(plan, { transport, journal, authorize });
}
