import {createTapItGame} from "./tapit-engine.js";

const formatTime = (milliseconds) => String(Math.ceil(milliseconds / 1_000)).padStart(2, "0");

export function mountTapIt(root, {invalidation} = {}) {
  if (!root) throw new Error("TapIt root element was not found.");

  root.innerHTML = `
    <header class="tapit-header">
      <a class="tapit-home" href="./" aria-label="Back to Darby's Widgets">
        <span class="tapit-home-arrow" aria-hidden="true">←</span>
        <span>Darby's Widgets</span>
      </a>
      <h1>Tap<span>It</span></h1>
      <span class="tapit-edition">REACTION / 001</span>
    </header>

    <section class="tapit-scoreboard" aria-label="Round score and time">
      <div class="tapit-stat">
        <span class="tapit-stat-label">SCORE</span>
        <strong data-score aria-live="polite">00</strong>
      </div>
      <p class="tapit-status" data-phase>READY</p>
      <div class="tapit-stat tapit-stat-time">
        <span class="tapit-stat-label">TIME</span>
        <strong data-time aria-live="off">20</strong>
      </div>
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
            <span class="tapit-overlay-kicker" data-overlay-label>REACTION TEST</span>
            <strong data-overlay-title>Ready?</strong>
            <p data-overlay-copy>Tap lit squares. Avoid the dark ones.</p>
            <button type="button" class="tapit-action" data-action>Start round</button>
          </div>
        </div>
      </div>

      <aside class="tapit-side-note tapit-side-right" aria-hidden="true">
        <span class="tapit-meter"><i></i><i></i><i></i><i></i><i></i></span>
        <span class="tapit-side-rule"></span>
        <span>20 SECONDS<br>ONE TARGET<br>AT A TIME?<br>NOT ALWAYS.</span>
      </aside>
    </section>

    <footer class="tapit-footer">
      <span>Tap the lime. Leave the dark.</span>
      <span class="tapit-footer-detail">Missed targets are free <b>·</b> unlit taps −1</span>
      <span class="tapit-rotate-note">Short screen? Rotate to portrait for larger targets. Keyboard play is available.</span>
    </footer>
  `;

  const scoreValue = root.querySelector("[data-score]");
  const timeValue = root.querySelector("[data-time]");
  const phaseLabel = root.querySelector("[data-phase]");
  const overlayTitle = root.querySelector("[data-overlay-title]");
  const overlayCopy = root.querySelector("[data-overlay-copy]");
  const overlay = root.querySelector("[data-overlay]");
  const action = root.querySelector("[data-action]");
  const gridSpace = root.querySelector("[data-grid-space]");
  const grid = root.querySelector("[data-grid]");
  const board = root.querySelector("[data-board]");

  if (![scoreValue, timeValue, phaseLabel, overlayTitle, overlayCopy, overlay, action, gridSpace, grid, board].every(Boolean)) {
    throw new Error("TapIt could not find all required page elements.");
  }

  const buttons = Array.from({length: 40}, (_, index) => {
    const button = document.createElement("button");
    button.className = "tapit-tile";
    button.type = "button";
    button.dataset.tile = String(index);
    button.setAttribute("aria-label", `Square ${index + 1}, not lit`);
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => game.hit(index));
    grid.append(button);
    return button;
  });

  const game = createTapItGame();
  let disposed = false;
  let observer;
  let animationFrame = 0;

  function render(state) {
    if (disposed) return;
    scoreValue.textContent = String(state.score).padStart(2, "0");
    timeValue.textContent = formatTime(state.remainingMs);
    timeValue.setAttribute("aria-label", `${Math.ceil(state.remainingMs / 1_000)} seconds remaining`);
    phaseLabel.textContent = state.phase === "playing"
      ? "LIVE ROUND"
      : state.phase === "countdown"
        ? "GET READY"
        : state.phase === "ended"
          ? "ROUND COMPLETE"
          : "READY";

    const active = new Set(state.litTiles);
    const expired = new Set(state.missedTiles);
    buttons.forEach((button, index) => {
      const lit = active.has(index);
      button.classList.toggle("is-lit", lit);
      button.classList.toggle("is-missed", !lit && expired.has(index));
      button.setAttribute("aria-pressed", String(lit));
      button.setAttribute("aria-label", `Square ${index + 1}, ${lit ? "lit target" : expired.has(index) ? "just missed" : "not lit"}`);
      button.disabled = state.phase !== "playing";
    });

    const isPlaying = state.phase === "playing";
    overlay.hidden = isPlaying;
    action.textContent = state.phase === "ended" ? "Play again" : "Start round";
    action.disabled = state.phase === "countdown";

    if (state.phase === "countdown") {
      root.querySelector("[data-overlay-label]").textContent = "GET READY";
      overlayTitle.textContent = String(state.countdown);
      overlayCopy.textContent = "Get ready";
    } else if (state.phase === "ended") {
      root.querySelector("[data-overlay-label]").textContent = "ROUND COMPLETE";
      overlayTitle.textContent = `Final score ${state.score}`;
      overlayCopy.textContent = state.message;
    } else if (state.phase === "idle") {
      root.querySelector("[data-overlay-label]").textContent = "REACTION TEST";
      overlayTitle.textContent = "Ready?";
      overlayCopy.textContent = "Tap lit squares. Avoid the dark ones.";
    }
  }

  function measureBoard() {
    if (disposed) return;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      animationFrame = 0;
      if (disposed) return;
      const space = gridSpace.getBoundingClientRect();
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
      const tile = Math.max(0, Math.floor(Math.min(
        76,
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

  action.addEventListener("click", game.start);
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
    grid.replaceChildren();
    action.removeEventListener("click", game.start);
  };

  invalidation?.then(cleanup);
  return cleanup;
}
