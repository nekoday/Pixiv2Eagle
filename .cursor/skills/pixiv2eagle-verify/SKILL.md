---
name: pixiv2eagle-verify
description: 验证 Re_Pixiv2Eagle 代码改动：npm run build 为唯一自动化检查，Tampermonkey 手测 7 项清单。在代码改动收尾、用户询问如何验证、或 claim 完成前 MUST 使用。
---

# Pixiv2Eagle 验证

## 前置条件

- Eagle 应用**必须**已启动（API 基址 `http://localhost:41595`）
- Tampermonkey 已安装并启用本脚本（`dist/Pixiv.js` 或开发 watch 产物）
- 已在菜单中配置 Pixiv 根文件夹 ID

## 自动化验证（唯一）

```bash
npm run build
```

- **MUST** 在 claim 完成前执行，退出码须为 0
- **禁止** 查找、运行或新建 `npm test` / lint / typecheck——本仓库无此类工具（见 `AGENTS.md`）

## 手测清单（7 项）

改动涉及对应域时，**MUST** 手测该项：

| # | 域 | 触发改动范围 |
|---|-----|-------------|
| 1 | 插画保存 | `artwork/`、`eagle/` 保存逻辑 |
| 2 | ugoira 动图 | `artwork/ugoira/` |
| 3 | 漫画系列 | `manga/series/` |
| 4 | 画师列表标记 | `artist-list/`、`config/selectors/list.js` |
| 5 | 小说三格式 | `novel/save/`（TXT / MD / EPUB） |
| 6 | 小说系列 | `novel/series/` |
| 7 | 菜单项 | `Tampermonkey/menu.js`、`setting.js` |

详细步骤见 [reference.md](reference.md)。

## 完成报告模板

```
验证结果：
- [ ] npm run build — 通过 / 失败
- [ ] Eagle 运行中
- [ ] 手测项：列出已测编号与结果
- [ ] 未测项：说明原因（若无则写「无」）
```

## 禁止事项

- 不要因「无测试框架」而跳过 build
- 不要声称「已验证」而未运行 build
- 跨域改动时不得只测一项就 claim 完成
