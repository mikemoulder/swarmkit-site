import type { SettlementTransport, SignedPayment } from "./execute.ts";
import { nearIntentsExecutionCall, signNearIntentsTransfers } from "./near.ts";
type SigningCallback = Parameters<typeof signNearIntentsTransfers>[1];
type ExecutionCall = ReturnType<typeof nearIntentsExecutionCall>;
export declare function nearIntentsTransport(options: {
    asset: string;
    relayerId: string;
    signIntent: SigningCallback;
    signTransaction: (call: ExecutionCall) => Promise<SignedPayment>;
    rpcUrl?: string;
}): SettlementTransport;
export {};
