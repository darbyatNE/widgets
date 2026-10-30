import test from "node:test";
import assert from "node:assert/strict";
import {createTapItGame, targetLifetimeMs} from "../src/components/tapit-engine.js";

class FakeClock {
  time = 0;
  nextId = 1;
  timers = new Map();

  now = () => this.time;

  setTimer = (callback, delay) => {
    const id = this.nextId++;
    this.timers.set(id, {at: this.time + delay, callback});
    return id;
  };

  clearTimer = (id) => this.timers.delete(id);

  advance(milliseconds) {
    const end = this.time + milliseconds;
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= end)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      const [id, timer] = next;
      this.time = timer.at;
      this.timers.delete(id);
      timer.callback();
    }
    this.time = end;
  }
}

function createHarness({random = () => 0, duration = 20_000, countdownDuration = 3_000} = {}) {
  const clock = new FakeClock();
  const game = createTapItGame({
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    random,
    duration,
    countdownDuration
  });
  return {clock, game};
}

test("countdown shows 3, 2, 1 before round one begins", () => {
  const {clock, game} = createHarness();
  const seen = [];
  game.subscribe((state) => seen.push(`${state.phase}:${state.countdown}`));

  game.start();
  assert.equal(game.getState().round, 1);
  assert.equal(game.getState().countdown, 3);
  clock.advance(999);
  assert.equal(game.getState().countdown, 3);
  clock.advance(1);
  assert.equal(game.getState().countdown, 2);
  clock.advance(1_000);
  assert.equal(game.getState().countdown, 1);
  clock.advance(1_000);
  assert.equal(game.getState().phase, "playing");
  assert.deepEqual(seen.slice(1, 4), ["countdown:3", "countdown:2", "countdown:1"]);
  assert.equal(game.getState().targets.length, 1);
});

test("target lifetime compounds by exactly seven percent per round", () => {
  const expected = [1_250, 1_162.5, 1_081.125, 1_005.44625, 935.0650125];
  expected.forEach((value, index) => assert.ok(Math.abs(targetLifetimeMs(index + 1) - value) < 1e-10));
});

test("each of the four randomly assigned target types applies its signed value", () => {
  const cases = [
    {random: 0, type: "lightPositive", value: 1},
    {random: .26, type: "deepPositive", value: 2},
    {random: .51, type: "lightNegative", value: -1},
    {random: .76, type: "deepNegative", value: -2}
  ];

  for (const {random, type, value} of cases) {
    const {clock, game} = createHarness({random: () => random});
    game.start();
    clock.advance(3_000);
    const [target] = game.getState().targets;
    assert.equal(target.type, type);
    assert.equal(target.value, value);
    assert.deepEqual(game.hit(target.tile), {kind: "target", type, value});
    assert.equal(game.getState().score, value);
    assert.equal(game.getState().totalScore, value);
    assert.equal(game.getState().targets.length, 0);
    game.dispose();
  }
});

test("five completed rounds retain individual and cumulative scores", () => {
  const {clock, game} = createHarness({duration: 200, countdownDuration: 30});
  const lifetimes = [];
  game.start();

  for (let round = 1; round <= 5; round += 1) {
    clock.advance(30);
    const state = game.getState();
    assert.equal(state.phase, "playing");
    assert.equal(state.round, round);
    lifetimes.push(state.targetLifetime);
    const [target] = state.targets;
    assert.equal(game.hit(target.tile).value, 1);
    assert.equal(game.getState().totalScore, round);
    clock.advance(200);
    const after = game.getState();
    assert.equal(after.phase, round === 5 ? "ended" : "between");
    assert.equal(after.score, 1);
    assert.equal(after.totalScore, round);
    assert.deepEqual(after.roundScores, Array.from({length: round}, () => 1));
    if (round < 5) game.nextRound();
  }

  assert.ok(lifetimes.every((value, index) => Math.abs(value - [1_250, 1_162.5, 1_081.125, 1_005.44625, 935.0650125][index]) < 1e-10));
  assert.equal(game.getState().roundScores.length, 5);
  assert.equal(game.getState().totalScore, 5);
  game.dispose();
});

test("target expiry itself is free, but tapping the expired square costs one point", () => {
  for (const typeRandom of [0, .26, .51, .76]) {
    const values = [0, typeRandom, .999];
    const {clock, game} = createHarness({random: () => values.shift() ?? .999});
    game.start();
    clock.advance(3_000);
    const [target] = game.getState().targets;
    clock.advance(1_250);
    assert.equal(game.getState().score, 0);
    assert.equal(game.getState().missedTiles.includes(target.tile), true);
    assert.deepEqual(game.hit(target.tile), {kind: "empty", value: -1});
    assert.equal(game.getState().score, -1);
    assert.equal(game.getState().missedTiles.includes(target.tile), true);
    clock.advance(240);
    assert.equal(game.getState().missedTiles.includes(target.tile), false);
    assert.deepEqual(game.hit(target.tile), {kind: "empty", value: -1});
    assert.equal(game.getState().score, -2);
    game.dispose();
  }
});

