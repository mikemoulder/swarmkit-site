export type RoundSpec = {
    id: string;
    resource: {
        label: string;
        unit: string;
        deliveryWindow: string;
    };
    asset: string;
    mechanismId?: string;
    buyers: readonly string[];
    sellers: readonly string[];
    demandCloses: number;
    commitCloses: number;
    revealCloses: number;
};
export type Demand = {
    quantity: string;
    budget: string;
};
export type Bid = {
    capacity: string;
    unitPrice: string;
    salt: string;
};
export type Allocation = {
    sellerId: string;
    unitPrice: string;
    total: string;
    shares: {
        buyerId: string;
        quantity: string;
        amount: string;
    }[];
};
