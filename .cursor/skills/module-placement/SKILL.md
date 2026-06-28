---
name: module-placement
description: Re_Pixiv2Eagle 模块放置指南：域边界、index.js bootstrap 职责、解环模式。在新功能、拆文件或不确定代码放哪时 MUST 使用。
---

# 模块放置指南

## 权威约定

- 完整目录树与构建约定：[`AGENTS.md`](../../../AGENTS.md)（**权威**）
- 语法与组织规则：[`.cursor/rules/syntax.mdc`](../../rules/syntax.mdc)（备份：[`docs/rules/syntax.md`](../../../docs/rules/syntax.md)）

## 目录树摘要

```
src/
├── index.js              # bootstrap ONLY
├── header.txt            # UserScript 元数据
├── Tampermonkey/         # GM 封装：setting / request / storage / menu / logger
├── config/               # constants / monitor / selectors
├── routing/              # URL 观察与页面 handler 调度
├── ui/                   # toast / button / dom 通用 UI
├── shared/               # 跨域复用：lib-loader / marking / chapter-title
├── eagle/                # Eagle API 客户端与文件夹逻辑
├── artwork/              # 插画/动图保存与 UI
├── manga/series/         # 漫画系列更新与标记
├── novel/                # 小说解析、保存、UI、系列
└── artist-list/          # 画师作品列表标记
```

## 域边界表

| 域 | 放什么 | 不放什么 |
|----|--------|---------|
| `Tampermonkey/` | GM API 封装、全局设置键 | Pixiv/Eagle 业务逻辑 |
| `config/` | 常量、monitor 配置、DOM 选择器 | API 调用、UI 组件 |
| `routing/` | URL 变化监听、handler 调度 | 具体页面业务 |
| `ui/` | 通用按钮/toast/DOM 工具 | 领域特定逻辑 |
| `shared/` | 两域以上复用的纯工具 | 单域专用代码 |
| `eagle/` | Eagle API、文件夹、索引、ArtistMatcher | Pixiv 页面解析 |
| `artwork/` | 插画/ugoira 保存与详情页 UI | 小说、漫画系列 |
| `novel/` | 小说全流程 | 插画保存 |
| `manga/series/` | 漫画系列 | 插画单页 |
| `artist-list/` | 画师列表页标记 | 作品详情页 |

## index.js 职责（bootstrap ONLY）

当前 `index.js` 仅做：

1. `registerMenuCommands()`
2. `createMonitorConfig(handlers)` 注入各域 handler
3. `ensureEagleIndex()` 启动索引
4. 初始 URL 匹配 + `observeUrlChanges()`

**MUST NOT** 在 `index.js` 堆积业务逻辑。新功能放入对应域目录，仅在 bootstrap 注册 handler 或 bind。

## 解环模式

syntax 规则 7.1–7.2 要求避免循环 import：

| 模式 | 示例 |
|------|------|
| **抽取第三模块** | `eagle/artist-matcher.js` 打破 artist↔folder |
| **bind/inject** | `bindEagleIndexRefresh(...)` 在模块末尾注入依赖 |
| **bootstrap wiring** | `index.js` 组装 monitor handlers，域模块不互引 UI |

新增模块时先画 import 方向：底层工具 → 域逻辑 → bootstrap 装配。

## 新功能决策树

1. 只涉及 Eagle API？→ `eagle/`
2. 只涉及 Pixiv DOM/数据？→ 对应域 + `config/selectors/`
3. 跨插画与小说？→ `shared/` 或各域各一份（优先不强行抽象）
4. 新页面类型？→ 域目录 + `config/monitor.js` 新增 monitor 项
5. 新 GM 设置？→ `Tampermonkey/setting.js` 的 `SETTING_KEYS`

## 禁止事项

- 不要在 `index.js` 写 save/mark/button 业务
- 不要新建 `novel/settings.js`（设置集中在 `Tampermonkey/setting.js`）
- 不要 `import` CDN 库（走 `shared/lib-loader.js` 动态加载）
- 不要在业务模块直接调用 `GM_xmlhttpRequest`
