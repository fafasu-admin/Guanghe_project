const CARD_WIDTH = 390;
const SCALE = 2;
const PADDING_X = 20;
const PADDING_TOP = 22;
const PADDING_BOTTOM = 28;
const SHARE_IMAGE_NAME = "共鸣者身份卡.png";
const SPECTRUM_ORDER_DEFAULT = ["logic", "sense", "soul", "rules"];

const COLORS = {
  bgTop: "#12102a",
  bgBottom: "#090817",
  gold: "#f0bf62",
  goldSoft: "#ffe4a8",
  textMuted: "rgba(214, 208, 232, 0.92)",
  textDim: "rgba(196, 190, 220, 0.88)",
  track: "rgba(255, 255, 255, 0.08)"
};

let shareCanvas = null;
let shareLink = "";
let previewObjectUrl = "";

const modal = document.querySelector("#share-modal");
const previewImage = document.querySelector("#share-preview-image");
const saveButton = document.querySelector("#share-save-button");
const copyLinkButton = document.querySelector("#share-copy-link-button");
const closeButton = document.querySelector("#share-modal-close");
const hint = document.querySelector("#share-modal-hint");

export function buildShareLink() {
  const url = new URL("index.html", window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function buildSharePayload(result, associations, spectrumOrder = SPECTRUM_ORDER_DEFAULT) {
  const primary = associations[result.primary.key];
  const secondaryKey = result.secondary?.key || null;
  const secondary = secondaryKey ? associations[secondaryKey] : null;

  return {
    primary,
    primaryKey: result.primary.key,
    primaryPercent: result.percentages[result.primary.key] ?? 0,
    secondary,
    secondaryPercent: secondaryKey ? result.percentages[secondaryKey] : null,
    percentages: { ...result.percentages },
    associations,
    spectrumOrder
  };
}

export function initShareCard({ onShareOpen, onShareSave, onShareCopyLink }) {
  if (!modal) {
    console.error("[shareCard] #share-modal not found in document");
    return async () => {};
  }

  saveButton?.addEventListener("click", () => {
    if (!shareCanvas) {
      setHint("请先生成分享图。");
      return;
    }

    shareCanvas.toBlob((blob) => {
      if (!blob) {
        setHint("保存失败，请重试。");
        return;
      }

      onShareSave?.();

      if (isTouchDevice()) {
        setHint("请长按上方图片，保存到相册。");
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = SHARE_IMAGE_NAME;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setHint("图片已开始下载。");
    }, "image/png");
  });

  copyLinkButton?.addEventListener("click", async () => {
    if (!shareLink) {
      setHint("链接尚未生成，请关闭后重试分享。");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      onShareCopyLink?.();
      setHint("链接已复制到剪贴板。");
    } catch {
      setHint(`复制失败，请手动复制：${shareLink}`);
    }
  });

  closeButton?.addEventListener("click", closeShareModal);
  modal.querySelectorAll("[data-share-close]").forEach((node) => {
    node.addEventListener("click", closeShareModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal && !modal.hidden) {
      closeShareModal();
    }
  });

  return async (payload, link) => {
    shareLink = link;
    clearPreview();
    shareCanvas = null;
    openShareModal();
    setHint("正在生成分享图…");
    if (saveButton) {
      saveButton.disabled = true;
    }

    try {
      await ensureFonts();
      shareCanvas = await renderShareCardCanvas(payload);
      await setPreviewFromCanvas(shareCanvas);
      setHint(isTouchDevice() ? "长按预览图可保存到相册，或点击下方按钮。" : "");
      onShareOpen?.();
    } catch (error) {
      console.error("[shareCard] render failed", error);
      setHint("分享图生成失败，仍可复制下方链接。");
      clearPreview();
    } finally {
      if (saveButton) {
        saveButton.disabled = !shareCanvas;
      }
    }
  };
}

async function ensureFonts() {
  if (!document.fonts?.load) {
    return;
  }

  await Promise.all([
    document.fonts.load('700 24px "Noto Serif SC"'),
    document.fonts.load('400 14px "Noto Serif SC"'),
    document.fonts.load('500 14px Cinzel')
  ]).catch(() => {});
  await document.fonts.ready;
}

const CARD_IMAGE_WIDTH = 228;
const CARD_IMAGE_HEIGHT = Math.round(CARD_IMAGE_WIDTH * (16 / 9));

async function renderShareCardCanvas(payload) {
  const assets = await preloadAssets(payload);
  const totalHeight = measureContentHeight(payload);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH * SCALE;
  canvas.height = totalHeight * SCALE;

  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  drawBackground(ctx, totalHeight);

  let y = PADDING_TOP;
  y = drawKicker(ctx, y);
  y = drawCardImage(ctx, assets.cardImage, y, CARD_IMAGE_WIDTH, CARD_IMAGE_HEIGHT);
  y = drawIdentityBlock(ctx, payload, y);
  y = drawStats(ctx, payload, assets, y);
  y = drawKeywords(ctx, payload.primary.keywords, y);
  y = drawSpectrumSection(ctx, payload, assets, y);
  drawFooterNote(ctx, y + 8);

  return canvas;
}

function measureContentHeight(payload) {
  const measureCtx = document.createElement("canvas").getContext("2d");
  let y = PADDING_TOP + 28 + CARD_IMAGE_HEIGHT + 24 + 108 + 52;
  y = measureKeywordsBottom(measureCtx, payload.primary.keywords, y);
  y += 18 + 20 + payload.spectrumOrder.length * 50 + 36;
  return Math.ceil(y + PADDING_BOTTOM);
}

function measureKeywordsBottom(ctx, keywords, startY) {
  const gap = 8;
  const pillHeight = 26;
  const pillPadX = 12;
  let cursorX = PADDING_X;
  let rowY = startY + pillHeight;

  ctx.font = '400 12px "Noto Serif SC", serif';

  keywords.forEach((keyword) => {
    const pillWidth = ctx.measureText(keyword).width + pillPadX * 2;

    if (cursorX + pillWidth > CARD_WIDTH - PADDING_X) {
      cursorX = PADDING_X;
      rowY += pillHeight + gap;
    }

    cursorX += pillWidth + gap;
  });

  return rowY + 12;
}

async function preloadAssets(payload) {
  const { primary, secondary, spectrumOrder, associations } = payload;
  const imageSources = new Set([primary.cardImage, primary.spectrumIcon]);

  if (secondary) {
    imageSources.add(secondary.spectrumIcon);
  }

  spectrumOrder.forEach((key) => {
    imageSources.add(associations[key].spectrumIcon);
  });

  const loaded = await Promise.all(
    [...imageSources].map(async (src) => {
      try {
        const image = await loadImage(src);
        return [src, image];
      } catch (error) {
        console.warn("[shareCard] image load failed", src, error);
        return [src, null];
      }
    })
  );

  const imageMap = Object.fromEntries(loaded);

  return {
    cardImage: imageMap[primary.cardImage] || null,
    primaryIcon: imageMap[primary.spectrumIcon] || null,
    secondaryIcon: secondary ? imageMap[secondary.spectrumIcon] || null : null,
    spectrumIcons: Object.fromEntries(
      spectrumOrder.map((key) => [key, imageMap[associations[key].spectrumIcon] || null])
    )
  };
}

function drawBackground(ctx, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, COLORS.bgTop);
  gradient.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, height);

  const glow = ctx.createRadialGradient(CARD_WIDTH / 2, 0, 0, CARD_WIDTH / 2, 0, CARD_WIDTH * 0.55);
  glow.addColorStop(0, "rgba(240, 191, 98, 0.1)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, height * 0.45);
}

function drawKicker(ctx, y) {
  const text = "共鸣者档案 | 游戏共鸣者议会";
  ctx.textAlign = "center";
  ctx.font = '400 11px "Noto Serif SC", serif';
  ctx.fillStyle = "rgba(196, 190, 220, 0.75)";
  ctx.fillText(text, CARD_WIDTH / 2, y + 12);

  const lineY = y + 22;
  const lineW = 200;
  const lineX = (CARD_WIDTH - lineW) / 2;
  const lineGrad = ctx.createLinearGradient(lineX, lineY, lineX + lineW, lineY);
  lineGrad.addColorStop(0, "rgba(240, 191, 98, 0.08)");
  lineGrad.addColorStop(0.5, "rgba(240, 191, 98, 0.55)");
  lineGrad.addColorStop(1, "rgba(240, 191, 98, 0.08)");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lineX, lineY);
  ctx.lineTo(lineX + lineW, lineY);
  ctx.stroke();

  return y + 28;
}

function drawCardImage(ctx, image, y, width, height) {
  const x = (CARD_WIDTH - width) / 2;

  ctx.save();
  roundRect(ctx, x - 4, y - 4, width + 8, height + 8, 12);
  ctx.fillStyle = "rgba(240, 191, 98, 0.12)";
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, width, height, 8);
  ctx.clip();

  if (image) {
    drawCoverImage(ctx, image, x, y, width, height);
  } else {
    ctx.fillStyle = "#1a1730";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = COLORS.gold;
    ctx.font = '600 14px "Noto Serif SC", serif';
    ctx.textAlign = "center";
    ctx.fillText("共鸣身份卡", CARD_WIDTH / 2, y + height / 2);
  }

  ctx.restore();
  return y + height + 24;
}

