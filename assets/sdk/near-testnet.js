export const NATIVE_TESTNET_NEAR = "near:testnet:native";
export const nearTransactionHash = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const testnetAccount = /^(?:[a-z0-9]+(?:[-_][a-z0-9]+)*\.)+testnet$/;
export function nearTestnetTransport(sign, rpcUrl = "https://rpc.testnet.near.org") {
    async function rpc(method, params) {
        const request = JSON.stringify({ jsonrpc: "2.0", id: "swarmkit", method, params });
        async function send() {
            return fetch(rpcUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(12_000),
                body: request,
            });
        }
        let response = await send();
        for (const delay of [2000, 4000, 8000]) {
            if (response.status !== 429)
                break;
            await response.body?.cancel();
            await new Promise((resolve) => setTimeout(resolve, delay));
            response = await send();
        }
        if (!response.ok)
            throw new Error(`NEAR testnet RPC HTTP ${response.status}`);
        return await response.json();
    }
    return {
        scope: "near:testnet",
        asset: NATIVE_TESTNET_NEAR,
        async prepare(payment) {
            if (![payment.buyerId, payment.sellerId].every((id) => id.length <= 64 && testnetAccount.test(id))
                || BigInt(payment.amount) > (1n << 128n) - 1n) {
                throw new Error("Expected named testnet accounts and a valid yoctoNEAR amount");
            }
            return sign(payment);
        },
        async broadcast(signed) {
            const response = await rpc("send_tx", { signed_tx_base64: signed.bytes, wait_until: "NONE" });
            if (response.error || !response.result)
                throw new Error("NEAR testnet broadcast response was inconclusive");
        },
        async inspect(payment, hash) {
            if (!nearTransactionHash.test(hash))
                throw new Error("Invalid NEAR transaction hash");
            const response = await rpc("tx", {
                tx_hash: hash, sender_account_id: payment.buyerId, wait_until: "NONE",
            });
            if (response.error?.cause?.name === "UNKNOWN_TRANSACTION")
                return "pending";
            if (!response.result || response.error)
                throw new Error("Could not reconcile NEAR transaction");
            if (response.result.final_execution_status !== "FINAL")
                return "pending";
            const { transaction, status } = response.result;
            if (transaction?.hash !== hash || transaction.signer_id !== payment.buyerId
                || transaction.receiver_id !== payment.sellerId || transaction.actions?.length !== 1
                || transaction.actions[0].Transfer?.deposit !== payment.amount) {
                throw new Error("Finalized NEAR transaction differs from the payment");
            }
            if (status?.Failure !== undefined)
                return "failed";
            if (typeof status?.SuccessValue === "string")
                return "confirmed";
            throw new Error("Finalized NEAR transaction has no execution outcome");
        },
    };
}
