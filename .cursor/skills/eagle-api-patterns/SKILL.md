---
name: eagle-api-patterns
description: Eagle localhost:41595 API 集成模式：端点、文件夹层级、ArtistMatcher、item.url 匹配与索引失效。在新增/修改 Eagle 集成、文件夹或索引逻辑时 MUST 使用。
---

# Eagle API 集成模式

## 权威规则

编辑 Eagle 通信逻辑前，**MUST** 阅读 [`.cursor/rules/eagle.mdc`](../../rules/eagle.mdc)（备份：[`docs/rules/eagle.md`](../../../docs/rules/eagle.md)）。本文 skill 不复制规则全文。

## 基础约定

- 基址：`http://localhost:41595`
- 请求**必须**经 `Tampermonkey/request.js` 的 `gmFetch`（JSON POST/GET）
- POST 须设 `Content-Type: application/json`，body 用 `JSON.stringify`
- 启动检查：`eagle/client.js` → `GET /api/application/info`

## 常用端点

| 端点 | 用途 | 主要调用方 |
|------|------|-----------|
| `/api/application/info` | 检测 Eagle 是否运行 | `client.js` |
| `/api/folder/list` | 文件夹树 | `index-cache.js`, `artist.js` |
| `/api/folder/create` | 创建文件夹 | `folder.js` |
| `/api/folder/update` | 更新描述等 | `folder.js`, `artist-info.js` |
| `/api/folder/rename` | 重命名 | `manga/series/update-chapters.js` |
| `/api/folder/activate` | 激活文件夹 | `novel/ui/saved-state.js` |
| `/api/item/list` | 分页列 item | `items.js`, `find-saved-folder.js` |
| `/api/item/info` | 单 item 详情 | `items.js`（深度 url 匹配） |
| `/api/item/addFromURLs` | URL 导入 | `items.js`, `novel/save/` |
| `/api/item/add` | 直接添加 | `novel/save/` |
| `/api/item/addFromPath` | 本地路径添加 | `novel/save/` |
| `/api/item/update` | 更新 item | `move-subfolder.js`, `update-chapters.js` |

## 文件夹层级

```
Pixiv 根文件夹 (用户配置的 folderId)
└── 画师文件夹 (description: "pid = {uid}" 或 ArtistMatcher 模板)
    ├── 类型文件夹 (description: illustrations / manga / novels)
    │   └── 作品子文件夹 (description: 纯数字 PID)  ← 多页/系列时
    └── 系列文件夹 (description: 系列 URL)
```

- 类型映射见 `eagle/type-folder.js`（illust/ugoira→插画, manga→漫画, novel→小说）
- 系列文件夹 description 格式：`https://www.pixiv.net/user/{uid}/series/{seriesId}`

## ArtistMatcher

`eagle/artist-matcher.js` 打破 `artist` ↔ `folder` 循环依赖：

- 模板占位符：`$uid`（数字）、`$name`（画师名）
- `match(str, uid)` / `generate(uid, name)` / `extract(str)`
- 用户可在菜单「设置画师文件夹名称模板」修改；读取 `SETTING_KEYS.ARTIST_MATCHER_TEMPLATE`

## item.url 匹配

判定作品是否已保存的核心模式（`eagle/items.js`）：

1. 构造 Pixiv URL：`https://www.pixiv.net/artworks/{id}` 或小说对应 URL
2. `GET /api/item/list?folders={folderId}&limit=&offset=` 分页遍历
3. 快速匹配：`item.url === artworkUrl`
4. 深度匹配：列表未命中时并发调用 `/api/item/info?id=` 比对 `data.url`

## 索引（index-cache.js）

全局画师索引 `Map<uid, { id, pids: Set }>`：

- 启动时 `ensureEagleIndex()`（`index.js` bootstrap 调用）
- 缓存：`Tampermonkey/storage.js` + `INDEX_EXPIRE_TIME` 过期
- **失效时机**：`invalidateEagleIndex()` — 菜单「强制更新 Eagle 索引」、过期、folderId 变更
- 构建：递归 `/api/folder/list`，画师 folder description 匹配 `pid = {uid}`，子孙 description 为纯数字即 PID

## 解环模式

- `bindEagleIndexRefresh({ invalidateEagleIndex, ensureEagleIndex })` 在 `index-cache.js` 末尾注入 setting 模块
- 新 Eagle 功能若与 setting/artist 互引，优先抽取到 `artist-matcher.js` 或 bootstrap bind