function drawIdentityBlock(ctx, payload, y) {
  const { primary } = payload;
  const centerX = CARD_WIDTH / 2;

  ctx.textAlign = "center";
  ctx.font = '500 13px Cinzel, "Palatino Linotype", Georgia, serif';
  fillGoldText(ctx, primary.archiveName || primary.englishName, centerX, y + 14);

  ctx.font = '700 22px "Noto Serif SC", serif';
  fillGoldText(ctx, primary.name, centerX, y + 44);

  const dividerY = y + 58;
  drawDivider(ctx, dividerY);

  const prefix = "你被记录为：";
  const personaTitle = primary.personaTitle;
  ctx.textAlign = "left";
  ctx.font = '400 13px "Noto Serif SC", serif';
  const prefixWidth = ctx.measureText(prefix).width;
  ctx.font = '600 13px "Noto Serif SC", serif';
  const titleWidth = ctx.measureText(personaTitle).width;
  let textX = (CARD_WIDTH - prefixWidth - titleWidth) / 2;
  const textY = y + 88;

  ctx.font = '400 13px "Noto Serif SC", serif';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(prefix, textX, textY);
  textX += prefixWidth;

  ctx.textAlign = "left";
  ctx.font = '600 13px "Noto Serif SC", serif';
  fillGoldText(ctx, personaTitle, textX, textY);
  ctx.textAlign = "center";

  return y + 108;
}

