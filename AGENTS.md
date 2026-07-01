# AGENTS.md

本项目是一个 Tampermonkey 用户脚本，用于将 Pixiv 插画/漫画/小说保存到 Eagle 图片管理软件。

## 构建与验证

- 构建：`npm run build`（实际执行 `node scripts/build.js`，esbuild 打包为单文件 IIFE → `dist/RePixiv2Eagle.js`）；开发用 `npm run dev`（watch）。
- **本仓库无测试套件、无 lint / formatter / typecheck**。修改后的验证手段是 `npm run build` 成功通过，并在 Tampermonkey 中手测相关页面——不要去找或新建 `npm test` / lint 命令。
- `dist/` 被 git 忽略，仅在本地构建生成，勿提交产物。

## 源码与运行时

- 源码为 `src/` 下的 ES 模块树；esbuild 以 `src/index.js` 为唯一入口，打包为单个 IIFE 产物 `dist/RePixiv2Eagle.js`。`src/header.txt` 为用户脚本元数据头，构建时作为 banner 注入产物，不在 `index.js` 内手写。
- `src/index.js` 为 bootstrap 入口（注册菜单、组装 monitor、启动路由）；业务逻辑分布在各子目录。
- 用户设置与 `SETTING_KEYS` 集中在 `tampermonkey/setting.js`（各域通过 getter 读取，无独立 `novel/settings.js`）。

```
src/
├── index.js                    # bootstrap 入口
├── header.txt                  # 用户脚本元数据
├── tampermonkey/
│   ├── setting.js              # SETTING_KEYS / DEFAULTS / getters / menu handlers
│   ├── request.js              # gmRequest / gmFetch / gmFetchBinary / gmFetchText
│   ├── storage.js              # eagleIndex 内部缓存
│   ├── menu.js                 # GM_registerMenuCommand
│   └── logger.js               # dbg / warn / err
├── config/
│   ├── constants.js
│   ├── monitor.js
│   └── selectors/              # artwork / list / manga / novel 等 + index.js 聚合
├── routing/
│   ├── observe-url.js
│   └── handle-page.js
├── ui/
│   ├── toast.js
│   ├── button.js
│   └── dom.js
├── shared/
│   ├── chapter-title.js
│   ├── lib-loader.js           # 共享 CDN 动态加载（ugoira / epub 复用）
│   └── marking/
│       └── insert-badge.js
├── eagle/
│   ├── client.js
│   ├── folder.js
│   ├── artist.js
│   ├── artist-matcher.js       # ArtistMatcher 类与 matcher 工厂（打破 artist↔folder 环）
│   ├── type-folder.js
│   ├── items.js
│   └── index-cache.js
├── artwork/
│   ├── id.js
│   ├── details.js
│   ├── pages.js
│   ├── save.js
│   ├── tags.js
│   ├── artist-info.js
│   ├── find-saved-folder.js    # 已保存文件夹查找（自 eagle/items 解耦）
│   ├── ui/
│   │   ├── save-button.js
│   │   ├── recommendation-mark.js
│   │   └── move-subfolder.js
│   └── ugoira/
│       ├── meta.js
│       ├── lib-loader.js       # ugoira 专用 CDN 加载（复用 shared/lib-loader）
│       └── convert.js
├── manga/
│   └── series/
│       ├── folder.js
│       ├── update-chapters.js
│       ├── ui-update-button.js
│       └── marking.js
├── novel/
│   ├── id.js
│   ├── resolvers.js
│   ├── details.js
│   ├── content.js
│   ├── download.js
│   ├── save/
│   │   ├── index.js
│   │   ├── text-markdown.js
│   │   └── epub.js
│   ├── ui/
│   │   ├── save-button.js
│   │   └── saved-state.js
│   └── series/
│       ├── find-series-folder.js
│       └── marking.js
└── artist-list/
    └── marking.js
```

- 运行环境：浏览器 + Tampermonkey；依赖 `GM_xmlhttpRequest` / `GM_getValue` / `GM_setValue` / `GM_registerMenuCommand`。
- 运行时第三方库（JSZip / fflate / gif.js）经 CDN 动态 `<script>` 注入，**不**走 `import`、不纳入 esbuild bundle。

## 领域规则文件（编辑对应代码前必读）

Cursor Agent 以 `.cursor/rules/*.mdc` 为权威规则源（按 glob 自动注入）；[`docs/rules/`](docs/rules/) 为同源 Markdown 备份，供人工阅读与版本对照，修改规则时请同步更新两处。

| 领域 | 规则文件 | 何时阅读 |
|---|---|---|
| 语法与代码风格 | [`.cursor/rules/syntax.mdc`](.cursor/rules/syntax.mdc)（备份：[`docs/rules/syntax.md`](docs/rules/syntax.md)） | 修改 `src/**/*.js` 或 `scripts/build.js` 时 |
| Pixiv（DOM/URL/Ajax） | [`.cursor/rules/pixiv.mdc`](.cursor/rules/pixiv.mdc)（备份：[`docs/rules/pixiv.md`](docs/rules/pixiv.md)） | 修改 Pixiv 页面交互、选择器、作品数据获取逻辑时 |
| Eagle API | [`.cursor/rules/eagle.mdc`](.cursor/rules/eagle.mdc)（备份：[`docs/rules/eagle.md`](docs/rules/eagle.md)） | 修改与 Eagle（localhost:41595）通信逻辑时 |

