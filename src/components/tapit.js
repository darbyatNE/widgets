import {createTapItGame, TARGET_TYPES} from "./tapit-engine.js";
import {createTapItAudio} from "./tapit-audio.js";

const formatTime = (milliseconds) => String(Math.ceil(milliseconds / 1_000)).padStart(2, "0");
const formatScore = (score) => score > 0 ? `+${score}` : String(score);

export function mountTapIt(root, {invalidation} = {}) {
  if (!root) throw new Error("TapIt root element was not found.");

  root.innerHTML = `
    <header class="tapit-header">
      <a class="tapit-home" href="./" aria-label="Back to Darby's Widgets">
        <span class="tapit-home-arrow" aria-hidden="true">←</span>
        <span>Darby's Widgets</span>
      </a>
      <h1>Tap<span>It</span></h1>
      <button type="button" class="tapit-sound" data-sound aria-pressed="true" aria-label="Mute sounds">SOUND&nbsp; ON</button>
    </header>

    <section class="tapit-scoreboard" aria-label="Game scores and time">
      <div class="tapit-stat">
        <span class="tapit-stat-label">ROUND SCORE</span>
        <strong data-score aria-live="polite">0</strong>
      </div>
      <div class="tapit-stat tapit-stat-round">
        <span class="tapit-stat-label">ROUND</span>
        <strong data-round>1<span> / 5</span></strong>
      </div>
      <div class="tapit-stat tapit-stat-total">
        <span class="tapit-stat-label">CUMULATIVE</span>
        <strong data-total-score aria-live="polite">0</strong>
      </div>
      <div class="tapit-stat tapit-stat-time">
        <span class="tapit-stat-label">TIME</span>
        <strong data-time aria-live="off">20</strong>
      </div>
      <p class="tapit-status" data-phase>READY</p>
      <div class="tapit-progress" data-progress aria-label="Round progress"></div>
    </section>

    <section class="tapit-arena" aria-label="TapIt playing field">
      <aside class="tapit-side-note tapit-side-left" aria-hidden="true">
        <span class="tapit-index">FIELD&nbsp; / &nbsp;40</span>
        <span class="tapit-side-rule"></span>
        <span>QUICK<br>HANDS.<br>CLEAR<br>HEAD.</span>
      </aside>

      <div class="tapit-grid-space" data-grid-space>
        <div class="tapit-board" data-board>
          <div class="tapit-grid" data-grid role="group" aria-label="40 square targets"></div>
        </div>
        <div class="tapit-overlay" data-overlay role="status" aria-live="assertive">
          <div class="tapit-overlay-panel">
            <span class="tapit-overlay-kicker" data-overlay-label>FIVE-ROUND REACTION TEST</span>
            <strong data-overlay-title>Ready?</strong>
            <p data-overlay-copy>Green earns points. Olive targets lose points. Expired targets are free; dark squares trigger a miss tone but do not change your score.</p>
            <ol class="tapit-results" data-round-scores hidden></ol>
            <button type="button" class="tapit-action" data-action>Start game</button>
          </div>
        </div>
      </div>

      <aside class="tapit-side-note tapit-side-right" aria-hidden="true">
        <span class="tapit-meter"><i></i><i></i><i></i><i></i><i></i></span>
        <span class="tapit-side-rule"></span>
        <span>FIVE ROUNDS<br>TWENTY SECONDS<br>FASTER TARGETS<br>EACH ROUND</span>
      </aside>
    </section>

    <footer class="tapit-footer">
      <div class="tapit-footer-rules"><span>Green: gain</span><b>·</b><span>olive: lose</span><b>·</b><span>expired: free</span><b>·</b><span>dark: miss, no score</span></div>
      <ul class="tapit-legend" aria-label="Target point values">
        <li><i class="swatch-light-green"></i><span>light green <b>+1</b></span></li>
        <li><i class="swatch-deep-green"></i><span>deep green <b>+2</b></span></li>
        <li><i class="swatch-light-olive"></i><span>light olive <b>−1</b></span></li>
        <li><i class="swatch-deep-olive"></i><span>deep olive <b>−2</b></span></li>
      </ul>
      <span class="tapit-sound-note" data-sound-note hidden role="status"></span>
      <span class="tapit-rotate-note">Portrait gives you larger targets, but landscape works too. Keyboard play is available.</span>
    </footer>
  `;

  const scoreValue = root.querySelector("[data-score]");
  const totalScoreValue = root.querySelector("[data-total-score]");
  const roundValue = root.querySelector("[data-round]");
  const timeValue = root.querySelector("[data-time]");
  const phaseLabel = root.querySelector("[data-phase]");
  const overlayLabel = root.querySelector("[data-overlay-label]");
  const overlayTitle = root.querySelector("[data-overlay-title]");
  const overlayCopy = root.querySelector("[data-overlay-copy]");
  const overlay = root.querySelector("[data-overlay]");
  const results = root.querySelector("[data-round-scores]");
  const action = root.querySelector("[data-action]");
  const soundButton = root.querySelector("[data-sound]");
  const soundNote = root.querySelector("[data-sound-note]");
  const progress = root.querySelector("[data-progress]");
  const gridSpace = root.querySelector("[data-grid-space]");
  const grid = root.querySelector("[data-grid]");
  const board = root.querySelector("[data-board]");

  if (![scoreValue, totalScoreValue, roundValue, timeValue, phaseLabel, overlayLabel, overlayTitle, overlayCopy, overlay, results, action, soundButton, soundNote, progress, gridSpace, grid, board].every(Boolean)) {
    throw new Error("TapIt could not find all required page elements.");
  }

  const game = createTapItGame();
  let disposed = false;
  let observer;
  let animationFrame = 0;
  let audioUnavailable = false;
  const audio = createTapItAudio({
    onUnavailable: () => {
      audioUnavailable = true;
      soundNote.hidden = false;
      soundNote.textContent = "Sound unavailable in this browser; scores are unaffected.";
      soundButton.setAttribute("aria-label", "Sound unavailable");
      soundButton.textContent = "SOUND OFF";
      soundButton.setAttribute("aria-pressed", "false");
    }
  });
  let soundEnabled = true;

  const progressSteps = Array.from({length: 5}, (_, index) => {
    const step = document.createElement("i");
    step.setAttribute("aria-hidden", "true");
    progress.append(step);
    return step;
  });

  const buttons = Array.from({length: 40}, (_, index) => {
    const button = document.createElement("button");
    button.className = "tapit-tile";
    button.type = "button";
    button.dataset.tile = String(index);
    button.setAttribute("aria-label", `Square ${index + 1}, not lit`);
    button.setAttribute("aria-pressed", "false");
    let touchHandled = false;
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") {
        touchHandled = false;
        return;
      }
      touchHandled = true;
      button.focus({preventScroll: true});
      audio.play(game.hit(index));
    });
    button.addEventListener("click", (event) => {
      if (touchHandled && (event.detail > 0 || event.pointerType === "touch")) {
        touchHandled = false;
        return;
      }
      audio.play(game.hit(index));
    });
    grid.append(button);
    return button;
  });

  function render(state) {
    if (disposed) return;
    scoreValue.textContent = formatScore(state.score);
    totalScoreValue.textContent = formatScore(state.totalScore);
    roundValue.innerHTML = `${state.round}<span> / 5</span>`;
    timeValue.textContent = formatTime(state.remainingMs);
    timeValue.setAttribute("aria-label", `${Math.ceil(state.remainingMs / 1_000)} seconds remaining`);
    phaseLabel.textContent = state.phase === "playing"
      ? "LIVE ROUND"
      : state.phase === "countdown"
        ? "GET READY"
        : state.phase === "between"
          ? "ROUND BREAK"
          : state.phase === "ended"
            ? "SESSION COMPLETE"
            : "READY";

    state.roundScores.forEach((_, index) => progressSteps[index]?.classList.add("is-complete"));
    progressSteps.forEach((step, index) => {
      step.classList.toggle("is-current", index === state.round - 1 && state.phase !== "ended");
      step.classList.toggle("is-complete", index < state.roundScores.length);
    });
    progress.setAttribute("aria-label", `${state.roundScores.length} of 5 rounds completed`);

    const active = new Map(state.targets.map((target) => [target.tile, target]));
    const missed = new Set(state.missedTiles);
    buttons.forEach((button, index) => {
      const target = active.get(index);
      const type = target ? TARGET_TYPES[target.type] : undefined;
      button.classList.toggle("is-lit", Boolean(target));
      button.classList.toggle("is-missed", !target && missed.has(index));
      for (const style of ["light-green", "deep-green", "light-olive", "deep-olive"]) button.classList.toggle(`is-${style}`, type?.color === style);
      button.setAttribute("aria-pressed", String(Boolean(target)));
      button.setAttribute("aria-label", `Square ${index + 1}, ${target ? `${formatScore(type.value)} ${type.label} target` : missed.has(index) ? "expired target" : "not lit"}`);
      button.disabled = state.phase !== "playing";
    });

    const isPlaying = state.phase === "playing";
    overlay.hidden = isPlaying;
    action.disabled = state.phase === "countdown";
    results.hidden = true;
    results.replaceChildren();

    if (state.phase === "countdown") {
      overlayLabel.textContent = `ROUND ${state.round} / 5`;
      overlayTitle.textContent = String(state.countdown);
      overlayCopy.textContent = "Get ready.";
      action.textContent = "Starting…";
    } else if (state.phase === "between") {
      overlayLabel.textContent = `ROUND ${state.round} COMPLETE`;
      overlayTitle.textContent = `Round score ${formatScore(state.score)}`;
      overlayCopy.textContent = `Cumulative score ${formatScore(state.totalScore)}. Round ${state.round + 1} targets last ${Math.round(state.targetLifetime * 0.93)} ms.`;
      renderRoundResults(state.roundScores, results);
      action.textContent = "Next round";
    } else if (state.phase === "ended") {
      const partial = state.partialRound;
      const complete = state.roundScores.length === 5;
      overlayLabel.textContent = complete ? "FIVE ROUNDS COMPLETE" : "SESSION ENDED";
      overlayTitle.textContent = complete
        ? `Final total ${formatScore(state.totalScore)}`
        : partial
          ? `Partial score ${formatScore(state.score)}`
          : `Session total ${formatScore(state.totalScore)}`;
      overlayCopy.textContent = complete ? "All five rounds are in. Your round scores:" : state.message;
      renderRoundResults(state.roundScores, results, partial ? {round: state.round, score: state.score} : undefined);
      action.textContent = "Play again";
    } else {
      overlayLabel.textContent = "FIVE-ROUND REACTION TEST";
      overlayTitle.textContent = "Ready?";
      overlayCopy.textContent = "Green earns points. Olive targets lose points. Expired targets are free; dark squares trigger a miss tone but do not change your score.";
      action.textContent = "Start game";
    }
  }

  function renderRoundResults(scores, list, partial) {
    list.hidden = false;
    [...scores, ...(partial ? [partial.score] : [])].forEach((value, index) => {
      const roundNumber = index + 1;
      const item = document.createElement("li");
      item.textContent = `R${roundNumber} ${formatScore(value)}${partial && roundNumber === partial.round ? " · partial" : ""}`;
      list.append(item);
    });
  }

  function measureBoard() {
    if (disposed) return;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      animationFrame = 0;
      if (disposed) return;
      const space = gridSpace.getBoundingClientRect();
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
      const tileLimit = window.matchMedia?.("(max-width: 700px)")?.matches ? Infinity : 76;
      const tile = Math.max(0, Math.floor(Math.min(
        tileLimit,
        (space.width - gap * 3) / 4,
        (space.height - gap * 9) / 10
      )));
      const width = tile * 4 + gap * 3;
      const height = tile * 10 + gap * 9;
      board.style.setProperty("--tapit-tile-size", `${tile}px`);
      board.style.width = `${width}px`;
      board.style.height = `${height}px`;
      grid.style.gridTemplateColumns = `repeat(4, ${tile}px)`;
      grid.style.gridTemplateRows = `repeat(10, ${tile}px)`;
      overlay.style.width = `${Math.min(space.width, Math.max(width, 260))}px`;
      overlay.style.height = `${height}px`;
    });
  }

  function onAction() {
    if (game.getState().phase === "between") game.nextRound();
    else {
      audio.prepare();
      game.start();
    }
  }

  function onSoundToggle() {
    if (audioUnavailable) return;
    soundEnabled = !soundEnabled;
    audio.setEnabled(soundEnabled);
    soundButton.setAttribute("aria-pressed", String(soundEnabled));
    soundButton.setAttribute("aria-label", soundEnabled ? "Mute sounds" : "Enable sounds");
    soundButton.textContent = soundEnabled ? "SOUND  ON" : "SOUND  OFF";
    soundNote.hidden = true;
    if (soundEnabled) audio.prepare();
  }

  action.addEventListener("click", onAction);
  soundButton.addEventListener("click", onSoundToggle);
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") game.endWhenHidden();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", game.endWhenHidden);

  if (typeof ResizeObserver === "function") {
    observer = new ResizeObserver(measureBoard);
    observer.observe(gridSpace);
  }
  window.addEventListener("resize", measureBoard, {passive: true});
  window.visualViewport?.addEventListener("resize", measureBoard, {passive: true});
  measureBoard();
  const unsubscribe = game.subscribe(render);

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    window.removeEventListener("resize", measureBoard);
    window.visualViewport?.removeEventListener("resize", measureBoard);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", game.endWhenHidden);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    unsubscribe();
    game.dispose();
    audio.dispose();
    grid.replaceChildren();
    action.removeEventListener("click", onAction);
    soundButton.removeEventListener("click", onSoundToggle);
  };

  invalidation?.then(cleanup);
  return cleanup;
}
