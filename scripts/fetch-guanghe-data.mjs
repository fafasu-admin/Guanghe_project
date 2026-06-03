import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BOARD_MAP = Object.freeze({
  soul: 137,
  sense: 138,
  logic: 139,
  rules: 140
});

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_MAX_PAGES = 20;
const DEFAULT_OUTPUT = "data/tree-live.json";

await loadEnvFile(".env");

const NUMERIC_FIELD_CANDIDATES = Object.freeze({
  views: [
    "views",
    "view",
    "viewCount",
    "view_count",
    "readCount",
    "read_count",
    "browseCount",
    "browse_count",
    "pv",
    "pvCount",
    "visitCount"
  ],
  likes: [
    "likes",
    "like",
    "likeCount",
    "like_count",
    "upCount",
    "up_count",
    "thumbsUpCount",
    "supportCount"
  ],
  comments: [
    "comments",
    "comment",
    "commentCount",
    "comment_count",
    "replyCount",
    "reply_count",
    "replies",
    "answerCount"
  ]
});

const config = {
  cookie: requireEnv("GUANGHE_COOKIE"),
  referer: process.env.GUANGHE_REFERER || "https://guanghe.qq.com/",
  origin: process.env.GUANGHE_ORIGIN || "https://guanghe.qq.com",
  outputPath: process.env.GUANGHE_OUTPUT || DEFAULT_OUTPUT,
  intervalMs: readPositiveInt("GUANGHE_INTERVAL_MS", DEFAULT_INTERVAL_MS),
  maxPages: readPositiveInt("GUANGHE_MAX_PAGES", DEFAULT_MAX_PAGES),
  writeEmpty: process.env.GUANGHE_WRITE_EMPTY === "1",
  runOnce: process.env.GUANGHE_ONCE === "1"
};

const headers = {
  Cookie: config.cookie,
  Referer: config.referer,
  Origin: config.origin,
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
};

await runCrawler();

async function runCrawler() {
  await fetchAndWrite();

  if (config.runOnce) return;

  setInterval(() => {
    fetchAndWrite().catch((error) => {
      console.error(`[guanghe-crawler] ${new Date().toISOString()} update failed`, error);
    });
  }, config.intervalMs);
}

async function fetchAndWrite() {
  const startedAt = new Date();
  const associations = {};
  const boards = {};

  for (const [key, boardId] of Object.entries(BOARD_MAP)) {
    const boardResult = await fetchBoardPosts(boardId);
    associations[key] = aggregateBoardStats(boardResult.posts, boardResult.total);
    boards[key] = {
      boardId,
      pagesFetched: boardResult.pagesFetched,
      total: boardResult.total,
      postsFetched: boardResult.posts.length
    };
  }

  const payload = {
    updatedAt: formatLocalTimestamp(startedAt),
    achievedTrunkStage: null,
    source: {
      type: "guanghe-board-posts",
      intervalMs: config.intervalMs,
      boards
    },
    associations
  };

  if (!config.writeEmpty && isEmptyAssociations(associations)) {
    console.warn(
      `[guanghe-crawler] ${payload.updatedAt} skipped write: all board stats are empty. Set GUANGHE_WRITE_EMPTY=1 to write empty data.`
    );
    return;
  }

  await writeJsonAtomic(config.outputPath, payload);
  console.log(
    `[guanghe-crawler] ${payload.updatedAt} wrote ${config.outputPath}: ${JSON.stringify(associations)}`
  );
}

async function fetchBoardPosts(boardId) {
  const posts = [];
  let total = 0;
  let page = 1;
  let pagesFetched = 0;

  while (page <= config.maxPages) {
    const url = new URL(`https://api.guanghe.qq.com/api/board/${boardId}/posts`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", "new");

    const json = await fetchJson(url);
    pagesFetched += 1;

    if (json.code !== 0) {
      throw new Error(`Board ${boardId} returned code=${json.code} msg=${json.msg || ""}`);
    }

    const pageInfo = json.data?.page || {};
    const pagePosts = extractPostList(json.data);
    total = Number(pageInfo.total) || Number(json.data?.total) || total || pagePosts.length;
    posts.push(...pagePosts);

    if (!pagePosts.length) break;

    const limit = Number(pageInfo.limit) || pagePosts.length;
    if (total && page * limit >= total) break;

    page += 1;
  }

  return {
    posts,
    total,
    pagesFetched
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

function normalizePostList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function extractPostList(data) {
  const candidates = [data?.posts, data?.list, data?.items, data?.records];

  for (const candidate of candidates) {
    const posts = normalizePostList(candidate);
    if (posts.length) return posts;
  }

  return Array.isArray(data) ? data : [];
}

function aggregateBoardStats(posts, total) {
  return posts.reduce(
    (stats, post) => {
      stats.views += pickNumber(post, NUMERIC_FIELD_CANDIDATES.views);
      stats.likes += pickNumber(post, NUMERIC_FIELD_CANDIDATES.likes);
      stats.comments += pickNumber(post, NUMERIC_FIELD_CANDIDATES.comments);
      return stats;
    },
    {
      views: 0,
      likes: 0,
      comments: 0,
      posts: Number(total) || posts.length || 0
    }
  );
}

function pickNumber(source, keys) {
  for (const key of keys) {
    const value = readDeepValue(source, key);
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return 0;
}

function isEmptyAssociations(associations) {
  return Object.values(associations).every((stats) => {
    return ["views", "likes", "comments", "posts"].every((key) => Number(stats[key]) === 0);
  });
}

function readDeepValue(source, key) {
  if (!source || typeof source !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];

  for (const value of Object.values(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = readDeepValue(value, key);
      if (nested !== undefined) return nested;
    }
  }

  return undefined;
}

async function writeJsonAtomic(outputPath, payload) {
  const absoluteOutput = resolve(outputPath);
  const temporaryOutput = absoluteOutput.replace(/\.json$/i, ".tmp.json");

  await mkdir(dirname(absoluteOutput), { recursive: true });
  await writeFile(temporaryOutput, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(temporaryOutput, absoluteOutput);
}

function formatLocalTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes())
  ].join("");
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Put it in your server environment or local .env file.`);
  }
  return value;
}

function readPositiveInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

async function loadEnvFile(path) {
  try {
    const content = await readFile(path, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      if (!key || process.env[key] !== undefined) return;

      process.env[key] = unwrapEnvValue(rawValue);
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function unwrapEnvValue(value) {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1);
  }
  return value;
}
