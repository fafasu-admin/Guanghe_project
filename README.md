# Guanghe Resonance Tree

这是一个静态 H5 项目，用于呈现「共鸣者档案」测试流程、结果卡片，以及四协会共鸣树的展示与调试页面。项目不依赖打包工具，直接通过本地 HTTP 静态服务即可运行。

## 快速启动

在项目根目录启动静态服务：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

如果系统没有 `python` 命令，请先安装 Python 3，或将 Python 加入系统 PATH 后再执行上面的命令。

本机访问：

- 首页测试流程：http://127.0.0.1:4173/index.html
- 共鸣树展示页：http://127.0.0.1:4173/tree-view.html
- 共鸣树调试页：http://127.0.0.1:4173/tree.html?preset=stage3&debug=1

手机局域网测试时，需要把服务绑定到 `0.0.0.0`，并用电脑的局域网 IP 访问：

```powershell
python -m http.server 4174 --bind 0.0.0.0
```

示例地址：

```text
http://<电脑局域网IP>:4174/tree-view.html
```

手机和电脑必须连接同一个 Wi-Fi。如果手机无法访问，优先检查 Windows 防火墙是否拦截 Python。

## 项目结构

```text
.
├── index.html                 # 共鸣者档案测试主入口
├── tree-view.html             # 面向用户的共鸣树展示页
├── tree.html                  # 共鸣树调试页，可通过 debug=1 打开调试面板
├── styles.css                 # 全站样式、结果页、树图展示与响应式规则
├── data/
│   ├── associations.json      # 四协会文案、颜色、图标、结果卡资源
│   ├── questions.json         # 测试题目与选项
│   ├── tree-config.json       # 共鸣树阶段、阈值、贴图资源配置
│   └── tree-mock.json         # 共鸣树展示页默认 mock 数据
├── src/
│   ├── app.js                 # 首页测试流程、结果计算与页面状态
│   ├── shareCard.js           # 结果卡分享图生成逻辑
│   ├── treeCore.js            # 共鸣树核心计算、贴图合成、分支密度与坐标配置
│   ├── tree.js                # tree.html 调试页入口
│   ├── treeView.js            # tree-view.html 展示页入口与展示页缩放逻辑
│   └── api/
│       └── report.js          # 埋点事件封装
├── scripts/
│   └── fetch-guanghe-data.mjs # 光核社区数据抓取脚本，输出 data/tree-live.json
├── assets/
│   ├── cards/                 # 结果卡、按钮、协会图标等图片资源
│   └── tree/resonance-art/    # 共鸣树分阶段贴图资源
│       ├── stage1/
│       ├── stage2/
│       └── stage3/
└── vendor/
    └── html2canvas.min.js     # 分享卡截图依赖
```

## 页面说明

### `index.html`

测试主流程页面。用户完成题目后，会根据选项倾向生成所属协会、结果卡、关键词、属性展示，以及跳转共鸣树展示页的入口。

主要脚本：

- `src/app.js`
- `src/shareCard.js`
- `vendor/html2canvas.min.js`

主要数据：

- `data/questions.json`
- `data/associations.json`

### `tree-view.html`

面向用户的共鸣树展示页。页面会优先读取 `data/tree-live.json`，读取失败时回退到 `data/tree-mock.json` 作为演示数据，计算总共鸣值、当前树干阶段，以及四个协会分支的疏密状态。

当前默认 mock 数据会得到：

- 总分：`3499`
- 树干：`stage3`
- 四个分支：全部 `lush`

主要脚本：

- `src/treeView.js`
- `src/treeCore.js`

### `tree.html`

共鸣树测试与调试页面。常用调试地址：

```text
tree.html?preset=stage3&debug=1
```

`debug=1` 会显示调试面板，可调整分数、阶段阈值，以及分支贴图坐标。调试面板复制出的 JSON 对应 `src/treeCore.js` 中的 `BRANCH_LAYER_ADJUSTMENTS`。

## 共鸣树数据与计算

共鸣值计算权重定义在 `src/treeCore.js`：

```js
views * 1 + likes * 3 + comments * 5 + posts * 10
```

分支密度阈值定义在 `data/tree-config.json`：

- `medium`: 180
- `lush`: 520

树干阶段阈值定义在 `data/tree-config.json` 的 `stages` 中：

- `stage1`: 0
- `stage2`: 800
- `stage3`: 2200

## 光核数据爬虫

`scripts/fetch-guanghe-data.mjs` 用于从光核社区接口抓取四个目标子板块数据，并生成前端可直接消费的 `data/tree-live.json`。

目标板块：

- `soul`: 137，灵魂编织协会
- `sense`: 138，感官铸型协会
- `logic`: 139，逻辑构序协会
- `rules`: 140，规则制定协会

运行前先复制 `.env.example` 为 `.env`，并在服务器环境变量或本地 shell 中配置：

