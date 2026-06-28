---
name: pixiv-selectors
description: 维护 Pixiv DOM 选择器：src/config/selectors/ 结构、领域前缀与 fallback 策略。在 Pixiv UI 改版、按钮/标记消失、或修改 DOM 交互时 MUST 使用。
---

# Pixiv 选择器维护

## 权威规则

编辑选择器或 DOM 交互逻辑前，**MUST** 阅读 [`.cursor/rules/pixiv.mdc`](../../rules/pixiv.mdc)（备份：[`docs/rules/pixiv.md`](../../../docs/rules/pixiv.md)）。本文 skill 不复制规则全文。

## 目录结构

```
src/config/selectors/
├── index.js          # 聚合 re-export，业务代码从此导入
├── artwork.js        # 作品详情页、推荐区域
├── list.js           # 画师列表、系列页列表
├── manga.js          # 漫画详情
├── manga-series.js   # 漫画系列页（可 re-export list 常量）
├── novel.js          # 小说详情与系列
└── novel-series.js   # 小说系列列表
```

**MUST** 新增选择器放入对应领域文件，经 `index.js` 导出；**禁止**在业务模块内硬编码选择器字符串。

## 命名与前缀

| 前缀 | 用途 | 示例 |
|------|------|------|
| `REC_` | 推荐区域 | `REC_THUMBNAIL_SELECTOR` |
| `ARTWORK_` | 作品详情按钮 | `ARTWORK_BUTTON_CONTAINER_SELECTOR` |
| `LIST_` / `THUMBNAIL_` | 画师列表 | `LIST_CONTAINER_SELECTOR` |
| `NOVEL_` | 小说 | `NOVEL_CONTENT_SELECTOR` |
| `MANGA_` | 漫画系列 | `MANGA_SERIES_HEADER_SELECTOR` |
| `SERIES_` | 通用系列列表 | `SERIES_PAGE_LIST_SELECTOR` |

常量名后缀 `_SELECTOR`；备选选择器用 `_FALLBACK_` 或 `_PARTIAL_` 区分。

## Fallback 策略

Pixiv 使用 styled-components，类名哈希会变。推荐模式：

1. **主选择器**：完整 class 链（最精确）
2. **Fallback**：较短 class 前缀（`_PARTIAL_`）或结构选择器
3. **运行时降级**：业务代码按序尝试，如推荐区域：

```javascript
// recommendation-mark.js 模式
const thumb = li.querySelector(REC_THUMBNAIL_SELECTOR)
    || li.querySelector(REC_THUMBNAIL_FALLBACK_SELECTOR)
    || li.querySelector(REC_THUMBNAIL_FALLBACK_PARTIAL_SELECTOR);
```

4. **waitForElement**：动态内容用 `ui/dom.js` 的 `waitForElement(selector, timeout)` 等待 DOM

## 路由与观察器

页面注入由 `config/monitor.js` + `routing/handle-page.js` 驱动：

| urlSuffix | handler | observeID |
|-----------|---------|-----------|
| `/artworks` | 保存按钮 + 推荐标记 | `EAGLE_SAVE_BUTTON_ID` |
| `/novel/show.php` | 小说保存按钮 | 同上 |
| `/novel/series` | 系列章节标记 | `null`（退避重试） |
| `/user` | 画师列表标记 | `null` |

修改选择器后须手测对应页面（见 `pixiv2eagle-verify` skill）。

## 修改检查清单

- [ ] 选择器加中文注释说明 DOM 用途
- [ ] 若 UI 有两套布局，提供 fallback 常量
- [ ] 业务 import 来自 `config/selectors/index.js`
- [ ] 对应 Pixiv 页面手测通过
