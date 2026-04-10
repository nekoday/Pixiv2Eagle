// ==UserScript==
// @name            Pixiv2Eagle
// @name:en         Pixiv2Eagle
// @description     一键将 Pixiv 艺术作品保存到 Eagle 图片管理软件，支持多页作品、自动创建画师文件夹、保留标签和元数据
// @description:en  Save Pixiv artworks to Eagle image management software with one click. Supports multi-page artworks, automatic artist folder creation, and preserves tags and metadata
// @version         2.4.0

// @author          nekoday
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

    // 获取是否严格排序保存
    function getStrictSaveOrder() {
        return GM_getValue("strictSaveOrder", false);
    }

    // 切换是否严格排序保存
    function toggleStrictSaveOrder() {
        const currentMode = getStrictSaveOrder();
        GM_setValue("strictSaveOrder", !currentMode);
        alert(`严格排序保存已${!currentMode ? "开启 ✅" : "关闭 ❌"}`);
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

    // 获取是否直接保存到 Pixiv 文件夹
    function getSaveToPixivFolderDirectly() {
        return GM_getValue("saveToPixivFolderDirectly", false);
    }

    // 切换是否直接保存到 Pixiv 文件夹
    function toggleSaveToPixivFolderDirectly() {
        const currentMode = getSaveToPixivFolderDirectly();
        GM_setValue("saveToPixivFolderDirectly", !currentMode);
        alert(
            !currentMode ? "✅ 已开启：直接保存到 Pixiv 文件夹，不创建画师子文件夹" : "📁 已恢复：按画师创建子文件夹",
        );
        if (getArtworkId()) {
            addButton();
        }
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
            GM_getValue("folderNameTemplate", "$name"),
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
    GM_registerMenuCommand("📁 设置 Pixiv 文件夹 ID", setFolderId);
    GM_registerMenuCommand("📅 切换：使用投稿时间作为添加日期", toggleUseUploadDate);
    GM_registerMenuCommand("🔢 切换：按照严格排序保存", toggleStrictSaveOrder);
    GM_registerMenuCommand("🕗 切换：保存作品描述", toggleSaveDescription);
    GM_registerMenuCommand("📂 切换：直接保存到 Pixiv 文件夹", toggleSaveToPixivFolderDirectly);
    GM_registerMenuCommand("🗂️ 切换：为多页作品创建子文件夹", toggleCreateSubFolder);
    GM_registerMenuCommand("🖼️ 保存当前作品到 Eagle", saveCurrentArtwork);
    GM_registerMenuCommand("🔎 切换：自动检测作品保存状态", toggleAutoCheckSavedStatus);
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
            const data = await gmFetch("http://localhost:41595/api/application/info");
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
    async function isArtworkSavedInEagle(artworkId, folderId, searchAll = false) {
        if (!folderId && !searchAll) {
            return { saved: false, itemId: null };
        }

        const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;
        const limit = 200;

        try {
            let offset = 0;
            let loopCount = 0;

            while (loopCount < 100000) {
                const params = new URLSearchParams({
                    limit: limit.toString(),
                    offset: offset.toString(),
                });
                if (folderId) {
                    params.set("folders", folderId);
                }

                const data = await gmFetch(`http://localhost:41595/api/item/list?${params.toString()}`);
                if (!data || !data.status) break;

                const items = Array.isArray(data.data)
                    ? data.data
                    : Array.isArray(data.data?.items)
                      ? data.data.items
                      : [];

                const matched = items.find((item) => item.url === artworkUrl);
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

    async function getEagleFolderTree() {
        const data = await gmFetch("http://localhost:41595/api/folder/list");
        if (!data.status || !Array.isArray(data.data)) {
            throw new Error("无法获取文件夹列表");
        }
        return data.data;
    }

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

    function normalizeFolderInfo(folder, fallbackName = "未命名文件夹") {
        return {
            existed: true,
            id: folder.id ?? null,
            name: folder.name || fallbackName,
            children: Array.isArray(folder.children) ? folder.children : [],
            description: folder.description || "",
        };
    }

    function findArtistFolderInChildren(children, artistId) {
        const targetArtistId = String(artistId);
        const artistFolder = (children || []).find((childFolder) => {
            const description = childFolder.description || "";
            const match = description.match(/pid\s*=\s*(\d+)/);
            return match && match[1] === targetArtistId;
        });
        return artistFolder ? normalizeFolderInfo(artistFolder) : null;
    }

    async function getDirectSaveBaseFolder(pixivFolderId) {
        const folderTree = await getEagleFolderTree();

        if (pixivFolderId) {
            const pixivFolder = findFolderRecursively(folderTree, pixivFolderId);
            if (!pixivFolder) {
                throw new Error("找不到指定的 Pixiv 文件夹，请检查输入的文件夹 ID 是否正确");
            }
            return normalizeFolderInfo(pixivFolder);
        }

        return {
            existed: true,
            id: null,
            name: "根目录",
            children: folderTree,
            description: "",
        };
    }

    // 查找画师文件夹（不创建）
    async function findArtistFolder(pixivFolderId, artistId) {
        try {
            const folderTree = await getEagleFolderTree();

            if (pixivFolderId) {
                const pixivFolder = findFolderRecursively(folderTree, pixivFolderId);
                if (!pixivFolder) {
                    throw new Error("找不到指定的 Pixiv 文件夹，请检查输入的文件夹 ID 是否正确");
                }
                return findArtistFolderInChildren(pixivFolder.children, artistId);
            }

            return findArtistFolderInChildren(folderTree, artistId);
        } catch (error) {
            console.error("查找画师文件夹失败:", error);
            throw error;
        }
    }

    // 在指定目录下查找系列文件夹（不创建）
    function findSeriesFolderInParent(parentFolder, artistId, seriesId) {
        if (!parentFolder || !parentFolder.children) return null;
        const seriesFolder = parentFolder.children.find((folder) => {
            const description = folder.description || "";
            const match = description.match(/^https?:\/\/www\.pixiv\.net\/user\/(\d+)\/series\/(\d+)\/?$/);
            return match && match[1] === String(artistId) && match[2] === String(seriesId);
        });
        return seriesFolder ? normalizeFolderInfo(seriesFolder) : null;
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
                name: folderName,
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

    async function getSaveBaseFolder(pixivFolderId, artistId, artistName) {
        if (getSaveToPixivFolderDirectly()) {
            return await getDirectSaveBaseFolder(pixivFolderId);
        }
        return await getArtistFolder(pixivFolderId, artistId, artistName);
    }

    async function getExistingSaveBaseFolder(pixivFolderId, artistId) {
        if (getSaveToPixivFolderDirectly()) {
            return await getDirectSaveBaseFolder(pixivFolderId);
        }
        return await findArtistFolder(pixivFolderId, artistId);
    }

    // 查找系列文件夹
    async function getSeriesFolder(parentFolder, artistId, seriesId, seriesName) {
        const existingFolder = findSeriesFolderInParent(parentFolder, artistId, seriesId);
        if (existingFolder) return existingFolder;

        const newSeriesFolderId = await createEagleFolder(
            seriesName,
            parentFolder.id,
            `https://www.pixiv.net/user/${artistId}/series/${seriesId}`,
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
            const baseFolder = await getExistingSaveBaseFolder(pixivFolderId, details.userId);
            if (!baseFolder) return null;

            // 默认在基础目录检查，如有系列则进入系列文件夹
            let currentFolder = baseFolder;
            if (details.seriesNavData) {
                const seriesFolder = findSeriesFolderInParent(
                    baseFolder,
                    details.userId,
                    details.seriesNavData.seriesId,
                );
                if (seriesFolder) {
                    currentFolder = seriesFolder;
                }
            }

            // 先检查当前文件夹中的作品
            const allowGlobalLookup = !currentFolder.id && getSaveToPixivFolderDirectly() && !pixivFolderId;
            const savedResult = await isArtworkSavedInEagle(artworkId, currentFolder.id, allowGlobalLookup);
            if (savedResult.saved) {
                return { folder: currentFolder, itemId: savedResult.itemId || null };
            }

            // 再检查子文件夹描述是否等于作品 ID
            const savedChild = (currentFolder.children || []).find(
                (folder) => (folder.description || "").trim() === String(artworkId),
            );
            if (savedChild) {
                return { folder: savedChild, itemId: null };
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

    // 将动图转换为 GIF Blob
    async function convertUgoiraToGifBlob(artworkId) {
        // 动态加载 fflate（解压 zip）库到用户脚本沙箱
        async function ensureFflateLoaded() {
            if (window.fflate) return;
            const code = await gmFetchText("https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.min.js");
            eval(code);
            if (!window.fflate) throw new Error("fflate 加载失败");
        }

        // 动态加载 gif.js 到用户脚本沙箱，并准备 worker 脚本 URL
        let __gifWorkerURL = null;
        async function ensureGifLibLoaded() {
            if (!window.GIF) {
                const code = await gmFetchText("https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.min.js");
                eval(code);
            }
            if (!__gifWorkerURL) {
                const workerCode = await gmFetchText("https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js");
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
        const modificationTime = useUploadDate ? new Date(details.uploadDate).getTime() : Date.now();
        const strictSaveOrder = getStrictSaveOrder();

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
                    ...(modificationTime && {
                        modificationTime: modificationTime + (strictSaveOrder ? index : 0),
                    }),
                    ...(!isUgoira && {
                        headers: {
                            referer: "https://www.pixiv.net/",
                        },
                    }),
                })),
                ...(folderId && { folderId }),
            }),
        });

        if (!data.status) {
            throw new Error("保存图片失败");
        }

        return data.data;
    }

    function shouldCreateArtworkSubFolder(details) {
        const createSubFolderMode = getCreateSubFolder();
        return (
            details.illustType === 1 ||
            (createSubFolderMode === "multi-page" && details.pageCount > 1) ||
            createSubFolderMode === "always"
        );
    }

    function formatFolderLabel(folder) {
        if (!folder) return "未知目录";
        return folder.id ? `${folder.name} (ID: ${folder.id})` : `${folder.name} (根目录)`;
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
            const directSaveMode = getSaveToPixivFolderDirectly();

            // 获取保存基准目录
            const baseFolder = await getSaveBaseFolder(folderId, details.userId, details.userName);
            let targetFolder = baseFolder;

            // 创建漫画系列文件夹
            if (details.illustType === 1 && details.seriesNavData) {
                const seriesId = details.seriesNavData.seriesId;
                const seriesTitle = details.seriesNavData.title;
                targetFolder = await getSeriesFolder(baseFolder, details.userId, seriesId, seriesTitle);
            }

            // 漫画作品，始终创建子文件夹
            // 如果是多 P 作品且设置了创建子文件夹，则创建子文件夹
            if (shouldCreateArtworkSubFolder(details)) {
                const artworkFolderId = await createEagleFolder(
                    details.illustTitle,
                    targetFolder.id,
                    String(artworkId),
                );
                targetFolder = {
                    existed: false,
                    id: artworkFolderId,
                    name: details.illustTitle,
                    children: [],
                    description: String(artworkId),
                };
            }

            await saveToEagle(details.originalUrls, targetFolder.id, details, artworkId);

            const targetFolderInfo =
                targetFolder.id !== baseFolder.id || targetFolder.name !== baseFolder.name
                    ? [`最终保存位置: ${formatFolderLabel(targetFolder)}`]
                    : [];

            const message = [
                `✅ ${details.illustType === 2 ? "动图已转换为 GIF 并" : "图片已成功"}保存到 Eagle`,
                "----------------------------",
                folderInfo,
                `${directSaveMode ? "保存基准目录" : "画师专属文件夹"}: ${formatFolderLabel(baseFolder)}`,
                ...targetFolderInfo,
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

    // 在 Eagle 中打开当前作品的保存目录
    async function openTargetFolderInEagle(details) {
        const folderId = getFolderId();
        const directSaveMode = getSaveToPixivFolderDirectly();

        const baseFolder = await getExistingSaveBaseFolder(folderId, details.userId);
        if (!baseFolder) {
            showMessage("无法找到画师文件夹，请先保存作品。", true);
            return;
        }

        let folderToOpen = baseFolder;
        if (directSaveMode && details.seriesNavData) {
            const seriesFolder = findSeriesFolderInParent(baseFolder, details.userId, details.seriesNavData.seriesId);
            if (seriesFolder) {
                folderToOpen = seriesFolder;
            }
        }

        if (!folderToOpen.id) {
            showMessage("当前为直接保存模式且未设置 Pixiv 文件夹 ID，暂不支持直接打开 Eagle 根目录。", true);
            return;
        }

        const eagleUrl = `http://localhost:41595/folder?id=${folderToOpen.id}`;
        window.location.href = eagleUrl;

        if (directSaveMode) {
            return;
        }

        // 计算正确的文件夹名称
        const artistMatcher = getArtistMatcher();
        const targetFolderName = artistMatcher.generate(details.userId, details.userName);

        // 更新 Eagle 文件夹名称
        if (baseFolder.name !== targetFolderName) {
            updateFolderNameInEagle(baseFolder.id, targetFolderName);
        }
    }

    // 从作品页打开保存目录
    async function openTargetFolderFromArtworkPage() {
        // 首先检查 Eagle 是否运行
        const eagleStatus = await checkEagle();
        if (!eagleStatus.running) {
            showMessage("Eagle 未启动，请先启动 Eagle 应用！", true);
            return;
        }

        const artworkId = getArtworkId();
        if (!artworkId) {
            showMessage("无法获取作品 ID", true);
            return;
        }

        try {
            const details = await getArtworkDetails(artworkId);
            await openTargetFolderInEagle(details);
        } catch (error) {
            console.error(error);
            showMessage(`打开保存目录失败: ${error.message}`, true);
        }
    }

    // 等待目标 section 元素加载
    function waitForElement(selector) {
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

            // 10 秒后超时
            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, 10000);
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
        const openFolderButton = createPixivStyledButton(
            getSaveToPixivFolderDirectly() ? "打开保存目录" : "打开画师文件夹",
        );
        openFolderButton.title = getSaveToPixivFolderDirectly()
            ? "在 Eagle 中打开当前作品的保存目录"
            : "在 Eagle 中打开当前画师文件夹";

        // 添加打开文件夹按钮点击事件
        openFolderButton.addEventListener("click", openTargetFolderFromArtworkPage);

        // 将按钮添加到包裹 div 中
        buttonWrapper.appendChild(openFolderButton);
        buttonWrapper.appendChild(saveButton);

        // 将按钮添加到 section 的最后
        targetSection.appendChild(buttonWrapper);

        // 自动检测是否已保存，已保存则更新按钮文本
        if (getAutoCheckSavedStatus()) updateSaveButtonIfSaved(saveButton);
    }

    const monitorConfig = [
        {
            urlSuffix: "/artworks",
            observeID: EAGLE_SAVE_BUTTON_ID,
            handler: addButton,
        },
    ];

    // 启动脚本
    try {
        for (const monitorInfo of monitorConfig) {
            if (location.pathname.includes(monitorInfo.urlSuffix)) {
                handlePageChange(monitorInfo);
            }
        }
        observeUrlChanges(monitorConfig);
    } catch (error) {
        console.error("脚本启动失败:", error);
    }
})();
