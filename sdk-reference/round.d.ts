import type { Allocation, Bid, Demand, RoundSpec } from "./types.ts";
import type { ProcurementMechanism, SplitAllocation } from "./mechanism.ts";
export type { Allocation, Bid, Demand, RoundSpec } from "./types.ts";
export type RoundCommand = {
    type: "demand";
    buyerId: string;
    request: Demand | null;
} | {
    type: "commitment";
    sellerId: string;
    hash: string;
} | {
    type: "reveal";
    sellerId: string;
    bid: Bid;
};
export type RoundEvent = RoundCommand & {
    at: number;
};
export type RoundTranscript = {
    version: 1;
    spec: RoundSpec;
    events: readonly RoundEvent[];
    observedAt: number;
};
export declare function commitBid(roundId: string, sellerId: string, bid: Bid): Promise<string>;
export declare function createRound(input: RoundSpec, clock?: () => number, mechanism?: ProcurementMechanism): {
    submitDemand: (buyerId: string, request: Demand | null) => boolean;
    submitCommitment: (sellerId: string, hash: string) => boolean;
    revealBid: (sellerId: string, bid: Bid) => Promise<boolean>;
    snapshot: () => {
        splitAllocation?: SplitAllocation | null | undefined;
        spec: RoundSpec;
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
        allocation: Allocation | null;
    };
    transcript: () => RoundTranscript;
};
export type RoundSnapshot = ReturnType<ReturnType<typeof createRound>["snapshot"]>;
