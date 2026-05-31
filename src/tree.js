const SCORE_WEIGHTS = Object.freeze({
  views: 1,
  likes: 3,
  comments: 5,
  posts: 10
});

const BRANCH_ORDER = ["logic", "sense", "soul", "rules"];

const BRANCH_DENSITY_LABELS = Object.freeze({
  sparse: "稀疏",
  medium: "适中",
  lush: "茂密"
});

const DEFAULT_ALIGNMENT = Object.freeze({
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0
});

const BRANCH_LAYER_ADJUSTMENTS = {
  stage1: {
    logic_medium: { x: 0, y: 0, scale: 1, rotate: 0 },
    logic_lush: { x: 0, y: 0, scale: 1, rotate: 0 },
    sense_medium: { x: 0, y: 0, scale: 1, rotate: 0 },
    sense_lush: { x: 0, y: 0, scale: 1, rotate: 0 },
    soul_medium: { x: 0, y: 0, scale: 1, rotate: 0 },
    soul_lush: { x: 0, y: 0, scale: 1, rotate: 0 },
    rules_medium: { x: 0, y: 0, scale: 1, rotate: 0 },
    rules_lush: { x: 0, y: 0, scale: 1, rotate: 0 }
  },
  stage2: {
    logic_medium: { x: 0, y: 0, scale: 1, rotate: 0 },
    logic_lush: { x: 0, y: 0, scale: 1, rotate: 0 },
    sense_medium: { x: 0, y: 0, scale: 1, rotate: 0 },
    sense_lush: { x: 0, y: 0, scale: 1, rotate: 0 },
    soul_medium: { x: 0, y: 0, scale: 1, rotate: 0 },
    soul_lush: { x: 0, y: 0, scale: 1, rotate: 0 },
    rules_medium: { x: 0, y: 0, scale: 1, rotate: 0 },
    rules_lush: { x: 0, y: 0, scale: 1, rotate: 0 }
  },
  stage3: {
    logic_medium: { x: 0, y: 0, scale: 1, rotate: 0 },
    logic_lush: { x: 0, y: 0, scale: 1, rotate: 0 },
    sense_medium: { x: 0, y: 0, scale: 1, rotate: 0 },
    sense_lush: { x: 0, y: 0, scale: 1, rotate: 0 },
    soul_medium: { x: -24, y: -25, scale: 1, rotate: 0 },
    soul_lush: { x: 0, y: 0, scale: 1, rotate: 0 },
    rules_medium: { x: 23, y: -14, scale: 1, rotate: 0 },
    rules_lush: { x: 24, y: 15, scale: 1.15, rotate: 0 }
  }
};

const PRESETS = Object.freeze({
  empty: {
    logic: 0,
    sense: 4,
    soul: 8,
    rules: 9
  },
  low: {
    logic: 42,
    sense: 68,
    soul: 96,
    rules: 118
  },
  mid: {
    logic: 360,
    sense: 480,
    soul: 620,
    rules: 540
  },
  high: {
    logic: 1200,
    sense: 1550,
    soul: 1820,
    rules: 1460
  },
  stage1: {
    forceStage: "stage1",
    scores: {
      logic: 80,
      sense: 110,
      soul: 140,
      rules: 120
    }
  },
  stage2: {
    forceStage: "stage2",
    scores: {
      logic: 260,
      sense: 310,
      soul: 340,
      rules: 300
    }
  },
  stage3: {
    forceStage: "stage3",
    scores: {
      logic: 620,
      sense: 700,
      soul: 760,
      rules: 680
    }
  }
});

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

const state = {
  associations: {},
  config: null,
  scores: {},
  forcedStageId: null,
  achievedTrunkStageId: null,
  assetFailures: new Set(),
  presetName: null,
  debugMode: false,
  alignDebug: {
    stage: "stage3",
    branch: "rules",
    density: "lush"
  }
};

init().catch((error) => {
  console.error("[tree] failed to initialize", error);
});

