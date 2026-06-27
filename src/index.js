    "use strict";

    import {
        SETTING_KEYS,
        getFolderId,
        getCreateSubFolder,
        getSaveByType,
        getDebugMode,
        getAutoCheckSavedStatus,
        getNovelSavePath,
        getNovelSaveFormat,
        forceRefreshEagleIndex,
    } from "./Tampermonkey/setting.js";
    import { registerMenuCommands } from "./Tampermonkey/menu.js";
    import { dbg, warn, err } from "./Tampermonkey/logger.js";
    import { showToast, showMessage } from "./ui/toast.js";
    import { createPixivStyledButton } from "./ui/button.js";
    import { waitForElement } from "./ui/dom.js";
    import { debouncedMarkSavedInArtistList } from "./artist-list/marking.js";
    import { gmFetch, gmFetchBinary, gmFetchText } from "./Tampermonkey/request.js";
    import {
        EAGLE_SAVE_BUTTON_ID,
        NOVEL_IMAGE_DOWNLOAD_DELAY_MS,
    } from "./config/constants.js";
    import { createMonitorConfig } from "./config/monitor.js";
    import { observeUrlChanges } from "./routing/observe-url.js";
    import { handlePageChange } from "./routing/handle-page.js";
    import { checkEagle } from "./eagle/client.js";
    import { createEagleFolder } from "./eagle/folder.js";
    import {
        findArtistFolder,
        getArtistFolder,
        getArtistMatcher,
        setArtistMatcher,
    } from "./eagle/artist.js";
    import { getTypeFolderInfo, getOrCreateTypeFolder } from "./eagle/type-folder.js";
    import {
        getAllEagleItemsInFolder,
        findSeriesFolderInArtist,
    } from "./eagle/items.js";
    import { ensureEagleIndex } from "./eagle/index-cache.js";
    import { addButton } from "./artwork/ui/save-button.js";
    import { markSavedInRecommendationArea } from "./artwork/ui/recommendation-mark.js";
    import { blobToDataURL } from "./artwork/ugoira/convert.js";
    import { ensureJSZipLoaded } from "./artwork/ugoira/lib-loader.js";
    import {
        LIST_CONTAINER_SELECTOR,
        SERIES_PAGE_LIST_SELECTOR,
        THUMBNAIL_CONTAINER_SELECTOR,
        NOVEL_TITLE_SELECTOR,
        NOVEL_DESC_SELECTOR,
        NOVEL_COVER_SELECTOR,
        NOVEL_AUTHOR_CONTAINER_SELECTOR,
        NOVEL_CONTENT_SELECTOR,
        NOVEL_TEXT_SPAN_SELECTOR,
        NOVEL_SERIES_SECTION_SELECTOR,
        NOVEL_SERIES_LINK_SELECTOR,
        NOVEL_SERIES_TITLE_SELECTOR,
        NOVEL_CHAPTER_NUMBER_LINK_SELECTOR,
        NOVEL_SAVE_BUTTON_SECTION_SELECTOR,
        NOVEL_TAGS_CONTAINER_SELECTOR,
        NOVEL_TAG_ITEM_SELECTOR,
        NOVEL_PUBLISH_DATE_CONTAINER_SELECTOR,
        NOVEL_SERIES_LIST_SELECTOR,
        NOVEL_CHAPTER_LINK_SELECTOR,
        NOVEL_CHAPTER_BADGE_CONTAINER_SELECTOR,
        NOVEL_CHAPTER_REF_BUTTON_SELECTOR,
    } from "./config/selectors/index.js";

    // Phase 0: ESM 入口已启用；SETTING_KEYS 来自 Tampermonkey/setting.js
    void SETTING_KEYS;

    // ========== 特征识别函数 ==========
    
    /**
     * 基于特征识别查找小说标签容器（使用备用方案）
     * 策略组合：
     * 1. 使用旧选择器（优先）
     * 2. 在main中寻找footer，找到后再在其中寻找ul表格
     * @returns {HTMLElement|null} 小说标签容器元素（footer）
     */
    function findNovelTagsContainer() {
        // 策略1: 尝试当前精确选择器
        let tagsContainer = document.querySelector(NOVEL_TAGS_CONTAINER_SELECTOR);
        if (tagsContainer) {
            dbg("标签容器查找: 使用精确选择器");
            return tagsContainer;
        }

        // 策略2: 在main中寻找footer，找到后检查其中是否有ul
        const mainEl = document.querySelector('main');
        if (mainEl) {
            const footerEl = mainEl.querySelector('footer');
            if (footerEl) {
                // 检查footer中是否有ul表格
                const ulEl = footerEl.querySelector('ul');
                if (ulEl) {
                    dbg("标签容器查找: 使用main>footer>ul结构");
                    return footerEl;
                }
            }
        }

        dbg("标签容器查找: 未找到合适的元素");
        return null;
    }

    /**
     * 基于特征识别查找小说标题元素（方法9：特征识别而非选择器）
     * 策略组合：
     * 1. 使用旧选择器（优先）
     * 2. 部分class匹配
     * 3. 基于DOM结构（在main标签内查找第一个h1）
     * 4. 基于视觉特征（找最大字号的h1）
     * @returns {HTMLElement|null} 小说标题元素
     */
    function findNovelTitle() {
        // 策略1: 尝试当前精确选择器
        let titleEl = document.querySelector(NOVEL_TITLE_SELECTOR);
        if (titleEl) {
            dbg("标题查找: 使用精确选择器");
            return titleEl;
        }

        // 策略2: 部分class匹配（去掉最后一个class，保留哈希前缀）
        titleEl = document.querySelector('h1[class*="sc-57130d55"]');
        if (titleEl) {
            dbg("标题查找: 使用部分class匹配");
            return titleEl;
        }

        // 策略3: 基于DOM结构 - main标签内的第一个h1
        const mainEl = document.querySelector('main');
        if (mainEl) {
            titleEl = mainEl.querySelector('h1');
            if (titleEl) {
                dbg("标题查找: 使用main>h1结构");
                return titleEl;
            }
        }

        // 策略4: 基于视觉特征 - 找最大字号的h1（排除固定导航栏）
        const allH1s = document.querySelectorAll('h1');
        if (allH1s.length > 0) {
            let maxFontSize = 0;
            let bestCandidate = null;

            allH1s.forEach(h1 => {
                // 排除不可见元素
                const style = window.getComputedStyle(h1);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return;
                }

                // 排除导航栏中的元素
                const rect = h1.getBoundingClientRect();
                if (rect.top < 0 || rect.top > window.innerHeight) {
                    return; // 不在可视区域
                }

                const fontSize = parseFloat(style.fontSize);
                if (fontSize > maxFontSize) {
                    maxFontSize = fontSize;
                    bestCandidate = h1;
                }
            });

            if (bestCandidate) {
                dbg("标题查找: 使用字号特征识别");
                return bestCandidate;
            }
        }

        // 策略5: 最后尝试 - 任意h1
        titleEl = document.querySelector('h1');
        if (titleEl) {
            dbg("标题查找: 使用通用h1回退");
            return titleEl;
        }

        warn("无法找到小说标题元素");
        return null;
    }

    /**
     * 基于特征识别查找小说封面（使用备用方案）
     * 策略组合：
     * 1. 使用精确选择器（优先）
     * 2. 使用部分class匹配
     * 3. 在main容器中寻找第一个img标签
     * @returns {HTMLImageElement|null} 小说封面图片元素
     */
    function findNovelCover() {
        // 策略1: 尝试当前精确选择器
        let coverImg = document.querySelector(NOVEL_COVER_SELECTOR);
        if (coverImg) {
            dbg("封面查找: 使用精确选择器");
            return coverImg;
        }

        // 策略2: 部分class匹配（去掉最后一个class，保留哈希前缀）
        coverImg = document.querySelector('img[class*="sc-41178ccf"]');
        if (coverImg) {
            dbg("封面查找: 使用部分class匹配");
            return coverImg;
        }

        // 策略3: 基于DOM结构 - main标签内的第一个img
        const mainEl = document.querySelector('main');
        if (mainEl) {
            coverImg = mainEl.querySelector('img');
            if (coverImg) {
                dbg("封面查找: 使用main>img结构");
                return coverImg;
            }
        }

        // 策略4: 最后尝试 - 任意img
        coverImg = document.querySelector('img');
        if (coverImg) {
            dbg("封面查找: 使用通用img回退");
            return coverImg;
        }

        warn("无法找到小说封面元素");
        return null;
    }

    // 注册菜单命令
    registerMenuCommands({
        forceRefreshEagleIndex,
        setArtistMatcher,
    });

    /**
     * 创建 EPUB 生成进度窗口
     * @returns {Object} 包含 updateProgress, close, cancel 方法的对象
     */
    function createEPUBProgressWindow() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999999;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            min-width: 400px;
            max-width: 600px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;

        const title = document.createElement('h3');
        title.textContent = '正在生成 EPUB 电子书';
        title.style.cssText = `
            margin: 0 0 16px 0;
            font-size: 18px;
            font-weight: 600;
        `;

        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            margin-bottom: 16px;
        `;

        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 100%;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 8px;
        `;

        const progressFill = document.createElement('div');
        progressFill.style.cssText = `
            height: 100%;
            width: 0%;
            background: #4CAF50;
            transition: width 0.3s ease;
        `;
        progressBar.appendChild(progressFill);

        const progressText = document.createElement('div');
        progressText.style.cssText = `
            font-size: 14px;
            color: #666;
            margin-top: 8px;
        `;
        progressText.textContent = '初始化...';

        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressText);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            margin-top: 16px;
        `;

        let cancelled = false;
        const cancelButton = document.createElement('button');
        cancelButton.textContent = '终止';
        cancelButton.style.cssText = `
            padding: 8px 16px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelButton.onmouseover = () => {
            cancelButton.style.background = '#d32f2f';
        };
        cancelButton.onmouseout = () => {
            cancelButton.style.background = '#f44336';
        };
        cancelButton.onclick = () => {
            cancelled = true;
            progressText.textContent = '正在终止...';
            cancelButton.disabled = true;
            cancelButton.style.opacity = '0.6';
            cancelButton.style.cursor = 'not-allowed';
        };

        buttonContainer.appendChild(cancelButton);

        modal.appendChild(title);
        modal.appendChild(progressContainer);
        modal.appendChild(buttonContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        return {
            updateProgress: (percent, message) => {
                if (cancelled) return;
                progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
                if (message) {
                    progressText.textContent = message;
                }
            },
            close: () => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            },
            isCancelled: () => cancelled,
            getCancelButton: () => cancelButton
        };
    }


    // 下载文件到本地（使用浏览器下载 API）
    function downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 下载图片到本地
    async function downloadImageToLocal(imageUrl, filename) {
        try {
            const imageData = await gmFetchBinary(imageUrl, {
                headers: {
                    referer: "https://www.pixiv.net/"
                }
            });
            const blob = new Blob([imageData], { type: "image/jpeg" });
            downloadFile(blob, filename);
            return true;
        } catch (error) {
            err(`下载图片失败 ${imageUrl}:`, error);
            return false;
        }
    }

    // 下载小说文件（文本或 Markdown）
    function downloadNovelFile(content, filename, format) {
        const mimeType = format === 'md' ? 'text/markdown' : 'text/plain';
        const blob = new Blob([content], { type: mimeType });
        downloadFile(blob, filename);
    }

    // 下载所有小说文件到本地
    async function downloadNovelFiles(combinedContent, novelTitle, novelId) {
        const safeTitle = novelTitle.replace(/[\\/:*?"<>|]/g, "_");
        const fileExtension = combinedContent.format === 'md' ? 'md' : 'txt';
        const filename = `${safeTitle}.${fileExtension}`;
        
        // 下载文本文件
        downloadNovelFile(combinedContent.content, filename, combinedContent.format);
        
        // 下载所有图片（如果有）
        const imagePaths = [];
        if (combinedContent.images && combinedContent.images.length > 0) {
            // 提示用户下载图片
            const downloadImages = confirm(`检测到 ${combinedContent.images.length} 张图片，是否下载？\n\n请确保所有文件（文本和图片）都下载到同一目录中。`);
            
            if (downloadImages) {
                for (let i = 0; i < combinedContent.images.length; i++) {
                    const image = combinedContent.images[i];
                    await new Promise(resolve => setTimeout(resolve, NOVEL_IMAGE_DOWNLOAD_DELAY_MS)); // 延迟避免浏览器阻止多个下载
                    const success = await downloadImageToLocal(image.url, image.filename);
                    if (success) {
                        imagePaths.push(image.filename);
                    }
                }
            }
        }
        
        return {
            novelFilename: filename,
            imageFilenames: imagePaths
        };
    }

    // 获取文件完整路径（提示用户输入）
    async function getFilePaths(novelFilename, imageFilenames, basePath) {
        const paths = {
            novelPath: null,
            imagePaths: []
        };
        
        // 如果有配置的路径，使用它
        if (basePath) {
            // 处理路径分隔符（支持 Windows 和 Unix 风格）
            const separator = basePath.includes('\\') ? '\\' : '/';
            const normalizedBasePath = basePath.endsWith('\\') || basePath.endsWith('/') 
                ? basePath.slice(0, -1) 
                : basePath;
            paths.novelPath = `${normalizedBasePath}${separator}${novelFilename}`;
            imageFilenames.forEach(filename => {
                paths.imagePaths.push(`${normalizedBasePath}${separator}${filename}`);
            });
            return paths;
        }
        
        // 否则提示用户输入
        const novelPath = prompt(
            `请输入小说文件的完整路径：\n\n文件名：${novelFilename}\n\n示例：C:\\Users\\YourName\\Downloads\\${novelFilename}`,
            ""
        );
        
        if (!novelPath) {
            throw new Error("未提供小说文件路径");
        }
        
        paths.novelPath = novelPath.trim();
        
        // 从小说文件路径提取目录（支持 Windows 和 Unix 风格）
        const lastBackslash = novelPath.lastIndexOf('\\');
        const lastSlash = novelPath.lastIndexOf('/');
        const lastSeparator = Math.max(lastBackslash, lastSlash);
        const novelDir = lastSeparator >= 0 ? novelPath.substring(0, lastSeparator) : novelPath;
        const separator = lastBackslash > lastSlash ? '\\' : '/';
        
        // 提示用户输入图片路径
        if (imageFilenames.length > 0) {
            const defaultPaths = imageFilenames.map(f => `${novelDir}${separator}${f}`).join('; ');
            const imagePathsInput = prompt(
                `请确认图片文件路径（用分号分隔，或留空使用默认路径）：\n\n图片文件名：${imageFilenames.join(', ')}\n\n默认路径：${defaultPaths}`,
                imageFilenames.map(f => `${novelDir}${separator}${f}`).join(';')
            );
            
            if (imagePathsInput) {
                paths.imagePaths = imagePathsInput.split(';').map(p => p.trim()).filter(p => p);
            } else {
                // 使用默认路径
                imageFilenames.forEach(filename => {
                    paths.imagePaths.push(`${novelDir}${separator}${filename}`);
                });
            }
        }
        
        return paths;
    }


    // 在画师作品列表页面标注已保存的作品（在作品标题前添加 ✅）
    async function markSavedInArtistList() {
        // 清理旧的 Observer，防止重复监听
        if (currentGalleryObserver) {
            currentGalleryObserver.disconnect();
            currentGalleryObserver = null;
        }

        // 更稳健的实现：等待作品链接加载，支持动态添加（滚动加载），并在 debug 模式下打印日志
        function log(...args) {
            dbg('markSavedInArtistList:', ...args);
        }

        dbg('markSavedInArtistList 函数已执行，当前URL:', location.pathname, '调试模式:', getDebugMode());

        try {
            // 仅在用户的常见画师列表或系列页面上运行
            if (
                !location.pathname.includes('/illustrations') &&
                !location.pathname.includes('/manga') &&
                !location.pathname.includes('/series/') &&
                !location.pathname.includes('/artworks')
            ) {
                log('当前页面非 artist illustrations/manga/series/artworks 页面，跳过');
                return;
            }

            log('当前页面匹配条件，开始处理');

            // 确定搜索范围与列表容器
            let listContainer = null;
            
            // 1. 系列页面
            if (location.pathname.includes('/series/')) {
                const selector = SERIES_PAGE_LIST_SELECTOR;
                log('系列页面：尝试定位列表容器', selector);
                // 尝试等待容器出现（最多 5 秒，避免过久阻塞）
                listContainer = await new Promise(resolve => {
                    const el = document.querySelector(selector);
                    if (el) return resolve(el);
                    const obs = new MutationObserver(() => {
                        const found = document.querySelector(selector);
                        if (found) {
                            obs.disconnect();
                            resolve(found);
                        }
                    });
                    obs.observe(document.body, { childList: true, subtree: true });
                    setTimeout(() => {
                        obs.disconnect();
                        resolve(null);
                    }, 5000);
                });
            } 
            // 2. 插画/漫画页面 (以及用户主页可能的列表)
            else {
                // 用户提供的选择器: div.sc-bf8cea3f-0.dKbaFf
                const selector = LIST_CONTAINER_SELECTOR;
                log('插画/漫画页面：尝试定位列表容器', selector);
                listContainer = await waitForElement(selector, 5000);
            }

            const anchorMap = {};

            if (listContainer) {
                const lis = listContainer.querySelectorAll('li');
                log(`在列表容器中找到 ${lis.length} 个作品项`);
                
                for (const li of lis) {
                    // 查找作品链接提取 PID
                    // 注意：有时一个 li 可能包含多个链接，通常取第一个指向 artworks 的
                    const link = li.querySelector('a[href*="/artworks/"]');
                    if (!link) continue;
                    
                    const href = link.getAttribute('href');
                    const m = href.match(/\/artworks\/(\d+)/);
                    if (!m) continue;
                    
                    const pid = m[1];
                    
                    // 查找目标缩略图容器 (标记插入点)
                    // 优先匹配带 radius="4" 的 div.sc-f44a0b30-9.cvPXKv
                    let target = li.querySelector(THUMBNAIL_CONTAINER_SELECTOR);
                    if (!target) target = li.querySelector('div.sc-f44a0b30-9');
                    
                    // 备选：如果找不到特定 class，尝试找图片容器
                    if (!target) {
                        const img = li.querySelector('img[src*="i.pximg.net"]');
                        if (img) {
                            // 通常图片被包裹在 picture > div 或直接在 div 中
                            // 我们希望找到那个有圆角和 overflow 的容器
                            target = img.closest('div[radius="4"]') || img.parentElement;
                        }
                    }

                    if (target) {
                        anchorMap[pid] = target;
                    }
                }
            } else {
                log('未找到列表容器，跳过检测');
                return;
            }

            const artworkIds = Object.keys(anchorMap);
            if (artworkIds.length === 0) {
                log('未解析到任何 artwork id');
                return;
            }

            log('检测到', artworkIds.length, '个作品链接/目标容器');
            log('解析到 artworkIds:', artworkIds.slice(0, 5).join(','), artworkIds.length > 5 ? '...' : '');

            // 获取画师 ID - 支持 /user/{id} 和 /users/{id} 两种格式
            let artistMatch = location.pathname.match(/^\/users\/(\d+)/);
            if (!artistMatch) {
                artistMatch = location.pathname.match(/^\/user\/(\d+)/);
            }
            const artistId = artistMatch ? artistMatch[1] : null;
            if (!artistId) {
                log('无法从 URL 解析 artistId，URL:', location.pathname);
                return;
            }

            log('解析到 artistId:', artistId);

            const pixivFolderId = getFolderId();
            const artistFolder = await findArtistFolder(pixivFolderId, artistId);
            if (!artistFolder) {
                log('未找到对应的画师文件夹，跳过标注（pixivFolderId:', pixivFolderId, '）');
                return;
            }

            log('找到画师文件夹', artistFolder.id, '名称:', artistFolder.name, '开始拉取 items');
            const items = await getAllEagleItemsInFolder(artistFolder.id);
            
            // 如果开启了按类型保存，还需要拉取类型文件夹中的 items
            if (artistFolder.children) {
                const typeFolders = artistFolder.children.filter(c => ['illustrations', 'manga', 'novels'].includes(c.description));
                for (const tf of typeFolders) {
                    const typeItems = await getAllEagleItemsInFolder(tf.id);
                    if (typeItems && typeItems.length) {
                        items.push(...typeItems);
                    }
                }
            }

            const urlSet = new Set((items || []).map((it) => it.url));
            log('画师文件夹(含类型子文件夹)中 items 数量:', items ? items.length : 0);

            // 依据规则：
            // - 画师文件夹的 description 中含有 `pid = {artistId}` 用于识别画师（见 findArtistFolder）
            // - 单个作品的子文件夹的 description 等于作品 ID（作品 pid）
            // 因此除了比对 item.url，还需要检查 artistFolder 及其子文件夹的 description 是否等于 artworkId
            const folderDescSet = new Set();
            const folderDescMap = {}; // desc -> folderId
            (function collectFolderDescriptions(folder) {
                if (!folder || !folder.children) return;
                for (const child of folder.children) {
                    const desc = (child.description || "").trim();
                    if (desc) {
                        folderDescSet.add(desc);
                        folderDescMap[desc] = child.id;
                    }
                    if (child.children && child.children.length) collectFolderDescriptions(child);
                }
            })(artistFolder);
            log('已收集到的子文件夹描述数量:', folderDescSet.size);

            // 如果是系列页面，优先查找系列文件夹并在该文件夹下递归寻找 item/url 与子文件夹描述（备注为 pid）
            if (location.pathname.includes('/series/')) {
                await enrichMarkingContextForMangaSeriesPage({
                    pixivFolderId,
                    artistId,
                    urlSet,
                    folderDescSet,
                    folderDescMap,
                    log,
                });
            }

            // 插入标记的函数：将勾号浮动到作品卡片容器左下角（优先使用容器类名: sc-4822cddd-0 eCgTWT），
            // 同时支持系列缩略图容器：sc-e83d358-1（包含 sc-f44a0b30-9 cvPXKv）
            // 插入标记的函数：直接在指定的容器中插入勾号
            const insertBadgeToContainer = (container, matchInfo = {}) => {
                if (insertSavedBadge(container, {
                    zIndex: "2147483647",
                    fontSize: "18px",
                    padding: "2px 6px",
                    large: true,
                    markContainer: true,
                    ensureOverflowVisible: true,
                })) {
                    log('徽章已插入:', matchInfo.artworkId);
                }
            };

            // 首次批量标注
            log('开始首次批量标注，artworkIds:', artworkIds.length, '个');
            for (const id of artworkIds) {
                const target = anchorMap[id];
                // 标记为已检查，防止重复处理（无论是否匹配）
                if (target.dataset.eagleChecked === '1') continue;
                target.dataset.eagleChecked = '1';

                const artworkUrl = `https://www.pixiv.net/artworks/${id}`;
                if (urlSet.has(artworkUrl)) {
                    log('作品', id, '匹配 (itemUrl)');
                    insertBadgeToContainer(target, { artworkId: id, artworkUrl, matchedBy: 'itemUrl' });
                } else if (folderDescSet.has(String(id))) {
                    log('作品', id, '匹配 (folderDesc)');
                    insertBadgeToContainer(target, { artworkId: id, artworkUrl, matchedBy: 'folderDesc' });
                } else {
                    log('未匹配作品:', id);
                }
            }

            // 监听后续动态添加的作品节点
            currentGalleryObserver = new MutationObserver((mutations) => {
                let shouldScan = false;
                for (const mut of mutations) {
                    if (mut.addedNodes.length > 0) {
                        shouldScan = true;
                        break;
                    }
                }
                
                if (shouldScan && listContainer) {
                    const lis = listContainer.querySelectorAll('li');
                    for (const li of lis) {
                        // 查找目标容器
                        let target = li.querySelector('div.sc-f44a0b30-9.cvPXKv');
                        if (!target) target = li.querySelector('div.sc-f44a0b30-9');
                        
                        // 如果已经检查过，跳过
                        if (target && target.dataset.eagleChecked === '1') continue;
                        
                        // 提取 PID
                        const link = li.querySelector('a[href*="/artworks/"]');
                        if (!link) continue;
                        const m = link.getAttribute('href').match(/\/artworks\/(\d+)/);
                        if (!m) continue;
                        const pid = m[1];

                        if (target) {
                            target.dataset.eagleChecked = '1'; // 标记为已检查
                            
                            const artworkUrl = `https://www.pixiv.net/artworks/${pid}`;
                            if (urlSet.has(artworkUrl)) {
                                insertBadgeToContainer(target, { artworkId: pid, artworkUrl, matchedBy: 'itemUrl' });
                            } else if (folderDescSet.has(String(pid))) {
                                insertBadgeToContainer(target, { artworkId: pid, artworkUrl, matchedBy: 'folderDesc' });
                            }
                        }
                    }
                }
            });

            // 观察 listContainer 或 body
            const observeTarget = listContainer || document.body;
            currentGalleryObserver.observe(observeTarget, { childList: true, subtree: true });
            
            // 5 分钟后断开监听以避免长期占用
            setTimeout(() => {
                if (currentGalleryObserver) currentGalleryObserver.disconnect();
            }, 5 * 60 * 1000);
        } catch (error) {
            err('标注画师作品保存状态失败:', error);
        }
    }

    let markSavedDebounceTimer = null;
    let currentGalleryObserver = null;

    async function debouncedMarkSavedInArtistList() {
        if (markSavedDebounceTimer) clearTimeout(markSavedDebounceTimer);
        markSavedDebounceTimer = setTimeout(() => {
            markSavedInArtistList();
        }, 300);
    }


    // 获取小说 ID
    function getNovelId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get("id");
    }

    // 组合小说内容（根据是否包含图片生成 TXT 或 Markdown）
    function combineNovelContent(details) {
        if (!details.hasImages || !details.images || details.images.length === 0) {
            // 纯文本格式
            return {
                content: details.content,
                format: 'txt',
                images: []
            };
        }
        
        // Markdown 格式
        const contentContainer = document.querySelector(NOVEL_CONTENT_SELECTOR);
        if (!contentContainer) {
            return {
                content: details.content,
                format: 'md',
                images: []
            };
        }
        
        // 构建 Markdown 内容，保持文本和图片的原始顺序
        let markdownContent = "";
        
        // 创建图片 URL 到索引的映射
        const imageUrlToIndex = new Map();
        details.images.forEach((img, index) => {
            imageUrlToIndex.set(img.src, index);
        });
        
        let imageIndex = 0;
        
        // 遍历内容容器的所有子节点（包括文本节点和元素节点），使用新的 span.text-count 和 <br> 结构
        const childNodes = Array.from(contentContainer.childNodes);
        let currentParagraph = ""; // 累积当前段落的文本
        
        for (const node of childNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && node.matches(NOVEL_TEXT_SPAN_SELECTOR)) {
                // 处理 span.text-count 元素
                const text = node.textContent.trim();
                if (text) {
                    currentParagraph += text;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
                // 遇到 <br> 标签，结束当前段落
                if (currentParagraph.trim()) {
                    markdownContent += currentParagraph.trim() + "\n\n";
                    currentParagraph = "";
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
                // 处理图片元素
                const src = node.src || node.getAttribute("data-src") || "";
                const alt = node.alt || node.getAttribute("alt") || "";
                
                if (src && imageUrlToIndex.has(src)) {
                    // 先输出当前段落（如果有）
                    if (currentParagraph.trim()) {
                        markdownContent += currentParagraph.trim() + "\n\n";
                        currentParagraph = "";
                    }
                    
                    // 添加图片引用
                    const idx = imageUrlToIndex.get(src);
                    const urlMatch = src.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
                    const ext = urlMatch ? urlMatch[1].toLowerCase() : "jpg";
                    const filename = `image_${idx}.${ext}`;
                    
                    markdownContent += `![${alt}](${filename})\n\n`;
                    imageIndex++;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // 处理其他元素（如包含图片的容器）
                const imagesInElement = Array.from(node.querySelectorAll("img"));
                
                if (imagesInElement.length > 0) {
                    // 先输出当前段落（如果有）
                    if (currentParagraph.trim()) {
                        markdownContent += currentParagraph.trim() + "\n\n";
                        currentParagraph = "";
                    }
                    
                    // 处理容器中的图片
                    for (const img of imagesInElement) {
                        const src = img.src || img.getAttribute("data-src") || "";
                        const alt = img.alt || img.getAttribute("alt") || "";
                        
                        if (src && imageUrlToIndex.has(src)) {
                            const idx = imageUrlToIndex.get(src);
                            const urlMatch = src.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
                            const ext = urlMatch ? urlMatch[1].toLowerCase() : "jpg";
                            const filename = `image_${idx}.${ext}`;
                            
                            markdownContent += `![${alt}](${filename})\n\n`;
                            imageIndex++;
                        }
                    }
                }
            }
        }
        
        // 处理最后一个段落（如果没有遇到 <br> 就结束了）
        if (currentParagraph.trim()) {
            markdownContent += currentParagraph.trim() + "\n\n";
        }
        
        // 如果没有成功构建 Markdown，回退到纯文本
        if (!markdownContent.trim()) {
            return {
                content: details.content,
                format: 'txt',
                images: []
            };
        }
        
        // 准备图片信息
        const imageInfo = details.images.map((img, index) => {
            const urlMatch = img.src.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
            const ext = urlMatch ? urlMatch[1].toLowerCase() : "jpg";
            return {
                url: img.src,
                filename: `image_${index}.${ext}`,
                alt: img.alt
            };
        });
        
        return {
            content: markdownContent.trim(),
            format: 'md',
            images: imageInfo
        };
    }

    // 生成 EPUB 电子书
    async function generateEPUB(details, combinedContent, progressWindow = null) {
        
        // 检查是否已取消
        if (progressWindow && progressWindow.isCancelled()) {
            throw new Error("EPUB 生成已取消");
        }
        
        if (progressWindow) {
            progressWindow.updateProgress(5, '正在加载 JSZip 库...');
        }
        
        // 确保 JSZip 已加载
        await ensureJSZipLoaded();
        
        if (progressWindow) {
            progressWindow.updateProgress(10, '正在创建 EPUB 结构...');
        }
        
        const zip = new window.JSZip();
        const safeTitle = details.title.replace(/[\\/:*?"<>|]/g, "_");
        
        // 1. 添加 mimetype 文件（必须是第一个，且不压缩）
        zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
        
        // 2. 创建 META-INF 目录和 container.xml
        const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`;
        zip.folder("META-INF").file("container.xml", containerXml, { compression: "STORE" });
        
        // 3. 创建 OEBPS 目录
        const oebps = zip.folder("OEBPS");
        const images = oebps.folder("images");
        
        // 检查是否已取消
        if (progressWindow && progressWindow.isCancelled()) {
            throw new Error("EPUB 生成已取消");
        }
        
        // 4. 下载并添加封面图片
        let coverImagePath = null;
        if (details.coverUrl) {
            if (progressWindow) {
                progressWindow.updateProgress(20, '正在下载封面图片...');
            }
            try {
                const coverData = await gmFetchBinary(details.coverUrl, {
                    headers: { referer: "https://www.pixiv.net/" }
                });
                const coverExt = details.coverUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) 
                    ? details.coverUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)[1].toLowerCase() 
                    : "jpg";
                coverImagePath = `images/cover.${coverExt}`;
                images.file(`cover.${coverExt}`, coverData, { compression: "STORE" });
            } catch (error) {
                err("下载封面失败:", error);
            }
        }
        
        // 检查是否已取消
        if (progressWindow && progressWindow.isCancelled()) {
            throw new Error("EPUB 生成已取消");
        }
        
        // 5. 下载并添加正文中的图片
        const imageManifest = [];
        if (combinedContent.images && combinedContent.images.length > 0) {
            const totalImages = combinedContent.images.length;
            for (let i = 0; i < combinedContent.images.length; i++) {
                // 检查是否已取消
                if (progressWindow && progressWindow.isCancelled()) {
                    throw new Error("EPUB 生成已取消");
                }
                
                if (progressWindow) {
                    const progress = 30 + Math.floor((i / totalImages) * 20);
                    progressWindow.updateProgress(progress, `正在下载图片 ${i + 1}/${totalImages}...`);
                }
                
                const img = combinedContent.images[i];
                try {
                    const imgData = await gmFetchBinary(img.url, {
                        headers: { referer: "https://www.pixiv.net/" }
                    });
                    const urlMatch = img.url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
                    const ext = urlMatch ? urlMatch[1].toLowerCase() : "jpg";
                    const imgPath = `images/${img.filename}`;
                    images.file(img.filename, imgData, { compression: "STORE" });
                    imageManifest.push({
                        id: `img_${i}`,
                        href: imgPath,
                        "media-type": `image/${ext === "jpg" ? "jpeg" : ext}`
                    });
                } catch (error) {
                    err(`下载图片失败 ${img.url}:`, error);
                }
            }
        }
        
        if (progressWindow) {
            progressWindow.updateProgress(50, '正在生成 HTML 内容...');
        }
        
        // 6. 生成封面页 HTML
        let coverHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <meta charset="UTF-8"/>
    <title>封面</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
    <div class="cover-page">
        ${coverImagePath ? `<img src="${coverImagePath}" alt="${escapeXml(details.title)}" class="cover-image"/>` : `<h1 class="cover-title">${escapeXml(details.title)}</h1>`}
    </div>
</body>
</html>`;
        oebps.file("cover.html", coverHtml, { compression: "STORE" });
        
        // 7. 生成作者信息页 HTML
        const authorUrl = details.authorId ? `https://www.pixiv.net/users/${details.authorId}` : '';
        let authorHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <meta charset="UTF-8"/>
    <title>作者信息</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
    <div class="author-page">
        <h1>${escapeXml(details.title)}</h1>
        <div class="author-info">
            <h2>作者信息</h2>
            <p class="author-name"><strong>作者：</strong>${escapeXml(details.authorName || "Unknown")}</p>
            ${authorUrl ? `<p class="author-url"><strong>Pixiv：</strong><a href="${escapeXml(authorUrl)}">${escapeXml(authorUrl)}</a></p>` : ''}
        </div>`;
        
        if (details.description) {
            authorHtml += `
        <div class="novel-description">
            <h2>小说简介</h2>
            <p>${escapeXml(details.description).replace(/\n/g, '</p><p>')}</p>
        </div>`;
        }
        
        if (details.tags && details.tags.length > 0) {
            authorHtml += `
        <div class="novel-tags">
            <h2>小说标签</h2>
            <p>${details.tags.map(tag => escapeXml(tag)).join('、')}</p>
        </div>`;
        }
        
        if (details.seriesTitle && details.seriesId) {
            const seriesUrl = `https://www.pixiv.net/novel/series/${details.seriesId}`;
            // 直接使用details.seriesTitle（原始系列标题），与保存到eagle时的提取方法相同，但不添加"系列:"前缀
            authorHtml += `
        <div class="novel-series">
            <h2>系列信息</h2>
            <p class="series-name"><strong>系列名：</strong>${escapeXml(details.seriesTitle)}</p>
            <p class="series-url"><strong>系列URL：</strong><a href="${escapeXml(seriesUrl)}">${escapeXml(seriesUrl)}</a></p>
        </div>`;
        }
        
        authorHtml += `
    </div>
</body>
</html>`;
        oebps.file("author.html", authorHtml, { compression: "STORE" });
        
        // 8. 生成正文内容 HTML（移除标题和简介，因为已在作者信息页）
        let htmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <meta charset="UTF-8"/>
    <title>${escapeXml(details.title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
    <div class="chapter">
        <h1>${escapeXml(details.title)}</h1>`;
        
        // 转换内容为 HTML
        if (combinedContent.format === 'md') {
            // Markdown 格式：将 Markdown 转换为 HTML
            const paragraphs = combinedContent.content.split(/\n\n+/);
            for (const para of paragraphs) {
                if (para.trim()) {
                    // 检查是否是图片引用
                    const imgMatch = para.match(/!\[([^\]]*)\]\(([^)]+)\)/);
                    if (imgMatch) {
                        const alt = imgMatch[1];
                        const filename = imgMatch[2];
                        const imgInfo = combinedContent.images.find(img => img.filename === filename);
                        if (imgInfo) {
                            htmlContent += `
        <p><img src="images/${imgInfo.filename}" alt="${escapeXml(alt)}" class="content-image"/></p>`;
                        } else {
                            // 如果找不到图片信息，保留原始文本
                            htmlContent += `
        <p>${escapeXml(para.trim())}</p>`;
                        }
                    } else {
                        htmlContent += `
        <p>${escapeXml(para.trim())}</p>`;
                    }
                }
            }
        } else {
            // 纯文本格式：按段落分割
            const paragraphs = combinedContent.content.split(/\n\n+/);
            for (const para of paragraphs) {
                if (para.trim()) {
                    htmlContent += `
        <p>${escapeXml(para.trim())}</p>`;
                }
            }
        }
        
        htmlContent += `
    </div>
</body>
</html>`;
        
        oebps.file("chapter.html", htmlContent, { compression: "STORE" });
        
        // 9. 生成 CSS 样式
        const cssContent = `body {
    font-family: "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif;
    line-height: 1.8;
    margin: 1em;
    padding: 0;
}

h1 {
    font-size: 1.5em;
    margin-bottom: 1em;
    text-align: center;
}

h2 {
    font-size: 1.2em;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    border-bottom: 1px solid #ccc;
    padding-bottom: 0.3em;
}

/* 封面页样式 */
.cover-page {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    text-align: center;
}

.cover-image {
    max-width: 100%;
    max-height: 100vh;
    height: auto;
    object-fit: contain;
}

.cover-title {
    font-size: 2em;
    margin: 0;
}

/* 作者信息页样式 */
.author-page {
    max-width: 800px;
    margin: 0 auto;
}

.author-info, .novel-description, .novel-tags, .novel-series {
    margin-bottom: 2em;
    padding: 1em;
    background-color: #f5f5f5;
    border-radius: 4px;
}

.author-name, .author-url, .series-name, .series-url {
    margin: 0.5em 0;
}

.author-url a, .series-url a {
    color: #0066cc;
    text-decoration: none;
    word-break: break-all;
}

.author-url a:hover, .series-url a:hover {
    text-decoration: underline;
}

.description {
    margin-bottom: 2em;
    padding: 1em;
    background-color: #f5f5f5;
    border-radius: 4px;
}

.chapter {
    max-width: 800px;
    margin: 0 auto;
}

p {
    margin: 1em 0;
    text-indent: 1em;
}

.content-image {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em auto;
}`;
        oebps.file("style.css", cssContent, { compression: "STORE" });
        
        // 10. 生成 content.opf（元数据清单）
        const identifier = `https://www.pixiv.net/novel/show.php?id=${details.id}`;
        // 使用提取的出版日期，如果没有则使用当前日期
        const publishDate = formatEPUBDate(details.publishDate) || new Date().toISOString().split('T')[0];
        
        let opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>${escapeXml(details.title)}</dc:title>
        <dc:creator opf:role="aut">${escapeXml(details.authorName || "Unknown")}</dc:creator>
        <dc:identifier id="bookid">${escapeXml(identifier)}</dc:identifier>
        <dc:language>ja</dc:language>
        <dc:date opf:event="publication">${publishDate}</dc:date>`;
        
        if (details.description) {
            opfContent += `
        <dc:description>${escapeXml(details.description)}</dc:description>`;
        }
        
        if (details.seriesTitle) {
            // 直接使用details.seriesTitle（原始系列标题），与保存到eagle时的提取方法相同
            opfContent += `
        <meta name="calibre:series" content="${escapeXml(details.seriesTitle)}"/>`;
        }
        
        opfContent += `
        <meta name="cover" content="cover-image"/>`;
        
        if (coverImagePath) {
            opfContent += `
        <meta name="cover-image" content="${coverImagePath}"/>`;
        }
        
        opfContent += `
    </metadata>
    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="cover" href="cover.html" media-type="application/xhtml+xml"/>
        <item id="author" href="author.html" media-type="application/xhtml+xml"/>
        <item id="chapter" href="chapter.html" media-type="application/xhtml+xml"/>
        <item id="style" href="style.css" media-type="text/css"/>`;
        
        if (coverImagePath) {
            const coverExt = coverImagePath.split('.').pop();
            opfContent += `
        <item id="cover-image" href="${coverImagePath}" media-type="image/${coverExt === "jpg" ? "jpeg" : coverExt}"/>`;
        }
        
        for (const img of imageManifest) {
            opfContent += `
        <item id="${img.id}" href="${img.href}" media-type="${img["media-type"]}"/>`;
        }
        
        opfContent += `
    </manifest>
    <spine toc="ncx">
        <itemref idref="cover"/>
        <itemref idref="author"/>
        <itemref idref="chapter"/>
    </spine>
    <guide>
        <reference type="cover" title="封面" href="cover.html"/>
    </guide>
</package>`;
        
        oebps.file("content.opf", opfContent, { compression: "STORE" });
        
        // 11. 生成 toc.ncx（目录导航）
        const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="${escapeXml(identifier)}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle>
        <text>${escapeXml(details.title)}</text>
    </docTitle>
    <navMap>
        <navPoint id="navpoint-1" playOrder="1">
            <navLabel>
                <text>封面</text>
            </navLabel>
            <content src="cover.html"/>
        </navPoint>
        <navPoint id="navpoint-2" playOrder="2">
            <navLabel>
                <text>作者信息</text>
            </navLabel>
            <content src="author.html"/>
        </navPoint>
        <navPoint id="navpoint-3" playOrder="3">
            <navLabel>
                <text>${escapeXml(details.title)}</text>
            </navLabel>
            <content src="chapter.html"/>
        </navPoint>
    </navMap>
</ncx>`;
        
        oebps.file("toc.ncx", tocNcx, { compression: "STORE" });
        
        // 检查是否已取消
        if (progressWindow && progressWindow.isCancelled()) {
            throw new Error("EPUB 生成已取消");
        }
        
        if (progressWindow) {
            progressWindow.updateProgress(80, '正在生成 EPUB 文件...');
        }
        
        // 10. 生成 EPUB 文件（Blob）
        let epubBlob;
        try {
            // 添加超时处理（120秒，因为 EPUB 生成可能需要一些时间）
            // 暂时注释掉超时处理
            // const timeoutPromise = new Promise((_, reject) => {
            //     setTimeout(() => {
            //         reject(new Error("EPUB 生成超时（120秒）"));
            //     }, 120000);
            // });
            
            // 使用 onUpdate 回调来监控进度
            let lastUpdateTime = Date.now();
            const generatePromise = zip.generateAsync({ 
                type: "blob",
                streamFiles: false, // 暂时禁用 streamFiles，可能导致卡住
                mimeType: "application/epub+zip",
                onUpdate: (metadata) => {
                    const now = Date.now();
                    lastUpdateTime = now;
                    if (progressWindow) {
                        const progressPercent = 80 + Math.floor(metadata.percent * 0.2); // 80-100%
                        progressWindow.updateProgress(progressPercent, `正在压缩 EPUB 文件... ${metadata.percent.toFixed(1)}%`);
                    }
                }
            });
            
            // 定期检查取消状态和更新进度，同时记录等待时间
            // 如果 onUpdate 回调长时间未触发，说明可能卡住了
            let waitTime = 0;
            let lastUpdateCheck = Date.now();
            const progressInterval = progressWindow ? setInterval(() => {
                waitTime += 500;
                const timeSinceLastUpdate = Date.now() - lastUpdateTime;
                if (progressWindow.isCancelled()) {
                    clearInterval(progressInterval);
                    // 无法直接取消 generateAsync，但会在 await 后检查
                } else {
                    // 如果超过 10 秒没有 onUpdate 回调，可能卡住了
                    if (timeSinceLastUpdate > 10000) {
                        progressWindow.updateProgress(85, `正在压缩 EPUB 文件... (可能卡住，已等待 ${Math.floor(waitTime/1000)} 秒)`);
                    } else {
                        progressWindow.updateProgress(85, `正在压缩 EPUB 文件... (已等待 ${Math.floor(waitTime/1000)} 秒)`);
                    }
                }
            }, 500) : null;
            
            try {
                // 暂时移除超时，直接等待 generatePromise
                // epubBlob = await Promise.race([generatePromise, timeoutPromise]);
                epubBlob = await generatePromise;
            } catch (awaitError) {
                throw awaitError;
            } finally {
                if (progressInterval) {
                    clearInterval(progressInterval);
                }
            }
            
            // 检查是否已取消
            if (progressWindow && progressWindow.isCancelled()) {
                throw new Error("EPUB 生成已取消");
            }
            
            if (progressWindow) {
                progressWindow.updateProgress(100, 'EPUB 生成完成！');
            }
        } catch (genError) {
            throw genError;
        }
        
        return epubBlob;
    }
    
    // XML 转义辅助函数
    function escapeXml(text) {
        if (!text) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    // 格式化日期为 EPUB 标准格式 (YYYY-MM-DD 或 YYYY-MM-DDTHH:MM:SSZ)
    function formatEPUBDate(datetime) {
        if (!datetime) return null;
        try {
            // 如果已经是 ISO 格式，直接使用
            const date = new Date(datetime);
            if (isNaN(date.getTime())) return null;
            // EPUB 2.0 标准格式：YYYY-MM-DD 或 YYYY-MM-DDTHH:MM:SSZ
            return date.toISOString().split('T')[0]; // 使用日期部分
        } catch (error) {
            err("日期格式化失败:", error);
            return null;
        }
    }

    // 获取小说详细信息
    async function getNovelDetails(novelId) {
        try {
            // 标题 - 使用特征识别
            const titleEl = findNovelTitle();
            const title = titleEl ? titleEl.textContent.trim() : `Novel_${novelId}`;

            // 简介
            const descEl = document.querySelector(NOVEL_DESC_SELECTOR);
            const description = descEl ? descEl.textContent.trim() : "";

            // 封面 - 使用特征识别
            const coverImg = findNovelCover();
            const coverUrl = coverImg ? coverImg.src : null;

            // 作者 - 复用 getArtistInfoFromDOM 的逻辑提取作者信息
            // 支持两种容器类型：
            // 1. 容器是 a 标签：<a class="sc-bypJrT bUiITy" data-gtm-value="15517627"><div>作者名</div></a>
            // 2. 容器是 div，内部包含 a 标签：<div><a href="/users/15517627">作者名</a></div>
            let authorId = null;
            let authorName = null;
            let authorLink = null;
            
            // 先尝试使用小说作者容器选择器
            const authorContainer = document.querySelector(NOVEL_AUTHOR_CONTAINER_SELECTOR);
            
            if (authorContainer) {
                // 判断容器类型
                if (authorContainer.tagName === 'A') {
                    // 容器本身就是 a 标签
                    authorLink = authorContainer;
                } else {
                    // 容器是 div 或其他元素，在容器内查找 a[href^="/users/"] 链接（复用 getArtistInfoFromDOM 逻辑）
                    authorLink = authorContainer.querySelector('a[href^="/users/"]');
                }
                
                if (authorLink) {
                    // 复用 getArtistInfoFromDOM 的提取逻辑
                    // 从链接的 data-gtm-value 或 href 中提取 authorId
                    authorId = authorLink.getAttribute("data-gtm-value") || authorLink.getAttribute("data-gtm-user-id");
                    if (!authorId && authorLink.href) {
                        const hrefMatch = authorLink.href.match(/\d+/);
                        authorId = hrefMatch ? hrefMatch[0] : null;
                    }
                    
                    // 从链接的 textContent 提取作者名（复用 getArtistInfoFromDOM 逻辑）
                    authorName = authorLink.textContent?.trim() || "";
                    
                    // 如果 textContent 为空，尝试从链接内的 div 提取（兼容新结构）
                    if (!authorName || authorName === "") {
                        const authorNameDiv = authorLink.querySelector('div');
                        if (authorNameDiv) {
                            authorName = authorNameDiv.innerText?.trim() || authorNameDiv.textContent?.trim() || "";
                        }
                    }
                    
                    // 如果仍然为空，查找页面上其他包含相同用户ID的链接（可能作者名在其他链接中）
                    if ((!authorName || authorName === "") && authorId) {
                        // 先尝试在特定类名的链接中查找：<a class="sc-76df3bd1-6 hQXkzZ">
                        const specificLink = document.querySelector(`a.sc-76df3bd1-6.hQXkzZ[href*="/users/${authorId}"], a.sc-76df3bd1-6.hQXkzZ[data-gtm-value="${authorId}"], a.sc-76df3bd1-6.hQXkzZ[data-gtm-user-id="${authorId}"]`);
                        if (specificLink) {
                            const linkText = specificLink.textContent?.trim() || specificLink.innerText?.trim() || "";
                            // 检查是否包含有效的作者名（不是常见的操作文本）
                            if (linkText && linkText.length > 0 && !linkText.includes('查看') && !linkText.includes('作品') && !linkText.includes('目录') && !specificLink.querySelector('figure')) {
                                authorName = linkText;
                            }
                        }
                        
                        // 如果特定类名链接中没找到，查找所有包含相同用户ID的链接
                        if (!authorName || authorName === "") {
                            const allUserLinks = document.querySelectorAll(`a[href*="/users/${authorId}"], a[data-gtm-value="${authorId}"], a[data-gtm-user-id="${authorId}"]`);
                            for (const link of allUserLinks) {
                                const linkText = link.textContent?.trim() || link.innerText?.trim() || "";
                                // 跳过只包含头像、空文本或常见操作文本的链接
                                const isInvalidText = !linkText || linkText.length === 0 || 
                                    link.querySelector('figure') ||
                                    linkText.includes('查看') || 
                                    linkText.includes('作品') || 
                                    linkText.includes('目录') ||
                                    linkText.includes('关注') ||
                                    linkText.includes('粉丝');
                                if (!isInvalidText) {
                                    authorName = linkText;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            // 如果主选择器找不到，尝试备用方法（复用 getArtistInfoFromDOM 的逻辑）
            if (!authorLink) {
                // 尝试直接查找 a[href^="/users/"] 链接
                const fallbackLink = document.querySelector('a[href^="/users/"][data-gtm-value], a[href^="/users/"][data-gtm-user-id]');
                if (fallbackLink) {
                    authorLink = fallbackLink;
                    authorId = fallbackLink.getAttribute("data-gtm-value") || fallbackLink.getAttribute("data-gtm-user-id");
                    if (!authorId && fallbackLink.href) {
                        const hrefMatch = fallbackLink.href.match(/\d+/);
                        authorId = hrefMatch ? hrefMatch[0] : null;
                    }
                    authorName = fallbackLink.textContent?.trim() || "";
                    
                    // 如果备用链接的textContent也为空，查找页面上其他包含相同用户ID的链接
                    if ((!authorName || authorName === "") && authorId) {
                        // 先尝试在特定类名的链接中查找：<a class="sc-76df3bd1-6 hQXkzZ">
                        const specificLink = document.querySelector(`a.sc-76df3bd1-6.hQXkzZ[href*="/users/${authorId}"], a.sc-76df3bd1-6.hQXkzZ[data-gtm-value="${authorId}"], a.sc-76df3bd1-6.hQXkzZ[data-gtm-user-id="${authorId}"]`);
                        if (specificLink) {
                            const linkText = specificLink.textContent?.trim() || specificLink.innerText?.trim() || "";
                            // 检查是否包含有效的作者名（不是常见的操作文本）
                            if (linkText && linkText.length > 0 && !linkText.includes('查看') && !linkText.includes('作品') && !linkText.includes('目录') && !specificLink.querySelector('figure')) {
                                authorName = linkText;
                            }
                        }
                        
                        // 如果特定类名链接中没找到，查找所有包含相同用户ID的链接
                        if (!authorName || authorName === "") {
                            const allUserLinks = document.querySelectorAll(`a[href*="/users/${authorId}"], a[data-gtm-value="${authorId}"], a[data-gtm-user-id="${authorId}"]`);
                            for (const link of allUserLinks) {
                                const linkText = link.textContent?.trim() || link.innerText?.trim() || "";
                                // 跳过只包含头像、空文本或常见操作文本的链接
                                const isInvalidText = !linkText || linkText.length === 0 || 
                                    link.querySelector('figure') ||
                                    linkText.includes('查看') || 
                                    linkText.includes('作品') || 
                                    linkText.includes('目录') ||
                                    linkText.includes('关注') ||
                                    linkText.includes('粉丝');
                                if (!isInvalidText) {
                                    authorName = linkText;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            // 如果仍然没有找到，使用默认值
            if (!authorName || authorName === "") {
                authorName = "Unknown";
            }
            
            if (authorName && authorName !== "Unknown") {
                dbg("提取到作者名:", authorName, "作者UID:", authorId);
            } else {
                dbg("未提取到作者名，使用默认值:", authorName);
            }

            // 系列信息
            const seriesSection = document.querySelector(NOVEL_SERIES_SECTION_SELECTOR);
            let seriesId = null;
            let seriesTitle = null;
            let chapterNumber = null; // 章节序号（格式：#1, #2, #3...）
            
            if (seriesSection) {
                // 优先从 h2.sc-edf844cc-2.emSEGV 获取系列标题
                const seriesTitleElement = document.querySelector(NOVEL_SERIES_TITLE_SELECTOR);
                if (seriesTitleElement) {
                    let rawSeriesTitle = seriesTitleElement.textContent.trim();
                    // 去除"系列"前缀，获取原始系列名称
                    if (rawSeriesTitle.startsWith('系列')) {
                        seriesTitle = rawSeriesTitle.substring(2).trim();
                    } else {
                        seriesTitle = rawSeriesTitle;
                    }
                }
                
                // 从章节序号链接提取序号：<a class="sc-41178ccf-15 kKNiSw">系列名称 #序号</a>
                const chapterNumberLink = document.querySelector(NOVEL_CHAPTER_NUMBER_LINK_SELECTOR);
                if (chapterNumberLink) {
                    const linkText = chapterNumberLink.textContent.trim();
                    // 提取序号：查找 # 后的数字
                    const numberMatch = linkText.match(/#(\d+)/);
                    if (numberMatch) {
                        chapterNumber = `#${numberMatch[1]}`;
                    }
                }
                
                // 从系列链接获取系列ID（如果还没有获取到系列标题，也从链接中提取）
                const seriesLink = document.querySelector(NOVEL_SERIES_LINK_SELECTOR);
                if (seriesLink) {
                    const match = seriesLink.getAttribute("href").match(/\/novel\/series\/(\d+)/);
                    if (match) {
                        seriesId = match[1];
                        // 如果还没有从h2元素获取到系列标题，则从链接中提取
                        if (!seriesTitle) {
                            // 从页面提取原始文本，然后去除"系列"前缀以获取原始系列名称
                            let rawSeriesTitle = seriesLink.textContent.trim();
                            // 去除"系列"前缀，获取原始系列名称
                            if (rawSeriesTitle.startsWith('系列')) {
                                seriesTitle = rawSeriesTitle.substring(2).trim();
                            } else {
                                seriesTitle = rawSeriesTitle;
                            }
                        }
                    }
                }
            }

            // 内容 - 尝试多种选择器
            let contentContainer = document.querySelector(NOVEL_CONTENT_SELECTOR);
            
            // 如果主选择器失败，尝试备用选择器
            if (!contentContainer) {
                // 尝试部分匹配（只匹配 class 前缀）
                const partialSelectors = [
                    'div.sc-ejfMa-d',  // 只匹配第一个 class
                    'div[class*="sc-ejfMa"]',  // 包含 sc-ejfMa 的 div
                    'div[class*="ejfMa"]',  // 包含 ejfMa 的 div
                ];
                
                for (const selector of partialSelectors) {
                    contentContainer = document.querySelector(selector);
                    if (contentContainer) {
                        break;
                    }
                }
            }
            
            // 如果还是找不到，尝试查找包含段落文本的容器
            if (!contentContainer) {
                // 查找包含多个 <p> 标签的容器
                const allDivs = document.querySelectorAll('div');
                for (const div of allDivs) {
                    const paragraphs = div.querySelectorAll('p');
                    if (paragraphs.length > 5) {  // 如果包含多个段落，可能是内容容器
                        const textLength = Array.from(paragraphs).reduce((sum, p) => sum + (p.textContent?.length || 0), 0);
                        if (textLength > 100) {  // 总文本长度超过 100 字符
                            contentContainer = div;
                            break;
                        }
                    }
                }
            }
            
            let content = "";
            const images = [];
            let hasImages = false;
            
            if (contentContainer) {
                // 检查是否包含图片
                const imgElements = Array.from(contentContainer.querySelectorAll("img"));
                hasImages = imgElements.length > 0;
                
                // 提取图片信息
                if (hasImages) {
                    imgElements.forEach((img, index) => {
                        const src = img.src || img.getAttribute("data-src") || "";
                        const alt = img.alt || img.getAttribute("alt") || "";
                        if (src) {
                            images.push({
                                src: src,
                                alt: alt,
                                index: index
                            });
                        }
                    });
                }
                
                // 提取文本内容（优先使用 span.text-count 结构，每段后遇到 <br> 时插入换行）
                const textSpans = contentContainer.querySelectorAll(NOVEL_TEXT_SPAN_SELECTOR);
                
                if (textSpans.length > 0) {
                    // 新结构：使用 span.text-count 提取内容
                    const contentParts = [];
                    
                    // 直接遍历所有找到的 textSpans
                    for (let i = 0; i < textSpans.length; i++) {
                        const span = textSpans[i];
                        const text = span.textContent.trim();
                        if (text) {
                            contentParts.push(text);
                        }
                        
                        // 检查当前 span 之后是否有 <br> 标签（作为段落分隔符）
                        // 查找下一个兄弟节点
                        let nextSibling = span.nextSibling;
                        while (nextSibling) {
                            if (nextSibling.nodeType === Node.ELEMENT_NODE) {
                                if (nextSibling.tagName === 'BR') {
                                    // 找到 BR 标签，添加两个换行符以形成段落分隔
                                    contentParts.push('\n\n');
                                    break;
                                } else if (nextSibling.matches && nextSibling.matches(NOVEL_TEXT_SPAN_SELECTOR)) {
                                    // 找到下一个 span，不需要换行
                                    break;
                                }
                            }
                            nextSibling = nextSibling.nextSibling;
                        }
                    }
                    
                    content = contentParts.join('');
                } else {
                    // 备用方案：使用旧的 <p> 标签提取逻辑
                    const paragraphs = Array.from(contentContainer.querySelectorAll("p"));
                    content = paragraphs.map(p => p.textContent).join("\n");
                }
            } else {
            }

            // 提取标签
            const tagsContainer = findNovelTagsContainer();
            const tags = [];
            if (tagsContainer) {
                // 先尝试使用精确选择器
                let tagItems = tagsContainer.querySelectorAll(NOVEL_TAG_ITEM_SELECTOR);
                
                // 如果精确选择器找不到，使用通用的 ul li 选择器
                if (tagItems.length === 0) {
                    tagItems = tagsContainer.querySelectorAll('ul li');
                    dbg("标签项提取: 使用通用的ul li选择器");
                }

                for (const tagItem of tagItems) {
                    const tagText = tagItem.textContent?.trim();
                    if (tagText) {
                        tags.push(tagText);
                    }
                }
                dbg("提取到小说标签:", tags);
            } else {
                dbg("未找到标签容器");
            }

            // 提取出版日期
            let publishDate = null;
            const dateContainer = document.querySelector(NOVEL_PUBLISH_DATE_CONTAINER_SELECTOR);
            if (dateContainer) {
                const timeEl = dateContainer.querySelector('time');
                if (timeEl) {
                    const datetime = timeEl.getAttribute('datetime');
                    if (datetime) {
                        publishDate = datetime;
                        dbg("提取到出版日期:", publishDate);
                    }
                }
            }

            return {
                id: novelId,
                title,
                description,
                coverUrl,
                authorId,
                authorName,
                seriesId,
                seriesTitle,
                chapterNumber, // 章节序号（格式：#1, #2, #3...）
                content,
                images,
                hasImages,
                tags,
                publishDate,
                illustType: "novel"
            };
        } catch (error) {
            err("获取小说信息失败:", error);
            throw error;
        }
    }

    // 保存小说为 TXT/MD 格式（原有逻辑）
    async function saveNovelAsTextOrMarkdown(details, combinedContent, chapterFolderId) {
        if (!combinedContent) {
            combinedContent = combineNovelContent(details);
        }
        
        // 生成文件名（添加序号前缀）
        let titleWithNumber = details.title;
        if (details.chapterNumber) {
            titleWithNumber = `${details.chapterNumber} ${details.title}`;
        }
        
        // 下载文件到本地
        showMessage("正在下载小说文件，请选择保存位置...", false);
        const downloadedFiles = await downloadNovelFiles(combinedContent, titleWithNumber, details.id);
        
        // 等待用户下载完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 获取文件路径
        const basePath = getNovelSavePath();
        const filePaths = await getFilePaths(downloadedFiles.novelFilename, downloadedFiles.imageFilenames, basePath);
        
        // 使用 addFromPath 批量添加文件（小说文件 + 图片文件）
        const novelExt = combinedContent.format === 'md' ? 'md' : 'txt';
        const safeTitle = titleWithNumber.replace(/[\\/:*?"<>|]/g, "_");
        const novelUrl = `https://www.pixiv.net/novel/show.php?id=${details.id}`;
        
        // 构建 items 数组
        const items = [];
        
        // 添加小说文件
        items.push({
            path: filePaths.novelPath,
            name: `${safeTitle}.${novelExt}`,
            website: novelUrl,
            annotation: details.id,
            tags: details.tags || [],
            folderId: chapterFolderId
        });
        
        // 添加所有图片文件（如果有）
        if (filePaths.imagePaths.length > 0 && combinedContent.images) {
            for (let i = 0; i < filePaths.imagePaths.length; i++) {
                const imagePath = filePaths.imagePaths[i];
                const imageInfo = combinedContent.images[i];
                
                if (imagePath && imageInfo) {
                    items.push({
                        path: imagePath,
                        name: imageInfo.filename,
                        website: novelUrl,
                        annotation: details.id,
                        tags: details.tags || [],
                        folderId: chapterFolderId
                    });
                }
            }
        }
        
        // 逐个添加文件（Eagle API addFromPath 可能不支持批量添加）
        if (items.length > 0) {
            try {
                for (const item of items) {
                    const addResult = await gmFetch("http://localhost:41595/api/item/addFromPath", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(item)
                    });
                    
                    if (!addResult || !addResult.status) {
                        err("添加文件失败:", item.path, addResult);
                        throw new Error(`添加文件到 Eagle 失败: ${item.name || item.path}`);
                    }
                }
            } catch (error) {
                err("添加小说文件到 Eagle 失败:", error);
                throw error;
            }
        }
    }

    // 保存当前小说到 Eagle
    async function saveCurrentNovel() {
        const folderId = getFolderId();
        const folderInfo = folderId ? `Pixiv 文件夹 ID: ${folderId}` : "未设置 Pixiv 文件夹 ID";

        let eagleStatus;
        try {
            eagleStatus = await checkEagle();
        } catch (error) {
            showMessage(`${folderInfo}\n检查 Eagle 状态时出错: ${error.message}`, true);
            return;
        }
        if (!eagleStatus || !eagleStatus.running) {
            const errorMsg = `${folderInfo}\nEagle 未启动，请先启动 Eagle 应用！`;
            showMessage(errorMsg, true);
            return;
        }

        const novelId = getNovelId();
        if (!novelId) {
            showMessage("无法获取小说 ID", true);
            return;
        }

        try {
            const details = await getNovelDetails(novelId);
            if (!details.authorId) {
                throw new Error("无法获取作者信息");
            }

            // 1. 获取/创建画师文件夹
            const artistFolder = await getArtistFolder(folderId, details.authorId, details.authorName);
            let targetParentId = artistFolder.id;
            let parentFolderObj = artistFolder;

            // 2. 处理按类型保存 (小说文件夹)
            if (getSaveByType()) {
                const typeInfo = getTypeFolderInfo("novel");
                const typeFolder = await getOrCreateTypeFolder(artistFolder, typeInfo);
                if (typeFolder) {
                    targetParentId = typeFolder.id;
                    parentFolderObj = typeFolder;
                }
            }

            // 3. 处理系列文件夹
            if (details.seriesId) {
                const seriesUrl = `https://www.pixiv.net/novel/series/${details.seriesId}`;
                let seriesFolderId = null;
                
                // 在父文件夹中查找
                if (parentFolderObj && parentFolderObj.children) {
                    const existingSeries = parentFolderObj.children.find(c => c.description === seriesUrl);
                    if (existingSeries) {
                        seriesFolderId = existingSeries.id;
                        parentFolderObj = existingSeries;
                    }
                }
                
                if (!seriesFolderId) {
                    // 使用与EPUB相同的逻辑：先去除可能存在的"系列"前缀，然后添加"系列:"前缀
                    let cleanSeriesTitle = details.seriesTitle;
                    if (cleanSeriesTitle.startsWith('系列')) {
                        cleanSeriesTitle = cleanSeriesTitle.substring(2).trim();
                    }
                    const seriesFolderName = `系列:${cleanSeriesTitle}`;
                    seriesFolderId = await createEagleFolder(seriesFolderName, targetParentId, seriesUrl);
                    if (parentFolderObj && parentFolderObj.children) {
                        const newSeriesObj = { id: seriesFolderId, name: seriesFolderName, description: seriesUrl, children: [] };
                        parentFolderObj.children.push(newSeriesObj);
                        parentFolderObj = newSeriesObj;
                    }
                }
                targetParentId = seriesFolderId;
            }

            // 4. 创建小说章节文件夹（添加序号前缀）
            let folderName = details.title;
            if (details.chapterNumber) {
                folderName = `${details.chapterNumber} ${details.title}`;
            }
            const chapterFolderId = await createEagleFolder(folderName, targetParentId, details.id);

            // 5. 保存内容
            // 5.1 封面
            if (details.coverUrl) {
                await gmFetch("http://localhost:41595/api/item/addFromURLs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        items: [{
                            url: details.coverUrl,
                            name: "cover.jpg",
                            website: `https://www.pixiv.net/novel/show.php?id=${details.id}`,
                            tags: [],
                            headers: { referer: "https://www.pixiv.net/" }
                        }],
                        folderId: chapterFolderId
                    })
                });
            }

            // 5.2 简介
            if (details.description) {
                const descBlob = new Blob([details.description], { type: "text/plain" });
                const descDataUrl = await blobToDataURL(descBlob);
                const base64 = descDataUrl.split(",")[1];
                
                await gmFetch("http://localhost:41595/api/item/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "简介",
                        ext: "txt",
                        base64: base64,
                        website: `https://www.pixiv.net/novel/show.php?id=${details.id}`,
                        annotation: details.id,
                        tags: [],
                        folderId: chapterFolderId
                    })
                });
            }

            // 5.3 正文 - 根据配置选择保存格式
            if (details.content) {
                const saveFormat = getNovelSaveFormat();
                
                if (saveFormat === 'epub') {
                    // EPUB 格式保存
                    const progressWindow = createEPUBProgressWindow();
                    try {
                        // 组合小说内容
                        const combinedContent = combineNovelContent(details);
                        
                        // 生成 EPUB
                        let epubBlob;
                        try {
                            epubBlob = await generateEPUB(details, combinedContent, progressWindow);
                        } catch (genError) {
                            throw genError;
                        }
                        
                        // 下载 EPUB 文件到本地（添加序号前缀）
                        let titleWithNumber = details.title;
                        if (details.chapterNumber) {
                            titleWithNumber = `${details.chapterNumber} ${details.title}`;
                        }
                        const safeTitle = titleWithNumber.replace(/[\\/:*?"<>|]/g, "_");
                        const epubFilename = `${safeTitle}.epub`;
                        downloadFile(epubBlob, epubFilename);
                        
                        // 等待用户下载完成
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // 获取文件路径
                        const basePath = getNovelSavePath();
                        let epubPath;
                        
                        if (basePath) {
                            const separator = basePath.includes('\\') ? '\\' : '/';
                            const normalizedBasePath = basePath.endsWith('\\') || basePath.endsWith('/') 
                                ? basePath.slice(0, -1) 
                                : basePath;
                            epubPath = `${normalizedBasePath}${separator}${epubFilename}`;
                        } else {
                            epubPath = prompt(
                                `请输入 EPUB 文件的完整路径：\n\n文件名：${epubFilename}\n\n示例：C:\\Users\\YourName\\Downloads\\${epubFilename}`,
                                ""
                            );
                            
                            if (!epubPath) {
                                throw new Error("未提供 EPUB 文件路径");
                            }
                            epubPath = epubPath.trim();
                        }
                        
                        // 使用 addFromPath 添加 EPUB 文件
                        const novelUrl = `https://www.pixiv.net/novel/show.php?id=${details.id}`;
                        const epubTags = details.tags || [];
                        dbg("保存 EPUB 文件，标签:", epubTags);
                        const addResult = await gmFetch("http://localhost:41595/api/item/addFromPath", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                                path: epubPath,
                                name: epubFilename,
                                website: novelUrl,
                        annotation: details.id,
                        tags: epubTags,
                        folderId: chapterFolderId
                    })
                });

                        if (!addResult || !addResult.status) {
                            err("添加 EPUB 文件失败:", epubPath, addResult);
                            throw new Error("添加 EPUB 文件到 Eagle 失败");
                        }
                    } catch (error) {
                        err("生成或保存 EPUB 失败:", error);
                        // EPUB 生成失败，不再回退到 TXT/MD 格式
                        // 注释掉回退逻辑，直接抛出错误
                        // showMessage("EPUB 生成失败，回退到文本格式保存...", false);
                        // const combinedContent = combineNovelContent(details);
                        // await saveNovelAsTextOrMarkdown(details, combinedContent, chapterFolderId);
                        throw error; // 直接抛出错误，不再回退
                    } finally {
                        // 关闭进度窗口
                        if (progressWindow) {
                            progressWindow.close();
                        }
                    }
                } else {
                    // TXT/MD 格式保存（原有逻辑）
                    await saveNovelAsTextOrMarkdown(details, null, chapterFolderId);
                }
            } else {
            }

            showMessage(`✅ 小说 "${details.title}" 已保存到 Eagle`);
            
            // 更新按钮状态
            const saveButton = document.querySelector(`#${EAGLE_SAVE_BUTTON_ID} div:last-child`);
            if (saveButton) {
                saveButton.textContent = "已保存";
                updateNovelSaveButtonIfSaved(saveButton);
            }

        } catch (error) {
            err(error);
            showMessage(`保存小说失败: ${error.message}`, true);
        }
    }

    // 更新小说保存按钮状态
    async function updateNovelSaveButtonIfSaved(saveButton) {
        const novelId = getNovelId();
        if (!novelId) return;

        try {
            const details = await getNovelDetails(novelId);
            if (!details.authorId) return;

            // 1. 查找画师文件夹
            let artistFolder = null;
            try {
                artistFolder = await findArtistFolder(getFolderId(), details.authorId);
            } catch (e) {
                warn("查找画师文件夹失败 (可能是 Pixiv 文件夹 ID 设置错误或文件夹不存在):", e);
                return; // 忽略错误，不更新按钮状态
            }
            
            if (!artistFolder) return;

            let searchRoots = [artistFolder];

            // 2. 如果开启了按类型保存，也要检查类型文件夹
            if (getSaveByType()) {
                const typeInfo = getTypeFolderInfo("novel");
                if (artistFolder.children) {
                    const typeFolder = artistFolder.children.find(c => c.description === typeInfo.description);
                    if (typeFolder) {
                        searchRoots.push(typeFolder);
                    }
                }
            }

            // 3. 如果有系列，检查系列文件夹
            if (details.seriesId) {
                const seriesUrl = `https://www.pixiv.net/novel/series/${details.seriesId}`;
                let seriesFolders = [];
                
                for (const root of searchRoots) {
                    if (root.children) {
                        const sFolder = root.children.find(c => c.description === seriesUrl);
                        if (sFolder) seriesFolders.push(sFolder);
                    }
                }
                
                if (seriesFolders.length > 0) {
                    searchRoots = seriesFolders;
                }
            }

            // 4. 在搜索根中查找章节文件夹 (description == novelId)
            let foundFolder = null;
            for (const root of searchRoots) {
                if (root.children) {
                    const chapter = root.children.find(c => c.description === novelId);
                    if (chapter) {
                        foundFolder = chapter;
                        break;
                    }
                }
            }

            if (foundFolder) {
                saveButton.textContent = "已保存";
                saveButton.style.backgroundColor = "#4caf50"; // Green
                saveButton.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    gmFetch("http://localhost:41595/api/folder/activate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ folderId: foundFolder.id })
                    });
                };
            }

        } catch (error) {
            err("Check saved status failed:", error);
        }
    }

    // 添加小说页面的保存按钮
    let addNovelButtonLock = false; // 执行锁，防止并发调用
    async function addNovelButton() {
        // 检查执行锁
        if (addNovelButtonLock) {
            return;
        }
        
        const oldWrapper = document.getElementById(EAGLE_SAVE_BUTTON_ID);
        if (oldWrapper) {
            return;
        }
        
        // 获取锁
        addNovelButtonLock = true;

        // 尝试多个选择器定位保存按钮插入位置
        let targetSection = await waitForElement(NOVEL_SAVE_BUTTON_SECTION_SELECTOR, 3000);
        
        // 如果主选择器失败，尝试备用方案：通过标题元素向上查找合适的容器
        if (!targetSection) {
            dbg("主选择器失败，尝试备用方案...");

            // 方案1: 尝试找到标题元素，然后找到它的父容器中的合适位置（使用特征识别）
            const titleElement = findNovelTitle();
            if (titleElement) {
                // 遍历父元素，找到包含标题的主要内容区域
                let parent = titleElement.parentElement;
                let attempts = 0;
                while (parent && attempts < 10) {
                    // 查找同级的 section 元素
                    const sections = parent.querySelectorAll('section');
                    for (const section of sections) {
                        // 寻找包含按钮或操作区域的 section
                        if (section.querySelector('button') || section.querySelector('a[role="button"]')) {
                            targetSection = section;
                            dbg("通过标题定位到目标区域:", section.className);
                            break;
                        }
                    }
                    if (targetSection) break;
                    parent = parent.parentElement;
                    attempts++;
                }
            }

            // 方案2: 如果还是找不到，尝试通过标签容器向上查找
            if (!targetSection) {
                const tagsContainer = findNovelTagsContainer();
                if (tagsContainer) {
                    // 在标签容器的前面插入
                    targetSection = tagsContainer.parentElement;
                    dbg("通过标签容器定位到目标区域");
                }
            }

            // 方案3: 通过作者信息容器定位
            if (!targetSection) {
                const authorContainer = document.querySelector(NOVEL_AUTHOR_CONTAINER_SELECTOR);
                if (authorContainer) {
                    let parent = authorContainer.parentElement;
                    let attempts = 0;
                    while (parent && attempts < 10) {
                        if (parent.tagName === 'SECTION') {
                            targetSection = parent;
                            dbg("通过作者信息定位到目标区域");
                            break;
                        }
                        parent = parent.parentElement;
                        attempts++;
                    }
                }
            }
        }

        if (!targetSection) {
            err("无法找到小说保存按钮插入位置，请检查页面结构");
            addNovelButtonLock = false; // 释放锁
            return;
        }

        // 双重检查，防止在等待过程中重复创建
        const doubleCheckButton = document.getElementById(EAGLE_SAVE_BUTTON_ID);
        if (doubleCheckButton) {
            addNovelButtonLock = false; // 释放锁
            return;
        }

        const buttonWrapper = document.createElement("div");
        buttonWrapper.id = EAGLE_SAVE_BUTTON_ID;
        buttonWrapper.style.display = "flex";
        buttonWrapper.style.alignItems = "center";
        buttonWrapper.style.justifyContent = "center";
        buttonWrapper.style.gap = "8px";
        buttonWrapper.style.marginTop = "16px";

        const saveButton = createPixivStyledButton("保存到 Eagle");
        saveButton.addEventListener("click", function(e) {
            saveCurrentNovel();
        });

        buttonWrapper.appendChild(saveButton);
        targetSection.appendChild(buttonWrapper);

        // 自动检测是否已保存
        if (getAutoCheckSavedStatus()) {
            updateNovelSaveButtonIfSaved(saveButton);
        }
        
        // 释放锁
        addNovelButtonLock = false;
    }

    // 在小说系列页面标记已保存章节
    async function markSavedInNovelSeries() {
        const listContainer = await waitForElement(NOVEL_SERIES_LIST_SELECTOR);
        if (!listContainer) return;
        
        const seriesIdMatch = location.pathname.match(/\/novel\/series\/(\d+)/);
        const seriesId = seriesIdMatch ? seriesIdMatch[1] : null;
        if (!seriesId) return;
        
        // 容器本身就是 a 标签，直接从中获取作者UID
        const authorContainer = document.querySelector(NOVEL_AUTHOR_CONTAINER_SELECTOR);
        if (!authorContainer) return;
        
        const authorId = authorContainer.getAttribute("data-gtm-value") || authorContainer.getAttribute("data-gtm-user-id");
        if (!authorId) return;
        
        const pixivFolderId = getFolderId();
        const artistFolder = await findArtistFolder(pixivFolderId, authorId);
        if (!artistFolder) return;
        
        let seriesFolder = findSeriesFolderInArtist(artistFolder, authorId, seriesId);
        
        if (!seriesFolder && artistFolder.children) {
            const novelFolder = artistFolder.children.find(c => c.description === 'novels');
            if (novelFolder) {
                seriesFolder = findSeriesFolderInArtist(novelFolder, authorId, seriesId);
            }
        }
        
        if (!seriesFolder) return;
        
        const chapterFolders = seriesFolder.children || [];
        const savedChapterIds = new Set(chapterFolders.map(c => c.description));
        
        const lis = listContainer.querySelectorAll('li');
        for (const li of lis) {
            const link = li.querySelector(NOVEL_CHAPTER_LINK_SELECTOR);
            if (!link) continue;
            
            const novelId = link.getAttribute('data-gtm-value');
            if (savedChapterIds.has(novelId)) {
                const targetContainer = li.querySelector(NOVEL_CHAPTER_BADGE_CONTAINER_SELECTOR);
                if (targetContainer) {
                    if (targetContainer.querySelector('.eagle-saved-mark')) continue;
                    
                    const refButton = targetContainer.querySelector(NOVEL_CHAPTER_REF_BUTTON_SELECTOR);
                    
                    const mark = document.createElement('span');
                    mark.className = 'eagle-saved-mark';
                    mark.textContent = '✅';
                    mark.style.marginRight = '8px';
                    mark.title = '已保存到 Eagle';
                    
                    if (refButton) {
                        targetContainer.insertBefore(mark, refButton);
                    } else {
                        targetContainer.appendChild(mark);
                    }
                }
            }
        }
    }


    const monitorConfig = createMonitorConfig({
        addButton,
        markSavedInRecommendationArea,
        addNovelButton,
        markSavedInNovelSeries,
        debouncedMarkSavedInArtistList,
    });

    // 启动脚本
    try {
        dbg('脚本已启动，当前URL:', location.pathname);

        // 立即开始构建全局索引
        ensureEagleIndex();

        for (const monitorInfo of monitorConfig) {
            if (location.pathname.includes(monitorInfo.urlSuffix)) {
                dbg('初始加载时触发处理器:', monitorInfo.urlSuffix);
                handlePageChange(monitorInfo);
            }
        }
        observeUrlChanges(monitorConfig);
    } catch (error) {
        err("脚本启动失败:", error);
    }
