# Re_Pixiv2Eagle

[https://github.com/juzijun233/Re_Pixiv2Eagle](https://github.com/juzijun233/Re_Pixiv2Eagle)

基于上游 [Pixiv2Eagle](https://github.com/nekoday/Pixiv2Eagle) 的重构分支。

本仓库使用 **esbuild** 作为构建管线：源码位于 `src/`，构建产物为单文件用户脚本 `dist/RePixiv2Eagle.js`，可直接导入 Tampermonkey。

> 当前阶段：已将上游单文件脚本原样迁移到 esbuild 构建（业务逻辑未改动）。后续将在此基础上逐步做模块拆分。

## 目录结构

```
src/
├── header.txt      # 用户脚本元数据头（@grant/@connect 等），构建时作为 banner 注入
└── index.js        # 脚本代码体（当前为单文件，后续拆分）
scripts/
└── build.js        # esbuild 构建脚本
dist/
└── RePixiv2Eagle.js  # 构建产物（git 忽略）
```

## 开发

```bash
npm install
npm run dev    # 开发模式（esbuild --watch 自动重打包）
npm run build  # 生产构建，输出 dist/RePixiv2Eagle.js
```

## 安装

1. 运行 `npm run build` 生成 `dist/RePixiv2Eagle.js`。
2. 打开 Tampermonkey → 新建脚本 → 粘贴 `dist/RePixiv2Eagle.js` 全部内容，或直接以本地文件方式导入。
3. 需配合 [Eagle](https://eagle.cool/) 客户端（监听 `http://localhost:41595`）。

## 与上游同步

元数据头与代码体来自上游 `Pixiv.js`，分别对应 `src/header.txt`（原文件第 1–49 行）与 `src/index.js`（原文件第 52–5419 行去除外层 IIFE 包裹）。

## License

MIT，沿用上游许可证。
