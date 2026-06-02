import { EVENT_TYPES, reportEvent } from "./api/report.js";
import {
  BRANCH_DENSITY_LABELS,
  BRANCH_ORDER,
  createTreeEngine
} from "./treeCore.js";

const elements = {
  svg: document.querySelector("#tree-svg"),
  trunkLayers: document.querySelector("#tree-trunk-layers"),
  updatedAt: document.querySelector("#tree-updated-at"),
  stageName: document.querySelector("#tree-stage-name"),
  totalScore: document.querySelector("#tree-total-score"),
  resonanceBars: document.querySelector("#tree-resonance-bars"),
  archive: document.querySelector("#tree-view-archive")
};

const engine = createTreeEngine({
  elements,
  formatUpdatedAt: (updatedAt) => `最近更新 · ${updatedAt}`,
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

  reportEvent(EVENT_TYPES.H5_ENTER, { page: "h5-tree" });

  window.requestAnimationFrame(() => {
    elements.archive?.classList.add("is-visible");
  });
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
    const density = engine.getBranchDensity(score);
    const trackWidth = score > 0 ? Math.max(6, (score / max) * 100) : 0;
    const isDominant = key === topKey && score > 0;

    return `
      <div class="spectrum-row${isDominant ? " is-dominant" : ""}">
        <span class="spectrum-icon-wrap">
          <img class="spectrum-icon" src="${association.spectrumIcon}" alt="" aria-hidden="true">
        </span>
        <div class="spectrum-body">
          <div class="spectrum-head">
            <span>${association.shortName}</span>
            <strong>${score.toLocaleString("zh-CN")}</strong>
          </div>
          <div class="spectrum-track">
            <span
              class="spectrum-fill${isDominant ? " is-dominant" : ""}"
              style="width: ${trackWidth}%; --accent: ${association.color}"
            ></span>
          </div>
          <small class="tree-view-branch-note">枝桠状态：${BRANCH_DENSITY_LABELS[density]}</small>
        </div>
      </div>
    `;
  }).join("");
}
