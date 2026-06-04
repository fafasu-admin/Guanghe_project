import { EVENT_TYPES, reportEvent } from "./api/report.js";
import {
  BRANCH_ORDER,
  createTreeEngine
} from "./treeCore.js";

const elements = {
  svg: document.querySelector("#tree-svg"),
  trunkLayers: document.querySelector("#tree-trunk-layers"),
  visual: document.querySelector(".tree-view-visual"),
  totalScore: document.querySelector("#tree-total-score"),
  resonanceBars: document.querySelector("#tree-resonance-bars"),
  archive: document.querySelector("#tree-view-archive")
};

const TREE_VIEW_REFERENCE_SIZE = 610;
let resizeFrame = 0;

const engine = createTreeEngine({
  elements,
  svgTitle: "协会共鸣树",
  renderBars: renderUserBars
});

init().catch((error) => {
  console.error("[tree-view] failed to initialize", error);
});

async function init() {
  const params = new URLSearchParams(window.location.search);

  await engine.init({
    presetName: params.get("preset"),
    debugMode: false
  });

  syncTreeViewScale();
  window.addEventListener("resize", scheduleTreeViewScaleSync);

  reportEvent(EVENT_TYPES.H5_ENTER, { page: "h5-tree" });

  window.requestAnimationFrame(() => {
    elements.archive?.classList.add("is-visible");
  });
}

function scheduleTreeViewScaleSync() {
  if (resizeFrame) return;

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = 0;
    syncTreeViewScale();
  });
}

function syncTreeViewScale() {
  if (!elements.visual) return;

  const visualHeight = elements.visual.getBoundingClientRect().height;
  if (!visualHeight) return;

  elements.visual.style.setProperty(
    "--tree-view-scale",
    String(visualHeight / TREE_VIEW_REFERENCE_SIZE)
  );
}

function renderUserBars(state, targetElements) {
  if (!targetElements.resonanceBars) return;

  const max = Math.max(...BRANCH_ORDER.map((key) => state.scores[key] || 0), 1);
  const topKey = BRANCH_ORDER.reduce((leader, key) => {
    return (state.scores[key] || 0) > (state.scores[leader] || 0) ? key : leader;
  }, BRANCH_ORDER[0]);

  targetElements.resonanceBars.innerHTML = BRANCH_ORDER.map((key) => {
    const association = state.associations[key];
    const score = state.scores[key] || 0;
    const trackWidth = score > 0 ? Math.max(6, (score / max) * 100) : 0;
    const isDominant = key === topKey && score > 0;

    return `
      <article class="spectrum-row${isDominant ? " is-dominant" : ""}" style="--accent: ${association.color}">
        <span class="spectrum-icon-wrap">
          <img class="spectrum-icon" src="${association.spectrumIcon}" alt="" aria-hidden="true">
        </span>
        <div class="spectrum-body">
          <div class="spectrum-head">
            <span class="tree-view-association-name">
              <strong>${association.shortName}</strong>
              <small>${association.englishName}</small>
            </span>
            <span class="tree-view-score">
              <small>共鸣值</small>
              <strong>${score.toLocaleString("zh-CN")}</strong>
            </span>
          </div>
          <div class="spectrum-track">
            <span
              class="spectrum-fill${isDominant ? " is-dominant" : ""}"
              style="width: ${trackWidth}%; --accent: ${association.color}"
            ></span>
          </div>
        </div>
      </article>
    `;
  }).join("");
}