function drawStats(ctx, payload, assets, y) {
  const { primary, secondary, primaryPercent, secondaryPercent } = payload;
  const rowHeight = 22;
  const leftX = PADDING_X + 4;

  drawStatRow(ctx, {
    y: y + 16,
    label: "主导共鸣：",
    value: `${statShortName(primary)} ${primaryPercent}%`,
    icon: assets.primaryIcon,
    accent: primary.color,
    leftX
  });

  drawStatRow(ctx, {
    y: y + 16 + rowHeight + 10,
    label: "潜在共鸣：",
    value: secondary ? `${statShortName(secondary)} ${secondaryPercent}%` : "—",
    icon: secondary ? assets.secondaryIcon : null,
    accent: secondary?.color || COLORS.textDim,
    leftX
  });

  return y + 52;
}

function drawStatRow(ctx, { y, label, value, icon, accent, leftX }) {
  const iconSize = 18;
  let textX = leftX;

  if (icon) {
    ctx.drawImage(icon, leftX, y - iconSize + 4, iconSize, iconSize);
    textX += iconSize + 8;
  }

  ctx.textAlign = "left";
  ctx.font = '400 12px "Noto Serif SC", serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(label, textX, y);

  const labelWidth = ctx.measureText(label).width;
  ctx.fillStyle = accent;
  ctx.font = '600 12px "Noto Serif SC", serif';
  ctx.fillText(value, textX + labelWidth, y);
}

