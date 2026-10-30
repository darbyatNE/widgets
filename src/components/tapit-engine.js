export const TARGET_TYPES = Object.freeze({
  lightPositive: Object.freeze({value: 1, color: "light-green", label: "light green"}),
  deepPositive: Object.freeze({value: 2, color: "deep-green", label: "deep green"}),
  lightNegative: Object.freeze({value: -1, color: "light-olive", label: "light olive"}),
  deepNegative: Object.freeze({value: -2, color: "deep-olive", label: "deep olive"})
});

const targetTypes = Object.keys(TARGET_TYPES);

export function targetLifetimeMs(round) {
  return 1_250 * 0.93 ** (round - 1);
}

export function createTapItGame({
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  random = Math.random,
  onChange = () => {},
  duration = 20_000,
  countdownDuration = 3_000
} = {}) {
  let phase = "idle";
  let score = 0;
  let round = 1;
  let countdown = 0;
  let startAt = 0;
  let roundDeadline = 0;
  let message = "Five rounds. Tap green for points; olive targets cost points.";
  let generation = 0;
  let disposed = false;
  let roundFinalized = false;
  const timers = new Set();
  const targets = new Map();
  const missed = new Set();
  const roundScores = [];
  const listeners = new Set();

  function snapshot() {
    const elapsed = phase === "playing" ? Math.max(0, now() - startAt) : 0;
    const remainingMs = phase === "playing"
      ? Math.max(0, duration - elapsed)
      : phase === "ended" || phase === "between"
        ? 0
        : duration;
    const completedScore = roundScores.reduce((total, value) => total + value, 0);
    return {
      phase,
      round,
      roundCount: 5,
      score,
      totalScore: completedScore + (roundFinalized ? 0 : score),
      roundScores: [...roundScores],
      partialRound: phase === "ended" && !roundFinalized,
      countdown,
      remainingMs,
      targetLifetime: targetLifetimeMs(round),
      targets: [...targets].map(([tile, target]) => ({tile, type: target.type, value: TARGET_TYPES[target.type].value, deadline: target.deadline})),
      litTiles: [...targets.keys()],
      missedTiles: [...missed],
      message
    };
  }

  function publish() {
    if (disposed) return;
    const state = snapshot();
    onChange(state);
    for (const listener of listeners) listener(state);
  }

  function clearHandle(handle) {
    if (handle === undefined) return;
    clearTimer(handle);
    timers.delete(handle);
  }

  function clearTimers() {
    for (const handle of timers) clearTimer(handle);
    timers.clear();
    targets.clear();
  }

  function schedule(callback, delay, token = generation) {
    let handle;
    handle = setTimer(() => {
      timers.delete(handle);
      if (disposed || token !== generation) return;
      callback();
    }, Math.max(0, delay));
    timers.add(handle);
    return handle;
  }

  function finishRound() {
    if (phase !== "playing") return;
    generation += 1;
    clearTimers();
    roundScores.push(score);
    roundFinalized = true;
    countdown = 0;
    if (round < 5) {
      phase = "between";
      message = `Round ${round} complete.`;
    } else {
      phase = "ended";
      message = "Five rounds complete. That is your final score.";
    }
    publish();
  }

  function markExpired(tile, token) {
    missed.add(tile);
    schedule(() => {
      missed.delete(tile);
      publish();
    }, 240, token);
  }

  function expireTarget(tile, target, token) {
    if (targets.get(tile) !== target) return;
    const remaining = target.deadline - now();
    if (remaining > 0) {
      target.timer = schedule(() => expireTarget(tile, target, token), remaining, token);
      return;
    }
    targets.delete(tile);
    markExpired(tile, token);
    publish();
  }

  function spawnTarget(token) {
    if (phase !== "playing" || token !== generation) return;
    if (now() >= roundDeadline) {
      finishRound();
      return;
    }

    const available = Array.from({length: 40}, (_, tile) => tile).filter((tile) => !targets.has(tile));
    if (available.length) {
      const tileChoice = Math.min(available.length - 1, Math.floor(Math.max(0, random()) * available.length));
      const tile = available[tileChoice];
      const typeChoice = Math.min(targetTypes.length - 1, Math.floor(Math.max(0, random()) * targetTypes.length));
      const type = targetTypes[typeChoice];
      const target = {type, deadline: now() + targetLifetimeMs(round), timer: undefined};
      target.timer = schedule(() => expireTarget(tile, target, token), target.deadline - now(), token);
      targets.set(tile, target);
      missed.delete(tile);
      publish();
    }

    const nextIn = 100 + Math.min(900, Math.floor(Math.max(0, random()) * 901));
    schedule(() => spawnTarget(token), nextIn, token);
  }

  function scheduleClockTick(token) {
    if (phase !== "playing" || token !== generation) return;
    const elapsed = Math.max(0, now() - startAt);
    const untilNextSecond = 1_000 - (elapsed % 1_000);
    schedule(() => {
      if (now() >= roundDeadline) {
        finishRound();
        return;
      }
      publish();
      scheduleClockTick(token);
    }, Math.min(untilNextSecond, Math.max(0, roundDeadline - now())), token);
  }

  function startPlaying(token) {
    if (phase !== "countdown" || token !== generation) return;
    phase = "playing";
    countdown = 0;
    score = 0;
    roundFinalized = false;
    startAt = now();
    roundDeadline = startAt + duration;
    message = `Round ${round} in progress.`;
    schedule(() => finishRound(), duration, token);
    scheduleClockTick(token);
    spawnTarget(token);
    publish();
  }

  function beginCountdown() {
    if (disposed) return;
    generation += 1;
    clearTimers();
    const token = generation;
    phase = "countdown";
    score = 0;
    roundFinalized = false;
    countdown = 3;
    message = `Round ${round}. Get ready.`;
    publish();

    const tickCountdown = () => {
      if (phase !== "countdown" || token !== generation) return;
      if (countdown > 1) {
        countdown -= 1;
        publish();
        schedule(tickCountdown, countdownDuration / 3, token);
      } else {
        startPlaying(token);
      }
    };
    schedule(tickCountdown, countdownDuration / 3, token);
  }

  function start() {
    if (disposed || (phase !== "idle" && phase !== "ended")) return;
    round = 1;
    roundScores.length = 0;
    missed.clear();
    beginCountdown();
  }

  function nextRound() {
    if (disposed || phase !== "between" || round >= 5) return;
    round += 1;
    missed.clear();
    beginCountdown();
  }

  function hit(tile) {
    if (disposed || phase !== "playing") return {kind: "inactive"};
    if (now() >= roundDeadline) {
      finishRound();
      return {kind: "inactive"};
    }
    if (!Number.isInteger(tile) || tile < 0 || tile >= 40) return {kind: "invalid"};

    const target = targets.get(tile);
    if (target !== undefined) {
      clearHandle(target.timer);
      targets.delete(tile);
      if (now() < target.deadline) {
        const {value} = TARGET_TYPES[target.type];
        score += value;
        publish();
        return {kind: "target", type: target.type, value};
      }
      markExpired(tile, generation);
      publish();
      return {kind: "empty", value: 0};
    }
    return {kind: "empty", value: 0};
  }

  function endWhenHidden() {
    if (phase === "between") {
      generation += 1;
      clearTimers();
      phase = "ended";
      countdown = 0;
      roundFinalized = true;
      message = `Session ended because the page became hidden after round ${round}. Completed round scores are final.`;
      publish();
      return;
    }
    if (phase === "playing" || phase === "countdown") {
      generation += 1;
      clearTimers();
      phase = "ended";
      countdown = 0;
      roundFinalized = false;
      message = "Session ended because the page became hidden. The current round is partial.";
      publish();
    }
  }

  function subscribe(listener) {
    if (disposed) return () => {};
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    generation += 1;
    clearTimers();
    listeners.clear();
  }

  return {
    start,
    nextRound,
    hit,
    endWhenHidden,
    subscribe,
    getState: snapshot,
    dispose
  };
}
