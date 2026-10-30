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
  let countdown = 0;
  let startAt = 0;
  let message = "Tap every lit square. Unlit taps cost one point; missed targets are free.";
  let generation = 0;
  let disposed = false;
  const timers = new Set();
  const targets = new Map();
  const missed = new Map();
  const listeners = new Set();

  function snapshot() {
    const elapsed = phase === "playing" ? Math.max(0, now() - startAt) : 0;
    const remainingMs = phase === "playing"
      ? Math.max(0, duration - elapsed)
      : phase === "ended"
        ? 0
        : duration;
    return {
      phase,
      score,
      countdown,
      remainingMs,
      litTiles: [...targets.keys()],
      missedTiles: [...missed.keys()],
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
    missed.clear();
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

  function finish(endMessage) {
    if (phase !== "playing" && phase !== "countdown") return;
    generation += 1;
    clearTimers();
    phase = "ended";
    countdown = 0;
    message = endMessage;
    publish();
  }

  function spawnTarget(token) {
    if (phase !== "playing" || token !== generation) return;
    if (now() - startAt >= duration) {
      finish("Time. Your score is final.");
      return;
    }

    const available = Array.from({length: 40}, (_, tile) => tile).filter((tile) => !targets.has(tile));
    if (available.length) {
      const choice = Math.min(available.length - 1, Math.floor(Math.max(0, random()) * available.length));
      const tile = available[choice];
      const target = {deadline: now() + 1_000, timer: undefined};
      target.timer = schedule(() => {
        if (targets.get(tile) !== target) return;
        targets.delete(tile);
        missed.delete(tile);
        const clearMiss = schedule(() => {
          missed.delete(tile);
          publish();
        }, 240, token);
        missed.set(tile, clearMiss);
        publish();
      }, 1_000, token);
      targets.set(tile, target);
      const oldMiss = missed.get(tile);
      if (oldMiss !== undefined) {
        clearHandle(oldMiss);
        missed.delete(tile);
      }
      publish();
    }

    const nextIn = 100 + Math.min(900, Math.floor(Math.max(0, random()) * 901));
    schedule(() => spawnTarget(token), nextIn, token);
  }

  function startPlaying(token) {
    if (phase !== "countdown" || token !== generation) return;
    phase = "playing";
    countdown = 0;
    startAt = now();
    message = "Round in progress.";
    schedule(() => finish("Time. Your score is final."), duration, token);
    scheduleClockTick(token);
    spawnTarget(token);
    publish();
  }

  function scheduleClockTick(token) {
    if (phase !== "playing" || token !== generation) return;
    const elapsed = Math.max(0, now() - startAt);
    const untilNextSecond = 1_000 - (elapsed % 1_000);
    schedule(() => {
      if (now() - startAt >= duration) {
        finish("Time. Your score is final.");
        return;
      }
      publish();
      scheduleClockTick(token);
    }, untilNextSecond, token);
  }

  function start() {
    if (disposed) return;
    generation += 1;
    clearTimers();
    const token = generation;
    phase = "countdown";
    score = 0;
    countdown = 3;
    message = "Get ready.";
    publish();

    const tickCountdown = () => {
      if (phase !== "countdown" || token !== generation) return;
      if (countdown > 1) {
        countdown -= 1;
        publish();
        schedule(tickCountdown, 1_000, token);
      } else {
        startPlaying(token);
      }
    };
    schedule(tickCountdown, countdownDuration / 3, token);
  }

  function hit(tile) {
    if (disposed || phase !== "playing") return false;
    if (now() - startAt >= duration) {
      finish("Time. Your score is final.");
      return false;
    }
    if (!Number.isInteger(tile) || tile < 0 || tile >= 40) return false;

    const target = targets.get(tile);
    if (target !== undefined) {
      clearHandle(target.timer);
      targets.delete(tile);
      if (now() < target.deadline) {
        score += 1;
        publish();
        return true;
      }
    }
    score -= 1;
    publish();
    return false;
  }

  function endWhenHidden() {
    if (phase === "playing" || phase === "countdown") {
      finish("Round ended because the page became hidden. Your score is final.");
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
    hit,
    endWhenHidden,
    subscribe,
    getState: snapshot,
    dispose
  };
}
