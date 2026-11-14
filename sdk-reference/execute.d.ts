import type { Payment, PaymentReceipt, SettlementPlan } from "./settlement.ts";
export type SignedPayment = {
    hash: string;
    bytes: string;
};
export type SettlementEntry = {
    payment: Payment;
    signed: SignedPayment;
};
export type SettlementJournal = {
    reserve(scope: string, candidate: SettlementEntry): Promise<SettlementEntry>;
    read(scope: string): Promise<SettlementEntry | undefined>;
    bindPlan?(scope: string, fingerprint: string): Promise<boolean>;
};
export type SettlementTransport = {
    scope: string;
    asset: string;
    prepare(payment: Readonly<Payment>): Promise<SignedPayment>;
    broadcast(signed: Readonly<SignedPayment>): Promise<void>;
    inspect(payment: Readonly<Payment>, hash: string): Promise<PaymentReceipt["status"]>;
};
export declare function executeSettlement(input: SettlementPlan, options: {
    transport: SettlementTransport;
    journal: SettlementJournal;
    authorize: (payment: Readonly<Payment>) => boolean | Promise<boolean>;
}): Promise<{
    receipts: (PaymentReceipt & {
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
