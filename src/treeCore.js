export const SCORE_WEIGHTS = Object.freeze({
  views: 1,
  likes: 3,
  comments: 5,
  posts: 10
});

export const BRANCH_ORDER = ["logic", "sense", "soul", "rules"];

export const BRANCH_DENSITY_LABELS = Object.freeze({
  sparse: "稀疏",
  medium: "适中",
  lush: "茂密"
});

export const DEFAULT_ALIGNMENT = Object.freeze({
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0
});

export const BRANCH_LAYER_ADJUSTMENTS = {
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
    soul_lush: { x: -14, y: -27, scale: 1, rotate: 0 },
    rules_medium: { x: 23, y: -14, scale: 1, rotate: 0 },
    rules_lush: { x: 24, y: 15, scale: 1.15, rotate: 0 }
  }
};

export const PRESETS = Object.freeze({
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

export function createTreeEngine(options = {}) {
  const {
    elements,
    debugMode = false,
    svgTitle = "四分支共鸣树",
    formatUpdatedAt = (updatedAt) => `${updatedAt} · 树形页面测试数据`,
    formatPresetLabel = (name) => (name ? `快速测试：${name}` : "动态数据"),
    renderBars = defaultRenderBars
  } = options;

  const state = {
    associations: {},
    config: null,
    scores: {},
    forcedStageId: null,
    achievedTrunkStageId: null,
    assetFailures: new Set(),
    presetName: null,
    debugMode,
    alignDebug: {
      stage: "stage3",
      branch: "rules",
      density: "lush"
    }
  };

  async function init(params = {}) {
    state.presetName = params.presetName ?? null;
    state.debugMode = params.debugMode ?? debugMode;

    const [associations, config, data] = await Promise.all([
      fetchJson("data/associations.json"),
      fetchJson("data/tree-config.json"),
      fetchTreeData()
    ]);

    state.associations = associations;
    state.config = config;
    state.scores = buildScores(data.associations || {});
    state.achievedTrunkStageId = data.achievedTrunkStage || null;
    state.forcedStageId = resolvePreset(state.presetName);

    await preloadRuntimeAssets(config);
    renderTrunkLayers(config.stages || []);
    renderAll(data.updatedAt || "调试中");

    return state;
  }

  function renderAll(updatedAt) {
    const totalScore = getTotalScore();
    const currentStage = resolveTrunkStage(totalScore);

    if (elements.updatedAt) {
      elements.updatedAt.textContent = formatUpdatedAt(updatedAt, state);
    }
    if (elements.totalScore) {
      elements.totalScore.textContent = totalScore.toLocaleString("zh-CN");
    }
    if (elements.stageName) {
      elements.stageName.textContent = currentStage.name;
    }

    setActiveTrunkStage(currentStage.id);
    updateCompositeBranchLayers(currentStage.id);
    renderTreeSvg(currentStage);
    renderBars(state, elements);
  }

  function resolvePreset(name) {
    const preset = PRESETS[name];
    if (!preset) {
      if (elements.presetLabel) {
        elements.presetLabel.textContent = formatPresetLabel(null, state);
      }
      return null;
    }

    if (elements.presetLabel) {
      elements.presetLabel.textContent = formatPresetLabel(name, state);
    }

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
    if (!elements.svg) return;

    elements.svg.innerHTML = `
      <title id="tree-svg-title">${escapeHtml(svgTitle)}</title>
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
    if (!elements.debugGrid) return;

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

  return {
    state,
    init,
    renderAll,
    getBranchDensity,
    getTotalScore,
    getCurrentAlignmentConfig,
    updateCurrentAlignmentValue,
    syncAlignmentControls,
    focusAlignmentLayer,
    ensureBranchLayerAdjustment,
    getAlignmentKey
  };
}

function defaultRenderBars(state, elements) {
  if (!elements.resonanceBars) return;

  const max = Math.max(...BRANCH_ORDER.map((key) => state.scores[key] || 0), 1);

  elements.resonanceBars.innerHTML = BRANCH_ORDER.map((key) => {
    const association = state.associations[key];
    const score = state.scores[key] || 0;
    const density = getBranchDensityForState(state, score);
    const trackWidth = score > 0 ? Math.max(6, (score / max) * 100) : 0;

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

function getBranchDensityForState(state, score) {
  const thresholds = state.config.branchDensityThresholds || {};
  const lushThreshold = Number(thresholds.lush) || 520;
  const mediumThreshold = Number(thresholds.medium) || 180;

  if (score >= lushThreshold) return "lush";
  if (score >= mediumThreshold) return "medium";
  return "sparse";
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

async function fetchTreeData() {
  try {
    return await fetchJson("data/tree-live.json");
  } catch (error) {
    console.warn("[tree data] failed to load live data, falling back to mock", error);
    return fetchJson("data/tree-mock.json");
  }
}

function buildScores(statsMap) {
  return BRANCH_ORDER.reduce((scores, key) => {
    scores[key] = calculateBranchScore(statsMap[key] || {});
    return scores;
  }, {});
}

function calculateBranchScore(stats) {
  return (
    (Number(stats.views) || 0) * SCORE_WEIGHTS.views +
    (Number(stats.likes) || 0) * SCORE_WEIGHTS.likes +
    (Number(stats.comments) || 0) * SCORE_WEIGHTS.comments +
    (Number(stats.posts) || 0) * SCORE_WEIGHTS.posts
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