## 项目 Skills

Skill 文件位于 `.cursor/skills/`；规则索引见 [`.cursor/rules/agents-skills.mdc`](.cursor/rules/agents-skills.mdc)。Agent 在对应场景 **MUST** 读取完整 `SKILL.md`。

- `pixiv2eagle-verify` — 代码改动收尾、用户问如何验证、claim 完成前
- `pixiv-selectors` — Pixiv UI 改版、按钮/标记消失、改 DOM 交互
- `eagle-api-patterns` — 新增/修改 Eagle 集成、文件夹或索引逻辑
- `module-placement` — 新功能、拆文件、不确定代码放哪
- `release-packaging` — 发版、`npm run release`、生成 `Releases/{version}/`

Skill 提供工作流与项目模式；领域细节仍以 `.cursor/rules/*.mdc` 为准。

## 发行打包

- 命令：`npm run release`（`node scripts/release.js`）；**始终**先 `npm run build`，再复制 `dist/RePixiv2Eagle.js` 到 `Releases/{version}/`
- 版本号以 `src/header.txt` 的 `@version` 为准；`Releases/` 被 git 忽略，勿提交
- 详见 [`.cursor/skills/release-packaging/SKILL.md`](.cursor/skills/release-packaging/SKILL.md)

## 注意事项

- Cursor 通过根目录 `.cursorignore` 引用 `.gitignore`（`@.gitignore`），Agent 索引与读取时会一并排除 `node_modules/`、`dist/` 等被 git 忽略的路径；新增需排除目录时改 `.gitignore` 即可。
- `docs/superpowers/` 为本地 Agent 规划草稿，已列入 `.gitignore`，勿提交。
- 开发基线为 **`main`**（esbuild 模块化已合入；远程可能仍保留旧单文件 `master` 历史）。
- `src/header.txt` 中的 `[IP_ADDRESS]` 是字面占位符——构建脚本**不会**替换它，会原样输出到 `dist/RePixiv2Eagle.js`（影响 `@version` 与一条 `@connect`）。改版本号 / 新增 `@connect` 域名请直接编辑 `src/header.txt`。
- 源码已由单文件拆分为 ES 模块树；esbuild 仍产出单 IIFE 产物，用户可见行为应与拆分前等价。
- 规则中的强制级别采用 RFC 2119 语义：**MUST**（必须）/ **SHOULD**（建议）/ **MAY**（可选）。规则内容为中文叙述，代码标识符、API 名、URL 保持原文。

## Learned User Preferences

- 文档与 Agent 回复使用简体中文；代码标识符、API 名、URL 保持原文。
- 目录命名用 `tampermonkey/`（小写），不用 `Tampermonkey/` 或 `gm/`。
- 用户设置与 `SETTING_KEYS` 集中在 `tampermonkey/setting.js`；各域通过 getter 读取，不另建域内 settings 文件。
- `docs/superpowers/` 等 Agent 工作流草稿不纳入版本库。
- 发版：先改 `src/header.txt` 的 `@version`（及 CHANGELOG），再 `npm run release`；`@author` 中 `juzijun233` 居前。
- 未明确要求时不主动 git commit 或 push。

## Learned Workspace Facts

- 仓库 fork 自 [nekoday/Pixiv2Eagle](https://github.com/nekoday/Pixiv2Eagle)；GitHub 地址为 `https://github.com/juzijun233/Re_Pixiv2Eagle`（仓库名带下划线）。
- 构建产物为 `dist/RePixiv2Eagle.js`；发行包为 `Releases/{version}/RePixiv2Eagle.js` + `CHANGELOG.md`（`Releases/` 已 git 忽略）。
- Tampermonkey `@name` 当前为 `Re_Pixiv2Eagle`；文件名与用户可见脚本品牌倾向 `RePixiv2Eagle`（无下划线）。
- 网页内设置 UI 在 `src/ui/control-panel/`（含 base64 配置导入/导出）；保存进度 toast 在 `src/ui/save-progress/`。
- 已保存标记动态更新由 `src/shared/marking/saved-event-bus.js` 协调（BroadcastChannel + GM 存储，联动详情页/推荐区/作者列表等）。
- 漫画/小说系列分属 `manga/series/`、`novel/series/`，无顶层 `series/`。
- `tampermonkey/storage.js` 缓存 Eagle 索引；`tampermonkey/setting.js` 持久化用户设置。
- `eagle/artist-matcher.js` 打破 artist↔folder 循环依赖。
- UI 主题（浅色/深色/跟随系统）在 `src/ui/theme.js`，设置项经控制面板暴露。