test("targets are hittable just before deadline; delayed expiry taps score -1 and cannot award a hit", () => {
  const beforeDeadline = createHarness();
  beforeDeadline.game.start();
  beforeDeadline.clock.advance(3_000);
  beforeDeadline.clock.time += 1_249;
  assert.deepEqual(beforeDeadline.game.hit(0), {kind: "target", type: "lightPositive", value: 1});
  assert.equal(beforeDeadline.game.getState().score, 1);
  beforeDeadline.game.dispose();

  const delayed = createHarness();
  delayed.game.start();
  delayed.clock.advance(3_000);
  const [target] = delayed.game.getState().targets;
  delayed.clock.time += 1_250;
  assert.deepEqual(delayed.game.hit(target.tile), {kind: "empty", value: -1});
  assert.equal(delayed.game.getState().score, -1);
  delayed.game.dispose();
});

test("tap on a target after its deadline scores -1 even if its expiry callback is delayed", () => {
  const {clock, game} = createHarness();
  game.start();
  clock.advance(3_000);
  const [target] = game.getState().targets;
  clock.time += 1_251;
  assert.deepEqual(game.hit(target.tile), {kind: "empty", value: -1});
  assert.equal(game.getState().score, -1);
  game.dispose();
});

test("unlit taps cost one point, while countdown, between-round and ended taps cannot score", () => {
  const {clock, game} = createHarness({duration: 100, countdownDuration: 30});
  game.start();
  assert.deepEqual(game.hit(39), {kind: "inactive"});
  assert.equal(game.getState().score, 0);
  clock.advance(30);
  assert.deepEqual(game.hit(39), {kind: "empty", value: -1});
  assert.equal(game.getState().score, -1);
  clock.advance(100);
  assert.equal(game.getState().phase, "between");
  assert.deepEqual(game.hit(39), {kind: "inactive"});
  assert.equal(game.getState().score, -1);
  game.nextRound();
  clock.advance(30);
  clock.advance(100);
  assert.equal(game.getState().phase, "between");
  for (let round = 3; round <= 5; round += 1) {
    game.nextRound();
    clock.advance(30);
    clock.advance(100);
  }
  assert.equal(game.getState().phase, "ended");
  assert.deepEqual(game.hit(39), {kind: "inactive"});
  assert.equal(game.getState().totalScore, -1);
  game.dispose();
});

test("round deadline wins over delayed timers and rejects a late target hit", () => {
  const {clock, game} = createHarness({duration: 1_000});
  game.start();
  clock.advance(3_000);
  const target = game.getState().targets[0];
  clock.time += 1_000;
  assert.deepEqual(game.hit(target.tile), {kind: "inactive"});
  assert.equal(game.getState().phase, "between");
  assert.equal(game.getState().roundScores[0], 0);
  assert.equal(game.getState().totalScore, 0);
  assert.deepEqual(game.getState().targets, []);
  game.dispose();
});

test("next round only works between rounds; replay resets all scores and invalidates stale timers", () => {
  const {clock, game} = createHarness({duration: 100, countdownDuration: 30});
  game.nextRound();
  assert.equal(game.getState().phase, "idle");
  game.start();
  game.nextRound();
  clock.advance(30);
  game.hit(game.getState().targets[0].tile);
  clock.advance(100);
  assert.equal(game.getState().phase, "between");
  assert.equal(clock.timers.size, 0);
  game.nextRound();
  assert.equal(game.getState().round, 2);
  assert.equal(clock.timers.size, 1);
  clock.advance(30);
  clock.advance(100);
  game.nextRound();
  clock.advance(30);
  clock.advance(100);
  game.nextRound();
  clock.advance(30);
  clock.advance(100);
  game.nextRound();
  clock.advance(30);
  clock.advance(100);
  assert.equal(game.getState().phase, "ended");
  assert.equal(game.getState().totalScore, 1);
  game.start();
  assert.equal(game.getState().phase, "countdown");
  assert.equal(game.getState().round, 1);
  assert.equal(game.getState().score, 0);
  assert.equal(game.getState().totalScore, 0);
  assert.deepEqual(game.getState().roundScores, []);
  assert.equal(clock.timers.size, 1);
  game.dispose();
  assert.equal(clock.timers.size, 0);
});

test("hiding the page ends a partial session without crediting its partial round as complete", () => {
  const {clock, game} = createHarness({duration: 100, countdownDuration: 30});
  game.start();
  clock.advance(30);
  game.hit(game.getState().targets[0].tile);
  clock.advance(100);
  assert.deepEqual(game.getState().roundScores, [1]);
  game.nextRound();
  clock.advance(30);
  game.hit(game.getState().targets[0].tile);
  game.endWhenHidden();
  assert.equal(game.getState().phase, "ended");
  assert.equal(game.getState().roundScores.length, 1);
  assert.equal(game.getState().partialRound, true);
  assert.equal(game.getState().score, 1);
  assert.equal(game.getState().totalScore, 2);
  assert.match(game.getState().message, /partial/);
  assert.deepEqual(game.getState().targets, []);
  game.dispose();
});

test("hiding between rounds ends the session without duplicating a completed round score", () => {
  const {clock, game} = createHarness({duration: 100, countdownDuration: 30});
  game.start();
  clock.advance(30);
  game.hit(game.getState().targets[0].tile);
  clock.advance(100);
  assert.equal(game.getState().phase, "between");
  assert.deepEqual(game.getState().roundScores, [1]);

  game.endWhenHidden();
  assert.equal(game.getState().phase, "ended");
  assert.equal(game.getState().partialRound, false);
  assert.deepEqual(game.getState().roundScores, [1]);
  assert.equal(game.getState().totalScore, 1);
  assert.match(game.getState().message, /completed round scores are final/i);
  game.dispose();
});