async function init() {
  const params = new URLSearchParams(window.location.search);
  state.presetName = params.get("preset");
  state.debugMode = params.get("debug") === "1";

  const [associations, config, data] = await Promise.all([
    fetchJson("data/associations.json"),
    fetchJson("data/tree-config.json"),
    fetchJson("data/tree-mock.json")
  ]);

  state.associations = associations;
  state.config = config;
  state.scores = buildScores(data.associations || {});
  state.achievedTrunkStageId = data.achievedTrunkStage || null;
  state.forcedStageId = resolvePreset(state.presetName);

  await preloadRuntimeAssets(config);
  renderTrunkLayers(config.stages || []);
  renderAll(data.updatedAt || "调试中");

  if (state.debugMode) {
    renderDebugPanel();
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

function calculateBranchScore(stats) {
  return (
    (Number(stats.views) || 0) * SCORE_WEIGHTS.views +
    (Number(stats.likes) || 0) * SCORE_WEIGHTS.likes +
    (Number(stats.comments) || 0) * SCORE_WEIGHTS.comments +
    (Number(stats.posts) || 0) * SCORE_WEIGHTS.posts
  );
}

function buildScores(statsMap) {
  return BRANCH_ORDER.reduce((scores, key) => {
    scores[key] = calculateBranchScore(statsMap[key] || {});
    return scores;
  }, {});
}

function resolvePreset(name) {
  const preset = PRESETS[name];
  if (!preset) {
    elements.presetLabel.textContent = "动态数据";
    return null;
  }

  elements.presetLabel.textContent = `快速测试：${name}`;

  const presetScores = preset.scores || preset;
  BRANCH_ORDER.forEach((key) => {
    state.scores[key] = presetScores[key] ?? state.scores[key] ?? 0;
  });

  return preset.forceStage || null;
}

function getBranchDensity(score) {
  const thresholds = state.config.branchDensityThresholds || {};
  const lushThreshold = Number(thresholds.lush) || 520;
  const mediumThreshold = Number(thresholds.medium) || 180;

  if (score >= lushThreshold) return "lush";
  if (score >= mediumThreshold) return "medium";
  return "sparse";
}

function renderAll(updatedAt) {
  const totalScore = getTotalScore();
  const currentStage = resolveTrunkStage(totalScore);

  elements.updatedAt.textContent = `${updatedAt} · 树形页面测试数据`;
  elements.totalScore.textContent = totalScore.toLocaleString("zh-CN");
  elements.stageName.textContent = currentStage.name;

  setActiveTrunkStage(currentStage.id);
  updateCompositeBranchLayers(currentStage.id);
  renderTreeSvg(currentStage);
  renderBars();
}

function getTotalScore() {
  return BRANCH_ORDER.reduce((sum, key) => sum + (Number(state.scores[key]) || 0), 0);
}

function resolveTrunkStage(totalScore) {
  const stages = state.config.stages || [];
  if (state.forcedStageId) {
    return getStageById(state.forcedStageId, stages) || stages[0];
  }

  const stageByScore = getStageByScore(totalScore, stages);
  if (state.debugMode) {
    return stageByScore;
  }

  const stageByServerProgress = getStageById(state.achievedTrunkStageId, stages);
  const stageByStoredProgress = getStoredStage(stages);
  const resolvedStage = getHighestStage([stageByScore, stageByServerProgress, stageByStoredProgress], stages);

  if (!state.presetName && !state.debugMode) {
    storeStage(resolvedStage);
  }

  return resolvedStage;
}

function getStageByScore(score, stages) {
  return stages.reduce((selected, stage) => {
    return score >= stage.minScore ? stage : selected;
  }, stages[0]);
}

function getStoredStage(stages) {
  const storedId = localStorage.getItem(state.config.stageStorageKey);
  return getStageById(storedId, stages) || stages[0];
}

function getStageById(stageId, stages) {
  if (!stageId) return null;
  return stages.find((stage) => stage.id === stageId) || null;
}

function getHighestStage(candidates, stages) {
  return candidates.filter(Boolean).reduce((highest, stage) => {
    const highestIndex = stages.findIndex((item) => item.id === highest.id);
    const stageIndex = stages.findIndex((item) => item.id === stage.id);
    return stageIndex > highestIndex ? stage : highest;
  }, stages[0]);
}

function storeStage(stage) {
  localStorage.setItem(state.config.stageStorageKey, stage.id);
}

function renderTrunkLayers(stages) {
  elements.trunkLayers.innerHTML = stages
    .map((stage) => renderCompositeStageLayer(stage, state.config.compositeAssets?.[stage.id]))
    .join("");
}

function renderCompositeStageLayer(stage, composite) {
  if (!composite?.base || state.assetFailures.has(composite.base)) {
    return "";
  }

  const branchLayers = BRANCH_ORDER.map((key) => {
    const assets = composite.branches?.[key] || {};

    return ["medium", "lush"].map((density) => {
      const asset = assets[density];
      if (!asset || state.assetFailures.has(asset)) return "";

      const adjustment = getBranchLayerAdjustment(stage.id, key, density);

      return `
        <span
          class="tree-art-image tree-branch-art"
          style="
            --branch-image: url('${asset}');
            --branch-x: ${adjustment.x}px;
            --branch-y: ${adjustment.y}px;
            --branch-scale: ${adjustment.scale};
            --branch-rotate: ${adjustment.rotate}deg;
          "
          aria-hidden="true"
          data-stage="${stage.id}"
          data-branch="${key}"
          data-density="${density}"
        ></span>
      `;
    }).join("");
  }).join("");

  return `
    <div
      class="tree-art-layer"
      data-stage="${stage.id}"
      style="--tree-base-image: url('${composite.base}')"
      aria-hidden="true"
    >
      ${branchLayers}
    </div>
  `;
}

function getBranchLayerAdjustment(stageId, branch, density) {
  const key = getAlignmentKey(branch, density);
  return BRANCH_LAYER_ADJUSTMENTS[stageId]?.[key] || DEFAULT_ALIGNMENT;
}

function setActiveTrunkStage(stageId) {
  elements.trunkLayers.querySelectorAll(".tree-art-layer").forEach((layer) => {
    layer.classList.toggle("is-active", layer.dataset.stage === stageId);
  });
}

function updateCompositeBranchLayers(stageId) {
  elements.trunkLayers.querySelectorAll(".tree-branch-art").forEach((layer) => {
    const branch = layer.dataset.branch;
    const density = getBranchDensity(state.scores[branch] || 0);
    const stageLayer = layer.closest(".tree-art-layer");
    const isCurrentStage = stageLayer?.dataset.stage === stageId;
    const shouldShow = isCurrentStage && density !== "sparse" && layer.dataset.density === density;

    layer.classList.toggle("is-visible", shouldShow);
  });
}

function renderTreeSvg(currentStage) {
  elements.svg.innerHTML = `
    <title id="tree-svg-title">四分支共鸣树</title>
    <desc id="tree-svg-desc">当前树干形态为${escapeHtml(currentStage.name)}，总共鸣值为${getTotalScore()}。</desc>
  `;
}

async function preloadRuntimeAssets(config) {
  const trunkAssets = (config.stages || []).map((stage) => stage.asset).filter(Boolean);
  const compositeAssets = getCompositeAssets(config);
  const assets = [...new Set([...trunkAssets, ...compositeAssets])];
  const results = await Promise.allSettled(assets.map((asset) => preloadImage(asset)));

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      state.assetFailures.add(assets[index]);
      console.warn("[tree assets] failed to preload", assets[index], result.reason);
    }
  });
}