```text
GUANGHE_COOKIE=从浏览器 Fetch/XHR 请求里复制的完整 Cookie
GUANGHE_REFERER=https://guanghe.qq.com/
GUANGHE_ORIGIN=https://guanghe.qq.com
GUANGHE_INTERVAL_MS=60000
GUANGHE_OUTPUT=data/tree-live.json
GUANGHE_MAX_PAGES=20
GUANGHE_WRITE_EMPTY=0
```

不要把真实 Cookie 写进代码、README、截图或 Git。`.env` 和 `data/tree-live.json` 已在 `.gitignore` 中忽略。

本地单次测试：

```powershell
$env:GUANGHE_COOKIE="your-cookie"
$env:GUANGHE_ONCE="1"
node scripts/fetch-guanghe-data.mjs
```

如果已经把 Cookie 写入本地 `.env`，也可以只临时指定单次运行开关：

```powershell
$env:GUANGHE_ONCE="1"
node scripts/fetch-guanghe-data.mjs
```

成功时会看到类似输出：

```text
[guanghe-crawler] 2026-06-03 11:22 wrote data/tree-live.json: {"soul":{"views":4,"likes":1,"comments":0,"posts":3},"sense":{"views":3,"likes":0,"comments":0,"posts":3},"logic":{"views":3,"likes":0,"comments":0,"posts":3},"rules":{"views":3,"likes":0,"comments":0,"posts":3}}
```

服务器持续运行：

```powershell
$env:GUANGHE_COOKIE="your-cookie"
node scripts/fetch-guanghe-data.mjs
```

脚本默认每 1 分钟抓取一次。接口返回数据后，会聚合为：

```json
{
  "updatedAt": "2026-06-03 12:00",
  "achievedTrunkStage": null,
  "associations": {
    "logic": {
      "views": 0,
      "likes": 0,
      "comments": 0,
      "posts": 0
    }
  }
}
```

默认情况下，如果四个板块都返回 0 条数据，脚本会跳过写入，避免把现有展示数据覆盖成空树。确认确实需要写入空结果时，可以设置 `GUANGHE_WRITE_EMPTY=1`。

Cookie 时效通常有限，需要定期从浏览器更新。若接口返回 `401`、`403`、未登录或 `code` 非 0，优先检查 Cookie 是否过期。

## 树图贴图与坐标

树图资源位于：

```text
assets/tree/resonance-art/<stage>/
```

每个阶段包含：

- `base-sparse.png`
- `logic-medium.png`
- `logic-lush.png`
- `sense-medium.png`
- `sense-lush.png`
- `soul-medium.png`
- `soul-lush.png`
- `rules-medium.png`
- `rules-lush.png`

分支贴图坐标配置位于 `src/treeCore.js` 的 `BRANCH_LAYER_ADJUSTMENTS`。其中：

- `logic`：逻辑构序，蓝紫分支
- `sense`：感官铸形，青色分支
- `soul`：灵魂编织，黄色分支
- `rules`：规则制定，红色分支

展示页 `tree-view.html` 使用 `610px` 参考画布，再根据实际展示高度进行等比缩放。这样调试页复制出的坐标可以继续作为贴图基准，同时避免 PC 或手机展示时树图裁切。

## README 文档结构

本文档按以下结构维护：

1. 项目简介：说明项目用途和运行方式。
2. 快速启动：列出本机和手机局域网测试方法。
3. 项目结构：解释根目录、数据、脚本、资源的职责。
4. 页面说明：分别说明首页、展示页、调试页。
5. 数据与计算：说明共鸣值、分支密度、树干阶段的来源。
6. 光核数据爬虫：说明 Cookie 配置、抓取脚本和输出 JSON。
7. 树图贴图与坐标：说明资源命名、坐标配置和展示缩放基准。
8. 开发注意事项：记录维护时容易踩坑的地方。

## 开发注意事项

- 这是静态项目，不需要 `npm install` 或构建步骤。
- 不建议直接双击 HTML 文件打开，ES Module 与 `fetch()` 在 `file://` 下可能受限；请使用 HTTP 静态服务。
- 修改 `data/*.json` 后建议刷新页面并加缓存参数，例如 `?v=dev1`。
- 实时数据由 `data/tree-live.json` 提供；本地不存在该文件时会自动回退到 `data/tree-mock.json`。
- 修改树图坐标时，优先使用 `tree.html?preset=stage3&debug=1` 调试并复制 JSON。
- `tree-view.html` 的展示缩放逻辑在 `src/treeView.js`，调试页 `tree.html` 不使用这套缩放逻辑。
- 光核 Cookie 只放服务器环境变量或本地 `.env`，不要提交到 GitHub。
- 如果手机局域网访问失败，先确认手机和电脑在同一 Wi-Fi，再检查防火墙。
