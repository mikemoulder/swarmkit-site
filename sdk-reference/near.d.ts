import type { Payment, SettlementPlan } from "./settlement.ts";
export declare const INTENTS_VERIFIER = "intents.near";
export declare function planNearSubaccounts(parentId: string, agents: readonly {
    label: string;
    publicKey: string;
    fundingYoctoNear: string;
}[]): {
    signerId: string;
    receiverId: string;
    actions: readonly [{
        readonly type: "CreateAccount";
    }, {
        readonly type: "Transfer";
        readonly deposit: string;
    }, {
        readonly type: "AddFullAccessKey";
        readonly publicKey: string;
    }];
}[];
export type NearIntentSigningRequest = Readonly<{
    payment: Readonly<Payment>;
    recipient: typeof INTENTS_VERIFIER;
    message: string;
    nonce: string;
}>;
type IntentSignature = {
    publicKey: string;
    signature: string;
};
type SignedIntent = {
    standard: "nep413";
    payload: Pick<NearIntentSigningRequest, "recipient" | "message" | "nonce">;
    public_key: string;
    signature: string;
};
export declare function prepareNearIntentsTransfers(plan: SettlementPlan, options: {
    salt: string;
    deadline: Date;
}): NearIntentSigningRequest[];
export declare function signNearIntentsTransfers(requests: readonly NearIntentSigningRequest[], sign: (request: NearIntentSigningRequest) => Promise<IntentSignature>): Promise<{
    signed: SignedIntent[];
}>;
export declare function nearIntentsExecutionCall(args: Awaited<ReturnType<typeof signNearIntentsTransfers>>): {
    readonly network: "mainnet";
    readonly receiverId: "intents.near";
    readonly methodName: "execute_intents";
    readonly args: {
        signed: SignedIntent[];
    };
    readonly attachedDepositYoctoNear: "0";
};
export declare function readNearIntentsSalt(rpcUrl?: string): Promise<string>;
export {};
