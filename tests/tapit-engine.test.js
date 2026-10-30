import test from "node:test";
import assert from "node:assert/strict";
import {createTapItGame} from "../src/components/tapit-engine.js";

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

function createHarness({random = () => 0, duration, countdownDuration} = {}) {
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

test("countdown shows 3, 2, 1 for one second each before the round", () => {
  const {clock, game} = createHarness();
  const seen = [];
  game.subscribe((state) => seen.push(`${state.phase}:${state.countdown}`));

  game.start();
  assert.equal(game.getState().countdown, 3);
  clock.advance(999);
  assert.equal(game.getState().countdown, 3);
  clock.advance(1);
  assert.equal(game.getState().countdown, 2);
  clock.advance(1_000);
  assert.equal(game.getState().countdown, 1);
  clock.advance(999);
  assert.equal(game.getState().phase, "countdown");
  clock.advance(1);
  assert.equal(game.getState().phase, "playing");
  assert.deepEqual(seen.slice(1, 4), ["countdown:3", "countdown:2", "countdown:1"]);
  assert.equal(game.getState().litTiles.length, 1);
});

test("active hits score +1, dark taps score -1, and hits extinguish targets", () => {
  const {clock, game} = createHarness();
  game.start();
  clock.advance(3_000);
  const [target] = game.getState().litTiles;
  assert.equal(game.hit(39), false);
  assert.equal(game.getState().score, -1);
  assert.equal(game.hit(target), true);
  assert.equal(game.getState().score, 0);
  assert.equal(game.getState().litTiles.includes(target), false);
  assert.equal(game.hit(target), false);
  assert.equal(game.getState().score, -1);
});

test("new targets arrive at inclusive random intervals and expire at 1000ms without penalty", () => {
  const values = [0, 0, .5, .999];
  const {clock, game} = createHarness({random: () => values.shift() ?? 0});
  game.start();
  clock.advance(3_000);
  assert.deepEqual(game.getState().litTiles, [0]);
  clock.advance(99);
  assert.equal(game.getState().litTiles.length, 1);
  clock.advance(1);
  assert.deepEqual(game.getState().litTiles, [0, 20]);
  clock.advance(899);
  assert.equal(game.getState().litTiles.length, 2);
  clock.advance(1);
  assert.deepEqual(game.getState().litTiles, [20]);
  assert.equal(game.getState().missedTiles.includes(0), true);
  assert.equal(game.getState().score, 0);
  clock.advance(240);
  assert.equal(game.getState().missedTiles.includes(0), false);
});

test("targets remain hittable just before their deadline when callbacks are delayed", () => {
  const {clock, game} = createHarness();
  game.start();
  clock.advance(3_000);
  clock.time += 999;
  assert.equal(game.hit(0), true);
  assert.equal(game.getState().score, 1);
  assert.deepEqual(game.getState().litTiles, []);
});

for (const delay of [1_000, 1_001]) {
  test(`expired taps cost one point after ${delay}ms even before expiry callbacks run`, () => {
    const {clock, game} = createHarness();
    game.start();
    clock.advance(3_000);
    const [expiryId, expiry] = [...clock.timers].filter(([, timer]) => timer.at === 4_000).at(-1);
    const [spawnId, spawn] = [...clock.timers].find(([, timer]) => timer.at === 3_100);

    clock.time += delay;
    assert.deepEqual(game.getState().litTiles, [0]);
    assert.equal(game.hit(0), false);
    assert.equal(game.getState().phase, "playing");
    assert.equal(game.getState().score, -1);
    assert.deepEqual(game.getState().litTiles, []);
    assert.equal(clock.timers.has(expiryId), false);

    clock.timers.delete(spawnId);
    spawn.callback();
    assert.deepEqual(game.getState().litTiles, [0]);
    expiry.callback();
    assert.deepEqual(game.getState().litTiles, [0]);
    assert.deepEqual(game.getState().missedTiles, []);
    assert.equal(game.hit(0), true);
    assert.equal(game.getState().score, 0);
    game.dispose();
  });
}

test("elapsed time ends exactly at the round deadline and rejects stale hits", () => {
  const {clock, game} = createHarness();
  game.start();
  clock.advance(3_000);
  const target = game.getState().litTiles[0];
  game.hit(39);
  assert.equal(game.getState().score, -1);
  clock.advance(19_999);
  assert.equal(game.getState().phase, "playing");
  clock.advance(1);
  assert.equal(game.getState().phase, "ended");
  assert.equal(game.getState().score, -1);
  assert.equal(game.getState().remainingMs, 0);
  assert.equal(game.hit(target), false);
  assert.equal(game.getState().score, -1);
  assert.deepEqual(game.getState().litTiles, []);
});

test("replay resets score and invalidates the previous round's timers", () => {
  const {clock, game} = createHarness();
  game.start();
  clock.advance(3_000);
  game.hit(39);
  clock.advance(700);
  const oldTimerCount = clock.timers.size;
  assert.ok(oldTimerCount > 1);
  game.start();
  assert.equal(game.getState().phase, "countdown");
  assert.equal(game.getState().score, 0);
  assert.equal(clock.timers.size, 1);
  clock.advance(3_000);
  const roundTarget = game.getState().litTiles[0];
  assert.equal(game.hit(roundTarget), true);
  assert.equal(game.getState().score, 1);
});

test("hiding the page ends a round and disposal clears all scheduled work", () => {
  const {clock, game} = createHarness();
  game.start();
  clock.advance(3_000);
  game.endWhenHidden();
  assert.equal(game.getState().phase, "ended");
  assert.match(game.getState().message, /hidden/);
  assert.deepEqual(game.getState().litTiles, []);

  game.start();
  const before = clock.timers.size;
  assert.ok(before > 0);
  game.dispose();
  assert.equal(clock.timers.size, 0);
  clock.advance(10_000);
  assert.equal(game.getState().phase, "countdown");
});
