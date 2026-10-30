import test from "node:test";
import assert from "node:assert/strict";
import {createTapItAudio} from "../src/components/tapit-audio.js";

class FakeAudioContext {
  state = "suspended";
  currentTime = 0;
  destination = {};
  oscillators = [];
  closed = false;
  stopCalls = 0;

  createOscillator() {
    const audioContext = this;
    const oscillator = {
      frequency: {value: 0},
      listeners: {},
      connect() {},
      disconnect() {},
      start() {},
      stop() { audioContext.stopCalls += 1; },
      addEventListener(name, callback) { this.listeners[name] = callback; }
    };
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain() {
    return {
      gain: {
        setValueAtTime() {},
        exponentialRampToValueAtTime() {}
      },
      connect() {},
      disconnect() {}
    };
  }

  async resume() { this.state = "running"; }
  async close() { this.state = "closed"; this.closed = true; }
}

test("audio prepares on demand, differentiates hit and penalty tones, and mute suppresses tones", async () => {
  const context = new FakeAudioContext();
  const audio = createTapItAudio({contextFactory: () => context});
  assert.equal(await audio.prepare(), true);
  audio.play({kind: "target", value: 1});
  audio.play({kind: "target", value: -2});
  assert.deepEqual(context.oscillators.map(({frequency}) => frequency.value), [660, 92]);
  audio.setEnabled(false);
  audio.play({kind: "empty", value: -1});
  assert.equal(context.oscillators.length, 2);
  audio.dispose();
  await Promise.resolve();
  assert.equal(context.closed, true);
});

test("muting stops tones already playing", async () => {
  const context = new FakeAudioContext();
  const audio = createTapItAudio({contextFactory: () => context});
  await audio.prepare();
  audio.play({kind: "target", value: 1});
  assert.equal(context.stopCalls, 1);
  audio.setEnabled(false);
  assert.equal(context.stopCalls, 2);
  audio.play({kind: "empty", value: -1});
  assert.equal(context.oscillators.length, 1);
  audio.dispose();
});

test("disposing during audio preparation prevents resumed playback or context recreation", async () => {
  const context = new FakeAudioContext();
  let releaseResume;
  context.resume = () => new Promise((resolve) => {
    releaseResume = () => {
      context.state = "running";
      resolve();
    };
  });
  let factoryCalls = 0;
  const audio = createTapItAudio({contextFactory: () => {
    factoryCalls += 1;
    return context;
  }});
  const prepared = audio.prepare();
  audio.dispose();
  releaseResume();
  assert.equal(await prepared, false);
  audio.play({kind: "target", value: 1});
  assert.equal(factoryCalls, 1);
  assert.equal(context.oscillators.length, 0);
  assert.equal(context.closed, true);
});

test("unsupported or failed audio announces a visible fallback and warns explicitly", async () => {
  let unavailableCalls = 0;
  const warnings = [];
  const audio = createTapItAudio({
    contextFactory: () => { throw new Error("blocked"); },
    onUnavailable: () => unavailableCalls += 1,
    logger: {warn: (...args) => warnings.push(args)}
  });
  assert.equal(await audio.prepare(), false);
  audio.play({kind: "empty", value: -1});
  assert.equal(audio.unavailable, true);
  assert.equal(unavailableCalls, 1);
  assert.equal(warnings.length, 1);
});
