import {
  BRANCH_LAYER_ADJUSTMENTS,
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
  presetLabel: document.querySelector("#tree-preset-label"),
  debugPanel: document.querySelector("#tree-debug-panel"),
  debugGrid: document.querySelector("#tree-debug-grid")
};

const engine = createTreeEngine({ elements });

init().catch((error) => {
  console.error("[tree] failed to initialize", error);
});

async function init() {
  const params = new URLSearchParams(window.location.search);
  const debugMode = params.get("debug") === "1";

  await engine.init({
    presetName: params.get("preset"),
    debugMode
  });

  if (debugMode) {
    renderDebugPanel();
  }
}

function renderDebugPanel() {
  elements.debugPanel.hidden = false;
  const { state } = engine;
  const stages = state.config.stages || [];

  elements.debugGrid.innerHTML = `
    ${BRANCH_ORDER.map((key) => {
      const association = state.associations[key];
      return `
        <label>
          <span>${association.shortName}分数</span>
          <input type="number" min="0" step="1" data-score-key="${key}" value="${state.scores[key] || 0}">
        </label>
      `;
    }).join("")}

    ${stages.map((stage) => `
      <label>
        <span>${stage.name}阈值</span>
        <input type="number" min="0" step="1" data-stage-id="${stage.id}" value="${stage.minScore}">
      </label>
    `).join("")}

    <hr class="tree-debug-divider">

    <label>
      <span>对齐阶段</span>
      <select data-align-stage>
        ${stages.map((stage) => `
          <option value="${stage.id}" ${stage.id === state.alignDebug.stage ? "selected" : ""}>
            ${stage.name}
          </option>
        `).join("")}
      </select>
    </label>

    <label>
      <span>对齐枝桠</span>
      <select data-align-branch>
        ${BRANCH_ORDER.map((key) => {
          const association = state.associations[key];
          return `
            <option value="${key}" ${key === state.alignDebug.branch ? "selected" : ""}>
              ${association.shortName}
            </option>
          `;
        }).join("")}
      </select>
    </label>

    <label>
      <span>枝桠密度</span>
      <select data-align-density>
        <option value="medium" ${state.alignDebug.density === "medium" ? "selected" : ""}>适中</option>
        <option value="lush" ${state.alignDebug.density === "lush" ? "selected" : ""}>茂密</option>
      </select>
    </label>

    <label>
      <span>X 偏移：<strong data-align-value="x">0</strong></span>
      <input type="range" min="-120" max="120" step="1" data-align-control="x">
    </label>

    <label>
      <span>Y 偏移：<strong data-align-value="y">0</strong></span>
      <input type="range" min="-120" max="120" step="1" data-align-control="y">
    </label>

    <label>
      <span>缩放：<strong data-align-value="scale">1</strong></span>
      <input type="range" min="0.75" max="1.25" step="0.001" data-align-control="scale">
    </label>

    <label>
      <span>旋转：<strong data-align-value="rotate">0</strong></span>
      <input type="range" min="-12" max="12" step="0.1" data-align-control="rotate">
    </label>

    <button type="button" data-align-copy>复制当前对齐 JSON</button>
    <pre data-align-output></pre>
  `;

  elements.debugGrid.addEventListener("input", handleDebugInput);
  elements.debugGrid.addEventListener("change", handleDebugChange);
  elements.debugGrid.addEventListener("click", handleDebugClick);

  engine.syncAlignmentControls();
  engine.focusAlignmentLayer();
}

function handleDebugInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;

  const { state } = engine;
  const scoreKey = input.dataset.scoreKey;
  const stageId = input.dataset.stageId;
  const alignControl = input.dataset.alignControl;

  if (scoreKey) {
    state.scores[scoreKey] = Math.max(0, Number(input.value) || 0);
    state.forcedStageId = null;
    engine.renderAll("调试中");
    engine.focusAlignmentLayer();
    return;
  }

  if (stageId) {
    const stage = state.config.stages.find((item) => item.id === stageId);
    if (stage) {
      stage.minScore = Math.max(0, Number(input.value) || 0);
      state.config.stages.sort((a, b) => a.minScore - b.minScore);
    }

    state.forcedStageId = null;
    engine.renderAll("调试中");
    engine.focusAlignmentLayer();
    return;
  }

  if (alignControl) {
    engine.updateCurrentAlignmentValue(alignControl, Number(input.value));
  }
}

function handleDebugChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLSelectElement)) return;

  const { state } = engine;

  if (input.dataset.alignStage !== undefined) {
    state.alignDebug.stage = input.value;
  }

  if (input.dataset.alignBranch !== undefined) {
    state.alignDebug.branch = input.value;
  }

  if (input.dataset.alignDensity !== undefined) {
    state.alignDebug.density = input.value;
  }

  engine.syncAlignmentControls();
  engine.focusAlignmentLayer();
}

async function handleDebugClick(event) {
  const button = event.target;
  if (!(button instanceof HTMLButtonElement)) return;
  if (button.dataset.alignCopy === undefined) return;

  const json = JSON.stringify(BRANCH_LAYER_ADJUSTMENTS, null, 2);
  const output = elements.debugGrid.querySelector("[data-align-output]");
  if (output) output.textContent = json;

  try {
    await navigator.clipboard.writeText(json);
    button.textContent = "已复制";
    setTimeout(() => {
      button.textContent = "复制当前对齐 JSON";
    }, 1200);
  } catch {
    button.textContent = "复制失败，手动复制下方 JSON";
  }
}
