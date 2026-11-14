import { createRound } from "./round.js";
import { createSettlementPlan } from "./settlement.js";
async function restore(input, nextTime, mechanism) {
    const transcript = structuredClone(input);
    if (transcript.version !== 1 || !Number.isFinite(transcript.observedAt)
        || !Array.isArray(transcript.events)) {
        throw new Error("Invalid round transcript");
    }
    let replayTime = -Infinity;
    let replaying = true;
    const round = createRound(transcript.spec, () => replaying || !nextTime ? replayTime : nextTime(), mechanism);
    async function apply(event) {
        switch (event.type) {
            case "demand":
                return (event.request === null || typeof event.request === "object")
                    && round.submitDemand(event.buyerId, event.request);
            case "commitment":
                return typeof event.hash === "string" && round.submitCommitment(event.sellerId, event.hash);
            case "reveal":
                return Boolean(event.bid && typeof event.bid === "object")
                    && round.revealBid(event.sellerId, event.bid);
            default:
                return false;
        }
    }
    for (const [index, event] of transcript.events.entries()) {
        if (!event || !Number.isFinite(event.at) || event.at < replayTime || event.at > transcript.observedAt) {
            throw new Error(`Invalid event time at index ${index}`);
        }
        replayTime = event.at;
        if (!await apply(event))
            throw new Error(`Rejected round event at index ${index}`);
    }
    replayTime = transcript.observedAt;
    const snapshot = round.snapshot();
    replaying = false;
    return { round, snapshot };
}
export async function resumeRound(transcript, clock = Date.now, mechanism) {
    return (await restore(transcript, clock, mechanism)).round;
}
export async function replayRound(transcript, mechanism) {
    return (await restore(transcript, undefined, mechanism)).snapshot;
}
export async function settlementPlanFromTranscript(transcript, mechanism) {
    return createSettlementPlan(await replayRound(transcript, mechanism));
}
export async function openStoredRound(spec, store, clock = Date.now, mechanism) {
    const round = createRound(spec, clock, mechanism);
    const initial = round.transcript();
    if (!await store.compareAndSet(initial, null))
        throw new Error("Round already exists");
    return initial;
}
export async function submitStoredRoundEvent(roundId, event, store, clock = Date.now, mechanism) {
    const command = structuredClone(event);
    const prior = await store.read(roundId);
    if (!prior || prior.spec.id !== roundId)
        throw new Error("Round not found");
    const round = await resumeRound(prior, clock, mechanism);
    let accepted;
    switch (command.type) {
        case "demand":
            accepted = round.submitDemand(command.buyerId, command.request);
            break;
        case "commitment":
            accepted = round.submitCommitment(command.sellerId, command.hash);
            break;
        case "reveal":
            accepted = await round.revealBid(command.sellerId, command.bid);
            break;
        default:
            throw new Error("Unknown round command");
    }
    if (!accepted)
        return { status: "rejected" };
    const transcript = round.transcript();
    if (!await store.compareAndSet(transcript, prior.events.length)) {
        return { status: "conflict" };
    }
    return { status: "accepted", transcript };
}
