import type { RoundSnapshot } from "./round.ts";
export type Payment = {
    id: string;
    buyerId: string;
    sellerId: string;
    amount: string;
};
export type SettlementPlan = {
    version: 1 | 2;
    roundId: string;
    asset: string;
    payments: readonly Payment[];
};
export declare function paymentIdFor(version: SettlementPlan["version"], roundId: string, buyerId: string, sellerId: string): string;
export type PaymentReceipt = {
    paymentId: string;
    status: "pending" | "confirmed" | "failed";
};
export declare function createSettlementPlan(round: RoundSnapshot): SettlementPlan;
export declare function summarizeSettlement(plan: SettlementPlan, receipts: readonly PaymentReceipt[]): {
    pending: string;
    confirmed: string;
    failed: string;
    paid: boolean;
};
