import type { RoundCommand, RoundTranscript } from "./round.ts";
import type { ProcurementMechanism } from "./mechanism.ts";
export declare function resumeRound(transcript: RoundTranscript, clock?: () => number, mechanism?: ProcurementMechanism): Promise<{
    submitDemand: (buyerId: string, request: import("./types.ts").Demand | null) => boolean;
    submitCommitment: (sellerId: string, hash: string) => boolean;
    revealBid: (sellerId: string, bid: import("./types.ts").Bid) => Promise<boolean>;
    snapshot: () => {
        splitAllocation?: import("./mechanism.ts").SplitAllocation | null | undefined;
        spec: import("./types.ts").RoundSpec;
        phase: string;
        buyers: {
            quantity: string;
            budget: string;
            buyerId: string;
        }[];
        quantity: string;
        bids: {
            sellerId: string;
            commitment: string;
            reveal: {
                capacity: string;
                unitPrice: string;
                salt: string;
            } | null;
            rejection: string | null;
        }[];
        allocation: import("./types.ts").Allocation | null;
    };
    transcript: () => RoundTranscript;
}>;
export declare function replayRound(transcript: RoundTranscript, mechanism?: ProcurementMechanism): Promise<{
    splitAllocation?: import("./mechanism.ts").SplitAllocation | null | undefined;
    spec: import("./types.ts").RoundSpec;
    phase: string;
    buyers: {
        quantity: string;
        budget: string;
        buyerId: string;
    }[];
    quantity: string;
    bids: {
        sellerId: string;
        commitment: string;
        reveal: {
            capacity: string;
            unitPrice: string;
            salt: string;
        } | null;
        rejection: string | null;
    }[];
    allocation: import("./types.ts").Allocation | null;
}>;
export declare function settlementPlanFromTranscript(transcript: RoundTranscript, mechanism?: ProcurementMechanism): Promise<import("./settlement.ts").SettlementPlan>;
export type RoundStore = {
    read(roundId: string): Promise<RoundTranscript | undefined>;
    compareAndSet(next: RoundTranscript, expectedRevision: number | null): Promise<boolean>;
};
export declare function openStoredRound(spec: RoundTranscript["spec"], store: RoundStore, clock?: () => number, mechanism?: ProcurementMechanism): Promise<RoundTranscript>;
export declare function submitStoredRoundEvent(roundId: string, event: RoundCommand, store: RoundStore, clock?: () => number, mechanism?: ProcurementMechanism): Promise<{
    readonly status: "rejected";
    readonly transcript?: undefined;
} | {
    readonly status: "conflict";
    readonly transcript?: undefined;
} | {
    readonly status: "accepted";
    readonly transcript: RoundTranscript;
}>;
