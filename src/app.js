import { EVENT_TYPES, reportEvent } from "./api/report.js";

const SPECTRUM_ORDER = ["logic", "sense", "soul", "rules"];

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
  resultArchive: document.querySelector("#result-archive"),
  resultStatus: document.querySelector("#result-status"),
  identityCard: document.querySelector("#identity-card"),
  resultCrest: document.querySelector("#result-crest"),
  cardHint: document.querySelector("#card-hint"),
  resultDetails: document.querySelector("#result-details"),
  resultEnglishName: document.querySelector("#result-english-name"),
  resultChineseName: document.querySelector("#result-chinese-name"),
  resultPersonaTitle: document.querySelector("#result-persona-title"),
  resultDeclaration: document.querySelector("#result-declaration"),
  resultPortrait: document.querySelector("#result-portrait"),
  resultCardImage: document.querySelector("#result-card-image"),
  resultPrimaryStat: document.querySelector("#result-primary-stat"),
  resultSecondaryStat: document.querySelector("#result-secondary-stat"),
  primaryStatIcon: document.querySelector("#primary-stat-icon"),
  secondaryStatIcon: document.querySelector("#secondary-stat-icon"),
  keywordRow: document.querySelector("#keyword-row"),
  distribution: document.querySelector("#distribution"),
  communityLink: document.querySelector("#community-link"),
  communityLinkText: document.querySelector("#community-link-text"),
  restartButton: document.querySelector("#restart-button"),
  shareButton: document.querySelector("#share-button"),
  resultStats: document.querySelector(".result-stats")
};

const STAT_FONT_MAX = 12;
const STAT_FONT_MIN = 9;

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
  window.addEventListener("resize", scheduleFitResultStats);
  reportEvent(EVENT_TYPES.H5_ENTER, { page: "h5-1" });
  maybeRenderDemo();
}

function getStatShortName(association) {
  return association.statShortName || association.shortName;
}

function fitResultStats() {
  if (!elements.resultStats) {
    return;
  }

  elements.resultStats.querySelectorAll(".result-stat").forEach((row) => {
    const icon = row.querySelector(".result-stat-icon");
    const text = row.querySelector(".result-stat-text");

    if (!text) {
      return;
    }

    text.style.fontSize = "";
    text.style.maxWidth = "";

    if (icon?.hidden) {
      return;
    }

    const gap = 4;
    const maxWidth = Math.max(row.clientWidth - (icon?.offsetWidth || 0) - gap, 0);
    let size = STAT_FONT_MAX;

    text.style.maxWidth = `${maxWidth}px`;
    text.style.fontSize = `${size}px`;

    while (text.scrollWidth > maxWidth && size > STAT_FONT_MIN) {
      size -= 0.5;
      text.style.fontSize = `${size}px`;
    }
  });
}

function scheduleFitResultStats() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(fitResultStats);
  });
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
  resetResultPresentation();
  reportEvent(EVENT_TYPES.TEST_START);
  showView("quiz");
  renderQuestion();
}

function restartTest() {
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
    elements.resultArchive.classList.add("is-visible");
    elements.identityCard.classList.add("is-summoned");
    if (params.get("flipped") === "1") {
      flipCard();
    }
  });
}

