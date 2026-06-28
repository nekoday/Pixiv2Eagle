# AGENTS.md

本项目是一个 Tampermonkey 用户脚本，用于将 Pixiv 插画/漫画/小说保存到 Eagle 图片管理软件。

## 构建与验证

- 构建：`npm run build`（实际执行 `node scripts/build.js`，esbuild 打包为单文件 IIFE → `dist/Pixiv.js`）；开发用 `npm run dev`（watch）。
- **本仓库无测试套件、无 lint / formatter / typecheck**。修改后的验证手段是 `npm run build` 成功通过，并在 Tampermonkey 中手测相关页面——不要去找或新建 `npm test` / lint 命令。
- `dist/` 被 git 忽略，仅在本地构建生成，勿提交产物。

## 源码与运行时

- 源码为 `src/` 下的 ES 模块树；esbuild 以 `src/index.js` 为唯一入口，打包为单个 IIFE 产物 `dist/Pixiv.js`。`src/header.txt` 为用户脚本元数据头，构建时作为 banner 注入产物，不在 `index.js` 内手写。
- `src/index.js` 为 bootstrap 入口（注册菜单、组装 monitor、启动路由）；业务逻辑分布在各子目录：

```
src/
├── index.js              # bootstrap 入口
├── header.txt            # 用户脚本元数据
├── Tampermonkey/         # GM 封装（setting / request / storage / menu / logger）
├── config/               # constants、monitor、selectors/
├── routing/              # URL 观察与页面分发
├── ui/                   # toast、button、dom
├── shared/               # 跨领域共享（chapter-title、marking/）
├── eagle/                # Eagle API 客户端与索引缓存
├── artwork/              # 插画保存（含 ugoira/）
├── manga/                # 漫画（series/ 子目录）
├── novel/                # 小说（save/、ui/、series/ 子目录）
└── artist-list/          # 画师列表已保存标记
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

## 注意事项

- Cursor 通过根目录 `.cursorignore` 引用 `.gitignore`（`@.gitignore`），Agent 索引与读取时会一并排除 `node_modules/`、`dist/` 等被 git 忽略的路径；新增需排除目录时改 `.gitignore` 即可。
- `src/header.txt` 中的 `[IP_ADDRESS]` 是字面占位符——构建脚本**不会**替换它，会原样输出到 `dist/Pixiv.js`（影响 `@version` 与一条 `@connect`）。改版本号 / 新增 `@connect` 域名请直接编辑 `src/header.txt`。
- 源码已由单文件拆分为 ES 模块树；esbuild 仍产出单 IIFE 产物，用户可见行为应与拆分前等价。
- 规则中的强制级别采用 RFC 2119 语义：**MUST**（必须）/ **SHOULD**（建议）/ **MAY**（可选）。规则内容为中文叙述，代码标识符、API 名、URL 保持原文。
