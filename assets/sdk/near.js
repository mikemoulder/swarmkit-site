import { paymentIdFor, summarizeSettlement } from "./settlement.js";
export const INTENTS_VERIFIER = "intents.near";
const accountPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const labelPattern = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const publicKeyPattern = /^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const maxAmount = (1n << 128n) - 1n;
function accountId(value) {
    return value.length >= 2 && value.length <= 64 && accountPattern.test(value);
}
function amount(value) {
    return /^[1-9][0-9]{0,38}$/.test(value) && BigInt(value) <= maxAmount;
}
export function planNearSubaccounts(parentId, agents) {
    if (!accountId(parentId) || !/\.(near|testnet)$/.test(parentId)) {
        throw new Error("Expected a named NEAR or testnet parent account");
    }
    const labels = new Set();
    const keys = new Set();
    return agents.map(({ label, publicKey, fundingYoctoNear }) => {
        const child = `${label}.${parentId}`;
        if (!labelPattern.test(label) || !accountId(child) || labels.has(label)) {
            throw new Error(`Invalid or duplicate agent label: ${label}`);
        }
        if (!publicKeyPattern.test(publicKey) || keys.has(publicKey) || !amount(fundingYoctoNear)) {
            throw new Error(`Invalid funding or invalid or reused agent key: ${label}`);
        }
        labels.add(label);
        keys.add(publicKey);
        return {
            signerId: parentId,
            receiverId: child,
            actions: [
                { type: "CreateAccount" },
                { type: "Transfer", deposit: fundingYoctoNear },
                { type: "AddFullAccessKey", publicKey },
            ],
        };
    });
}
export function prepareNearIntentsTransfers(plan, options) {
    summarizeSettlement(plan, []);
    if ((plan.version !== 1 && plan.version !== 2) || !plan.roundId)
        throw new Error("Invalid settlement plan");
    if (!plan.asset.startsWith("nep141:") || !accountId(plan.asset.slice(7))) {
        throw new Error("Expected a Verifier NEP-141 token ID");
    }
    if (!/^[0-9a-fA-F]{8}$/.test(options.salt))
        throw new Error("Expected four bytes of Verifier salt");
    const deadline = options.deadline.toISOString();
    if (options.deadline.getTime() <= Date.now())
        throw new Error("Intent deadline has expired");
    for (const payment of plan.payments) {
        if (!accountId(payment.buyerId) || !accountId(payment.sellerId) || payment.buyerId === payment.sellerId
            || payment.id !== paymentIdFor(plan.version, plan.roundId, payment.buyerId, payment.sellerId)
            || !amount(payment.amount)) {
            throw new Error(`Invalid NEAR payment: ${payment.id}`);
        }
    }
    return plan.payments.map((payment) => {
        const nonce = crypto.getRandomValues(new Uint8Array(32));
        for (let index = 0; index < 4; index++) {
            nonce[index] = Number.parseInt(options.salt.slice(index * 2, index * 2 + 2), 16);
        }
        const message = JSON.stringify({
            signer_id: payment.buyerId,
            deadline,
            intents: [{
                    intent: "transfer",
                    receiver_id: payment.sellerId,
                    tokens: { [plan.asset]: payment.amount },
                    memo: payment.id,
                }],
        });
        return Object.freeze({
            payment: Object.freeze({ ...payment }),
            recipient: INTENTS_VERIFIER,
            nonce: btoa(String.fromCharCode(...nonce)),
            message,
        });
    });
}
export async function signNearIntentsTransfers(requests, sign) {
    const signed = [];
    for (const request of requests) {
        const { recipient, message, nonce } = request;
        const { publicKey, signature } = await sign(request);
        if (!publicKeyPattern.test(publicKey) || !/^ed25519:[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) {
            throw new Error(`Invalid NEP-413 signer response for ${request.payment.buyerId}`);
        }
        signed.push({
            standard: "nep413",
            payload: { recipient, message, nonce },
            public_key: publicKey,
            signature,
        });
    }
    return { signed };
}
export function nearIntentsExecutionCall(args) {
    if (args.signed.length === 0)
        throw new Error("No signed transfers to execute");
    return {
        network: "mainnet",
        receiverId: INTENTS_VERIFIER,
        methodName: "execute_intents",
        args: structuredClone(args),
        attachedDepositYoctoNear: "0",
    };
}
export async function readNearIntentsSalt(rpcUrl = "https://rpc.mainnet.near.org") {
    const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
            jsonrpc: "2.0", id: "swarmkit-intents-salt", method: "query",
            params: {
                request_type: "call_function", finality: "final",
                account_id: INTENTS_VERIFIER, method_name: "current_salt", args_base64: "e30=",
            },
        }),
    });
    if (!response.ok)
        throw new Error(`NEAR RPC returned HTTP ${response.status}`);
    const body = await response.json();
    const bytes = body.result?.result;
    if (!Array.isArray(bytes) || bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
        throw new Error("NEAR RPC did not return Verifier salt bytes");
    }
    const salt = JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes)));
    if (typeof salt !== "string" || !/^[0-9a-f]{8}$/.test(salt)) {
        throw new Error("Unexpected Verifier salt");
    }
    return salt;
}
