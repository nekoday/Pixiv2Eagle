// ==UserScript==
// @name            Pixiv2Eagle
// @name:en         Pixiv2Eagle
// @description     一键将 Pixiv 艺术作品保存到 Eagle 图片管理软件，支持多页作品、自动创建画师文件夹、保留标签和元数据
// @description:en  Save Pixiv artworks to Eagle image management software with one click. Supports multi-page artworks, automatic artist folder creation, and preserves tags and metadata
// @version         2.2.3.12

// @author          nekoday,juzijun233
// @namespace       https://github.com/nekoday/Pixiv2Eagle
// @homepage        https://github.com/nekoday/Pixiv2Eagle
// @icon            https://www.pixiv.net/favicon.ico
// @license         MIT License

// @match           https://www.pixiv.net/*

// @grant           GM_xmlhttpRequest
// @grant           GM_getValue
// @grant           GM_setValue
// @grant           GM_registerMenuCommand
// @connect         localhost
// @connect         127.0.0.1
// @connect         i.pximg.net
// @connect         cdn.jsdelivr.net
// @connect         jsdmirror.com
// ==/UserScript==

/*
MIT License

Copyright (c) 2025 nekoday

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

(function () {
    "use strict";

    // 常量定义
    const EAGLE_SAVE_BUTTON_ID = "eagle-save-button-wrapper";
    const EAGLE_OPEN_ITEM_BUTTON_ID = "eagle-open-artwork-button";
    const PIXIV_SECTION_CLASS = "sc-7709e4d9-0"; // deprecated
    const PIXIV_ARTIST_DIV_CLASS = "sc-946c1cc3-1 lnPJtB"; // deprecated
    
    // JS 库加载源开关（true = 国内源，false = 国际源）
    const USE_DOMESTIC_CDN = true;

    // DOM Selectors - Recommendation Area
    const REC_SECTION_SELECTOR = 'section[class*="sc-79c00fd3-0"]'; // 推荐作品区域容器 (Section)
    const REC_CONTAINER_SELECTOR = 'div.sc-bf8cea3f-0.dKbaFf'; // 推荐作品区域容器 (Div, 新版)
    const REC_WORK_LINK_SELECTOR = 'a.sc-fab8f26d-6'; // 推荐作品链接 (用于提取 PID)
    const REC_ARTIST_LINK_SELECTOR = 'a.sc-fbe982d0-2'; // 推荐作品画师链接 (用于提取 UID)
    const REC_THUMBNAIL_SELECTOR = 'div.sc-f44a0b30-9.cvPXKv'; // 推荐作品缩略图容器 (首选标记位置)
    const REC_THUMBNAIL_FALLBACK_SELECTOR = 'div.sc-fab8f26d-3.etVILu'; // 推荐作品缩略图容器 (备选)
    const REC_THUMBNAIL_FALLBACK_PARTIAL_SELECTOR = 'div.sc-fab8f26d-3'; // 推荐作品缩略图容器 (部分匹配备选)

    // DOM Selectors - Artist List / Series
    const LIST_CONTAINER_SELECTOR = 'div.sc-e83d358-0.daBOIJ'; // 画师插画/漫画列表容器
    const SERIES_PAGE_LIST_SELECTOR = 'div.sc-de6bf819-3.cNVLSX'; // 系列页面作品列表容器
    const THUMBNAIL_CONTAINER_SELECTOR = 'div.sc-f44a0b30-9.cvPXKv'; // 列表作品缩略图容器
    const THUMBNAIL_CONTAINER_PARTIAL_SELECTOR = 'div.sc-f44a0b30-9'; // 列表作品缩略图容器 (部分匹配)
    
    // DOM Selectors - Novel
    const NOVEL_TITLE_SELECTOR = 'h1.sc-41178ccf-3.irrkHK'; // 小说标题
    const NOVEL_DESC_SELECTOR = 'div.sc-fcc502d1-0.jNYFaO > p.sc-fcc502d1-1.YOSSS'; // 小说简介
    const NOVEL_SERIES_DESC_SELECTOR = 'div.sc-fcc502d1-0.jNYFaO > p.sc-fcc502d1-1.fDflWh'; // 小说系列简介
    const NOVEL_COVER_SELECTOR = 'img.sc-41178ccf-19.cKuUeg'; // 小说封面图片
    const NOVEL_SERIES_COVER_SELECTOR = 'img.sc-11435b73-2.hnPyQB'; // 小说系列封面图片
    const NOVEL_AUTHOR_CONTAINER_SELECTOR = 'a.sc-bypJrT.bUiITy'; // 小说作者信息容器（a标签，包含作者UID和作者名）
    const NOVEL_CONTENT_SELECTOR = 'div.sc-ejfMa-d.fldORf'; // 小说正文内容容器
    const NOVEL_SERIES_SECTION_SELECTOR = 'section.sc-55920ee2-1'; // 小说所属系列区域 (用于判断是否属于系列)
    const NOVEL_SERIES_LINK_SELECTOR = 'a.sc-13d2e2cd-0.gwOqfd[href^="/novel/series/"]'; // 小说系列链接
    const NOVEL_SERIES_TITLE_SELECTOR = 'h2.sc-edf844cc-2.emSEGV'; // 小说系列标题
    const NOVEL_SAVE_BUTTON_SECTION_SELECTOR = 'section.sc-44936c9d-0.bmSdAW'; // 小说保存按钮插入位置
    const NOVEL_CHAPTER_LIST_SELECTOR = 'div.sc-794d489b-0.buoliH'; // 小说系列章节列表容器
    const NOVEL_SERIES_LIST_SELECTOR = 'div.sc-794d489b-0.buoliH'; // 小说系列列表容器 (别名，与 NOVEL_CHAPTER_LIST_SELECTOR 相同)
    const NOVEL_CHAPTER_LINK_SELECTOR = 'a[data-gtm-value]'; // 小说章节链接 (用于提取 novelId)
    const NOVEL_CHAPTER_ITEM_CONTAINER_SELECTOR = 'div.sc-3a91e6c3-6.eJoreT'; // 小说章节列表项容器 (用于插入标记)
    const NOVEL_CHAPTER_BADGE_CONTAINER_SELECTOR = 'div.sc-3a91e6c3-6.eJoreT'; // 小说章节标记容器 (与 NOVEL_CHAPTER_ITEM_CONTAINER_SELECTOR 相同)
    const NOVEL_CHAPTER_REF_BUTTON_SELECTOR = 'button.sc-5d3311e8-0.iGxyRb'; // 小说章节列表参考按钮 (标记插在此之前)
    const NOVEL_TAGS_CONTAINER_SELECTOR = 'footer.sc-41178ccf-4.RaSaf'; // 小说标签容器
    const NOVEL_TAG_ITEM_SELECTOR = 'ul.sc-bb0ca45a-0.feaSLI li'; // 小说标签项（位于 footer 内的 ul 列表中）
    const NOVEL_PUBLISH_DATE_CONTAINER_SELECTOR = 'div.sc-a5165759-0.lbROcw'; // 小说出版日期容器

    // DOM Selectors - Misc
    const SERIES_NAV_BUTTON_SELECTOR = 'div.sc-487e14c9-0.doUXUo'; // 漫画系列"加入追更"按钮 (用于判断是否为漫画系列)
    const MANGA_SERIES_INFO_SELECTOR = 'div.sc-41178ccf-0.fwlXRJ a'; // 漫画系列信息 (用于提取章节序号)
    const MANGA_SERIES_HEADER_SELECTOR = 'div.sc-e4a4c914-0.Hwtke'; // 漫画系列页面头部 (用于插入更新按钮)
    const ARTWORK_BUTTON_CONTAINER_SELECTOR = 'div.sc-7fd477ff-3.jrRrCf'; // 作品详情页按钮容器
    const ARTWORK_BUTTON_REF_SELECTOR = 'div.sc-7fd477ff-4.duoqQE'; // 作品详情页按钮插入参考点

    // 获取文件夹 ID
    function getFolderId() {
        return GM_getValue("pixivFolderId", "");
    }

    // 设置文件夹 ID
    function setFolderId() {
        const currentId = getFolderId();
        const userInput = prompt("请输入 Pixiv 文件夹 ID 或 Eagle 文件夹链接：", currentId);

        if (userInput === null) return;

        let finalId = userInput.trim();
        const urlParam = "folder?id=";
        const urlIndex = finalId.indexOf(urlParam);

        if (urlIndex !== -1) {
            // 如果输入的是链接，提取 ID
            finalId = finalId.substring(urlIndex + urlParam.length);
            // 移除可能的后续参数（虽然 Eagle 链接通常没有）
            const queryParamIndex = finalId.indexOf("?");
            if (queryParamIndex !== -1) {
                finalId = finalId.substring(0, queryParamIndex);
            }
            const hashIndex = finalId.indexOf("#");
            if (hashIndex !== -1) {
                finalId = finalId.substring(0, hashIndex);
            }
        }

        // 再次 trim 以防万一
        finalId = finalId.trim();

        GM_setValue("pixivFolderId", finalId);

        if (finalId === "") {
            alert("已清空文件夹 ID，将默认在根目录创建画师文件夹");
        } else {
            alert(`文件夹 ID 已设置为: ${finalId}`);
        }
    }

    // 获取是否使用投稿时间
    function getUseUploadDate() {
        return GM_getValue("useUploadDate", false);
    }

    // 切换是否使用投稿时间
    function toggleUseUploadDate() {
        const currentMode = getUseUploadDate();
        GM_setValue("useUploadDate", !currentMode);
        alert(`使用投稿时间作为添加日期已${!currentMode ? "开启 ✅" : "关闭 ❌"}`);
    }

    // 获取是否保存作品描述
    function getSaveDescription() {
        return GM_getValue("saveDescription", true); // 默认开启
    }

    // 切换是否保存作品描述
    function toggleSaveDescription() {
        const currentMode = getSaveDescription();
        GM_setValue("saveDescription", !currentMode);
        alert(`保存作品描述已${!currentMode ? "开启 ✅" : "关闭 ❌"}`);
    }

    // 切换是否为多 P 作品创建子文件夹
    function toggleCreateSubFolder() {
        const currentMode = getCreateSubFolder();
        switch (currentMode) {
            case "off":
                GM_setValue("createSubFolder", "multi-page");
                alert("✅ 仅为多页作品创建子文件夹");
                break;
            case "multi-page":
                GM_setValue("createSubFolder", "always");
                alert("✅ 为任意作品创建子文件夹");
                break;
            case "always":
                GM_setValue("createSubFolder", "off");
                alert("❌ 已关闭创建作品子文件夹功能");
                break;
            default:
                GM_setValue("createSubFolder", "off");
                alert("❌ 已关闭创建作品子文件夹功能");
        }
    }

    // 获取是否为多 P 作品创建子文件夹
    function getCreateSubFolder() {
        let currentMode = GM_getValue("createSubFolder", "off");
        if (typeof currentMode === "boolean") {
            currentMode = currentMode ? "multi-page" : "off";
            GM_setValue("createSubFolder", currentMode);
        }
        return currentMode;
    }

    // 获取是否按类型保存
    function getSaveByType() {
        return GM_getValue("saveByType", false);
    }

    // 切换按类型保存
    function toggleSaveByType() {
        const currentMode = getSaveByType();
        GM_setValue("saveByType", !currentMode);
        alert(`按类型保存已${!currentMode ? "开启 ✅" : "关闭 ❌"}`);
    }

    // 获取调试模式状态
    function getDebugMode() {
        return GM_getValue("debugMode", false);
    }

    // 切换调试模式
    function toggleDebugMode() {
        const currentMode = getDebugMode();
        GM_setValue("debugMode", !currentMode);
        alert(`调试模式已${!currentMode ? "开启 ✅" : "关闭 ❌"}`);
    }

    // 获取是否自动检测作品保存状态
    function getAutoCheckSavedStatus() {
        return GM_getValue("autoCheckSavedStatus", false);
    }

    // 切换自动检测作品保存状态
    function toggleAutoCheckSavedStatus() {
        const currentStatus = getAutoCheckSavedStatus();
        GM_setValue("autoCheckSavedStatus", !currentStatus);
        alert(`自动检测作品保存状态已${!currentStatus ? "开启" : "关闭"}`);
    }

    // 设置画师文件夹匹配模板串
    function setArtistMatcher() {
        const template = prompt(
            "请输入画师文件夹匹配模板，$uid 为画师 ID，$name 为画师名称。\n默认值：$name",
            GM_getValue("folderNameTemplate", "$name")
        );
        if (template === null) return;
        GM_setValue("folderNameTemplate", template);
        alert(`✅ 模板字符串已设置为 ${template}`);
    }

    // 根据用户模板串创建 ArtistMatcher 实例
    function getArtistMatcher() {
        return new ArtistMatcher(GM_getValue("folderNameTemplate", "$name"));
    }

    // 注册菜单命令
    // 强制更新 Eagle 索引
    async function forceRefreshEagleIndex() {
        try {
            invalidateEagleIndex();
            await ensureEagleIndex(true);
            alert("✅ Eagle 索引已强制更新完成");
        } catch (error) {
            console.error("强制更新索引失败:", error);
            alert(`❌ 强制更新索引失败: ${error.message}`);
        }
    }

    GM_registerMenuCommand("📁 设置 Pixiv 文件夹 ID", setFolderId);
    GM_registerMenuCommand("📅 切换：使用投稿时间作为添加日期", toggleUseUploadDate);
    GM_registerMenuCommand("🕗 切换：保存作品描述", toggleSaveDescription);
    GM_registerMenuCommand("🗂️ 切换：为多页作品创建子文件夹", toggleCreateSubFolder);
    GM_registerMenuCommand("🗂️ 切换：按类型保存", toggleSaveByType);
    GM_registerMenuCommand("🖼️ 保存当前作品到 Eagle", saveCurrentArtwork);
    GM_registerMenuCommand("🔎 切换：自动检测作品保存状态", toggleAutoCheckSavedStatus);
    GM_registerMenuCommand("🔄 强制更新 Eagle 索引", forceRefreshEagleIndex);
    GM_registerMenuCommand("📂 设置小说保存路径", setNovelSavePath);
    GM_registerMenuCommand("📚 切换：小说保存格式 (TXT/MD/EPUB)", setNovelSaveFormat);
    GM_registerMenuCommand("🧪 切换：调试模式", toggleDebugMode);
    GM_registerMenuCommand("🧪 设置画师文件夹名称模板", setArtistMatcher);

    class ArtistMatcher {
        constructor(template) {
            this.template = template;
            this.regex = this.createRegex(template);
        }

        /**
         * 根据模板创建正则表达式
         * @param {string} template - 模板字符串，如 "$uid_$name" 或 "pid = $uid"
         * @returns {RegExp} 生成的正则表达式
         */
        createRegex(template) {
            // 转义正则表达式特殊字符，但保留占位符
            let regexStr = template
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // 转义特殊字符
                .replace(/\\\$uid/g, "(\\d+)") // $uid 匹配数字
                .replace(/\\\$name/g, "(.+?)"); // $name 匹配任意字符（非贪婪）

            return new RegExp(`^${regexStr}$`);
        }

        /**
         * 检测字符串是否匹配指定的画师（仅比较 uid）
         * @param {string} str - 待检测的字符串
         * @param {number|string} uid - 画师 ID
         * @returns {boolean} 是否匹配
         */
        match(str, uid) {
            const extracted = this.extract(str);
            if (!extracted || !extracted.uid) {
                return false;
            }
            return extracted.uid.toString() === uid.toString();
        }

        /**
         * 从字符串中提取画师信息
         * @param {string} str - 待解析的字符串
         * @returns {Object|null} 包含 uid 和 name 的对象，如果不匹配则返回 null
         */
        extract(str) {
            const match = str.match(this.regex);
            if (!match) {
                return null;
            }

            const result = {};
            const uidMatch = this.template.match(/\$uid/g);
            const nameMatch = this.template.match(/\$name/g);

            let groupIndex = 1;

            // 按照模板中的顺序提取字段
            if (this.template.indexOf("$uid") < this.template.indexOf("$name")) {
                if (uidMatch) result.uid = match[groupIndex++];
                if (nameMatch) result.name = match[groupIndex++];
            } else {
                if (nameMatch) result.name = match[groupIndex++];
                if (uidMatch) result.uid = match[groupIndex++];
            }

            return result;
        }

        /**
         * 使用指定字段生成对应的字符串
         * @param {number|string} uid - 画师ID
         * @param {string} name - 画师名称
         * @returns {string} 根据模板生成的字符串
         */
        generate(uid, name) {
            return this.template.replace(/\$uid/g, uid).replace(/\$name/g, name);
        }

        /**
         * 更新模板
         * @param {string} newTemplate - 新的模板字符串
         */
        updateTemplate(newTemplate) {
            this.template = newTemplate;
            this.regex = this.createRegex(newTemplate);
        }
    }

    // 显示消息（根据调试模式决定是否显示）
    function showMessage(message, forceShow = false) {
        if (getDebugMode() || forceShow) {
            alert(message);
        }
    }

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

    /**
     * 移除标题中的序号部分（#数字 或 第数字话）
     * @param {string} title - 原始标题
     * @returns {string} 处理后的标题
     */
    function removeChapterNumber(title) {
        const numMatch = title.match(/#(\d+)/) || title.match(/第(\d+)[话話]/) || title.match(/^(\d+)$/);
        if (numMatch) {
            const cleaned = title.replace(numMatch[0], "").trim();
            return cleaned || title; // 如果清理后为空，返回原标题
        }
        return title;
    }

    // 封装 GM_xmlhttpRequest 为 Promise
    function gmFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || "GET",
                url: url,
                headers: options.headers || {},
                data: options.body,
                responseType: "json",
                onload: function (response) {
                    resolve(response.response);
                },
                onerror: function (error) {
                    reject(error);
                },
            });
        });
    }

    // 封装 GM_xmlhttpRequest 获取二进制数据（ArrayBuffer/Blob）
    function gmFetchBinary(url, options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || "GET",
                url: url,
                headers: options.headers || {},
                data: options.body,
                responseType: options.responseType || "arraybuffer",
                onload: function (response) {
                    resolve(response.response);
                },
                onerror: function (error) {
                    reject(error);
                },
            });
        });
    }

    // 检查 Eagle 是否运行
    async function checkEagle() {
        try {
            // 添加超时处理（5秒）
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Eagle API 调用超时（5秒）")), 5000);
            });
            
            const data = await Promise.race([
                gmFetch("http://localhost:41595/api/application/info"),
                timeoutPromise
            ]);
            
            return {
                running: true,
                version: data.data.version,
            };
        } catch (error) {
            console.error("Eagle 未启动或无法连接:", error);
            return {
                running: false,
                version: null,
            };
        }
    }

    // 查询 Eagle 中是否已保存指定作品
    async function isArtworkSavedInEagle(artworkId, folderId) {
        if (!folderId) {
            return { saved: false, itemId: null };
        }

        const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;
        const limit = 200;

        try {
            let offset = 0;
            let loopCount = 0;

            while (loopCount < 100000) {
                const params = new URLSearchParams({
                    folders: folderId,
                    limit: limit.toString(),
                    offset: offset.toString(),
                });

                const data = await gmFetch(`http://localhost:41595/api/item/list?${params.toString()}`);
                if (!data || !data.status) break;

                const items = Array.isArray(data.data)
                    ? data.data
                    : Array.isArray(data.data?.items)
                    ? data.data.items
                    : [];

                // 1. 快速检查：直接对比列表返回的 url
                let matched = items.find((item) => item.url === artworkUrl);
                
                // 2. 深度检查：如果列表没找到，遍历调用 /api/item/info 获取详细信息对比
                // (优化：解决列表接口可能返回不完整或缓存数据的问题)
                if (!matched && items.length > 0) {
                    const concurrency = 5; // 并发数限制
                    for (let i = 0; i < items.length; i += concurrency) {
                        const chunk = items.slice(i, i + concurrency);
                        const results = await Promise.all(chunk.map(async (item) => {
                            try {
                                const infoData = await gmFetch(`http://localhost:41595/api/item/info?id=${item.id}`);
                                if (infoData && infoData.data && infoData.data.url === artworkUrl) {
                                    return item;
                                }
                            } catch (e) {
                                // 忽略单个获取失败
                            }
                            return null;
                        }));
                        
                        matched = results.find(r => r);
                        if (matched) break;
                    }
                }

                if (matched) {
                    return {
                        saved: true,
                        itemId: matched.id,
                    };
                }

                if (items.length < limit) break;
                offset += items.length;
                loopCount += 1;
            }
        } catch (error) {
            console.error("检测作品保存状态失败:", error);
        }

        return { saved: false, itemId: null };
    }

    // 查找画师文件夹（不创建）
    async function findArtistFolder(pixivFolderId, artistId) {
        // 递归查找文件夹
        function findFolderRecursively(folders, targetId) {
            for (const folder of folders) {
                if (folder.id === targetId) {
                    return folder;
                }
                if (folder.children && folder.children.length > 0) {
                    const found = findFolderRecursively(folder.children, targetId);
                    if (found) {
                        return found;
                    }
                }
            }
            return null;
        }

        // 在文件夹中查找画师文件夹（通过画师 ID）
        function findArtistFolderInFolder(folder, artistId) {
            if (!folder || !folder.children) return null;

            const artistFolder = folder.children.find((childFolder) => {
                const description = childFolder.description || "";
                const match = description.match(/pid\s*=\s*(\d+)/);
                return match && match[1] === artistId;
            });

            if (artistFolder) {
                return {
                    existed: true,
                    id: artistFolder.id,
                    name: artistFolder.name,
                    children: artistFolder.children,
                };
            }
            return null;
        }

        // 在指定的 Pixiv 文件夹中查找画师文件夹
        async function findArtistFolderInPixivFolder(pixivFolderId, artistId) {
            try {
                // 获取所有文件夹列表
                const data = await gmFetch("http://localhost:41595/api/folder/list");
                if (!data.status || !Array.isArray(data.data)) {
                    throw new Error("无法获取文件夹列表");
                }

                // 递归查找 Pixiv 主文件夹
                const pixivFolder = findFolderRecursively(data.data, pixivFolderId);
                if (!pixivFolder) {
                    throw new Error("找不到指定的 Pixiv 文件夹，请检查输入的文件夹 ID 是否正确");
                }

                // 在 Pixiv 文件夹中查找画师文件夹
                return findArtistFolderInFolder(pixivFolder, artistId);
            } catch (error) {
                console.error("在 Pixiv 文件夹中查找画师文件夹失败:", error);
                throw error;
            }
        }

        // 在根目录查找画师文件夹
        async function findArtistFolderInRoot(artistId) {
            try {
                const rootFolders = await gmFetch("http://localhost:41595/api/folder/list");
                if (!rootFolders.status || !Array.isArray(rootFolders.data)) {
                    throw new Error("无法获取根目录文件夹列表");
                }

                const existingFolder = rootFolders.data.find((folder) => {
                    const description = folder.description || "";
                    const match = description.match(/pid\s*=\s*(\d+)/);
                    return match && match[1] === artistId;
                });

                if (existingFolder) {
                    return {
                        existed: true,
                        id: existingFolder.id,
                        name: existingFolder.name,
                        children: existingFolder.children,
                    };
                }
                return null;
            } catch (error) {
                console.error("在根目录查找画师文件夹失败:", error);
                throw error;
            }
        }

        if (pixivFolderId) {
            return await findArtistFolderInPixivFolder(pixivFolderId, artistId);
        } else {
            return await findArtistFolderInRoot(artistId);
        }
    }

    // 在画师文件夹中查找指定系列文件夹（不创建）
    function findSeriesFolderInArtist(artistFolder, artistId, seriesId) {
        if (!artistFolder || !artistFolder.children) return null;
        
        // 调试：打印所有子文件夹的描述，帮助排查匹配失败原因
        const debug = getDebugMode();
        if (debug) {
            console.log(`[Pixiv2Eagle] 正在画师文件夹中查找系列 ${seriesId}，子文件夹数量: ${artistFolder.children.length}`);
        }

        return artistFolder.children.find((folder) => {
            const description = (folder.description || "").trim();
            // 宽松匹配：允许 http/https，允许末尾斜杠，允许描述中包含额外空白
            // 同时也尝试匹配仅包含 URL 的情况
            const urlPattern = new RegExp(`https?:\\/\\/www\\.pixiv\\.net\\/user\\/${artistId}\\/series\\/${seriesId}\\/?`);
            const match = description.match(urlPattern);
            
            if (debug && description) {
                // console.debug(`[Pixiv2Eagle] 检查文件夹: ${folder.name}, 描述: ${description}, 匹配结果: ${!!match}`);
            }
            
            return !!match;
        });
    }

    // 创建 Eagle 文件夹
    async function createEagleFolder(folderName, parentId = null, description = "") {
        try {
            const data = await gmFetch("http://localhost:41595/api/folder/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    folderName: folderName,
                    ...(parentId && { parent: parentId }),
                }),
            });

            if (!data.status) {
                throw new Error("创建文件夹失败");
            }

            const newFolderId = data.data.id;

            // 如果有描述，更新文件夹描述
            if (description) {
                const updateData = await gmFetch("http://localhost:41595/api/folder/update", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        folderId: newFolderId,
                        newDescription: description,
                    }),
                });

                if (!updateData.status) {
                    throw new Error("更新文件夹描述失败");
                }
            }

            return newFolderId;
        } catch (error) {
            console.error("创建文件夹失败:", error);
            throw error;
        }
    }

    // 创建画师专属文件夹
    async function createArtistFolder(artistName, artistId, parentId = null) {
        const artistMatcher = getArtistMatcher();
        const folderName = artistMatcher.generate(artistId, artistName);

        try {
            const newFolderId = await createEagleFolder(folderName, parentId, `pid = ${artistId}`);
            return {
                existed: false,
                id: newFolderId,
                name: artistName,
                children: [],
            };
        } catch (error) {
            console.error("创建画师文件夹失败:", error);
            throw error;
        }
    }

    // 查找或创建画师专属文件夹
    async function getArtistFolder(pixivFolderId, artistId, artistName) {
        // 先查找
        const found = await findArtistFolder(pixivFolderId, artistId);
        if (found) return found;
        // 没找到则创建
        return await createArtistFolder(artistName, artistId, pixivFolderId);
    }

    // 获取类型文件夹信息
    function getTypeFolderInfo(illustType) {
        // illustType: 0=illust, 1=manga, 2=ugoira, "novel"=novel
        // 映射: 0,2 -> 插画 (illustrations), 1 -> 漫画 (manga)
        if (illustType === 1) {
            return { name: "漫画", description: "manga" };
        } else if (illustType === "novel") {
            return { name: "小说", description: "novels" };
        } else {
            // 默认为插画 (包括 ugoira)
            return { name: "插画", description: "illustrations" };
        }
    }

    // 查找或创建类型文件夹
    async function getOrCreateTypeFolder(artistFolder, typeInfo) {
        if (!artistFolder || !artistFolder.children) return null;
        
        let typeFolder = artistFolder.children.find(c => c.description === typeInfo.description);
        if (!typeFolder) {
            const newId = await createEagleFolder(typeInfo.name, artistFolder.id, typeInfo.description);
            typeFolder = { id: newId, name: typeInfo.name, description: typeInfo.description, children: [] };
            // 更新本地缓存的结构
            artistFolder.children.push(typeFolder);
        }
        return typeFolder;
    }

    // 查找系列文件夹
    async function getSeriesFolder(artistFolder, artistId, seriesId, seriesName) {
        const existingFolder = artistFolder.children.find((folder) => {
            const description = folder.description || "";
            const match = description.match(/^https?:\/\/www\.pixiv\.net\/user\/(\d+)\/series\/(\d+)\/?$/);
            return match && match[1] === artistId && match[2] === seriesId;
        });

        if (existingFolder) {
            return {
                existed: true,
                id: existingFolder.id,
                name: existingFolder.name,
                children: existingFolder.children,
            };
        }

        const newSeriesFolderId = await createEagleFolder(
            seriesName,
            artistFolder.id,
            `https://www.pixiv.net/user/${artistId}/series/${seriesId}`
        );
        return {
            existed: false,
            id: newSeriesFolderId,
            name: seriesName,
            children: [],
        };
    }

    // 查找已保存作品所在的文件夹（包含系列与子文件夹描述）
    async function findSavedFolderForArtwork(artworkId) {
        try {
            const details = await getArtworkDetails(artworkId);
            const pixivFolderId = getFolderId();
            const artistFolder = await findArtistFolder(pixivFolderId, details.userId);
            if (!artistFolder) return null;

            if (getDebugMode()) {
                console.log(`[Pixiv2Eagle] 开始查找作品: ${artworkId}, 标题: ${details.title}`);
            }

            // 检查当前页面是否为漫画系列（通过"加入追更列表"按钮判断）
            const isSeriesPage = !!document.querySelector(SERIES_NAV_BUTTON_SELECTOR);

            // 默认在画师文件夹检查，如有系列或当前为系列页面则进入系列文件夹
            let currentFolder = artistFolder;
            
            // 如果开启了按类型保存，或者为了兼容性，检查类型文件夹
            // 注意：这里我们不强制切换 currentFolder，而是增加搜索路径
            // 但为了保持逻辑简单，我们先尝试定位到最具体的文件夹
            
            // 尝试定位系列文件夹
            if (details.seriesNavData || isSeriesPage) {
                const seriesId = details.seriesNavData?.seriesId || 
                    (location.pathname.match(/\/series\/(\d+)/) || [])[1];
                if (seriesId) {
                    // 1. 在画师根目录下找系列
                    let seriesFolder = findSeriesFolderInArtist(artistFolder, details.userId, seriesId);
                    
                    // 2. 如果没找到，且可能在类型文件夹下（如“漫画”文件夹）
                    if (!seriesFolder && artistFolder.children) {
                        const typeFolders = artistFolder.children.filter(c => ['illustrations', 'manga', 'novels'].includes(c.description));
                        for (const tf of typeFolders) {
                            seriesFolder = findSeriesFolderInArtist(tf, details.userId, seriesId);
                            if (seriesFolder) break;
                        }
                    }
                    
                    if (seriesFolder) {
                        currentFolder = seriesFolder;
                    }
                }
            } else {
                // 如果不是系列，可能是单幅插画，检查是否在类型文件夹中
                // 优先检查类型文件夹
                if (artistFolder.children) {
                    const typeInfo = getTypeFolderInfo(details.illustType);
                    const typeFolder = artistFolder.children.find(c => c.description === typeInfo.description);
                    if (typeFolder) {
                        // 如果找到了类型文件夹，我们应该检查它里面的 items
                        // 但我们也应该检查画师根目录，以防旧数据
                        // 这里我们暂时只切换 currentFolder 如果它确实包含该作品?
                        // 不，isArtworkSavedInEagle 只检查一个文件夹。
                        // 我们需要更灵活的检查。
                        
                        // 策略：先检查类型文件夹，再检查画师文件夹
                        const savedInType = await isArtworkSavedInEagle(artworkId, typeFolder.id);
                        if (savedInType.saved) {
                            return { folder: typeFolder, itemId: savedInType.itemId };
                        }
                        // 如果没在类型文件夹找到，继续使用 artistFolder (currentFolder) 进行后续检查
                    }
                }
            }

            // 先检查当前文件夹中的作品
            const savedResult = await isArtworkSavedInEagle(artworkId, currentFolder.id);
            if (savedResult.saved) {
                return { folder: currentFolder, itemId: savedResult.itemId || null };
            }

            // 再检查当前文件夹及其所有子文件夹中的 description 是否等于作品 ID（递归）
            function findInSubfolders(folder) {
                if (!folder || !folder.children) return null;
                for (const child of folder.children) {
                    const desc = (child.description || "").trim();
                    if (desc === String(artworkId)) {
                        return child;
                    }
                    // 递归查找更深层的子文件夹
                    const found = findInSubfolders(child);
                    if (found) return found;
                }
                return null;
            }
            const savedChild = findInSubfolders(currentFolder);
            if (savedChild) {
                return { folder: savedChild, itemId: null };
            }

            // 3. 尝试通过标题在画师文件夹及其子文件夹中搜索 (弥补上述检查可能遗漏的情况)
            if (details.illustTitle) {
                try {
                    // 收集画师文件夹及其所有子文件夹的 ID
                    const allFolderIds = [artistFolder.id];
                    function collectFolderIds(folder) {
                        if (folder.children) {
                            folder.children.forEach(child => {
                                allFolderIds.push(child.id);
                                collectFolderIds(child);
                            });
                        }
                    }
                    collectFolderIds(artistFolder);

                    // 移除标题中的序号部分，以便进行模糊匹配
                    const searchKeyword = removeChapterNumber(details.illustTitle);

                    if (getDebugMode()) {
                        console.log(`[Pixiv2Eagle] 尝试通过标题搜索: "${searchKeyword}" (原标题: "${details.illustTitle}"), 搜索范围: ${allFolderIds.length} 个文件夹`);
                    }

                    const params = new URLSearchParams({
                        folders: allFolderIds.join(','),
                        keyword: searchKeyword,
                        limit: "50"
                    });
                    // 注意：Eagle 的 keyword 搜索是模糊匹配
                    const searchUrl = `http://localhost:41595/api/item/list?${params.toString()}`;
                    const data = await gmFetch(searchUrl);
                    
                    if (data && data.status === "success") {
                        const items = Array.isArray(data.data) ? data.data : (data.data?.items || []);
                        const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;
                        
                        if (getDebugMode()) {
                            console.log(`[Pixiv2Eagle] 标题搜索结果: 找到 ${items.length} 个项目`);
                        }

                        // 优先检查 URL 匹配
                        let matched = items.find(item => item.url === artworkUrl);
                        
                        // 如果没有直接匹配，尝试获取详细信息验证 (深度检查)
                        if (!matched && items.length > 0) {
                            if (getDebugMode()) {
                                console.log(`[Pixiv2Eagle] 列表 URL 未匹配，尝试深度检查 ${items.length} 个项目...`);
                            }
                            const concurrency = 5;
                            for (let i = 0; i < items.length; i += concurrency) {
                                const chunk = items.slice(i, i + concurrency);
                                const results = await Promise.all(chunk.map(async (item) => {
                                    try {
                                        const infoData = await gmFetch(`http://localhost:41595/api/item/info?id=${item.id}`);
                                        if (infoData && infoData.data && infoData.data.url === artworkUrl) {
                                            return item;
                                        }
                                    } catch (e) { return null; }
                                    return null;
                                }));
                                matched = results.find(r => r);
                                if (matched) break;
                            }
                        }

                        if (matched) {
                            if (getDebugMode()) {
                                console.log(`[Pixiv2Eagle] ✅ 通过标题搜索找到已保存作品:`, matched.id);
                            }
                            return { folder: artistFolder, itemId: matched.id };
                        } else {
                            if (getDebugMode()) {
                                console.log(`[Pixiv2Eagle] ❌ 标题搜索未找到匹配 URL 的作品`);
                            }
                        }
                    }
                } catch (err) {
                    console.error("通过标题搜索失败:", err);
                }
            } else {
                if (getDebugMode()) {
                    console.log(`[Pixiv2Eagle] ❌ 无法获取作品标题，跳过标题搜索`);
                }
            }

            return null;
        } catch (error) {
            console.error("定位已保存作品文件夹失败:", error);
            return null;
        }
    }

    // 监听 URL 变化
    function observeUrlChanges(monitorConfig) {
        const handler = () => {
            for (const monitorInfo of monitorConfig) {
                if (location.pathname.includes(monitorInfo.urlSuffix)) {
                    handlePageChange(monitorInfo);
                }
            }
        };

        // 监听 popstate 事件（后退/前进按钮触发）
        window.addEventListener("popstate", () => {
            handler();
        });

        // 重写 history.pushState
        const originalPushState = history.pushState;
        history.pushState = function () {
            originalPushState.apply(this, arguments);
            handler();
        };

        // 重写 history.replaceState
        const originalReplaceState = history.replaceState;
        history.replaceState = function () {
            originalReplaceState.apply(this, arguments);
            handler();
        };
    }

    // 处理页面变化
    function handlePageChange(monitorInfo) {
        // 立即尝试执行处理函数（添加页面元素）
        monitorInfo.handler();

        // 设置一个观察器来监视 DOM 变化
        const observer = new MutationObserver((mutations, obs) => {
            // 检查是否存在指定 ID 的元素，若不存在则添加
            const button = document.getElementById(monitorInfo.observeID);
            if (!button) {
                monitorInfo.handler();
            } else {
                observer.disconnect();
            }
        });

        // 配置观察器
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // 30 秒后停止观察（避免无限观察）
        setTimeout(() => {
            observer.disconnect();
        }, 30000);

        // 同时设置一个间隔检查
        let checkCount = 0;
        const intervalId = setInterval(() => {
            const button = document.getElementById(monitorInfo.observeID);
            if (!button) {
                monitorInfo.handler();
            }

            checkCount++;
            if (checkCount >= 10) {
                // 5 秒后停止检查（500ms * 10）
                clearInterval(intervalId);
            }
        }, 500);
    }

    // 创建 Pixiv 风格的按钮
    function createPixivStyledButton(text) {
        const button = document.createElement("div");
        button.textContent = text;
        button.style.cursor = "pointer";
        button.style.fontSize = "14px";
        button.style.padding = "8px 16px";
        button.style.borderRadius = "999px";
        button.style.color = "#333";
        button.style.backgroundColor = "transparent";
        button.style.display = "flex";
        button.style.alignItems = "center";
        button.style.gap = "4px";
        button.style.transition = "all 0.2s ease";
        button.style.border = "1px solid #d6d6d6";

        // 添加鼠标悬浮效果
        button.addEventListener("mouseenter", () => {
            button.style.backgroundColor = "#0096fa";
            button.style.color = "white";
            button.style.border = "1px solid #0096fa";
        });

        // 添加鼠标离开效果
        button.addEventListener("mouseleave", () => {
            button.style.backgroundColor = "transparent";
            button.style.color = "#333";
            button.style.border = "1px solid #d6d6d6";
        });

        // 添加点击效果
        button.addEventListener("mousedown", () => {
            button.style.backgroundColor = "#0075c5";
            button.style.border = "1px solid #0075c5";
        });

        button.addEventListener("mouseup", () => {
            button.style.backgroundColor = "#0096fa";
            button.style.border = "1px solid #0096fa";
        });

        return button;
    }

    // 获取作品 ID
    function getArtworkId() {
        const match = location.pathname.match(/^\/artworks\/(\d+)/);
        return match ? match[1] : null;
    }

    // 处理标签
    function processTags(tags, isOriginal, aiType) {
        if (!Array.isArray(tags)) return [];

        // 初始化结果数组和标签集合
        const processedTags = [];
        const tagSet = new Set();

        // 定义添加标签的辅助函数
        const addTagIfNotExists = (tag) => {
            if (!tagSet.has(tag)) {
                tagSet.add(tag);
                processedTags.push(tag);
                return true;
            }
            return false;
        };

        // 首先添加特殊标签（如果需要）
        // 如果是 AI 生成的作品，添加"AI生成"标签
        if (aiType === 2) {
            addTagIfNotExists("AI生成");
        }

        // 如果是原创作品，添加"原创"标签
        if (isOriginal) {
            addTagIfNotExists("原创");
        }

        // 处理原始标签，保持顺序但去除重复
        tags.forEach((tagInfo) => {
            const tag = tagInfo.tag;
            addTagIfNotExists(tag);

            // 如果有翻译且有英文翻译，将其作为单独的标签处理
            if (tagInfo.translation && tagInfo.translation.en) {
                const enTag = tagInfo.translation.en;
                addTagIfNotExists(enTag);
            }
        });

        return processedTags;
    }

    // 获取作品页面信息
    async function getArtworkPages(artworkId) {
        try {
            const response = await fetch(`https://www.pixiv.net/ajax/illust/${artworkId}/pages?lang=zh`);
            const data = await response.json();

            if (!data.body || !Array.isArray(data.body)) {
                throw new Error("无法获取作品页面信息");
            }

            return {
                pageCount: data.body.length,
                originalUrls: data.body.map((page) => page.urls.original),
            };
        } catch (error) {
            console.error("获取作品页面信息失败:", error);
            throw error;
        }
    }

    // 获取作品详细信息
    async function getArtworkDetails(artworkId) {
        try {
            const [basicInfo, pagesInfo] = await Promise.all([
                fetch(`https://www.pixiv.net/ajax/illust/${artworkId}?lang=zh`).then((r) => r.json()),
                getArtworkPages(artworkId),
            ]);

            if (!basicInfo.body) {
                throw new Error("无法获取作品信息");
            }

            function formatDescription(desc) {
                const replaceOperations = [
                    // Eagle 无法解析的标签
                    { regex: /<br\s*\/?>/gi, replace: "\n" },
                    { regex: /<\/?\s*strong>/gi, replace: "" },

                    // Pixiv 短链接 转换为 长链接
                    {
                        regex: /<a\s+href="(https:\/\/twitter\.com\/([^"]+))"\s+target="_blank">twitter\/\2<\/a>/gi,
                        replace: "$1",
                    },
                    {
                        regex: /<a\s+href="(https:\/\/www\.pixiv\.net\/artworks\/(\d+))">illust\/\2<\/a>/gi,
                        replace: "$1",
                    },
                    { regex: /<a\s+href="(https:\/\/www\.pixiv\.net\/users\/(\d+))">user\/\2<\/a>/gi, replace: "$1" },
                ];

                for (const { regex, replace } of replaceOperations) {
                    desc = desc.replace(regex, replace);
                }

                return desc.trim();
            }

            /**
             * 获取作品标题
             * @param {string} title
             * @returns {string}
             */
            const getTitle = (title) => {
                if (title === "") return artworkId;
                if (["无题", "無題", "무제", "Untitled"].includes(title)) return `${artworkId}_${title}`;
                return title;
            };

            const details = {
                userName: basicInfo.body.userName,
                userId: basicInfo.body.userId,
                illustTitle: getTitle(basicInfo.body.illustTitle),
                description: formatDescription(basicInfo.body.description),
                pageCount: pagesInfo.pageCount,
                originalUrls: pagesInfo.originalUrls,
                uploadDate: basicInfo.body.uploadDate,
                tags: processTags(basicInfo.body.tags.tags, basicInfo.body.isOriginal, basicInfo.body.aiType),
                // 作品类型：0 插画、1 漫画、2 动图（ugoira）
                illustType: basicInfo.body.illustType,
                seriesNavData: basicInfo.body.seriesNavData,
            };

            // 尝试从 DOM 提取漫画章节序号并优化标题
            // 格式通常为 "系列名称 #序号"，优化后为 "#序号 章节标题"
            if (details.illustType === 1) {
                try {
                    const seriesInfoEl = document.querySelector(MANGA_SERIES_INFO_SELECTOR);
                    if (seriesInfoEl) {
                        const text = seriesInfoEl.textContent.trim();
                        const lastHashIndex = text.lastIndexOf('#');
                        if (lastHashIndex !== -1) {
                            const chapterNum = text.substring(lastHashIndex + 1).trim();
                            // 简单验证是否包含数字
                            if (/\d/.test(chapterNum)) {
                                details.illustTitle = `#${chapterNum} ${details.illustTitle}`;
                                console.log(`[Pixiv2Eagle] 已优化漫画标题: ${details.illustTitle}`);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[Pixiv2Eagle] 尝试优化漫画标题失败:', e);
                }
            }

            return details;
        } catch (error) {
            console.error("获取作品信息失败:", error);
            throw error;
        }
    }

    // 获取动图（ugoira）元数据
    async function getUgoiraMeta(artworkId) {
        try {
            const response = await fetch(`https://www.pixiv.net/ajax/illust/${artworkId}/ugoira_meta?lang=zh`);
            const data = await response.json();
            if (!data || !data.body || !data.body.originalSrc || !Array.isArray(data.body.frames)) {
                throw new Error("无法获取动图元数据");
            }
            return {
                originalSrc: data.body.originalSrc,
                frames: data.body.frames, // [{file: '000000.jpg', delay: 100}, ...]
            };
        } catch (err) {
            console.error("获取动图元数据失败:", err);
            throw err;
        }
    }

    // 以文本形式获取内容
    function gmFetchText(url, options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || "GET",
                url: url,
                headers: options.headers || {},
                data: options.body,
                responseType: "text",
                onload: function (response) {
                    resolve(response.responseText || response.response);
                },
                onerror: function (error) {
                    reject(error);
                },
            });
        });
    }

    // 下载 ugoira 的 zip 数据
    async function downloadUgoiraZip(zipUrl) {
        const buffer = await gmFetchBinary(zipUrl, {
            responseType: "arraybuffer",
            headers: { referer: "https://www.pixiv.net/" },
        });
        if (!buffer) throw new Error("下载 ugoira 压缩包失败");
        return buffer;
    }

    // 将 Uint8Array 解码成 Image 对象
    function decodeImageFromU8(u8, mime) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([u8], { type: mime });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(e);
            };
            img.src = url;
        });
    }

    // 动态加载 JSZip 库到用户脚本沙箱
    async function ensureJSZipLoaded() {
        if (window.JSZip) {
            return;
        }
        // 使用 3.1.5 版本，因为 3.2.x+ 版本存在性能问题
        const jsZipUrl = USE_DOMESTIC_CDN 
            ? "https://cdn.jsdmirror.com/npm/jszip@3.1.5/dist/jszip.min.js"
            : "https://cdn.jsdelivr.net/npm/jszip@3.1.5/dist/jszip.min.js";
        let code;
        try {
            code = await gmFetchText(jsZipUrl);
            if (!code || code.length === 0) {
                throw new Error(`JSZip 代码加载失败：代码为空 (URL: ${jsZipUrl})`);
            }
        } catch (fetchError) {
            throw new Error(`JSZip 代码加载失败：${fetchError?.message || '未知错误'} (URL: ${jsZipUrl})`);
        }
        
        try {
            eval(code);
        } catch (evalError) {
            throw new Error(`JSZip 代码执行失败：${evalError?.message || '未知错误'}`);
        }
        
        if (!window.JSZip) {
            throw new Error("JSZip 加载失败：eval 后 window.JSZip 不存在");
        }
    }

    // 将动图转换为 GIF Blob
    async function convertUgoiraToGifBlob(artworkId) {
        // 动态加载 fflate（解压 zip）库到用户脚本沙箱
        async function ensureFflateLoaded() {
            if (window.fflate) return;
            const fflateUrl = USE_DOMESTIC_CDN
                ? "https://cdn.jsdmirror.com/npm/fflate@0.8.2/umd/index.min.js"
                : "https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.min.js";
            const code = await gmFetchText(fflateUrl);
            eval(code);
            if (!window.fflate) throw new Error("fflate 加载失败");
        }

        // 动态加载 gif.js 到用户脚本沙箱，并准备 worker 脚本 URL
        let __gifWorkerURL = null;
        async function ensureGifLibLoaded() {
            if (!window.GIF) {
                const gifJsUrl = USE_DOMESTIC_CDN
                    ? "https://cdn.jsdmirror.com/npm/gif.js@0.2.0/dist/gif.min.js"
                    : "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.min.js";
                const code = await gmFetchText(gifJsUrl);
                eval(code);
            }
            if (!__gifWorkerURL) {
                const gifWorkerUrl = USE_DOMESTIC_CDN
                    ? "https://cdn.jsdmirror.com/npm/gif.js@0.2.0/dist/gif.worker.js"
                    : "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js";
                const workerCode = await gmFetchText(gifWorkerUrl);
                __gifWorkerURL = URL.createObjectURL(new Blob([workerCode], { type: "text/javascript" }));
            }
            if (!window.GIF || !__gifWorkerURL) throw new Error("gif.js 加载失败");
        }

        await ensureFflateLoaded();
        await ensureGifLibLoaded();

        const meta = await getUgoiraMeta(artworkId);
        const zipBuf = await downloadUgoiraZip(meta.originalSrc);
        const entries = window.fflate.unzipSync(new Uint8Array(zipBuf));

        if (!entries || !meta.frames || meta.frames.length === 0) {
            throw new Error("动图数据不完整");
        }

        // 猜测帧图片类型
        const guessMime = (name) => (name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

        // 解码第一帧获取宽高
        const first = meta.frames[0];
        const firstBytes = entries[first.file];
        if (!firstBytes) throw new Error("压缩包中缺少帧文件: " + first.file);
        const firstImg = await decodeImageFromU8(firstBytes, guessMime(first.file));

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = firstImg.width;
        canvas.height = firstImg.height;

        const gif = new window.GIF({
            workers: 2,
            quality: 10,
            width: canvas.width,
            height: canvas.height,
            workerScript: __gifWorkerURL,
        });

        // 绘制第一帧并加入 GIF
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(firstImg, 0, 0);
        gif.addFrame(ctx, { copy: true, delay: Math.max(20, first.delay || 100) });

        // 处理后续帧
        for (let i = 1; i < meta.frames.length; i++) {
            const f = meta.frames[i];
            const bytes = entries[f.file];
            if (!bytes) throw new Error("压缩包中缺少帧文件: " + f.file);
            const img = await decodeImageFromU8(bytes, guessMime(f.file));
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            gif.addFrame(ctx, { copy: true, delay: Math.max(20, f.delay || 100) });
        }

        const blob = await new Promise((resolve) => {
            gif.on("finished", (b) => resolve(b));
            gif.render();
        });
        return blob;
    }

    async function blobToDataURL(blob) {
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
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
            console.error(`下载图片失败 ${imageUrl}:`, error);
            return false;
        }
    }

    // 下载小说文件（文本或 Markdown）
    function downloadNovelFile(content, filename, format) {
        const mimeType = format === 'md' ? 'text/markdown' : 'text/plain';
        const blob = new Blob([content], { type: mimeType });
        downloadFile(blob, filename);
    }

    // 获取小说保存路径配置
    function getNovelSavePath() {
        return GM_getValue("novelSavePath", "");
    }

    // 设置小说保存路径
    function setNovelSavePath() {
        const currentPath = getNovelSavePath();
        const userInput = prompt("请输入小说保存路径（例如：C:\\Users\\YourName\\Downloads）:", currentPath);
        
        if (userInput === null) return;
        
        const path = userInput.trim();
        GM_setValue("novelSavePath", path);
        
        if (path === "") {
            alert("已清空保存路径，将提示用户手动输入");
        } else {
            alert(`小说保存路径已设置为: ${path}`);
        }
    }

    // 获取小说保存格式
    function getNovelSaveFormat() {
        const format = GM_getValue("novelSaveFormat", "txt"); // 默认 txt
        return format;
    }

    // 设置小说保存格式
    function setNovelSaveFormat() {
        const currentFormat = getNovelSaveFormat();
        const formats = ["txt", "md", "epub"];
        const formatNames = { txt: "纯文本 (TXT)", md: "Markdown (MD)", epub: "EPUB 电子书" };
        
        const formatIndex = formats.indexOf(currentFormat);
        const nextFormat = formats[(formatIndex + 1) % formats.length];
        
        GM_setValue("novelSaveFormat", nextFormat);
        alert(`小说保存格式已设置为: ${formatNames[nextFormat]}`);
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
                    await new Promise(resolve => setTimeout(resolve, 500)); // 延迟避免浏览器阻止多个下载
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

    // 保存图片到 Eagle
    async function saveToEagle(imageUrls, folderId, details, artworkId) {
        async function getUgoiraUrl(artworkId) {
            const gifBlob = await convertUgoiraToGifBlob(artworkId);
            const [base64, dataURL] = await (async () => {
                const du = await blobToDataURL(gifBlob);
                const comma = du.indexOf(",");
                return [du.substring(comma + 1), du];
            })();
            return dataURL;
        }

        // 如果是动图（ugoira），先转换为 GIF 并保存
        const isUgoira = details.illustType === 2;
        if (isUgoira) {
            imageUrls = [await getUgoiraUrl(artworkId)];
        }

        const baseTitle = details.illustTitle;
        const isMultiPage = imageUrls.length > 1;
        const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;

        // 根据设置决定是否使用投稿时间
        const useUploadDate = getUseUploadDate();
        const modificationTime = useUploadDate ? new Date(details.uploadDate).getTime() : undefined;

        // 根据设置决定是否保存描述
        const shouldSaveDescription = getSaveDescription();
        const annotation = shouldSaveDescription ? details.description : undefined;

        // 批量添加图片
        const data = await gmFetch("http://localhost:41595/api/item/addFromURLs", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                items: imageUrls.map((url, index) => ({
                    url,
                    name: isMultiPage ? `${baseTitle}_${index}` : baseTitle,
                    website: artworkUrl,
                    tags: details.tags,
                    ...(annotation && { annotation }),
                    ...(modificationTime && { modificationTime }),
                    ...(!isUgoira && {
                        headers: {
                            referer: "https://www.pixiv.net/",
                        },
                    }),
                })),
                folderId,
            }),
        });

        if (!data.status) {
            throw new Error("保存图片失败");
        }

        return data.data;
    }

    // 保存当前作品到 Eagle
    async function saveCurrentArtwork() {
        const folderId = getFolderId();
        const folderInfo = folderId ? `Pixiv 文件夹 ID: ${folderId}` : "未设置 Pixiv 文件夹 ID";

        // 首先检查 Eagle 是否运行
        const eagleStatus = await checkEagle();
        if (!eagleStatus.running) {
            showMessage(`${folderInfo}\nEagle 未启动，请先启动 Eagle 应用！`, true);
            return;
        }

        const artworkId = getArtworkId();
        if (!artworkId) {
            showMessage("无法获取作品 ID", true);
            return;
        }

        try {
            const details = await getArtworkDetails(artworkId);

            // 检查或创建画师专属文件夹
            const artistFolder = await getArtistFolder(folderId, details.userId, details.userName);
            let targetFolderId = artistFolder.id;
            let parentFolderObj = artistFolder; // 用于传递给 getSeriesFolder

            // 处理按类型保存
            if (getSaveByType()) {
                const typeInfo = getTypeFolderInfo(details.illustType);
                const typeFolder = await getOrCreateTypeFolder(artistFolder, typeInfo);
                if (typeFolder) {
                    targetFolderId = typeFolder.id;
                    parentFolderObj = typeFolder;
                }
            }

            // 创建漫画系列文件夹
            if (details.illustType === 1 && details.seriesNavData) {
                const seriesId = details.seriesNavData.seriesId;
                const seriesTitle = details.seriesNavData.title;
                const seriesFolder = await getSeriesFolder(parentFolderObj, details.userId, seriesId, seriesTitle);
                targetFolderId = seriesFolder.id;
            }

            // 漫画作品，始终创建子文件夹
            // 如果是多 P 作品且设置了创建子文件夹，则创建子文件夹
            if (
                details.illustType === 1 ||
                (getCreateSubFolder() === "multi-page" && details.pageCount > 1) ||
                getCreateSubFolder() === "always"
            ) {
                targetFolderId = await createEagleFolder(details.illustTitle, targetFolderId, artworkId);
            }

            await saveToEagle(details.originalUrls, targetFolderId, details, artworkId);

            // 保存成功后，使索引失效，下次访问时自动重建
            invalidateEagleIndex();

            const message = [
                `✅ ${details.illustType === 2 ? "动图已转换为 GIF 并" : "图片已成功"}保存到 Eagle`,
                "----------------------------",
                folderInfo,
                `画师专属文件夹: ${artistFolder.name} (ID: ${artistFolder.id})`,
                "----------------------------",
                `Eagle版本: ${eagleStatus.version}`,
                "----------------------------",
                `作品ID: ${artworkId}`,
                `作者: ${details.userName} (ID: ${details.userId})`,
                `作品名称: ${details.illustTitle}`,
                `作品类型： ${details.illustType === 2 ? "动图 (ugoira)" : details.illustType === 1 ? "漫画" : "插画"}`,
                `页数: ${details.pageCount}`,
                `上传时间: ${details.uploadDate}`,
                `标签: ${details.tags.join(", ")}`,
            ].join("\n");

            showMessage(message);
        } catch (error) {
            console.error(error);
            showMessage(`${folderInfo}\n保存图片失败: ${error.message}`, true);
        }
    }

    /**
     * @deprecated 通过 DOM 获取画师 UID 和用户名
     */
    function getArtistInfoFromDOM() {
        // 通过 div 的 class 查找画师信息
        const artistDiv = document.querySelector(`div.${PIXIV_ARTIST_DIV_CLASS.replace(/ /g, ".")}`);
        if (artistDiv) {
            const link = artistDiv.querySelector('a[href^="/users/"]');
            if (link) {
                const userId = link.getAttribute("data-gtm-value") || (link.getAttribute("href").match(/\d+/) || [])[0];
                const userName = link.textContent.trim();
                if (userId && userName) {
                    return { userId, userName };
                }
            }
        }
        return null;
    }

    // 从 artwork 信息获取画师信息
    async function getArtistInfoFromArtwork(artworkId) {
        const artworkInfo = await fetch(`https://www.pixiv.net/ajax/illust/${artworkId}?lang=zh`).then((r) => r.json());
        if (artworkInfo && artworkInfo.body) {
            return {
                userId: artworkInfo.body.userId,
                userName: artworkInfo.body.userName,
            };
        }
        return null;
    }

    // 更新 Eagle 文件夹名称
    async function updateFolderNameInEagle(folderId, newName) {
        await gmFetch("http://localhost:41595/api/folder/update", {
            method: "POST",
            body: JSON.stringify({
                folderId: folderId,
                newName: newName,
            }),
        });
    }

    // 在 Eagle 中打开画师专属文件夹
    async function openArtistFolderInEagle(artistInfo) {
        const folderId = getFolderId();

        // 只查找，不自动创建
        const artistFolder = await findArtistFolder(folderId, artistInfo.userId);

        if (!artistFolder) {
            showMessage(`无法找到画师文件夹，请先保存作品。`, true);
            return;
        }

        // 打开画师文件夹
        const eagleUrl = `http://localhost:41595/folder?id=${artistFolder.id}`;
        window.location.href = eagleUrl;

        // 计算正确的文件夹名称
        const artistMatcher = getArtistMatcher();
        const targetFolderName = artistMatcher.generate(artistInfo.userId, artistInfo.userName);

        // 更新 Eagle 文件夹名称
        if (artistFolder.name !== targetFolderName) {
            updateFolderNameInEagle(artistFolder.id, targetFolderName);
        }
    }

    // 从作品页打开画师专属文件夹
    async function openArtistFolderFromArtworkPage() {
        // 首先检查 Eagle 是否运行
        const eagleStatus = await checkEagle();
        if (!eagleStatus.running) {
            showMessage("Eagle 未启动，请先启动 Eagle 应用！", true);
            return;
        }

        // 通过 DOM 获取画师信息
        const artworkId = getArtworkId();
        const artistInfo = await getArtistInfoFromArtwork(artworkId);
        if (!artistInfo) {
            showMessage("无法获取画师信息", true);
            return;
        }

        try {
            await openArtistFolderInEagle(artistInfo);
        } catch (error) {
            console.error(error);
            showMessage(`打开画师文件夹失败: ${error.message}`, true);
        }
    }

    // 等待目标 section 元素加载
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve) => {
            // 首先检查元素是否已经存在
            const element = document.querySelector(selector);
            if (element) {
                return resolve(element);
            }

            // 如果元素不存在，设置观察器
            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });

            // 超时
            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    function waitForSectionWithin(parent, timeout = 10000) {
        const getFirstSection = () => {
            const children = parent.children ? Array.from(parent.children) : [];
            const directChild = children.find((child) => child.tagName && child.tagName.toLowerCase() === "section");
            if (directChild) {
                return directChild;
            }
            return parent.querySelector("section");
        };

        const existing = getFirstSection();
        if (existing) {
            return Promise.resolve(existing);
        }

        return new Promise((resolve) => {
            const observer = new MutationObserver((mutations, obs) => {
                const section = getFirstSection();
                if (section) {
                    obs.disconnect();
                    resolve(section);
                }
            });

            observer.observe(parent, {
                childList: true,
                subtree: true,
            });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    // 自动检测 Eagle 中是否已有当前作品，并更新按钮文案
    async function updateSaveButtonIfSaved(saveButton) {
        function attachOpenArtworkButton(savedInfo) {
            const wrapper = saveButton.parentElement;

            const hrefQuery = savedInfo.itemId ? `item?id=${savedInfo.itemId}` : `folder?id=${savedInfo.folder.id}`;
            const clickHandler = () => (window.location.href = `http://localhost:41595/${hrefQuery}`);

            const openButton = createPixivStyledButton("🔍");
            openButton.id = EAGLE_OPEN_ITEM_BUTTON_ID;
            openButton.title = "在 Eagle 中打开此作品";
            openButton.onclick = clickHandler;

            wrapper.insertBefore(openButton, saveButton.nextSibling);
        }

        const artworkId = getArtworkId();
        if (!artworkId) return;

        try {
            const eagleStatus = await checkEagle();
            if (!eagleStatus.running) return;

            const savedInfo = await findSavedFolderForArtwork(artworkId);

            if (savedInfo && savedInfo.folder) {
                saveButton.textContent = "✅ 此作品已保存";
                attachOpenArtworkButton(savedInfo);
            }
        } catch (error) {
            console.error("检测保存状态时出错:", error);
        }
    }

    // 将作品文件移动到子文件夹
    async function moveArtworkToSubfolder(artworkId) {
        const folderId = getFolderId();
        if (!folderId) {
            alert("请先设置 Pixiv 文件夹 ID！");
            return;
        }

        const eagleStatus = await checkEagle();
        if (!eagleStatus.running) {
            alert("Eagle 未启动！");
            return;
        }

        // 检查是否启用了子文件夹功能
        const createSubFolderMode = getCreateSubFolder();
        if (createSubFolderMode === 'off') {
            alert("请先启用多页作品子文件夹功能！");
            return;
        }

        try {
            // 1. 获取作品详情
            const details = await getArtworkDetails(artworkId);
            if (!details) {
                alert("无法获取作品详情");
                return;
            }

            // 2. 查找画师文件夹
            const artistFolder = await findArtistFolder(folderId, details.userId);
            if (!artistFolder) {
                alert("未找到画师文件夹");
                return;
            }

            // 3. 确定目标父文件夹 (根据"按类型保存"设置)
            let targetParentFolder = artistFolder;
            if (getSaveByType()) {
                const typeInfo = getTypeFolderInfo(details.illustType);
                targetParentFolder = await getOrCreateTypeFolder(artistFolder, typeInfo);
                if (getDebugMode()) {
                    console.log(`[Pixiv2Eagle] 按类型保存开启，目标父文件夹: ${targetParentFolder.name}`);
                }
            }

            // 4. 检查是否需要创建子文件夹（根据 createSubFolder 设置）
            const shouldCreateSubfolder = 
                createSubFolderMode === 'always' || 
                (createSubFolderMode === 'multi-page' && details.pageCount > 1) ||
                details.illustType === 1; // 漫画始终创建子文件夹

            if (!shouldCreateSubfolder) {
                alert("根据当前设置，此作品不需要子文件夹");
                return;
            }

            // 5. 查找或创建目标子文件夹
            let subFolder = null;
            if (targetParentFolder.children) {
                subFolder = targetParentFolder.children.find(c => c.description === artworkId);
            }

            if (!subFolder) {
                // 创建子文件夹
                const subFolderId = await createEagleFolder(
                    details.illustTitle,
                    targetParentFolder.id,
                    artworkId
                );
                subFolder = { id: subFolderId, name: details.illustTitle };
                if (getDebugMode()) {
                    console.log(`[Pixiv2Eagle] 已创建子文件夹: ${details.illustTitle} (在 ${targetParentFolder.name} 下)`);
                }
            } else {
                if (getDebugMode()) {
                    console.log(`[Pixiv2Eagle] 子文件夹已存在: ${subFolder.name}`);
                }
            }

            // 6. 查找所有属于该作品的文件 (在整个画师文件夹树中查找)
            // 收集画师文件夹及其所有子文件夹的 ID
            const allFolderIds = [artistFolder.id];
            function collectFolderIds(folder) {
                if (folder.children) {
                    folder.children.forEach(child => {
                        allFolderIds.push(child.id);
                        collectFolderIds(child);
                    });
                }
            }
            collectFolderIds(artistFolder);

            // 构造搜索关键字 (移除序号以便模糊匹配)
            const searchKeyword = removeChapterNumber(details.illustTitle);

            if (getDebugMode()) {
                console.log(`[Pixiv2Eagle] 正在搜索待移动文件，关键字: "${searchKeyword}", 范围: ${allFolderIds.length} 个文件夹`);
            }

            const params = new URLSearchParams({
                folders: allFolderIds.join(','),
                keyword: searchKeyword,
                limit: "200" // 假设单次能搜到所有相关图片
            });
            
            const searchUrl = `http://localhost:41595/api/item/list?${params.toString()}`;
            const data = await gmFetch(searchUrl);
            
            let artworkItems = [];
            if (data && data.status === "success") {
                const items = Array.isArray(data.data) ? data.data : (data.data?.items || []);
                const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;
                
                // 过滤出 URL 匹配的项目
                artworkItems = items.filter(item => item.url === artworkUrl);
                
                // 如果 URL 匹配失败，尝试深度检查 (针对 Eagle 可能未索引 URL 的情况)
                if (artworkItems.length === 0 && items.length > 0) {
                    if (getDebugMode()) {
                        console.log(`[Pixiv2Eagle] 列表 URL 未匹配，尝试深度检查 ${items.length} 个项目...`);
                    }
                    const concurrency = 5;
                    for (let i = 0; i < items.length; i += concurrency) {
                        const chunk = items.slice(i, i + concurrency);
                        const results = await Promise.all(chunk.map(async (item) => {
                            try {
                                const infoData = await gmFetch(`http://localhost:41595/api/item/info?id=${item.id}`);
                                if (infoData && infoData.data && infoData.data.url === artworkUrl) {
                                    return item;
                                }
                            } catch (e) { return null; }
                            return null;
                        }));
                        const found = results.filter(r => r);
                        artworkItems.push(...found);
                    }
                }
            }

            // 排除已经在目标文件夹中的项目
            artworkItems = artworkItems.filter(item => {
                // item.folders 可能是 undefined (list 接口不一定返回)，需要 info 接口确认吗？
                // 通常 list 接口返回的 item 不包含 folders 列表，或者包含。
                // 无论如何，再次移动到同一个文件夹是安全的，Eagle 会处理。
                return true; 
            });

            if (artworkItems.length === 0) {
                alert("未找到需要移动的文件 (请确认文件已保存且 URL 正确)");
                return;
            }

            if (getDebugMode()) {
                console.log(`[Pixiv2Eagle] 找到 ${artworkItems.length} 个文件，准备移动...`);
            }

            // 7. 移动文件到子文件夹
            for (const item of artworkItems) {
                // 修改 folders 属性并保存
                await gmFetch("http://localhost:41595/api/item/update", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: item.id,
                        folders: [subFolder.id]
                    })
                });
                if (getDebugMode()) {
                    console.log(`[Pixiv2Eagle] 已移动文件: ${item.name} -> ${subFolder.name}`);
                }
            }

            alert(`✅ 成功将 ${artworkItems.length} 个文件移动到子文件夹 "${subFolder.name}"`);

        } catch (error) {
            console.error(error);
            alert("移动失败: " + error.message);
        }
    }

    // 更新系列漫画的序号 (批量重命名)
    async function updateSeriesChapters() {
        const folderId = getFolderId();
        if (!folderId) {
            alert("请先设置 Pixiv 文件夹 ID！");
            return;
        }

        const eagleStatus = await checkEagle();
        if (!eagleStatus.running) {
            alert("Eagle 未启动！");
            return;
        }

        // 1. 获取系列信息
        const seriesIdMatch = location.pathname.match(/\/series\/(\d+)/);
        if (!seriesIdMatch) {
            alert("无法获取系列 ID");
            return;
        }
        const seriesId = seriesIdMatch[1];

        // 尝试获取画师 ID (从当前 URL 中查找)
        // URL 格式通常为 /user/{uid}/series/{seriesId} 或 /users/{uid}/series/{seriesId}
        let artistId = null;
        const artistIdMatch = location.pathname.match(new RegExp(`\/users?\/(\\d+)\/series\/${seriesId}`));
        if (artistIdMatch) {
            artistId = artistIdMatch[1];
        }

        if (!artistId) {
            alert("无法获取画师 ID");
            return;
        }

        try {
            // 2. 查找 Eagle 中的系列文件夹
            const artistFolder = await findArtistFolder(folderId, artistId);
            if (!artistFolder) {
                alert("Eagle 中未找到该画师的文件夹");
                return;
            }

            let seriesFolder = findSeriesFolderInArtist(artistFolder, artistId, seriesId);

            // 如果在画师根目录下没找到，尝试在类型文件夹（如“漫画”）中查找
            if (!seriesFolder && artistFolder.children) {
                const typeFolders = artistFolder.children.filter(c => ['illustrations', 'manga', 'novels'].includes(c.description));
                for (const tf of typeFolders) {
                    const found = findSeriesFolderInArtist(tf, artistId, seriesId);
                    if (found) {
                        seriesFolder = found;
                        break;
                    }
                }
            }

            if (!seriesFolder) {
                alert("Eagle 中未找到该系列的文件夹");
                return;
            }

            // 3. 遍历页面上的章节列表
            const listContainer = document.querySelector(SERIES_PAGE_LIST_SELECTOR);
            if (!listContainer) {
                alert("未找到章节列表");
                return;
            }

            const lis = listContainer.querySelectorAll('li');
            if (getDebugMode()) {
                console.log(`[Pixiv2Eagle] 找到 ${lis.length} 个章节列表项`);
            }
            
            if (!seriesFolder.children) {
                if (getDebugMode()) {
                    console.log("[Pixiv2Eagle] 系列文件夹没有子文件夹信息，尝试重新获取");
                }
                // 尝试重新获取该文件夹的详情，以确保 children 存在
                // 注意：Eagle API folder/list 返回的是全树，但如果我们拿到的对象不完整，可能需要刷新
                // 这里假设 seriesFolder 已经是完整的。如果为空，可能是真的没有子文件夹。
                seriesFolder.children = [];
            }
            if (getDebugMode()) {
                console.log(`[Pixiv2Eagle] Eagle 系列文件夹中有 ${seriesFolder.children.length} 个子文件夹`);
            }

            let updateCount = 0;

            for (const li of lis) {
                // 优先使用用户指定的标题容器选择器，确保提取到的是标题文本而非缩略图或其他链接
                let link = li.querySelector('div.sc-fab8f26d-1.kcKSxC a');
                // 降级策略
                if (!link) link = li.querySelector('a[href*="/artworks/"]');
                
                if (!link) continue;

                const href = link.getAttribute('href');
                const pidMatch = href.match(/\/artworks\/(\d+)/);
                if (!pidMatch) continue;
                const pid = pidMatch[1];

                // 克隆节点以清理干扰文本（如徽章）
                const linkClone = link.cloneNode(true);
                
                // 移除 Eagle 标记
                const eagleBadge = linkClone.querySelector('.eagle-saved-badge');
                if (eagleBadge) eagleBadge.remove();

                // 移除 R-18 标记 (通常是 div 或 span，内容为 R-18)
                const badges = linkClone.querySelectorAll('div, span');
                badges.forEach(el => {
                    if (el.textContent.trim() === 'R-18') el.remove();
                });

                const title = linkClone.textContent.trim();

                // 尝试提取章节序号
                // 假设标题包含 #数字 或 第数字话，或者是纯数字
                let chapterNum = null;
                const numMatch = title.match(/#(\d+)/) || title.match(/第(\d+)[话話]/) || title.match(/^(\d+)$/);
                if (numMatch) {
                    chapterNum = numMatch[1];
                }

                if (!chapterNum) {
                    if (getDebugMode()) {
                        console.log(`[Pixiv2Eagle] 无法从标题 "${title}" 中提取序号，跳过`);
                    }
                    continue;
                }

                // 4. 在 Eagle 系列文件夹中查找对应章节文件夹
                // 假设章节文件夹的 description 是 PID
                // 使用 trim() 避免空白字符导致匹配失败
                let chapterFolder = seriesFolder.children.find(c => (c.description || "").trim() === pid);

                // 如果通过 PID 没找到，尝试通过标题查找
                if (!chapterFolder) {
                    // 移除标题中的序号部分，以便进行模糊匹配
                    const searchTitle = removeChapterNumber(title);
                    
                    if (searchTitle) {
                        // 尝试在子文件夹名称中查找 (只要包含处理后的标题即可)
                        chapterFolder = seriesFolder.children.find(c => c.name.includes(searchTitle));
                        if (chapterFolder && getDebugMode()) {
                            console.log(`[Pixiv2Eagle] 通过标题 "${searchTitle}" 匹配到文件夹: ${chapterFolder.name}`);
                        }
                    }
                }

                if (chapterFolder) {
                    // 构造新名称: #序号 标题
                    // 如果标题本身已经包含 #序号，则避免重复
                    let newName = title;
                    if (!newName.startsWith(`#${chapterNum}`)) {
                        newName = `#${chapterNum} ${title}`;
                    }

                    // 如果名称不同，则重命名文件夹
                    if (chapterFolder.name !== newName) {
                        if (getDebugMode()) {
                            console.log(`[Pixiv2Eagle] 重命名文件夹: ${chapterFolder.name} -> ${newName}`);
                        }
                        await gmFetch("http://localhost:41595/api/folder/rename", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ folderId: chapterFolder.id, newName: newName })
                        });
                        updateCount++;
                    }

                    // 5. 重命名文件夹内的图片
                    // 获取文件夹内所有图片
                    const items = await getAllEagleItemsInFolder(chapterFolder.id);
                    if (items && items.length > 0) {
                        for (const item of items) {
                            // 尝试提取页码后缀 (_0, _1, _p0, _p1 等)
                            // Eagle 的 item.name 通常不包含扩展名
                            const suffixMatch = item.name.match(/(_p?\d+)$/);
                            let suffix = "";
                            
                            if (suffixMatch) {
                                suffix = suffixMatch[1];
                            } else if (items.length > 1) {
                                // 如果有多张图片且无法识别后缀，跳过以防命名冲突
                                console.warn(`[Pixiv2Eagle] 无法识别图片后缀且存在多张图片，跳过重命名: ${item.name}`);
                                continue;
                            }

                            const newItemName = `${newName}${suffix}`;
                            if (item.name !== newItemName) {
                                if (getDebugMode()) {
                                    console.log(`[Pixiv2Eagle] 重命名图片: ${item.name} -> ${newItemName}`);
                                }
                                await gmFetch("http://localhost:41595/api/item/update", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: item.id, name: newItemName })
                                });
                            }
                        }
                    }
                }
            }

            alert(`更新完成！共更新了 ${updateCount} 个章节文件夹。`);

        } catch (e) {
            console.error(e);
            alert("更新失败: " + e.message);
        }
    }

    // 添加更新系列按钮
    async function addUpdateSeriesButton() {
        // 仅在系列页面运行
        if (!location.pathname.includes('/series/')) return;

        // 目标：放在 "阅读第一话" 按钮旁边
        // 选择器：div.gtm-manga-series-first-story 或其父容器
        // 通常结构：div > a.gtm-manga-series-first-story
        // 我们尝试找到包含该按钮的容器
        const firstStoryBtn = await waitForElement('.gtm-manga-series-first-story', 5000);
        if (!firstStoryBtn) {
            // 降级：如果找不到特定按钮，尝试放在 header 中
            const header = await waitForElement(MANGA_SERIES_HEADER_SELECTOR);
            if (!header) return;
            if (document.getElementById('eagle-update-series-btn')) return;
            
            const btn = createPixivStyledButton("更新系列序号");
            btn.id = 'eagle-update-series-btn';
            btn.style.marginLeft = '10px';
            btn.onclick = updateSeriesChapters;
            header.appendChild(btn);
            return;
        }

        // 找到容器 (通常是 firstStoryBtn 的父级或本身)
        // 假设 firstStoryBtn 是一个 a 标签或 div，我们需要插在它后面
        const container = firstStoryBtn.parentElement;
        if (!container) return;

        if (document.getElementById('eagle-update-series-btn')) return;

        const btn = createPixivStyledButton("更新系列漫画的序号");
        btn.id = 'eagle-update-series-btn';
        // 样式调整：蓝色背景，白色文字，圆角
        btn.style.backgroundColor = '#0096fa';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.fontWeight = 'bold';
        btn.style.marginLeft = '16px'; // 保持适当间距
        btn.style.height = '32px'; // 与 Pixiv 按钮高度一致
        btn.style.padding = '0 16px';
        
        // 覆盖默认的 hover 效果
        btn.onmouseenter = () => {
            btn.style.backgroundColor = '#0075c5';
        };
        btn.onmouseleave = () => {
            btn.style.backgroundColor = '#0096fa';
            btn.style.color = '#fff';
        };
        btn.onmousedown = () => {
            btn.style.backgroundColor = '#005c9c';
        };
        btn.onmouseup = () => {
            btn.style.backgroundColor = '#0075c5';
        };

        btn.onclick = updateSeriesChapters;

        // 插入到 firstStoryBtn 后面
        // 检查 container 的布局，如果是 flex，直接 append 即可
        // 为了保险，使用 insertBefore nextSibling
        container.insertBefore(btn, firstStoryBtn.nextSibling);
        
        // 确保容器是 flex 布局以便对齐
        const computedStyle = window.getComputedStyle(container);
        if (computedStyle.display !== 'flex') {
            container.style.display = 'flex';
            container.style.alignItems = 'center';
        }
        // 强制设置宽度为 100%
        container.style.width = '100%';
    }

    // 获取指定 Eagle 文件夹下所有 items（分页）
    async function getAllEagleItemsInFolder(folderId) {
        const limit = 200;
        let offset = 0;
        const items = [];

        while (true) {
            const params = new URLSearchParams({ folders: folderId, limit: String(limit), offset: String(offset) });
            const data = await gmFetch(`http://localhost:41595/api/item/list?${params.toString()}`);
            if (!data || !data.status) break;

            const pageItems = Array.isArray(data.data) ? data.data : Array.isArray(data.data?.items) ? data.data.items : [];
            if (!pageItems || pageItems.length === 0) break;

            items.push(...pageItems);
            if (pageItems.length < limit) break;
            offset += pageItems.length;
        }

        return items;
    }

    // 在画师作品列表页面标注已保存的作品（在作品标题前添加 ✅）
    async function markSavedInArtistList() {
        // 清理旧的 Observer，防止重复监听
        if (currentGalleryObserver) {
            currentGalleryObserver.disconnect();
            currentGalleryObserver = null;
        }

        // 更稳健的实现：等待作品链接加载，支持动态添加（滚动加载），并在 debug 模式下打印日志
        const debug = getDebugMode();

        function log(...args) {
            if (debug) console.debug('[Pixiv2Eagle] markSavedInArtistList:', ...args);
        }

        if (debug) {
            console.log('[Pixiv2Eagle] markSavedInArtistList 函数已执行，当前URL:', location.pathname, '调试模式:', debug);
        }

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
                // 尝试添加更新按钮
                addUpdateSeriesButton();

                log('检测到系列页面，开始处理系列文件夹');
                try {
                    const seriesMatch = location.pathname.match(/\/series\/(\d+)/);
                    const seriesId = seriesMatch ? seriesMatch[1] : null;
                    log('系列ID:', seriesId);
                    if (seriesId) {
                        // 重新获取画师文件夹的最新数据（包含完整的子文件夹树）
                        const updatedArtistFolder = await findArtistFolder(pixivFolderId, artistId);
                        if (!updatedArtistFolder) {
                            log('系列页面但无法重新获取画师文件夹');
                        } else {
                            log('已重新获取画师文件夹，查找系列文件夹');
                            // 1. 在画师根目录下找系列
                            let seriesFolder = findSeriesFolderInArtist(updatedArtistFolder, artistId, seriesId);
                            
                            // 2. 如果没找到，且可能在类型文件夹下（如“漫画”文件夹）
                            if (!seriesFolder && updatedArtistFolder.children) {
                                const typeFolders = updatedArtistFolder.children.filter(c => ['illustrations', 'manga', 'novels'].includes(c.description));
                                for (const tf of typeFolders) {
                                    seriesFolder = findSeriesFolderInArtist(tf, artistId, seriesId);
                                    if (seriesFolder) break;
                                }
                            }

                            if (seriesFolder) {
                                log('找到系列文件夹:', seriesFolder.id, '，名称:', seriesFolder.name, '，将递归检查其 items 与子文件夹描述');
                                // 递归获取系列文件夹下所有层级的 items
                                async function collectSeriesFolderItems(folder) {
                                    if (!folder || !folder.id) return;
                                    try {
                                        const folderItems = await getAllEagleItemsInFolder(folder.id);
                                        log('系列文件夹', folder.id, '中 items 数量:', folderItems ? folderItems.length : 0);
                                        for (const it of folderItems || []) if (it && it.url) urlSet.add(it.url);
                                    } catch (e) {
                                        console.error('拉取系列文件夹 items 失败:', folder.id, e);
                                    }
                                    if (!folder.children || folder.children.length === 0) return;
                                    for (const child of folder.children) {
                                        const d = (child.description || '').trim();
                                        if (d) {
                                            // console.log('[Pixiv2Eagle] 收集子文件夹 description:', d, '-> 文件夹ID:', child.id);
                                            folderDescSet.add(d);
                                            folderDescMap[d] = child.id;
                                        }
                                        // 递归子文件夹
                                        await collectSeriesFolderItems(child);
                                    }
                                }
                                await collectSeriesFolderItems(seriesFolder);
                                log('系列页面递归收集完成，urlSet 大小:', urlSet.size, '，folderDescSet 大小:', folderDescSet.size);
                            } else {
                                log('系列页面但未在 Eagle 中找到对应系列文件夹（seriesId:', seriesId, '）');
                                log('画师文件夹子目录列表:', updatedArtistFolder.children.map(c => `${c.name} (${c.description})`).join(', '));
                            }
                        }
                    }
                } catch (e) {
                    console.error('处理系列页面时出错:', e);
                }
            }

            // 插入标记的函数：将勾号浮动到作品卡片容器左下角（优先使用容器类名: sc-4822cddd-0 eCgTWT），
            // 同时支持系列缩略图容器：sc-e83d358-1（包含 sc-f44a0b30-9 cvPXKv）
            // 插入标记的函数：直接在指定的容器中插入勾号
            const insertBadgeToContainer = (container, matchInfo = {}) => {
                if (!container) return;
                
                // 防止重复插入
                if (container.dataset.eagleSaved === '1') return;

                // 确保容器为定位上下文
                try {
                    const cs = window.getComputedStyle(container);
                    if (!cs || cs.position === 'static') {
                        container.style.position = 'relative';
                    }
                    // 确保 overflow 不会隐藏徽章
                    if (container.style.overflow !== 'visible') {
                         container.style.overflow = 'visible';
                    }
                } catch (e) {
                    // ignore
                }

                const badge = document.createElement('span');
                badge.className = 'eagle-saved-badge';
                badge.textContent = '✅';
                badge.setAttribute('aria-hidden', 'true');
                // 样式：左下角浮动
                badge.style.position = 'absolute';
                badge.style.left = '6px';
                badge.style.bottom = '6px';
                badge.style.zIndex = '2147483647';
                badge.style.fontSize = '18px';
                badge.style.lineHeight = '1';
                badge.style.pointerEvents = 'none';
                badge.style.backgroundColor = 'rgba(255,255,255,0.95)';
                badge.style.padding = '2px 6px';
                badge.style.borderRadius = '4px';
                badge.style.fontWeight = 'bold';
                badge.style.display = 'flex';
                badge.style.alignItems = 'center';
                badge.style.justifyContent = 'center';
                badge.style.minWidth = '24px';
                badge.style.minHeight = '24px';

                container.appendChild(badge);
                container.dataset.eagleSaved = '1';

                if (debug) log('徽章已插入:', matchInfo.artworkId);
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
                    if (debug) log('未匹配作品:', id);
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
        } catch (err) {
            console.error('标注画师作品保存状态失败:', err);
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

    let currentRecObserver = null;
    let isRecAreaInitializing = false;
    let currentRecUrl = ""; // 记录当前监控的 URL，防止重复初始化

    // 索引过期时间：24小时
    const INDEX_EXPIRE_TIME = 24 * 60 * 60 * 1000; // 24小时（毫秒）

    // 索引序列化：将 Map 转换为可存储的普通对象
    function serializeIndex(index) {
        const serialized = {};
        for (const [uid, data] of index.entries()) {
            serialized[uid] = {
                id: data.id,
                pids: Array.from(data.pids) // Set 转换为 Array
            };
        }
        return serialized;
    }

    // 索引反序列化：将存储的数据恢复为 Map
    function deserializeIndex(data) {
        const index = new Map();
        for (const [uid, value] of Object.entries(data)) {
            index.set(uid, {
                id: value.id,
                pids: new Set(value.pids) // Array 转换为 Set
            });
        }
        return index;
    }

    // 使索引失效（清除缓存）
    function invalidateEagleIndex() {
        // 清除持久化存储
        GM_setValue("eagleIndex", null);
        // 清除 window 对象上的索引
        window.__pixiv2eagle_globalEagleIndex = null;
        window.__pixiv2eagle_eagleIndexLoadingPromise = null;
    }

    // 使用 window 对象存储索引，避免页面导航时被重置
    if (typeof window.__pixiv2eagle_globalEagleIndex === 'undefined') {
        window.__pixiv2eagle_globalEagleIndex = null;
    }
    if (typeof window.__pixiv2eagle_eagleIndexLoadingPromise === 'undefined') {
        window.__pixiv2eagle_eagleIndexLoadingPromise = null;
    }

    // 异步构建 Eagle 索引 (单例模式)
    async function ensureEagleIndex(forceRefresh = false) {
        
        // 如果强制刷新，清除缓存
        if (forceRefresh) {
            invalidateEagleIndex();
        }

        // 优先使用内存中的索引
        if (window.__pixiv2eagle_globalEagleIndex) return window.__pixiv2eagle_globalEagleIndex;
        if (window.__pixiv2eagle_eagleIndexLoadingPromise) return window.__pixiv2eagle_eagleIndexLoadingPromise;

        // 尝试从持久化存储加载索引
        const pixivFolderId = getFolderId();
        if (!forceRefresh && pixivFolderId) {
            try {
                const cachedData = GM_getValue("eagleIndex", null);
                if (cachedData && cachedData.index && cachedData.expireTime && cachedData.pixivFolderId) {
                    const now = Date.now();
                    // 检查是否过期且文件夹ID匹配
                    if (now < cachedData.expireTime && cachedData.pixivFolderId === pixivFolderId) {
                        // 索引未过期，反序列化并返回
                        const index = deserializeIndex(cachedData.index);
                        window.__pixiv2eagle_globalEagleIndex = index;
                        console.log(`[Pixiv2Eagle] 从缓存加载 Eagle 索引，包含 ${index.size} 位画师`);
                        return index;
                    } else {
                        // 索引已过期或文件夹ID不匹配，清除缓存
                        if (now >= cachedData.expireTime) {
                            console.log("[Pixiv2Eagle] 索引已过期，重新构建...");
                        } else {
                            console.log("[Pixiv2Eagle] 文件夹ID不匹配，重新构建索引...");
                        }
                        invalidateEagleIndex();
                    }
                }
            } catch (e) {
                console.warn("[Pixiv2Eagle] 加载缓存索引失败:", e);
                invalidateEagleIndex();
            }
        }

        console.log("[Pixiv2Eagle] 正在构建全局 Eagle 索引...");
        window.__pixiv2eagle_eagleIndexLoadingPromise = (async () => {
            const index = new Map();
            if (!pixivFolderId) return index;

            try {
                const folderList = await gmFetch("http://localhost:41595/api/folder/list");
                if (folderList.status && Array.isArray(folderList.data)) {
                    const findFolder = (folders, id) => {
                        for (const f of folders) {
                            if (f.id === id) return f;
                            if (f.children) {
                                const res = findFolder(f.children, id);
                                if (res) return res;
                            }
                        }
                        return null;
                    };
                    const root = findFolder(folderList.data, pixivFolderId);
                    
                    if (root && root.children) {
                        for (const artistFolder of root.children) {
                            const desc = artistFolder.description || "";
                            const match = desc.match(/pid\s*=\s*(\d+)/);
                            if (match) {
                                const artistUid = match[1];
                                const pids = new Set();
                                
                                // 递归遍历所有子孙节点查找 PID (支持类型文件夹、系列文件夹等嵌套结构)
                                const traverse = (nodes) => {
                                    for (const node of nodes) {
                                        const subDesc = (node.description || "").trim();
                                        // 只要备注是纯数字，就认为是作品 PID
                                        if (subDesc && /^\d+$/.test(subDesc)) {
                                            pids.add(subDesc);
                                        }
                                        // 继续递归子文件夹
                                        if (node.children && node.children.length > 0) {
                                            traverse(node.children);
                                        }
                                    }
                                };

                                if (artistFolder.children) {
                                    traverse(artistFolder.children);
                                }
                                index.set(artistUid, { id: artistFolder.id, pids });
                            }
                        }
                    }
                    console.log(`[Pixiv2Eagle] 全局 Eagle 索引构建完成，包含 ${index.size} 位画师`);
                    
                    // 持久化索引到存储
                    try {
                        const expireTime = Date.now() + INDEX_EXPIRE_TIME;
                        const serializedIndex = serializeIndex(index);
                        GM_setValue("eagleIndex", {
                            index: serializedIndex,
                            expireTime: expireTime,
                            pixivFolderId: pixivFolderId
                        });
                        console.log(`[Pixiv2Eagle] 索引已保存，将在 ${new Date(expireTime).toLocaleString()} 过期`);
                    } catch (e) {
                        console.warn("[Pixiv2Eagle] 保存索引失败:", e);
                    }
                }
            } catch (e) {
                console.error("[Pixiv2Eagle] 构建 Eagle 索引失败:", e);
            }
            return index;
        })();

        try {
            window.__pixiv2eagle_globalEagleIndex = await window.__pixiv2eagle_eagleIndexLoadingPromise;
        } catch (e) {
            console.error(e);
            window.__pixiv2eagle_eagleIndexLoadingPromise = null; // 允许重试
        }
        return window.__pixiv2eagle_globalEagleIndex;
    }

    // 在推荐区域标记已保存作品
    async function markSavedInRecommendationArea() {
        // 如果正在初始化，直接返回，避免重复执行
        if (isRecAreaInitializing) return;
        
        // 如果当前 URL 已经监控过，且 Observer 还在运行，则不重复初始化
        // 注意：Pixiv 是 SPA，URL 变化时页面内容可能重置，所以通常需要重新 attach
        // 但如果 URL 没变（例如只是参数变化或重复触发），则跳过
        if (currentRecUrl === location.href && currentRecObserver) {
            // console.log("[Pixiv2Eagle] 当前 URL 已在监控推荐区域，跳过重复初始化");
            return;
        }

        isRecAreaInitializing = true;
        currentRecUrl = location.href;

        try {
            // 清理旧的 Observer
            if (currentRecObserver) {
                currentRecObserver.disconnect();
                currentRecObserver = null;
            }
            // 清理旧的 Timer
            if (window.recScanTimer) {
                clearInterval(window.recScanTimer);
                window.recScanTimer = null;
            }
            // 清理旧的 Pending Timer
            if (window.recPendingTimer) {
                clearInterval(window.recPendingTimer);
                window.recPendingTimer = null;
            }

            console.log("[Pixiv2Eagle] 开始监控推荐区域 (全局索引版)...");

            // 立即触发索引构建，但不阻塞后续的 Observer 设置
            ensureEagleIndex();

            // 待重试队列 (Set<HTMLElement>)
            const pendingLis = new Set();

            // 2. 处理单个 LI 节点的函数
            const processLi = (li) => {
                if (li.dataset.eagleChecked) {
                    pendingLis.delete(li); // 已完成，移出队列
                    return;
                }

                // 提取作品 PID
                let titleLink = li.querySelector(REC_WORK_LINK_SELECTOR);
                if (!titleLink) titleLink = li.querySelector('a[href*="/artworks/"]');
                
                if (!titleLink) {
                    pendingLis.add(li); // 链接未加载，加入重试队列
                    return; 
                }
                const pidMatch = titleLink.getAttribute("href").match(/\/artworks\/(\d+)/);
                if (!pidMatch) {
                    pendingLis.add(li);
                    return;
                }
                const pid = pidMatch[1];

                // 提取画师 UID
                let artistLink = li.querySelector(REC_ARTIST_LINK_SELECTOR);
                if (!artistLink) artistLink = li.querySelector('a[href*="/users/"]');

                if (!artistLink) {
                    pendingLis.add(li); // 链接未加载，加入重试队列
                    return; 
                }
                const uidMatch = artistLink.getAttribute("href").match(/\/users\/(\d+)/);
                if (!uidMatch) {
                    pendingLis.add(li);
                    return;
                }
                const uid = uidMatch[1];

                // 确保索引已就绪
                if (!window.__pixiv2eagle_globalEagleIndex) {
                    pendingLis.add(li); // 索引未就绪，加入重试队列
                    return;
                }

                // 检查 Eagle 索引
                const artistData = window.__pixiv2eagle_globalEagleIndex.get(uid);
                
                // 情况 1: 画师不在 Eagle 中 -> 肯定未保存 -> 标记为已检查
                if (!artistData) {
                    if (getDebugMode()) {
                        console.log(`[Pixiv2Eagle] 作品 ${pid}: 画师 ${uid} 不在 Eagle 中 -> 未保存`);
                    }
                    li.dataset.eagleChecked = "1";
                    pendingLis.delete(li);
                    return;
                }

                // 情况 2: 画师在 Eagle 中，检查作品 PID
                if (artistData.pids.has(pid)) {
                    const success = addBadge(li, pid);
                    if (success) {
                        li.dataset.eagleChecked = "1"; // 标记成功才设为 checked
                        pendingLis.delete(li);
                        if (getDebugMode()) {
                            console.log(`[Pixiv2Eagle] 作品 ${pid}: 已保存 (画师 ${uid}) -> 标记成功`);
                        }
                    } else {
                        // 标记失败（如找不到容器），加入重试队列
                        if (getDebugMode()) {
                            console.log(`[Pixiv2Eagle] 作品 ${pid}: 已保存 (画师 ${uid}) -> 标记失败 (找不到容器)，加入重试`);
                        }
                        pendingLis.add(li);
                    }
                } else {
                    // 情况 3: 作品未保存 -> 标记为已检查
                    if (getDebugMode()) {
                        console.log(`[Pixiv2Eagle] 作品 ${pid}: 画师 ${uid} 在 Eagle 中，但作品未保存`);
                    }
                    li.dataset.eagleChecked = "1";
                    pendingLis.delete(li);
                }
            };

            // 3. 添加标记函数
            const addBadge = (li, pid) => {
                // 寻找缩略图容器
                let target = li.querySelector(REC_THUMBNAIL_SELECTOR);
                if (!target) target = li.querySelector('div.sc-f44a0b30-9');
                
                // 备选容器
                if (!target) target = li.querySelector(REC_THUMBNAIL_FALLBACK_SELECTOR);
                if (!target) target = li.querySelector('div.sc-fab8f26d-3');

                // 图片容器回退
                if (!target) {
                    const img = li.querySelector('img');
                    if (img) target = img.parentElement;
                }

                if (!target) return false;

                if (target.querySelector('.eagle-saved-badge')) return true;

                const badge = document.createElement('span');
                badge.className = 'eagle-saved-badge';
                badge.textContent = '✅';
                badge.setAttribute('aria-hidden', 'true');
                badge.style.position = 'absolute';
                badge.style.left = '6px';
                badge.style.bottom = '6px';
                badge.style.zIndex = '10';
                badge.style.fontSize = '14px';
                badge.style.lineHeight = '1';
                badge.style.pointerEvents = 'none';
                badge.style.backgroundColor = 'rgba(255,255,255,0.95)';
                badge.style.padding = '2px 4px';
                badge.style.borderRadius = '4px';
                badge.style.fontWeight = 'bold';
                
                const style = window.getComputedStyle(target);
                if (style.position === 'static') {
                    target.style.position = 'relative';
                }
                target.appendChild(badge);
                return true;
            };

            // 4. 扫描逻辑
            const scan = () => {
                // 如果索引还没好，先不处理，等待下一次 Timer
                if (!window.__pixiv2eagle_globalEagleIndex) return;

                let lis = [];
                
                // 方案 A: 查找 Section 或新的容器
                // 2024-12-23: Pixiv 更新，推荐作品容器变为 div.sc-bf8cea3f-0.dKbaFf
                const containers = document.querySelectorAll(`${REC_SECTION_SELECTOR}, ${REC_CONTAINER_SELECTOR}`);
                if (containers.length > 0) {
                    containers.forEach(container => {
                        container.querySelectorAll('li').forEach(li => lis.push(li));
                    });
                }
                
                // 方案 B: 回退查找
                if (!lis || lis.length === 0) {
                    const links = document.querySelectorAll(REC_WORK_LINK_SELECTOR);
                    if (links.length > 0) {
                        const liSet = new Set();
                        links.forEach(a => {
                            const li = a.closest('li');
                            if (li) liSet.add(li);
                        });
                        lis = Array.from(liSet);
                    }
                }

                if (lis.length > 0) {
                    // console.log(`[Pixiv2Eagle] 扫描发现 ${lis.length} 个条目`);
                    lis.forEach(processLi);
                }
            };

            // 5. 启动 Observer 和 Timer
            const observer = new MutationObserver((mutations) => {
                let shouldScan = false;
                for (const mut of mutations) {
                    if (mut.addedNodes.length > 0) {
                        shouldScan = true;
                        break;
                    }
                }
                if (shouldScan) {
                    if (getDebugMode()) {
                        console.log("[Pixiv2Eagle] 推荐区域检测到新内容，触发扫描...");
                    }
                    scan();
                }
            });

            const targetRoot = document.querySelector('main') || document.body;
            observer.observe(targetRoot, { childList: true, subtree: true });
            currentRecObserver = observer;

            // 主定时器：扫描新元素 (2秒一次)
            window.recScanTimer = setInterval(scan, 2000);

            // 重试定时器：高频扫描待处理队列 (200毫秒一次)
            window.recPendingTimer = setInterval(() => {
                if (pendingLis.size > 0) {
                    // console.log(`[Pixiv2Eagle] 重试 ${pendingLis.size} 个待处理条目...`);
                    // 复制一份进行遍历，避免遍历时修改 Set 导致问题
                    const items = Array.from(pendingLis);
                    items.forEach(processLi);
                }
            }, 200);

            // 初始尝试
            scan();

        } catch (err) {
            console.error("[Pixiv2Eagle] 推荐区域监控出错:", err);
        } finally {
            isRecAreaInitializing = false;
        }
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
                format: 'txt',
                images: []
            };
        }
        
        // 构建 Markdown 内容，保持文本和图片的原始顺序
        let markdownContent = "";
        const allElements = Array.from(contentContainer.children);
        
        // 创建图片 URL 到索引的映射
        const imageUrlToIndex = new Map();
        details.images.forEach((img, index) => {
            imageUrlToIndex.set(img.src, index);
        });
        
        let imageIndex = 0;
        
        // 遍历所有子元素，保持顺序
        for (const element of allElements) {
            // 检查元素中是否包含图片
            const imagesInElement = Array.from(element.querySelectorAll("img"));
            
            if (imagesInElement.length > 0) {
                // 如果元素包含图片，需要分别处理文本和图片
                const textNodes = Array.from(element.childNodes).filter(
                    node => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "IMG")
                );
                
                // 添加文本内容
                for (const textNode of textNodes) {
                    if (textNode.nodeType === Node.TEXT_NODE) {
                        const text = textNode.textContent.trim();
                        if (text) {
                            markdownContent += text + "\n\n";
                        }
                    } else if (textNode.tagName === "P") {
                        const text = textNode.textContent.trim();
                        if (text) {
                            markdownContent += text + "\n\n";
                        }
                    }
                }
                
                // 添加图片引用
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
            } else if (element.tagName === "P") {
                // 普通段落
                const text = element.textContent.trim();
                if (text) {
                    markdownContent += text + "\n\n";
                }
            } else if (element.tagName === "IMG") {
                // 单独的图片元素
                const src = element.src || element.getAttribute("data-src") || "";
                const alt = element.alt || element.getAttribute("alt") || "";
                
                if (src && imageUrlToIndex.has(src)) {
                    const idx = imageUrlToIndex.get(src);
                    const urlMatch = src.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
                    const ext = urlMatch ? urlMatch[1].toLowerCase() : "jpg";
                    const filename = `image_${idx}.${ext}`;
                    
                    markdownContent += `![${alt}](${filename})\n\n`;
                    imageIndex++;
                }
            } else if (element.textContent.trim()) {
                // 其他包含文本的元素
                const text = element.textContent.trim();
                markdownContent += text + "\n\n";
            }
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
                if (getDebugMode()) {
                    console.error("[Pixiv2Eagle] 下载封面失败:", error);
                }
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
                    if (getDebugMode()) {
                        console.error(`[Pixiv2Eagle] 下载图片失败 ${img.url}:`, error);
                    }
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
            if (getDebugMode()) {
                console.error("[Pixiv2Eagle] 日期格式化失败:", error);
            }
            return null;
        }
    }

    // 获取小说详细信息
    async function getNovelDetails(novelId) {
        try {
            // 标题
            const titleEl = document.querySelector(NOVEL_TITLE_SELECTOR);
            const title = titleEl ? titleEl.textContent.trim() : `Novel_${novelId}`;

            // 简介
            const descEl = document.querySelector(NOVEL_DESC_SELECTOR);
            const description = descEl ? descEl.textContent.trim() : "";

            // 封面
            const coverImg = document.querySelector(NOVEL_COVER_SELECTOR);
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
            
            if (getDebugMode()) {
                if (authorName && authorName !== "Unknown") {
                    console.log("[Pixiv2Eagle] 提取到作者名:", authorName, "作者UID:", authorId);
                } else {
                    console.log("[Pixiv2Eagle] 未提取到作者名，使用默认值:", authorName);
                }
            }

            // 系列信息
            const seriesSection = document.querySelector(NOVEL_SERIES_SECTION_SELECTOR);
            let seriesId = null;
            let seriesTitle = null;
            
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
                
                // 提取文本内容（忽略开头空白div，提取后续p标签）
                const allElements = Array.from(contentContainer.children);
                let startIndex = 0;
                // 跳过开头的空白div
                for (let i = 0; i < allElements.length; i++) {
                    const el = allElements[i];
                    if (el.tagName === "P" || el.textContent.trim()) {
                        startIndex = i;
                        break;
                    }
                }
                
                const paragraphs = Array.from(contentContainer.querySelectorAll("p"));
                content = paragraphs.map(p => p.textContent).join("\n");
            } else {
            }

            // 提取标签
            const tagsContainer = document.querySelector(NOVEL_TAGS_CONTAINER_SELECTOR);
            const tags = [];
            if (tagsContainer) {
                const tagItems = tagsContainer.querySelectorAll(NOVEL_TAG_ITEM_SELECTOR);
                for (const tagItem of tagItems) {
                    const tagText = tagItem.textContent?.trim();
                    if (tagText) {
                        tags.push(tagText);
                    }
                }
                if (getDebugMode()) {
                    console.log("[Pixiv2Eagle] 提取到小说标签:", tags);
                }
            } else {
                if (getDebugMode()) {
                    console.log("[Pixiv2Eagle] 未找到标签容器");
                }
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
                        if (getDebugMode()) {
                            console.log("[Pixiv2Eagle] 提取到出版日期:", publishDate);
                        }
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
                content,
                images,
                hasImages,
                tags,
                publishDate,
                illustType: "novel"
            };
        } catch (error) {
            console.error("获取小说信息失败:", error);
            throw error;
        }
    }

    // 保存小说为 TXT/MD 格式（原有逻辑）
    async function saveNovelAsTextOrMarkdown(details, combinedContent, chapterFolderId) {
        if (!combinedContent) {
            combinedContent = combineNovelContent(details);
        }
        
        // 下载文件到本地
        showMessage("正在下载小说文件，请选择保存位置...", false);
        const downloadedFiles = await downloadNovelFiles(combinedContent, details.title, details.id);
        
        // 等待用户下载完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 获取文件路径
        const basePath = getNovelSavePath();
        const filePaths = await getFilePaths(downloadedFiles.novelFilename, downloadedFiles.imageFilenames, basePath);
        
        // 使用 addFromPath 批量添加文件（小说文件 + 图片文件）
        const novelExt = combinedContent.format === 'md' ? 'md' : 'txt';
        const safeTitle = details.title.replace(/[\\/:*?"<>|]/g, "_");
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
                        if (getDebugMode()) {
                            console.error("[Pixiv2Eagle] 添加文件失败:", item.path, addResult);
                        }
                        throw new Error(`添加文件到 Eagle 失败: ${item.name || item.path}`);
                    }
                }
            } catch (error) {
                console.error("添加小说文件到 Eagle 失败:", error);
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

            // 4. 创建小说章节文件夹
            const chapterFolderId = await createEagleFolder(details.title, targetParentId, details.id);

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
                        
                        // 下载 EPUB 文件到本地
                const safeTitle = details.title.replace(/[\\/:*?"<>|]/g, "_");
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
                        if (getDebugMode()) {
                            console.log("[Pixiv2Eagle] 保存 EPUB 文件，标签:", epubTags);
                        }
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
                            if (getDebugMode()) {
                                console.error("[Pixiv2Eagle] 添加 EPUB 文件失败:", epubPath, addResult);
                            }
                            throw new Error("添加 EPUB 文件到 Eagle 失败");
                        }
                    } catch (error) {
                        console.error("生成或保存 EPUB 失败:", error);
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
            console.error(error);
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
                console.warn("[Pixiv2Eagle] 查找画师文件夹失败 (可能是 Pixiv 文件夹 ID 设置错误或文件夹不存在):", e);
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

        } catch (err) {
            console.error("Check saved status failed:", err);
        }
    }

    // 添加小说页面的保存按钮
    async function addNovelButton() {
        const oldWrapper = document.getElementById(EAGLE_SAVE_BUTTON_ID);
        if (oldWrapper) return;

        const targetSection = await waitForElement(NOVEL_SAVE_BUTTON_SECTION_SELECTOR);
        if (!targetSection) return;

        // 双重检查，防止在等待过程中重复创建
        if (document.getElementById(EAGLE_SAVE_BUTTON_ID)) return;

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

    // 在作品详情页添加"移动到子文件夹"按钮
    async function addMoveToSubfolderButton() {
        const artworkId = getArtworkId();
        if (!artworkId) return;

        try {
            // 1. 检查"多页作品创建子文件夹"设置
            const createSubFolderMode = getCreateSubFolder();
            /*
            if (createSubFolderMode === 'off') {
                console.log('[Pixiv2Eagle] 子文件夹功能未启用，不显示按钮');
                return;
            }
            */

            // 2. 检查是否已保存
            const savedInfo = await findSavedFolderForArtwork(artworkId);
            /*
            if (!savedInfo || !savedInfo.folder) {
                console.log('[Pixiv2Eagle] 作品未保存，不显示按钮');
                return;
            }
            */

            // 3. 查找按钮容器（等待 DOM 加载）
            await new Promise(resolve => setTimeout(resolve, 500)); // 等待页面完全加载
            const container = document.querySelector(ARTWORK_BUTTON_CONTAINER_SELECTOR);
            const refButton = document.querySelector(ARTWORK_BUTTON_REF_SELECTOR);
            
            if (!container) {
                if (getDebugMode()) {
                    console.log('[Pixiv2Eagle] 未找到按钮容器:', ARTWORK_BUTTON_CONTAINER_SELECTOR);
                }
                return;
            }

            if (!refButton && getDebugMode()) {
                console.log('[Pixiv2Eagle] 未找到参考按钮:', ARTWORK_BUTTON_REF_SELECTOR);
            }

            // 4. 避免重复添加
            if (document.getElementById('eagle-move-to-subfolder-btn')) {
                return;
            }

            // 5. 创建按钮
            const btn = createPixivStyledButton("更新系列漫画至序列文件夹");
            btn.id = 'eagle-move-to-subfolder-btn';
            btn.style.marginLeft = '8px';
            btn.onclick = async () => {
                btn.textContent = '正在移动...';
                btn.style.pointerEvents = 'none';
                await moveArtworkToSubfolder(artworkId);
                btn.textContent = '更新系列漫画至序列文件夹';
                btn.style.pointerEvents = 'auto';
            };

            // 6. 插入按钮
            if (refButton) {
                container.insertBefore(btn, refButton);
            } else {
                // 如果没有参考按钮，直接添加到容器末尾
                container.appendChild(btn);
            }
            if (getDebugMode()) {
                console.log('[Pixiv2Eagle] ✅ 成功添加"移动到子文件夹"按钮');
            }

        } catch (error) {
            console.error('[Pixiv2Eagle] ❌ 添加"移动到子文件夹"按钮失败:', error);
        }
    }

    // 主函数
    async function addButton() {
        // 移除旧按钮（如果存在）
        const oldWrapper = document.getElementById(EAGLE_SAVE_BUTTON_ID);
        if (oldWrapper) {
            oldWrapper.remove();
        }

        // 等待 <main> 及其嵌套的 section 结构加载
        const mainElement = await waitForElement("main");
        if (!mainElement) return;

        const outerSection = await waitForSectionWithin(mainElement);
        if (!outerSection) return;

        const targetSection = await waitForSectionWithin(outerSection);
        if (!targetSection) return;

        // 检查按钮是否已经存在（双重检查，以防在等待过程中已添加）
        if (document.getElementById(EAGLE_SAVE_BUTTON_ID)) return;

        // 找到 section 中最后一个 div 作为参考
        const lastDiv = targetSection.querySelector("div:last-of-type");
        if (!lastDiv) return;

        // 创建包裹 div
        const buttonWrapper = document.createElement("div");
        buttonWrapper.id = EAGLE_SAVE_BUTTON_ID;
        buttonWrapper.className = lastDiv.className;
        buttonWrapper.style.display = "flex";
        buttonWrapper.style.alignItems = "center";
        buttonWrapper.style.justifyContent = "center";
        buttonWrapper.style.gap = "8px"; // 添加按钮之间的间距

        // 创建保存按钮
        const saveButton = createPixivStyledButton("保存到 Eagle");
        saveButton.title = "将当前作品保存到 Eagle";

        // 添加保存按钮点击事件
        saveButton.addEventListener("click", saveCurrentArtwork);

        // 创建打开文件夹按钮
        const openFolderButton = createPixivStyledButton("打开画师文件夹");

        // 添加打开文件夹按钮点击事件
        openFolderButton.addEventListener("click", openArtistFolderFromArtworkPage);

        // 将按钮添加到包裹 div 中
        buttonWrapper.appendChild(openFolderButton);
        buttonWrapper.appendChild(saveButton);

        // 将按钮添加到 section 的最后
        targetSection.appendChild(buttonWrapper);

        // 自动检测是否已保存，已保存则更新按钮文本
        if (getAutoCheckSavedStatus()) updateSaveButtonIfSaved(saveButton);

        // 添加"移动到子文件夹"按钮（如果适用）
        addMoveToSubfolderButton();
    }

    const monitorConfig = [
        {
            urlSuffix: "/artworks",
            observeID: EAGLE_SAVE_BUTTON_ID,
            handler: () => {
                addButton();
                markSavedInRecommendationArea();
            },
        },
        {
            urlSuffix: "/novel/show.php",
            observeID: EAGLE_SAVE_BUTTON_ID,
            handler: () => {
                addNovelButton();
            }
        },
        {
            urlSuffix: "/novel/series",
            observeID: null,
            handler: () => {
                markSavedInNovelSeries();
            }
        },
        {
            urlSuffix: "/user",
            observeID: null,
            handler: debouncedMarkSavedInArtistList,
        },
    ];

    // 启动脚本
    try {
        if (getDebugMode()) {
            console.log('[Pixiv2Eagle] 脚本已启动，当前URL:', location.pathname);
        }
        
        // 立即开始构建全局索引
        ensureEagleIndex();

        for (const monitorInfo of monitorConfig) {
            if (location.pathname.includes(monitorInfo.urlSuffix)) {
                if (getDebugMode()) {
                    console.log('[Pixiv2Eagle] 初始加载时触发处理器:', monitorInfo.urlSuffix);
                }
                handlePageChange(monitorInfo);
            }
        }
        observeUrlChanges(monitorConfig);
    } catch (error) {
        console.error("脚本启动失败:", error);
    }
})();