function getCompositeAssets(config) {
  return Object.values(config.compositeAssets || {}).flatMap((stage) => {
    const branchAssets = Object.values(stage.branches || {}).flatMap((branch) => Object.values(branch || {}));
    return [stage.base, ...branchAssets].filter(Boolean);
  });
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = () => reject(new Error(`Image failed: ${src}`));
    image.src = src;
  });
}

function renderBars() {
  const max = Math.max(...BRANCH_ORDER.map((key) => state.scores[key] || 0), 1);

  elements.resonanceBars.innerHTML = BRANCH_ORDER.map((key) => {
    const association = state.associations[key];
    const score = state.scores[key] || 0;
    const density = getBranchDensity(score);
    const trackWidth = score > 0 ? Math.max(6, score / max * 100) : 0;

    return `
      <div class="distribution-row">
        <div class="distribution-label">
          <span>${association.shortName}</span>
          <strong>${score.toLocaleString("zh-CN")}</strong>
        </div>
        <div class="distribution-track">
          <span style="width: ${trackWidth}%; --accent: ${association.color}"></span>
        </div>
        <small class="tree-leaf-note">枝桠状态：${BRANCH_DENSITY_LABELS[density]}</small>
      </div>
    `;
  }).join("");
}

function renderDebugPanel() {
  elements.debugPanel.hidden = false;
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

  syncAlignmentControls();
  focusAlignmentLayer();
}

function handleDebugInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;

  const scoreKey = input.dataset.scoreKey;
  const stageId = input.dataset.stageId;
  const alignControl = input.dataset.alignControl;

  if (scoreKey) {
    state.scores[scoreKey] = Math.max(0, Number(input.value) || 0);
    state.forcedStageId = null;
    renderAll("调试中");
    focusAlignmentLayer();
    return;
  }

  if (stageId) {
    const stage = state.config.stages.find((item) => item.id === stageId);
    if (stage) {
      stage.minScore = Math.max(0, Number(input.value) || 0);
      state.config.stages.sort((a, b) => a.minScore - b.minScore);
    }

    state.forcedStageId = null;
    renderAll("调试中");
    focusAlignmentLayer();
    return;
  }

  if (alignControl) {
    updateCurrentAlignmentValue(alignControl, Number(input.value));
  }
}

function handleDebugChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLSelectElement)) return;

  if (input.dataset.alignStage !== undefined) {
    state.alignDebug.stage = input.value;
  }

  if (input.dataset.alignBranch !== undefined) {
    state.alignDebug.branch = input.value;
  }

  if (input.dataset.alignDensity !== undefined) {
    state.alignDebug.density = input.value;
  }

  syncAlignmentControls();
  focusAlignmentLayer();
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

function getAlignmentKey(branch, density) {
  return `${branch}_${density}`;
}

function ensureBranchLayerAdjustment(stageId, branch, density) {
  const key = getAlignmentKey(branch, density);

  if (!BRANCH_LAYER_ADJUSTMENTS[stageId]) {
    BRANCH_LAYER_ADJUSTMENTS[stageId] = {};
  }

  if (!BRANCH_LAYER_ADJUSTMENTS[stageId][key]) {
    BRANCH_LAYER_ADJUSTMENTS[stageId][key] = { ...DEFAULT_ALIGNMENT };
  }

  return BRANCH_LAYER_ADJUSTMENTS[stageId][key];
}

function getCurrentAlignmentConfig() {
  return ensureBranchLayerAdjustment(
    state.alignDebug.stage,
    state.alignDebug.branch,
    state.alignDebug.density
  );
}

function updateCurrentAlignmentValue(prop, value) {
  const cfg = getCurrentAlignmentConfig();

  if (prop === "scale") {
    cfg[prop] = Number(value.toFixed(3));
  } else if (prop === "rotate") {
    cfg[prop] = Number(value.toFixed(1));
  } else {
    cfg[prop] = Math.round(value);
  }

  applyAlignmentToLayer(
    state.alignDebug.stage,
    state.alignDebug.branch,
    state.alignDebug.density
  );

  syncAlignmentControls();
  focusAlignmentLayer();
}

function applyAlignmentToLayer(stageId, branch, density) {
  const cfg = ensureBranchLayerAdjustment(stageId, branch, density);
  const layer = elements.trunkLayers.querySelector(
    `.tree-art-layer[data-stage="${stageId}"] .tree-branch-art[data-branch="${branch}"][data-density="${density}"]`
  );

  if (!layer) return;

  layer.style.setProperty("--branch-x", `${cfg.x}px`);
  layer.style.setProperty("--branch-y", `${cfg.y}px`);
  layer.style.setProperty("--branch-scale", String(cfg.scale));
  layer.style.setProperty("--branch-rotate", `${cfg.rotate}deg`);
}

function syncAlignmentControls() {
  const cfg = getCurrentAlignmentConfig();

  elements.debugGrid.querySelectorAll("[data-align-control]").forEach((control) => {
    const prop = control.dataset.alignControl;
    control.value = String(cfg[prop]);
  });

  elements.debugGrid.querySelectorAll("[data-align-value]").forEach((valueEl) => {
    const prop = valueEl.dataset.alignValue;
    valueEl.textContent = String(cfg[prop]);
  });
}

function focusAlignmentLayer() {
  const { stage, branch, density } = state.alignDebug;

  elements.trunkLayers.querySelectorAll(".tree-branch-art").forEach((layer) => {
    const isTarget =
      layer.closest(".tree-art-layer")?.dataset.stage === stage &&
      layer.dataset.branch === branch &&
      layer.dataset.density === density;

    layer.classList.toggle("is-align-target", isTarget);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
