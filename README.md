# Guanghe Resonance Tree

这是一个静态 H5 项目，用于呈现「共鸣者档案」测试流程、结果卡片，以及四协会共鸣树的展示与调试页面。项目不依赖打包工具，直接通过本地 HTTP 静态服务即可运行。

## 快速启动

在项目根目录启动静态服务：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

如果系统没有 `python` 命令，也可以使用 Codex 内置 Python：

```powershell
& 'C:\Users\em-_t\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 4173 --bind 127.0.0.1
```

本机访问：

- 首页测试流程：http://127.0.0.1:4173/index.html
- 共鸣树展示页：http://127.0.0.1:4173/tree-view.html
- 共鸣树调试页：http://127.0.0.1:4173/tree.html?preset=stage3&debug=1

手机局域网测试时，需要把服务绑定到 `0.0.0.0`，并用电脑的局域网 IP 访问：

```powershell
& 'C:\Users\em-_t\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 4174 --bind 0.0.0.0
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

面向用户的共鸣树展示页。默认读取 `data/tree-mock.json` 作为演示数据，计算总共鸣值、当前树干阶段，以及四个协会分支的疏密状态。

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
6. 树图贴图与坐标：说明资源命名、坐标配置和展示缩放基准。
7. 开发注意事项：记录维护时容易踩坑的地方。

## 开发注意事项

- 这是静态项目，不需要 `npm install` 或构建步骤。
- 不建议直接双击 HTML 文件打开，ES Module 与 `fetch()` 在 `file://` 下可能受限；请使用 HTTP 静态服务。
- 修改 `data/*.json` 后建议刷新页面并加缓存参数，例如 `?v=dev1`。
- 修改树图坐标时，优先使用 `tree.html?preset=stage3&debug=1` 调试并复制 JSON。
- `tree-view.html` 的展示缩放逻辑在 `src/treeView.js`，调试页 `tree.html` 不使用这套缩放逻辑。
- 如果手机局域网访问失败，先确认手机和电脑在同一 Wi-Fi，再检查防火墙。
