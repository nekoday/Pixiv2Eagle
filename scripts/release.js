const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const headerPath = path.join(root, 'src/header.txt');

function readVersion() {
  const header = fs.readFileSync(headerPath, 'utf8');
  const match = header.match(/@version\s+(\S+)/);
  if (!match) {
    console.error('[release] @version not found in src/header.txt');
    process.exit(1);
  }
  return match[1];
}

function buildChangelogTemplate(version) {
  const today = new Date().toISOString().slice(0, 10);
  return `# Re_Pixiv2Eagle 更新日志

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 格式。

## [${version}] - ${today}

### 🔧 技术改进
- **发行打包**: 建立 \`npm run release\` 工作流，产出 \`Releases/{version}/RePixiv2Eagle.js\` 与版本更新日志

<!-- 在此版本下方补充 ✨ 新增、🐛 修复 等条目 -->

## [3.0.0] - （日期待填）

### ⚠️ 重要更改
- **主版本升级**: 自上游单文件脚本重构为 esbuild 多模块结构（\`src/\` ES 模块树 + \`scripts/build.js\`），用户脚本元数据迁至 \`src/header.txt\`

### 🔧 技术改进
- **构建管线**: esbuild 打包为单文件 IIFE \`dist/RePixiv2Eagle.js\`，开发模式 \`npm run dev\`（watch）

<!-- 在此补充 3.0.0～当前版本之间的历史变更 -->
`;
}

async function main() {
  const version = readVersion();
  console.log(`[release] version ${version}`);

  console.log('[release] running build...');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });

  const releaseDir = path.join(root, 'Releases', version);
  fs.mkdirSync(releaseDir, { recursive: true });

  const src = path.join(root, 'dist', 'RePixiv2Eagle.js');
  const dest = path.join(releaseDir, 'RePixiv2Eagle.js');
  fs.copyFileSync(src, dest);
  console.log(`[release] copied -> ${path.relative(root, dest)}`);

  const changelogPath = path.join(releaseDir, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    fs.writeFileSync(changelogPath, buildChangelogTemplate(version), 'utf8');
    console.log(`[release] created ${path.relative(root, changelogPath)}`);
  } else {
    console.log('[release] CHANGELOG.md exists, skipped');
  }

  console.log(`[release] done -> Releases/${version}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
