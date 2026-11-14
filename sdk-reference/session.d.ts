import type { RoundSnapshot, RoundTranscript } from "./round.ts";
import type { Bid } from "./types.ts";
import type { SimulationOptions } from "./simulation.ts";
/** Private simulation checkpoint. Contains unrevealed offers; never publish it. */
export type SimulationSession = {
    version: 1;
    stage: "ready" | "demand" | "commit" | "reveal" | "closed";
    randomState: number;
    transcript: RoundTranscript;
    sealedOffers: {
        sellerId: string;
        bid: Bid;
        reveal: boolean;
    }[];
};
/** Start an empty simulation. No strategies execute until advanceSimulation is called. */
export declare function startSimulation(options: Pick<SimulationOptions, "spec" | "seed" | "buyers" | "sellers" | "mechanism">): SimulationSession;
/** Advance exactly one stage. Persist the returned checkpoint before calling again.
 * Strategies must be side-effect-free: an uncommitted attempt may be retried.
 * The supplied callbacks may be asynchronous; clocks are logical simulation time.
 */
export declare function advanceSimulation(input: SimulationSession, strategies: Pick<SimulationOptions, "buyers" | "sellers" | "mechanism">): Promise<SimulationSession>;
/** Explain the recorded outcome without claiming the heuristic proves infeasibility. */
export declare function explainAllocation(snapshot: RoundSnapshot): {
    outcome: "allocated" | "no-sale";
    reason: string;
    buyers: {
        spent: string;
        remainingBudget: string;
        lines: (import("./mechanism.ts").FulfillmentLine & {
            unitPrice: string;
            amount: string;
        })[];
        quantity: string;
        budget: string;
        buyerId: string;
    }[];
    sellers: {
        sellerId: string;
        reason: string;
        quantity: string;
    }[];
};
