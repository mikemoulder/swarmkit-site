import type { Payment, SettlementPlan } from "./settlement.ts";
import { executeSettlement } from "./execute.ts";
export type SpendingPolicy = {
    roundId: string;
    buyerId: string;
    asset: string;
    transportScope: string;
    sellers: readonly string[];
    maxAmount: string;
    expiresAt: number;
};
export declare function spendingPolicyMessage(policy: SpendingPolicy): Uint8Array<ArrayBuffer>;
export declare function authorizeWithSpendingPolicies(input: SettlementPlan, transportScope: string, approvals: readonly {
    policy: SpendingPolicy;
    signature: Uint8Array;
}[], resolveBuyerKey: (buyerId: string) => Promise<Parameters<typeof globalThis.crypto.subtle.verify>[1] | undefined>, clock?: () => number): Promise<(payment: Readonly<Payment>) => boolean>;
export declare function executeWithSpendingPolicies(input: SettlementPlan, options: Omit<Parameters<typeof executeSettlement>[1], "authorize"> & {
    approvals: Parameters<typeof authorizeWithSpendingPolicies>[2];
    resolveBuyerKey: Parameters<typeof authorizeWithSpendingPolicies>[3];
    clock?: () => number;
}): Promise<{
    receipts: (import("./settlement.ts").PaymentReceipt & {
        transactionHash?: string;
        broadcastUncertain?: true;
    })[];
    summary: {
        pending: string;
        confirmed: string;
        failed: string;
        paid: boolean;
    };
}>;