function resetResultPresentation() {
  elements.resultArchive.classList.remove("is-visible");
  elements.resultDetails.classList.remove("is-details-visible");
  elements.identityCard.classList.remove("is-summoned", "is-shaking", "is-flipped", "is-flash");
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

  resetResultPresentation();
  showView("resonance");

  window.setTimeout(() => {
    renderResult(result);
    showView("result");
    window.requestAnimationFrame(() => {
      elements.resultArchive.classList.add("is-visible");
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
    ranked,
    percentages: ranked.reduce((map, item) => {
      map[item.key] = item.percentage;
      return map;
    }, {})
  };
}

function renderResult(result) {
  const primary = state.associations[result.primary.key];
  const potential = result.secondary || result.ranked[1];
  const potentialAssociation = potential ? state.associations[potential.key] : null;
  const primaryPercent = result.percentages[result.primary.key];

  document.documentElement.style.setProperty("--accent", primary.color);
  document.documentElement.style.setProperty("--accent-soft", primary.softColor);

  elements.identityCard.classList.remove("is-summoned", "is-shaking", "is-flipped", "is-flash");
  elements.resultDetails.classList.remove("is-details-visible");
  elements.identityCard.style.setProperty("--accent", primary.color);
  elements.identityCard.style.setProperty("--accent-soft", primary.softColor);
  elements.resultCrest.textContent = primary.crest;
  elements.cardHint.textContent = "点击卡牌，翻开你的共鸣身份。";
  elements.resultStatus.textContent = "卡牌边缘的微光已经回应你。";

  elements.resultCardImage.src = primary.cardImage;
  elements.resultCardImage.alt = `${primary.personaTitle}卡面`;
  elements.resultEnglishName.textContent = primary.archiveName || primary.englishName;
  elements.resultChineseName.textContent = primary.name;
  elements.resultPersonaTitle.textContent = primary.personaTitle;
  elements.resultDeclaration.textContent = primary.declaration;
  elements.resultPortrait.textContent = primary.portrait;
  elements.resultPrimaryStat.textContent = `${getStatShortName(primary)} ${primaryPercent}%`;
  elements.primaryStatIcon.src = primary.spectrumIcon;
  elements.communityLink.href = primary.communityUrl;

  if (potentialAssociation) {
    elements.resultSecondaryStat.textContent = `${getStatShortName(potentialAssociation)} ${result.percentages[potential.key]}%`;
    elements.secondaryStatIcon.src = potentialAssociation.spectrumIcon;
    elements.secondaryStatIcon.hidden = false;
  } else {
    elements.resultSecondaryStat.textContent = "—";
    elements.secondaryStatIcon.hidden = true;
  }

  elements.communityLinkText.textContent = `进入${primary.shortName}协会，找到你的同伴 >`;

  elements.keywordRow.innerHTML = primary.keywords
    .map((keyword) => `<span class="result-keyword">${keyword}</span>`)
    .join("");

  renderDistribution(result);
  scheduleFitResultStats();
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
    elements.resultStatus.textContent = "协会低语已显现。";
    elements.cardHint.textContent = "";

    window.setTimeout(() => {
      elements.resultDetails.classList.add("is-details-visible");
      scheduleFitResultStats();
    }, 560);

    window.setTimeout(() => {
      elements.identityCard.classList.remove("is-flash");
    }, 1100);
  }, 1000);
}

function renderDistribution(result) {
  const primaryKey = result.primary.key;

  elements.distribution.innerHTML = SPECTRUM_ORDER.map((key) => {
    const association = state.associations[key];
    const percent = result.percentages[key] || 0;
    const isDominant = key === primaryKey;

    const fillStyle = isDominant
      ? `flex: 0 0 ${percent}%; width: ${percent}%;`
      : `width: ${percent}%; --accent: ${association.color};`;

    return `
      <div class="spectrum-row${isDominant ? " is-dominant" : ""}">
        <span class="spectrum-icon-wrap">
          <img class="spectrum-icon" src="${association.spectrumIcon}" alt="" aria-hidden="true">
        </span>
        <div class="spectrum-body">
          <div class="spectrum-head">
            <span>${association.shortName}</span>
            <strong>${percent}%</strong>
          </div>
          <div class="spectrum-track">
            <span class="spectrum-fill${isDominant ? " is-dominant" : ""}" style="${fillStyle}"></span>
            ${isDominant ? '<span class="spectrum-extend" aria-hidden="true"></span>' : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function shareResult() {
  const result = state.latestResult || buildResult();
  const primary = state.associations[result.primary.key];
  const text = `废墟的低语告诉我：我被记录为「${primary.personaTitle}」，灵魂属于「${primary.name}」。`;

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
  elements.shareButton.setAttribute("aria-label", "已复制分享文案");
  window.setTimeout(() => {
    elements.shareButton.setAttribute("aria-label", "分享共鸣身份");
  }, 1800);
}

function romanize(number) {
  return ["I", "II", "III", "IV"][number - 1] || String(number);
}
