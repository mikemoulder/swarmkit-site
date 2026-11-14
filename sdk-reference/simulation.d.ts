import type { Bid, Demand, RoundSpec } from "./types.ts";
import type { Payment, PaymentReceipt } from "./settlement.ts";
import type { ProcurementMechanism } from "./mechanism.ts";
type StrategyContext = {
    resource: Readonly<RoundSpec["resource"]>;
    asset: string;
    random: () => number;
};
export type BuyerStrategy = {
    id: string;
    demand: (context: StrategyContext) => Demand | null | Promise<Demand | null>;
};
export type SellerStrategy = {
    id: string;
    offer: (context: StrategyContext & {
        pooledQuantity: string;
    }) => Omit<Bid, "salt"> | null | Promise<Omit<Bid, "salt"> | null>;
    reveal?: boolean;
};
export type SimulationOptions = {
    spec: Omit<RoundSpec, "buyers" | "sellers">;
    seed: number;
    mechanism?: ProcurementMechanism;
    buyers: readonly BuyerStrategy[];
    sellers: readonly SellerStrategy[];
    paymentOutcome?: (payment: Readonly<Payment>) => PaymentReceipt["status"];
};
export declare function simulateProcurement(options: SimulationOptions): Promise<{
    mode: "simulation";
    transcript: import("./round.ts").RoundTranscript;
    stages: readonly [{
        splitAllocation?: import("./mechanism.ts").SplitAllocation | null | undefined;
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
        allocation: import("./types.ts").Allocation | null;
    }, {
        splitAllocation?: import("./mechanism.ts").SplitAllocation | null | undefined;
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
        allocation: import("./types.ts").Allocation | null;
    }, {
        splitAllocation?: import("./mechanism.ts").SplitAllocation | null | undefined;
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
        allocation: import("./types.ts").Allocation | null;
    }, {
        splitAllocation?: import("./mechanism.ts").SplitAllocation | null | undefined;
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
        allocation: import("./types.ts").Allocation | null;
    }];
    plan: import("./settlement.ts").SettlementPlan;
    settlement: {
        pending: string;
        confirmed: string;
        failed: string;
        paid: boolean;
    };
    payments: {
        buyerId: string;
        amount: string;
        status: "failed" | "pending" | "simulated";
    }[];
}>;
export {};
