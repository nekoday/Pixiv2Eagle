---
name: release-packaging
description: Re_Pixiv2Eagle 发行打包：npm run release 依据 src/header.txt @version 生成 Releases/{version}/RePixiv2Eagle.js 与 CHANGELOG.md。在发版、打包 Tampermonkey 脚本、生成发行目录时 MUST 使用。
---

# Re_Pixiv2Eagle 发行打包

Tampermonkey 用户脚本的本地发行工作流。产物为**单文件脚本** + **版本更新日志**，不打包 zip、不涉及 Fabric/模组 jar 布局（与通用 `release-packaging` 全局技能区分）。

## 何时使用

- 用户要求**发版**、**打包发行版**、**生成 Releases 目录**
- 需要产出可导入 Tampermonkey 的 `RePixiv2Eagle.js` 副本并附带版本说明
- Agent 协助撰写或整理某版本的 `CHANGELOG.md` 后执行打包

## 版本来源（权威）

- **`src/header.txt`** 中的 `@version` 行（如 `3.2.0`）
- `package.json` 的 `version` 字段**不**参与发行命名
- 构建时 banner 注入产物，`dist/RePixiv2Eagle.js` 与发行副本版本一致

## 工作流

1. **升版本**：编辑 `src/header.txt` 的 `@version`
2. **写更新日志**：编辑 `Releases/{version}/CHANGELOG.md`（若目录尚不存在，可先 `npm run release` 生成模板再补充）
3. **打包**：

```bash
npm run release
```

脚本会**始终**执行 `npm run build`，再复制产物到发行目录。

## 输出结构

```
Releases/
└── {version}/          # 与 @version 一致，如 3.2.0
    ├── RePixiv2Eagle.js  # 自 dist/RePixiv2Eagle.js 复制，可导入 Tampermonkey
    └── CHANGELOG.md    # 该版本更新日志（Keep a Changelog + emoji 小节）
```

### CHANGELOG 格式

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，小节标题使用 emoji + 中文，例如：

| 小节 | 用途 |
|------|------|
| ⚠️ 重要更改 | 破坏性变更 |
| ✨ 新增 | 新功能 |
| 🐛 修复 | Bug 修复 |
| 🔧 技术改进 | 重构、构建、实现 |
| 🎨 界面改进 | UI/样式 |
| 📝 文档 | 说明文档 |

条目形式：`- **标题**: 说明`

**首次生成**：`scripts/release.js` 写入带占位小节的模板（含 3.0.0 主版本说明占位）。**已存在**的 `CHANGELOG.md` **不会**被覆盖，由用户维护内容。

## Git

- `Releases/` 已列入 `.gitignore`，**勿提交**发行产物
- `dist/` 同样被忽略；发行前依赖 `npm run build` 生成最新 `dist/RePixiv2Eagle.js`

## 与验证的关系

- `npm run release` 内含 build，退出码须为 0
- 发版后**建议**按 [`pixiv2eagle-verify`](../../pixiv2eagle-verify/SKILL.md) 手测改动涉及的域
- 安装测试：将 `Releases/{version}/RePixiv2Eagle.js` 导入 Tampermonkey，确认 `@version` 与菜单行为

## 禁止事项

- 不要修改 `src/header.txt` 中的 `[IP_ADDRESS]` 占位符（除非用户明确要求改 `@connect`）
- 不要用 `package.json` version 命名 `Releases/` 子目录
- 不要提交 `Releases/` 或 `dist/` 到 Git
- 不要覆盖用户已编辑的 `Releases/{version}/CHANGELOG.md`

## 相关文件

| 路径 | 作用 |
|------|------|
| `scripts/release.js` | 发行自动化 |
| `scripts/build.js` | esbuild 打包 |
| `src/header.txt` | `@version` 与 Userscript 元数据 |
| `.gitignore` | 忽略 `Releases/`、`dist/` |
