# Re_Pixiv2Eagle

基于 [Pixiv2Eagle](https://github.com/nekoday/Pixiv2Eagle) 重构的 Tampermonkey 用户脚本。

使用 esbuild 进行模块化构建，将拆分后的多文件源码打包为单文件用户脚本。

## 开发

```bash
npm install
npm run dev    # 开发模式（--watch 自动重打包）
npm run build  # 生产构建
```

输出文件位于 `dist/` 目录。
