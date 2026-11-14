import type { PaymentReceipt } from "./settlement.ts";
import type { RoundTranscript } from "./round.ts";
import type { ProcurementMechanism } from "./mechanism.ts";
import type { SettlementTransport } from "./execute.ts";
export type ReceiptClaim = PaymentReceipt & {
    transactionHash?: string;
};
export declare function auditSettlement(transcript: RoundTranscript, claims: readonly ReceiptClaim[], options?: {
    mechanism?: ProcurementMechanism;
    verifier?: Pick<SettlementTransport, "asset" | "inspect">;
}): Promise<{
    plan: import("./settlement.ts").SettlementPlan;
    claimedSummary: {
        pending: string;
        confirmed: string;
        failed: string;
        paid: boolean;
    };
    verifiedSummary: {
        pending: string;
        confirmed: string;
        failed: string;
        paid: boolean;
    } | undefined;
    checks: {
        paymentId: string;
        transactionHash: string | undefined;
        claimed: "failed" | "pending" | "confirmed";
        observed: "failed" | "pending" | "confirmed" | undefined;
        matches: boolean | undefined;
    }[];
}>;