function drawKeywords(ctx, keywords, y) {
  const gap = 8;
  const pillHeight = 26;
  const pillPadX = 12;
  let cursorX = PADDING_X;
  let rowY = y + pillHeight;

  ctx.font = '400 12px "Noto Serif SC", serif';

  keywords.forEach((keyword) => {
    const textWidth = ctx.measureText(keyword).width;
    const pillWidth = textWidth + pillPadX * 2;

    if (cursorX + pillWidth > CARD_WIDTH - PADDING_X) {
      cursorX = PADDING_X;
      rowY += pillHeight + gap;
    }

    roundRect(ctx, cursorX, rowY - pillHeight + 4, pillWidth, pillHeight, 999);
    ctx.fillStyle = "rgba(240, 191, 98, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 191, 98, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = COLORS.goldSoft;
    ctx.textAlign = "left";
    ctx.fillText(keyword, cursorX + pillPadX, rowY - 7);

    cursorX += pillWidth + gap;
  });

  return rowY + 12;
}

function drawSpectrumSection(ctx, payload, assets, y) {
  const { spectrumOrder, associations, percentages, primaryKey } = payload;
  const titleY = y + 18;

  ctx.textAlign = "center";
  ctx.font = '600 14px "Noto Serif SC", serif';
  fillGoldText(ctx, "你的共鸣光谱", CARD_WIDTH / 2, titleY);

  let rowY = titleY + 20;

  spectrumOrder.forEach((key) => {
    const association = associations[key];
    const percent = percentages[key] || 0;
    const isDominant = key === primaryKey;
    rowY = drawSpectrumRow(ctx, {
      y: rowY,
      association,
      percent,
      isDominant,
      icon: assets.spectrumIcons[key]
    });
  });

  return rowY;
}

