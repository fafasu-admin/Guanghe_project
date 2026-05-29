import { EVENT_TYPES, reportEvent } from "./api/report.js";

const state = {
  associations: {},
  questions: [],
  currentIndex: 0,
  answers: [],
  scores: {},
  latestResult: null
};

const views = {
  intro: document.querySelector("#intro-view"),
  quiz: document.querySelector("#quiz-view"),
  resonance: document.querySelector("#resonance-view"),
  result: document.querySelector("#result-view")
};

const elements = {
  startButton: document.querySelector("#start-button"),
  questionTitle: document.querySelector("#question-title"),
  questionLore: document.querySelector("#question-lore"),
  questionCount: document.querySelector("#question-count"),
  progressBar: document.querySelector("#progress-bar"),
  optionGrid: document.querySelector("#option-grid"),
  resultTitle: document.querySelector("#result-title"),
  resultEnglishName: document.querySelector("#result-english-name"),
  resultChineseName: document.querySelector("#result-chinese-name"),
  frontEnglishName: document.querySelector("#front-english-name"),
  frontChineseName: document.querySelector("#front-chinese-name"),
  resultSubtitle: document.querySelector("#result-subtitle"),
  resultDeclaration: document.querySelector("#result-declaration"),
  resultPortrait: document.querySelector("#result-portrait"),
  resultCrest: document.querySelector("#result-crest"),
  resultCardImage: document.querySelector("#result-card-image"),
  keywordRow: document.querySelector("#keyword-row"),
  distribution: document.querySelector("#distribution"),
  identityCard: document.querySelector("#identity-card"),
  resultCopy: document.querySelector("#result-copy"),
  cardHint: document.querySelector("#card-hint"),
  restartButton: document.querySelector("#restart-button"),
  shareButton: document.querySelector("#share-button"),
  communityLink: document.querySelector("#community-link")
};

init();

async function init() {
  const [associations, questions] = await Promise.all([
    fetchJson("data/associations.json"),
    fetchJson("data/questions.json")
  ]);

  state.associations = associations;
  state.questions = questions;
  resetScores();
  bindEvents();
  reportEvent(EVENT_TYPES.H5_ENTER, { page: "h5-1" });
  maybeRenderDemo();
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

function bindEvents() {
  elements.startButton.addEventListener("click", startTest);
  elements.restartButton.addEventListener("click", restartTest);
  elements.shareButton.addEventListener("click", shareResult);
  elements.identityCard.addEventListener("click", flipCard);
  elements.communityLink.addEventListener("click", () => {
    const result = state.latestResult || buildResult();
    reportEvent(EVENT_TYPES.COMMUNITY_CTA_CLICKED, {
      primaryAssociation: result.primary.key,
      secondaryAssociation: result.secondary?.key || null
    });
  });
}

function startTest() {
  resetScores();
  state.currentIndex = 0;
  state.answers = [];
  state.latestResult = null;
  reportEvent(EVENT_TYPES.TEST_START);
  showView("quiz");
  renderQuestion();
}

function restartTest() {
  elements.identityCard.classList.remove("is-summoned", "is-shaking", "is-flipped", "is-flash");
  elements.resultCopy.classList.remove("is-visible");
  startTest();
}

function resetScores() {
  state.scores = Object.keys(state.associations).reduce((scores, key) => {
    scores[key] = 0;
    return scores;
  }, {});
}

function maybeRenderDemo() {
  const params = new URLSearchParams(window.location.search);
  const demoAssociation = params.get("demo");

  if (!demoAssociation || !state.associations[demoAssociation]) {
    return;
  }

  resetScores();
  Object.keys(state.scores).forEach((key) => {
    state.scores[key] = key === demoAssociation ? 6.5 : 0.5;
  });

  const result = buildResult();
  state.latestResult = result;
  renderResult(result);
  showView("result");

  window.requestAnimationFrame(() => {
    elements.identityCard.classList.add("is-summoned");
    if (params.get("flipped") === "1") {
      flipCard();
    }
  });
}

function showView(name) {
  Object.values(views).forEach((view) => view.classList.remove("is-active"));
  views[name].classList.add("is-active");
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];
  const number = state.currentIndex + 1;
  const total = state.questions.length;

  elements.questionTitle.textContent = question.title;
  elements.questionLore.textContent = question.lore;
  elements.questionCount.textContent = `${number}/${total}`;
  elements.progressBar.style.width = `${((number - 1) / total) * 100}%`;
  elements.optionGrid.innerHTML = "";

  question.options.forEach((option, index) => {
    const association = state.associations[option.association];
    const button = document.createElement("button");
    button.className = "option-card";
    button.type = "button";
    button.style.setProperty("--accent", association.color);
    button.innerHTML = `
      <span class="option-mark">${romanize(index + 1)}</span>
      <span>${option.text}</span>
    `;
    button.addEventListener("click", () => chooseOption(question, option));
    elements.optionGrid.appendChild(button);
  });
}

