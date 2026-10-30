export function createTapItAudio({onUnavailable = () => {}, contextFactory, logger = console} = {}) {
  let context;
  let enabled = true;
  let unavailable = false;
  let disposed = false;
  const activeTones = new Map();

  function reportUnavailable(error) {
    if (unavailable || disposed) return;
    unavailable = true;
    logger.warn("TapIt sound is unavailable; gameplay will continue without audio.", error);
    onUnavailable(error);
  }

  function getContext() {
    if (disposed || unavailable) return undefined;
    if (context) return context;
    try {
      const Factory = contextFactory ?? (() => {
        const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AudioContextClass) throw new Error("Web Audio is not supported by this browser.");
        return new AudioContextClass();
      });
      context = Factory();
      if (!context?.createOscillator || !context?.createGain) {
        throw new Error("The browser returned an incomplete Web Audio context.");
      }
      return context;
    } catch (error) {
      reportUnavailable(error);
      return undefined;
    }
  }

  async function prepare() {
    if (!enabled || disposed) return false;
    const audio = getContext();
    if (!audio) return false;
    try {
      if (audio.state === "suspended") await audio.resume();
      return !disposed && context === audio && audio.state !== "closed";
    } catch (error) {
      reportUnavailable(error);
      return false;
    }
  }

  function play(result) {
    if (disposed || !enabled || !result || result.kind === "inactive" || result.kind === "invalid" || result.kind === "expired") return;
    const audio = getContext();
    if (!audio) return;
    if (audio.state === "suspended") {
      prepare().then((ready) => {
        if (ready && enabled && !disposed && context === audio) play(result);
      });
      return;
    }
    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const positive = result.kind === "target" && result.value > 0;
      oscillator.type = positive ? "sine" : "square";
      oscillator.frequency.value = positive
        ? result.value === 2 ? 880 : 660
        : result.value === -2 ? 92 : 138;
      const now = audio.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(positive ? 0.055 : 0.035, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (positive ? 0.14 : 0.19));
      oscillator.connect(gain);
      gain.connect(audio.destination);
      activeTones.set(oscillator, gain);
      oscillator.start(now);
      oscillator.stop(now + (positive ? 0.15 : 0.2));
      oscillator.addEventListener("ended", () => {
        activeTones.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      }, {once: true});
    } catch (error) {
      reportUnavailable(error);
    }
  }

  function stopActiveTones() {
    const audio = context;
    for (const [oscillator, gain] of activeTones) {
      try {
        if (audio && audio.state !== "closed") oscillator.stop(audio.currentTime);
      } catch {
        // The oscillator may already have reached its scheduled stop time.
      }
      oscillator.disconnect();
      gain.disconnect();
    }
    activeTones.clear();
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) stopActiveTones();
    return enabled;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    enabled = false;
    stopActiveTones();
    if (!context || context.state === "closed") return;
    context.close().catch((error) => logger.warn("TapIt audio context could not be closed cleanly.", error));
    context = undefined;
  }

  return {
    prepare,
    play,
    setEnabled,
    get enabled() { return enabled; },
    get unavailable() { return unavailable; },
    dispose
  };
}
