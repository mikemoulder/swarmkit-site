import { INTENTS_VERIFIER, nearIntentsExecutionCall, prepareNearIntentsTransfers, readNearIntentsSalt, signNearIntentsTransfers } from "./near.js";
import { nearTransactionHash } from "./near-testnet.js";
export function nearIntentsTransport(options) {
    const { asset, relayerId, signIntent, signTransaction, rpcUrl = "https://rpc.mainnet.near.org" } = options;
    async function rpc(method, params) {
        const response = await fetch(rpcUrl, {
            method: "POST", headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(12_000),
            body: JSON.stringify({ jsonrpc: "2.0", id: "swarmkit-intents", method, params }),
        });
        if (!response.ok)
            throw new Error(`NEAR mainnet RPC HTTP ${response.status}`);
        return await response.json();
    }
    return {
        scope: "near:mainnet:intents",
        asset,
        async prepare(payment) {
            const [roundId, , sellerId] = JSON.parse(payment.id);
            const salt = await readNearIntentsSalt(rpcUrl);
            const requests = prepareNearIntentsTransfers({ version: sellerId === undefined ? 1 : 2, roundId, asset, payments: [payment] }, { salt, deadline: new Date(Date.now() + 5 * 60_000) });
            const call = nearIntentsExecutionCall(await signNearIntentsTransfers(requests, signIntent));
            const bytes = new TextEncoder().encode(JSON.stringify(call.args));
            const preflight = await rpc("query", {
                request_type: "call_function", finality: "final", account_id: INTENTS_VERIFIER,
                method_name: "simulate_intents", args_base64: btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")),
            });
            if (!preflight.result?.result || preflight.error)
                throw new Error("Verifier preflight failed");
            const simulation = JSON.parse(new TextDecoder().decode(Uint8Array.from(preflight.result.result)));
            if (simulation.invariant_violation != null || simulation.intents_executed?.length !== 1) {
                throw new Error("Verifier did not simulate the approved transfer");
            }
            return signTransaction(call);
        },
        async broadcast(signed) {
            const response = await rpc("send_tx", { signed_tx_base64: signed.bytes, wait_until: "NONE" });
            if (!response.result || response.error)
                throw new Error("NEAR Intents broadcast response was inconclusive");
        },
        async inspect(payment, hash) {
            if (!nearTransactionHash.test(hash))
                throw new Error("Invalid NEAR transaction hash");
            const response = await rpc("tx", { tx_hash: hash, sender_account_id: relayerId, wait_until: "NONE" });
            if (response.error?.cause?.name === "UNKNOWN_TRANSACTION")
                return "pending";
            if (!response.result || response.error)
                throw new Error("Could not reconcile NEAR Intents transaction");
            if (response.result.final_execution_status !== "FINAL")
                return "pending";
            const { transaction, status } = response.result;
            const action = transaction?.actions[0]?.FunctionCall;
            if (transaction?.hash !== hash || transaction.signer_id !== relayerId
                || transaction.receiver_id !== INTENTS_VERIFIER || transaction.actions.length !== 1
                || action?.method_name !== "execute_intents" || action.deposit !== "0") {
                throw new Error("Finalized transaction differs from the Verifier call");
            }
            const args = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(action.args), (byte) => byte.charCodeAt(0))));
            const signed = args.signed?.[0];
            const message = JSON.parse(signed?.payload?.message ?? "{}");
            const transfer = message.intents?.[0];
            if (args.signed?.length !== 1 || signed.standard !== "nep413" || signed.payload.recipient !== INTENTS_VERIFIER
                || message.signer_id !== payment.buyerId || message.intents?.length !== 1 || transfer?.intent !== "transfer"
                || transfer.receiver_id !== payment.sellerId || transfer.memo !== payment.id
                || !transfer.tokens || Object.keys(transfer.tokens).length !== 1 || transfer.tokens[asset] !== payment.amount
                || transfer.notification != null) {
                throw new Error("Finalized Verifier call differs from the payment");
            }
            if (status?.Failure !== undefined)
                return "failed";
            if (typeof status?.SuccessValue === "string")
                return "confirmed";
            throw new Error("Finalized Verifier transaction has no execution outcome");
        },
    };
}