function chooseOption(question, option) {
  state.scores[option.association] += question.weight;
  state.answers.push({
    questionId: question.id,
    association: option.association,
    weight: question.weight
  });

  reportEvent(EVENT_TYPES.QUESTION_ANSWERED, {
    questionId: question.id,
    association: option.association,
    weight: question.weight
  });

  state.currentIndex += 1;

  if (state.currentIndex >= state.questions.length) {
    elements.progressBar.style.width = "100%";
    revealResult();
    return;
  }

  renderQuestion();
}

function revealResult() {
  const result = buildResult();
  state.latestResult = result;

  reportEvent(EVENT_TYPES.TEST_COMPLETED, {
    primaryAssociation: result.primary.key,
    secondaryAssociation: result.secondary?.key || null,
    percentages: result.percentages
  });

  showView("resonance");

  window.setTimeout(() => {
    renderResult(result);
    showView("result");
    window.requestAnimationFrame(() => {
      elements.identityCard.classList.add("is-summoned");
    });
  }, 1300);
}

function buildResult() {
  const total = Object.values(state.scores).reduce((sum, score) => sum + score, 0) || 1;
  const ranked = Object.entries(state.scores)
    .map(([key, score]) => ({
      key,
      score,
      percentage: Math.round((score / total) * 100)
    }))
    .sort((a, b) => b.score - a.score);

  const primary = ranked[0];
  const secondary = ranked[1]?.percentage >= 15 ? ranked[1] : null;

  return {
    primary,
    secondary,
    percentages: ranked.reduce((map, item) => {
      map[item.key] = item.percentage;
      return map;
    }, {})
  };
}

function renderResult(result) {
  const primary = state.associations[result.primary.key];
  const secondary = result.secondary ? state.associations[result.secondary.key] : null;
  const primaryPercent = result.percentages[result.primary.key];
  const secondaryText = secondary
    ? ` / 共鸣副脉：${secondary.shortName} ${result.percentages[result.secondary.key]}%`
    : "";

  elements.identityCard.classList.remove("is-summoned", "is-shaking", "is-flipped", "is-flash");
  elements.resultCopy.classList.remove("is-visible");
  elements.identityCard.style.setProperty("--accent", primary.color);
  elements.identityCard.style.setProperty("--accent-soft", primary.softColor);
  elements.resultCardImage.src = primary.cardImage;
  elements.resultCardImage.alt = `${primary.name}卡面`;
  elements.resultCrest.textContent = primary.crest;
  elements.resultEnglishName.textContent = primary.englishName;
  elements.resultChineseName.textContent = primary.name;
  elements.frontEnglishName.textContent = primary.englishName;
  elements.frontChineseName.textContent = primary.name;
  elements.resultSubtitle.textContent = `主归属：${primary.shortName} ${primaryPercent}%${secondaryText}`;
  elements.resultDeclaration.textContent = primary.declaration;
  elements.resultPortrait.textContent = primary.portrait;
  elements.communityLink.href = primary.communityUrl;
  elements.cardHint.textContent = "点击卡牌，翻开你的共鸣身份。";

  elements.keywordRow.innerHTML = primary.keywords
    .map((keyword) => `<span>${keyword}</span>`)
    .join("");

  renderDistribution(result.percentages);
}

function flipCard() {
  if (
    !state.latestResult ||
    elements.identityCard.classList.contains("is-flipped") ||
    elements.identityCard.classList.contains("is-shaking")
  ) {
    return;
  }

  elements.identityCard.classList.add("is-shaking");
  elements.cardHint.textContent = "卡牌正在回应你的共鸣。";

  window.setTimeout(() => {
    elements.identityCard.classList.remove("is-shaking");
    elements.identityCard.classList.add("is-flipped", "is-flash");
    elements.cardHint.textContent = "协会低语已显现。你的共鸣身份正在被记录。";

    window.setTimeout(() => {
      elements.resultCopy.classList.add("is-visible");
    }, 560);

    window.setTimeout(() => {
      elements.identityCard.classList.remove("is-flash");
    }, 1100);
  }, 1000);
}

function renderDistribution(percentages) {
  const entries = Object.entries(state.associations);
  elements.distribution.innerHTML = entries
    .map(([key, association]) => {
      const percent = percentages[key] || 0;
      return `
        <div class="distribution-row">
          <div class="distribution-label">
            <span>${association.shortName}</span>
            <strong>${percent}%</strong>
          </div>
          <div class="distribution-track">
            <span style="width: ${percent}%; --accent: ${association.color}"></span>
          </div>
        </div>
      `;
    })
    .join("");
}

async function shareResult() {
  const result = state.latestResult || buildResult();
  const primary = state.associations[result.primary.key];
  const text = `废墟的低语告诉我：我的灵魂属于「${primary.name}」。`;

  reportEvent(EVENT_TYPES.RESULT_SHARED, {
    primaryAssociation: result.primary.key,
    secondaryAssociation: result.secondary?.key || null
  });

  if (navigator.share) {
    await navigator.share({
      title: "共鸣者协会身份卡",
      text,
      url: window.location.href
    });
    return;
  }

  await navigator.clipboard?.writeText(`${text} ${window.location.href}`);
  elements.shareButton.textContent = "已复制分享文案";
  window.setTimeout(() => {
    elements.shareButton.textContent = "分享共鸣身份";
  }, 1800);
}

function romanize(number) {
  return ["I", "II", "III", "IV"][number - 1] || String(number);
}