function drawSpectrumRow(ctx, { y, association, percent, isDominant, icon }) {
  const iconX = PADDING_X;
  const iconSize = isDominant ? 34 : 30;
  const iconY = y;

  if (isDominant) {
    ctx.beginPath();
    ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2 + 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(240, 191, 98, 0.85)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (icon) {
    const inset = isDominant ? 2 : 0;
    ctx.drawImage(icon, iconX + inset, iconY + inset, iconSize - inset * 2, iconSize - inset * 2);
  }

  const bodyX = PADDING_X + 46;
  const bodyW = CARD_WIDTH - bodyX - PADDING_X;
  const labelY = y + 12;

  ctx.textAlign = "left";
  ctx.font = isDominant ? '600 12px "Noto Serif SC", serif' : '400 12px "Noto Serif SC", serif';

  if (isDominant) {
    fillGoldText(ctx, association.shortName, bodyX, labelY);
  } else {
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(association.shortName, bodyX, labelY);
  }

  ctx.textAlign = "right";
  const percentText = `${percent}%`;
  if (isDominant) {
    fillGoldText(ctx, percentText, bodyX + bodyW, labelY);
  } else {
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(percentText, bodyX + bodyW, labelY);
  }

  const trackY = y + 20;
  const trackH = isDominant ? 10 : 8;
  roundRect(ctx, bodyX, trackY, bodyW, trackH, 999);
  ctx.fillStyle = COLORS.track;
  ctx.fill();

  const fillW = Math.max((bodyW * percent) / 100, isDominant ? 10 : 4);
  if (fillW > 0) {
    roundRect(ctx, bodyX, trackY, fillW, trackH, 999);
    const fillGrad = ctx.createLinearGradient(bodyX, trackY, bodyX + fillW, trackY);
    if (isDominant) {
      fillGrad.addColorStop(0, COLORS.gold);
      fillGrad.addColorStop(1, COLORS.goldSoft);
    } else {
      fillGrad.addColorStop(0, association.color);
      fillGrad.addColorStop(1, lightenColor(association.color, 0.28));
    }
    ctx.fillStyle = fillGrad;
    ctx.globalAlpha = isDominant ? 0.95 : 0.72;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  return y + 50;
}

function drawFooterNote(ctx, y) {
  const text = "数值代表不同创造者倾向的共鸣强度，不代表能力高低。";
  ctx.textAlign = "center";
  ctx.font = '400 10px "Noto Serif SC", serif';
  ctx.fillStyle = "rgba(160, 154, 188, 0.65)";
  wrapText(ctx, text, CARD_WIDTH / 2, y + 10, CARD_WIDTH - PADDING_X * 2, 14);
}

function drawDivider(ctx, y) {
  const centerX = CARD_WIDTH / 2;
  const half = 120;
  const grad = ctx.createLinearGradient(centerX - half, y, centerX + half, y);
  grad.addColorStop(0, "rgba(240, 191, 98, 0.08)");
  grad.addColorStop(0.5, "rgba(240, 191, 98, 0.55)");
  grad.addColorStop(1, "rgba(240, 191, 98, 0.08)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - half, y);
  ctx.lineTo(centerX + half, y);
  ctx.stroke();
}

function fillGoldText(ctx, text, x, y) {
  const metrics = ctx.measureText(text);
  const align = ctx.textAlign;
  let x0;
  let x1;

  if (align === "right") {
    x0 = x - metrics.width;
    x1 = x;
  } else if (align === "center") {
    x0 = x - metrics.width / 2;
    x1 = x + metrics.width / 2;
  } else {
    x0 = x;
    x1 = x + metrics.width;
  }

  const grad = ctx.createLinearGradient(x0, y - 14, x1, y);
  grad.addColorStop(0, "#fff6d6");
  grad.addColorStop(0.45, COLORS.gold);
  grad.addColorStop(1, "#c8943f");
  ctx.fillStyle = grad;
  ctx.fillText(text, x, y);
}

function wrapText(ctx, text, centerX, startY, maxWidth, lineHeight) {
  const chars = [...text];
  let line = "";
  let y = startY;

  chars.forEach((char, index) => {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, centerX, y);
      line = char;
      y += lineHeight;
    } else {
      line = test;
    }

    if (index === chars.length - 1) {
      ctx.fillText(line, centerX, y);
    }
  });
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const offsetX = x + (width - drawW) / 2;
  const offsetY = y + (height - drawH) / 2;
  ctx.drawImage(image, offsetX, offsetY, drawW, drawH);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = new URL(src, window.location.href).href;
  });
}

function statShortName(association) {
  return association.statShortName || association.shortName;
}

function lightenColor(hex, amount) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = (channel) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

async function setPreviewFromCanvas(canvas) {
  clearPreview();

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!blob) {
    throw new Error("Empty preview blob");
  }

  previewObjectUrl = URL.createObjectURL(blob);
  previewImage.src = previewObjectUrl;
  previewImage.alt = "共鸣者身份卡分享图";
}

function clearPreview() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = "";
  }

  previewImage?.removeAttribute("src");
}

function openShareModal() {
  if (!modal) {
    return;
  }

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("share-modal-open");
}

export function closeShareModal() {
  if (!modal) {
    return;
  }

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("share-modal-open");
  setHint("");
  if (saveButton) {
    saveButton.disabled = !shareCanvas;
  }
}

function setHint(message) {
  if (hint) {
    hint.textContent = message;
  }
}

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}
