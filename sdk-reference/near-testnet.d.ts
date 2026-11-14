import type { SettlementTransport, SignedPayment } from "./execute.ts";
import type { Payment } from "./settlement.ts";
export declare const NATIVE_TESTNET_NEAR = "near:testnet:native";
export declare const nearTransactionHash: RegExp;
export declare function nearTestnetTransport(sign: (payment: Readonly<Payment>) => Promise<SignedPayment>, rpcUrl?: string): SettlementTransport;
