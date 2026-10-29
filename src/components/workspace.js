const MOBILE_MAX = 759;
const RAIL_WIDTH = 296;
const RAIL_GAP = 20;

export function observeViewport(notify) {
  const update = () => notify({w: window.innerWidth, h: window.innerHeight});
  update();
  window.addEventListener("resize", update);
  return () => window.removeEventListener("resize", update);
}

// Plot size for a panel: fills the space left under the header on desktop, a fixed height on narrow screens.
export function chartSize(vp, width, {rail = false, reserve, min = 240, mobile = 360} = {}) {
  const narrow = vp.w <= MOBILE_MAX;
  return {
    width: Math.max(260, narrow || !rail ? width : width - RAIL_WIDTH - RAIL_GAP),
    height: narrow ? mobile : Math.max(min, vp.h - reserve)
  };
}

// Accessible tab list that shows one .view-panel at a time. Panels are #panel-<id>; the active id is mirrored in data-view and the URL hash.
export function viewTabs(views, {label = "Chart views", invalidation} = {}) {
  const root = document.querySelector(".workspace");
  const nav = document.createElement("div");
  nav.className = "view-tabs";
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", label);
  const tabs = views.map(({id, label}) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = `tab-${id}`;
    tab.textContent = label;
    tab.dataset.view = id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `panel-${id}`);
    return tab;
  });
  nav.append(...tabs);

  function activate(id, {focus = false, hash = true} = {}) {
    for (const tab of tabs) {
      const on = tab.dataset.view === id;
      tab.setAttribute("aria-selected", on);
      tab.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(`panel-${tab.dataset.view}`);
      panel.hidden = !on;
      if (on && focus) tab.focus();
    }
    root.dataset.view = id;
    if (hash) history.replaceState(null, "", `#${id}`);
  }

  const ac = new AbortController();
  const {signal} = ac;
  nav.addEventListener("click", (e) => {
    const tab = e.target.closest("[role=tab]");
    if (tab) activate(tab.dataset.view);
  }, {signal});
  nav.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = {ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1}[e.key];
    if (next === undefined) return;
    e.preventDefault();
    activate(tabs[(next + tabs.length) % tabs.length].dataset.view, {focus: true});
  }, {signal});
  // In-page buttons such as <button data-goto="trend"> switch views.
  root.addEventListener("click", (e) => {
    const go = e.target.closest("[data-goto]");
    if (go) activate(go.dataset.goto, {focus: true});
  }, {signal});
  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (views.some((v) => v.id === id)) activate(id, {hash: false});
  }, {signal});
  invalidation?.then(() => ac.abort());

  const initial = location.hash.slice(1);
  activate(views.some((v) => v.id === initial) ? initial : views[0].id, {hash: false});
  return nav;
}
