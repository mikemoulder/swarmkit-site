export type EligibleOffer = Readonly<{
    sellerId: string;
    unitPrice: string;
    capacity: string;
}>;
export type FulfillmentLine = {
    buyerId: string;
    sellerId: string;
    quantity: string;
};
export type SplitAllocation = {
    lines: (FulfillmentLine & {
        unitPrice: string;
        amount: string;
    })[];
    total: string;
};
type Buyer = Readonly<{
    buyerId: string;
    quantity: string;
    budget: string;
}>;
export type ProcurementMechanism = Readonly<{
    id: string;
} & ({
    selectWinner: (offers: readonly EligibleOffer[]) => string | null;
} | {
    allocate: (buyers: readonly Buyer[], offers: readonly EligibleOffer[]) => readonly FulfillmentLine[] | null;
})>;
export declare const cheapestCapacity: ProcurementMechanism;
export declare function validateSplit(buyers: readonly Buyer[], offers: readonly EligibleOffer[], lines: readonly FulfillmentLine[]): SplitAllocation;
export declare const lowestPrice: ProcurementMechanism;
export {};
