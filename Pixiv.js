// ==UserScript==
// @name            Pixiv2Eagle
// @name:en         Pixiv2Eagle
// @description     一键将 Pixiv 艺术作品保存到 Eagle 图片管理软件，支持多页作品、自动创建画师文件夹、保留标签和元数据
// @description:en  Save Pixiv artworks to Eagle image management software with one click. Supports multi-page artworks, automatic artist folder creation, and preserves tags and metadata
// @version         2.2.3

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
    GM_registerMenuCommand("📁 设置 Pixiv 文件夹 ID", setFolderId);
    GM_registerMenuCommand("📅 切换：使用投稿时间作为添加日期", toggleUseUploadDate);
    GM_registerMenuCommand("🕗 切换：保存作品描述", toggleSaveDescription);
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
        return artistFolder.children.find((folder) => {
            const description = folder.description || "";
            const match = description.match(/^https?:\/\/www\.pixiv\.net\/user\/(\d+)\/series\/(\d+)\/?$/);
            return match && match[1] === String(artistId) && match[2] === String(seriesId);
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

            // 检查当前页面是否为漫画系列（通过"加入追更列表"按钮判断）
            const isSeriesPage = !!document.querySelector('div.sc-487e14c9-0.doUXUo');

            // 默认在画师文件夹检查，如有系列或当前为系列页面则进入系列文件夹
            let currentFolder = artistFolder;
            if (details.seriesNavData || isSeriesPage) {
                const seriesId = details.seriesNavData?.seriesId || 
                    (location.pathname.match(/\/series\/(\d+)/) || [])[1];
                if (seriesId) {
                    const seriesFolder = findSeriesFolderInArtist(
                        artistFolder,
                        details.userId,
                        seriesId
                    );
                    if (seriesFolder) {
                        currentFolder = seriesFolder;
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

            // 创建漫画系列文件夹
            if (details.illustType === 1 && details.seriesNavData) {
                const seriesId = details.seriesNavData.seriesId;
                const seriesTitle = details.seriesNavData.title;
                const seriesFolder = await getSeriesFolder(artistFolder, details.userId, seriesId, seriesTitle);
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
        // 更稳健的实现：等待作品链接加载，支持动态添加（滚动加载），并在 debug 模式下打印日志
        const debug = getDebugMode();

        function log(...args) {
            if (debug) console.debug('[Pixiv2Eagle] markSavedInArtistList:', ...args);
        }

        console.log('[Pixiv2Eagle] markSavedInArtistList 函数已执行，当前URL:', location.pathname, '调试模式:', debug);

        try {
            // 仅在用户的常见画师列表或系列页面上运行
            if (
                !location.pathname.includes('/illustrations') &&
                !location.pathname.includes('/manga') &&
                !location.pathname.includes('/series/')
            ) {
                log('当前页面非 artist illustrations/manga/series 页面，跳过');
                console.log('[Pixiv2Eagle] 当前页面不匹配条件，跳过');
                return;
            }

            console.log('[Pixiv2Eagle] 当前页面匹配条件，开始处理');

            // 等待页面中出现至少一个作品链接（最长等待 10s）
            const waitForAnchors = (timeout = 10000) =>
                new Promise((resolve) => {
                    const selector = 'a[href^="/artworks/"], a[href*="/artworks/"]';
                    const existing = document.querySelectorAll(selector);
                    if (existing && existing.length > 0) return resolve(Array.from(existing));

                    const obs = new MutationObserver(() => {
                        const found = document.querySelectorAll(selector);
                        if (found && found.length > 0) {
                            obs.disconnect();
                            resolve(Array.from(found));
                        }
                    });
                    obs.observe(document.body, { childList: true, subtree: true });

                    setTimeout(() => {
                        try {
                            obs.disconnect();
                        } catch (e) {}
                        resolve(Array.from(document.querySelectorAll(selector)));
                    }, timeout);
                });

            const anchors = await waitForAnchors(10000);
            if (!anchors || anchors.length === 0) {
                log('未检测到作品链接');
                console.log('[Pixiv2Eagle] 未检测到作品链接');
                return;
            }

            console.log('[Pixiv2Eagle] 检测到', anchors.length, '个作品链接');

            // 构建 anchor map：为每个 artwork id 选择最佳的 anchor 作为插入位置
            // 优先级（评分高到低）：
            // - 外层系列容器 div.sc-e83d358-1
            // - 系列缩略图 div.sc-f44a0b30-9(.cvPXKv)
            // - 艺术家列表卡片 div.sc-4822cddd-0(.eCgTWT)
            // - 其他（最低分）。避免选择不合适的全局容器（例如直接选择 #seriesContents）
            const anchorMap = {};
            function scoreAnchor(el) {
                if (!el || !(el instanceof Element)) return -1;
                // 优先匹配外层系列容器
                if (el.closest && el.closest('div.sc-e83d358-1')) return 3;
                if (el.closest && (el.closest('div.sc-f44a0b30-9.cvPXKv') || el.closest('div.sc-f44a0b30-9'))) return 2;
                if (el.closest && (el.closest('div.sc-4822cddd-0.eCgTWT') || el.closest('div.sc-4822cddd-0'))) return 1;
                // 其它情况评分为 0（不再对 #seriesContents 做特殊惩罚）
                return 0;
            }

            for (const a of anchors) {
                const href = a.getAttribute('href') || '';
                const m = href.match(/\/artworks\/(\d+)/);
                if (m) {
                    const id = m[1];
                    const s = scoreAnchor(a);
                    if (!anchorMap[id]) {
                        // 直接记录第一个合格的锚点（可能是得分最低的，但后续会替换）
                        anchorMap[id] = { el: a, score: s };
                    } else {
                        // 比较分数，选择更合适的锚点
                        const existing = anchorMap[id];
                        if ((s || 0) > (existing.score || 0)) {
                            anchorMap[id] = { el: a, score: s };
                        }
                    }
                }
            }
            // 将 map 中的值规范为元素引用（丢弃 score）
            for (const k of Object.keys(anchorMap)) {
                anchorMap[k] = anchorMap[k].el || anchorMap[k];
            }
            const artworkIds = Object.keys(anchorMap);
            if (artworkIds.length === 0) {
                log('未解析到任何 artwork id');
                console.log('[Pixiv2Eagle] 未解析到任何 artwork id');
                return;
            }

            console.log('[Pixiv2Eagle] 解析到 artworkIds:', artworkIds.slice(0, 5).join(','), artworkIds.length > 5 ? '...' : '');

            // 获取画师 ID - 支持 /user/{id} 和 /users/{id} 两种格式
            let artistMatch = location.pathname.match(/^\/users\/(\d+)/);
            if (!artistMatch) {
                artistMatch = location.pathname.match(/^\/user\/(\d+)/);
            }
            const artistId = artistMatch ? artistMatch[1] : null;
            if (!artistId) {
                log('无法从 URL 解析 artistId');
                console.log('[Pixiv2Eagle] 无法从 URL 解析 artistId，URL:', location.pathname);
                return;
            }

            console.log('[Pixiv2Eagle] 解析到 artistId:', artistId);

            const pixivFolderId = getFolderId();
            const artistFolder = await findArtistFolder(pixivFolderId, artistId);
            if (!artistFolder) {
                log('未找到对应的画师文件夹，跳过标注');
                console.log('[Pixiv2Eagle] 未找到对应的画师文件夹（pixivFolderId:', pixivFolderId, '）');
                return;
            }

            log('找到画师文件夹', artistFolder.id, '开始拉取 items');
            console.log('[Pixiv2Eagle] 找到画师文件夹:', artistFolder.id, '名称:', artistFolder.name);
            const items = await getAllEagleItemsInFolder(artistFolder.id);
            const urlSet = new Set((items || []).map((it) => it.url));
            console.log('[Pixiv2Eagle] 画师文件夹中 items 数量:', items ? items.length : 0);

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
            console.log('[Pixiv2Eagle] 已收集到的子文件夹描述数量:', folderDescSet.size);

            // 如果是系列页面，优先查找系列文件夹并在该文件夹下递归寻找 item/url 与 子文件夹描述（备注为 pid）
            if (location.pathname.includes('/series/')) {
                console.log('[Pixiv2Eagle] 检测到系列页面，开始处理系列文件夹');
                try {
                    const seriesMatch = location.pathname.match(/\/series\/(\d+)/);
                    const seriesId = seriesMatch ? seriesMatch[1] : null;
                    console.log('[Pixiv2Eagle] 系列ID:', seriesId);
                    if (seriesId) {
                        // 重新获取画师文件夹的最新数据（包含完整的子文件夹树）
                        const updatedArtistFolder = await findArtistFolder(pixivFolderId, artistId);
                        if (!updatedArtistFolder) {
                            log('系列页面但无法重新获取画师文件夹');
                            console.log('[Pixiv2Eagle] 系列页面但无法重新获取画师文件夹');
                        } else {
                            console.log('[Pixiv2Eagle] 已重新获取画师文件夹，查找系列文件夹');
                            const seriesFolder = findSeriesFolderInArtist(updatedArtistFolder, artistId, seriesId);
                            if (seriesFolder) {
                                console.log('[Pixiv2Eagle] 找到系列文件夹:', seriesFolder.id, '，名称:', seriesFolder.name);
                                log('在系列页面找到对应的 Eagle 系列文件夹', seriesFolder.id, '，将递归检查其 items 与子文件夹描述');
                                // 递归获取系列文件夹下所有层级的 items
                                async function collectSeriesFolderItems(folder) {
                                    if (!folder || !folder.id) return;
                                    try {
                                        const folderItems = await getAllEagleItemsInFolder(folder.id);
                                        console.log('[Pixiv2Eagle] 系列文件夹', folder.id, '中 items 数量:', folderItems ? folderItems.length : 0);
                                        for (const it of folderItems || []) if (it && it.url) urlSet.add(it.url);
                                    } catch (e) {
                                        console.error('拉取系列文件夹 items 失败:', folder.id, e);
                                    }
                                    if (!folder.children || folder.children.length === 0) return;
                                    for (const child of folder.children) {
                                        const d = (child.description || '').trim();
                                        if (d) {
                                            console.log('[Pixiv2Eagle] 收集子文件夹 description:', d, '-> 文件夹ID:', child.id);
                                            folderDescSet.add(d);
                                            folderDescMap[d] = child.id;
                                        }
                                        // 递归子文件夹
                                        await collectSeriesFolderItems(child);
                                    }
                                }
                                await collectSeriesFolderItems(seriesFolder);
                                console.log('[Pixiv2Eagle] 系列页面递归收集完成，urlSet 大小:', urlSet.size, '，folderDescSet 大小:', folderDescSet.size);
                                log('系列页面递归收集完成，现有 urlSet 大小:', urlSet.size, '，folderDescSet 大小:', folderDescSet.size);
                            } else {
                                console.log('[Pixiv2Eagle] 系列页面但未在 Eagle 中找到对应系列文件夹（seriesId:', seriesId, '）');
                                log('系列页面但未在 Eagle 中找到对应系列文件夹');
                            }
                        }
                    }
                } catch (e) {
                    console.error('处理系列页面时出错:', e);
                }
            }

            // 插入标记的函数：将勾号浮动到作品卡片容器左下角（优先使用容器类名: sc-4822cddd-0 eCgTWT），
            // 同时支持系列缩略图容器：sc-e83d358-1（包含 sc-f44a0b30-9 cvPXKv）
            const insertBadge = (anchor, matchInfo = {}) => {
                if (!anchor) return;

                // 当在系列页面时，严格限定标记只在每个系列项的外层容器里插入
                // 优先寻找同时具有两个类名的容器：sc-e83d358-1 和 gIHHFW
                if (location.pathname.includes('/series/')) {
                    // 在系列页面时，逐层向上查找一个合理的“系列项”容器。
                    // 目标优先级：sc-e83d358-1(.gIHHFW) -> sc-f44a0b30-9(.cvPXKv) -> 含有缩略图的祖先
                    function findSeriesItemContainer(start) {
                        if (!start) return null;
                        let cur = start instanceof Element ? start : start.parentElement;
                        let depth = 0;
                        while (cur && cur !== document.body && depth < 8) {
                            try {
                                // 优先匹配 Pixiv 系列外层/项容器
                                if (cur.matches && (cur.matches('div.sc-e83d358-1') || cur.matches('div.sc-e83d358-1.gIHHFW'))) return cur;
                                // 也把外层盒子 sc-f44a0b30-0 视为候选（包含宽高 wrapper）
                                if (cur.matches && cur.matches('div.sc-f44a0b30-0')) return cur;
                                if (cur.matches && (cur.matches('div.sc-f44a0b30-9') || cur.matches('div.sc-f44a0b30-9.cvPXKv'))) return cur;
                                // 如果元素包含明显的 pixiv 缩略图，也可作为候选
                                const img = cur.querySelector && cur.querySelector('img');
                                if (img && typeof img.src === 'string' && img.src.includes('i.pximg.net')) return cur;
                            } catch (e) {
                                // ignore
                            }
                            cur = cur.parentElement;
                            depth++;
                        }
                        return null;
                    }

                    const strictSeriesContainer = findSeriesItemContainer(anchor);
                    if (!strictSeriesContainer) {
                        if (debug) log('系列页面：未在 anchor 的祖先链中找到系列项容器（尝试宽松匹配）', matchInfo.artworkId);
                        console.log('[Pixiv2Eagle] 系列页面：未在 anchor 的祖先链中找到系列项容器，尝试宽松匹配', matchInfo.artworkId);
                        // 不立即返回——改为允许后续更宽松的匹配（由后面的容器验证决定）
                    } else {
                        // 找到后强制为容器，避免回退到过高的父容器
                        var forcedSeriesContainer = strictSeriesContainer;
                    }
                }

                // 查找候选容器的策略：
                // 1. 优先找 sc-e83d358-1（系列页面的外层容器）
                // 2. 其次找 sc-f44a0b30-9.cvPXKv（系列缩略图）
                // 3. 再找 sc-4822cddd-0.eCgTWT（艺术家列表卡片）
                // 4. 最后回退到 parentElement
                let container = null;
                
                // 如果在系列页面并已找到强制容器，则直接使用它
                if (typeof forcedSeriesContainer !== 'undefined' && forcedSeriesContainer) {
                    container = forcedSeriesContainer;
                    if (debug) log('使用强制的系列外层容器:', matchInfo.artworkId);
                    console.log('[Pixiv2Eagle] 作品', matchInfo.artworkId, '使用强制的系列外层容器 (sc-e83d358-1.gIHHFW)');
                } else {
                    // 首先尝试找最外层的系列容器（sc-e83d358-1）
                    const seriesOuterContainer = anchor.closest('div.sc-e83d358-1');
                    if (seriesOuterContainer) {
                        container = seriesOuterContainer;
                        if (debug) log('找到系列外层容器:', matchInfo.artworkId);
                        console.log('[Pixiv2Eagle] 作品', matchInfo.artworkId, '找到系列外层容器 (sc-e83d358-1)');
                    }
                }
                
                // 如果没有外层容器，继续尝试其他选项
                if (!container) {
                    container =
                        anchor.closest('div.sc-e83d358-1') ||
                        anchor.closest('div.sc-f44a0b30-0') ||
                        anchor.closest('div.sc-f44a0b30-9.cvPXKv') ||
                        anchor.closest('div.sc-f44a0b30-9') ||
                        anchor.closest('div.sc-4822cddd-0.eCgTWT') ||
                        anchor.closest('div.sc-4822cddd-0');
                }

                if (!container) container = anchor.parentElement;
                if (!container) return;

                // 验证容器是否为作品卡片或系列缩略图：
                // - 普通作品卡片须包含 Pixiv 缩略图（i.pximg.net）或 <picture>/<img>
                // - 系列缩略图容器（sc-f44a0b30-9.cvPXKv）允许任何 <img> 或 <picture>
                // 优先基于 anchor 判断缩略图，避免将包含大量缩略图的上层容器误判为目标容器
                function containsPixivThumbnail(el, anchor) {
                    try {
                        if (!el) return false;
                        // 优先检查 anchor 本身是否包含图片（更接近缩略图位置）
                        if (anchor && anchor.querySelector) {
                            const aImg = anchor.querySelector('img');
                            if (aImg && typeof aImg.src === 'string' && aImg.src.includes('i.pximg.net')) return true;
                            const aPic = anchor.querySelector('picture');
                            if (aPic && aPic.querySelector('img')) return true;
                        }
                        // 否则检查容器内的直接图片（但优先匹配与 anchor 相近的图片）
                        const imgs = Array.from(el.querySelectorAll('img'));
                        for (const img of imgs) {
                            if (img && typeof img.src === 'string' && img.src.includes('i.pximg.net')) {
                                // 确保该 img 在容器中且尽量靠近 anchor（祖先关系或共享最近公共祖先）
                                if (!anchor || el.contains(anchor)) return true;
                            }
                        }
                        const pic = el.querySelector('picture');
                        if (pic && pic.querySelector('img')) return true;
                        return false;
                    } catch (e) {
                        return false;
                    }
                }

                function containsAnyImg(el, anchor) {
                    try {
                        if (!el) return false;
                        // 优先检查 anchor 下的 img/picture
                        if (anchor && anchor.querySelector) {
                            if (anchor.querySelector('img')) return true;
                            if (anchor.querySelector('picture')) return true;
                        }
                        // 再检查容器内的直接 img/picture，但避免把超大容器误判
                        const directImg = el.querySelector('img');
                        if (directImg) return true;
                        const directPic = el.querySelector('picture');
                        if (directPic) return true;
                        return false;
                    } catch (e) {
                        return false;
                    }
                }

                // 如果容器本身不满足条件，则向上查找最多 4 层祖先来验证
                let valid = false;
                // 优先判断常见 pixiv 缩略图
                if (containsPixivThumbnail(container, anchor)) {
                    valid = true;
                    if (debug) log('容器验证通过 (pixiv缩略图):', matchInfo.artworkId);
                    console.log('[Pixiv2Eagle] 作品', matchInfo.artworkId, '容器验证通过 (pixiv缩略图)');
                }

                // 如果是系列页面容器（sc-e83d358-1 或外层盒子 sc-f44a0b30-0），允许任何包含图片的容器
                if (!valid && (container.classList.contains('sc-e83d358-1') || container.classList.contains('sc-f44a0b30-0'))) {
                    if (containsAnyImg(container, anchor)) {
                        valid = true;
                        if (debug) log('容器验证通过 (系列页面外层容器):', matchInfo.artworkId);
                        console.log('[Pixiv2Eagle] 作品', matchInfo.artworkId, '容器验证通过 (系列页面外层容器 sc-e83d358-1)');
                    }
                }

                // 如果容器或其祖先是系列缩略图类，则允许任何 img/picture
                if (!valid) {
                    const seriesAncestor = container.closest('div.sc-f44a0b30-0') || container.closest('div.sc-f44a0b30-9.cvPXKv') || container.closest('div.sc-f44a0b30-9');
                    if (seriesAncestor && containsAnyImg(seriesAncestor, anchor)) {
                        container = seriesAncestor;
                        valid = true;
                        if (debug) log('容器验证通过 (系列缩略图):', matchInfo.artworkId);
                        console.log('[Pixiv2Eagle] 作品', matchInfo.artworkId, '容器验证通过 (系列缩略图 sc-f44a0b30-9)');
                    }
                }

                // 继续向上寻找包含缩略图的祖先（最多 4 层）
                let up = container;
                let depth = 0;
                while (!valid && up.parentElement && depth < 4) {
                    up = up.parentElement;
                    if (containsPixivThumbnail(up, anchor) || containsAnyImg(up, anchor)) {
                        container = up;
                        valid = true;
                        if (debug) log('容器验证通过 (向上搜索层级 ' + depth + '):', matchInfo.artworkId);
                        console.log('[Pixiv2Eagle] 作品', matchInfo.artworkId, '容器验证通过 (向上搜索层级 ' + depth + ')');
                        break;
                    }
                    depth++;
                }

                if (!valid) {
                    // 不是典型的作品卡片或系列缩略图（例如 series 阅读按钮），跳过标注
                    if (debug) log('容器验证失败，跳过标注:', matchInfo.artworkId, '容器类名:', container.className);
                    return;
                }

                // 防止重复插入（用 data 属性放在容器上）
                if (container.dataset.eagleSaved === '1') return;

                // 确保容器为定位上下文
                try {
                    const cs = window.getComputedStyle(container);
                    if (!cs || cs.position === 'static') {
                        container.style.position = 'relative';
                    }
                } catch (e) {
                    // ignore
                }

                // 选择最终用于插入徽章的父元素：
                // 优先使用缩略图容器（sc-f44a0b30-9 / sc-f44a0b30-9.cvPXKv），
                // 否则使用之前确定的 container
                let badgeParent = container;
                try {
                    const thumb = container.querySelector && (container.querySelector('div.sc-f44a0b30-9.cvPXKv') || container.querySelector('div.sc-f44a0b30-9'));
                    if (thumb) {
                        badgeParent = thumb;
                        if (debug) log('优先使用缩略图容器作为徽章父元素:', matchInfo.artworkId);
                        console.log('[Pixiv2Eagle] 作品', matchInfo.artworkId, '优先使用缩略图容器插入徽章');
                    }
                } catch (e) {
                    // ignore
                }

                const badge = document.createElement('span');
                badge.className = 'eagle-saved-badge';
                badge.textContent = '✅';
                badge.setAttribute('aria-hidden', 'true');
                // 样式：左下角浮动，系列缩略图也适用
                badge.style.position = 'absolute';
                // 更保守的偏移，避免与右下角的书签/按钮重叠
                badge.style.left = '6px';
                badge.style.bottom = '6px';
                badge.style.zIndex = '9999';
                badge.style.fontSize = '16px';
                badge.style.lineHeight = '1';
                badge.style.pointerEvents = 'none';
                badge.style.backgroundColor = 'rgba(255,255,255,0.95)';
                badge.style.padding = '2px 6px';
                badge.style.borderRadius = '4px';

                try {
                    // 确保 badgeParent 为定位上下文
                    try {
                        const cs2 = window.getComputedStyle(badgeParent);
                        if (!cs2 || cs2.position === 'static') {
                            badgeParent.style.position = 'relative';
                        }
                    } catch (e) {
                        // ignore
                    }

                    badgeParent.appendChild(badge);
                    // 在最外层 container 上打标用于去重，避免重复插入
                    container.dataset.eagleSaved = '1';

                    // 记录该次匹配的信息（持久化以供后续分析）
                    try {
                        const record = {
                            artworkId: matchInfo.artworkId || null,
                            artworkUrl: matchInfo.artworkUrl || null,
                            matchedBy: matchInfo.matchedBy || null,
                            matchedFolderId: matchInfo.matchedFolderId || null,
                            containerClass: (container.className || '').toString(),
                            timestamp: Date.now(),
                            pagePath: location.pathname,
                        };

                        // 读取已有记录（确保为数组）
                        let existing = [];
                        try {
                            const raw = GM_getValue('eagleSavedBadgeRecords', []);
                            existing = Array.isArray(raw) ? raw : [];
                        } catch (e) {
                            existing = [];
                        }
                        existing.push(record);
                        try {
                            GM_setValue('eagleSavedBadgeRecords', existing);
                        } catch (e) {
                            console.error('保存勾选记录到 GM_setValue 失败:', e);
                        }

                        if (debug) console.debug('[Pixiv2Eagle] 记录已保存缩略图匹配:', record);
                    } catch (recErr) {
                        console.error('记录匹配信息失败:', recErr);
                    }
                } catch (e) {
                    console.error('插入已保存标记失败:', e);
                }
            };

            // 首次批量标注
            console.log('[Pixiv2Eagle] 开始首次批量标注，artworkIds:', artworkIds.length, '个');
            for (const id of artworkIds) {
                const a = anchorMap[id];
                const artworkUrl = `https://www.pixiv.net/artworks/${id}`;
                // 匹配优先级：
                // 1) item.url 与 artworkUrl 匹配 (matchedBy = 'itemUrl')
                // 2) 画师文件夹（或其子文件夹）中有 folder.description === artworkId (matchedBy = 'folderDesc')
                if (urlSet.has(artworkUrl)) {
                    console.log('[Pixiv2Eagle] 作品', id, '匹配 (itemUrl)');
                    if (debug) log('标注作品 (itemUrl):', id);
                    insertBadge(a, { artworkId: id, artworkUrl, matchedBy: 'itemUrl', matchedFolderId: null });
                } else if (folderDescSet.has(String(id))) {
                    const matchedFolderId = folderDescMap[String(id)] || null;
                    console.log('[Pixiv2Eagle] 作品', id, '匹配 (folderDesc)，文件夹ID:', matchedFolderId);
                    if (debug) log('标注作品 (folderDesc):', id, '文件夹ID:', matchedFolderId);
                    insertBadge(a, { artworkId: id, artworkUrl, matchedBy: 'folderDesc', matchedFolderId });
                } else {
                    console.log('[Pixiv2Eagle] 作品', id, '未匹配（不在 urlSet 或 folderDescSet 中）');
                    if (debug) log('未匹配作品:', id, '(不在 urlSet 或 folderDescSet 中)');
                }
            }

            // 监听后续动态添加的作品节点（如无限滚动或分页加载）
            const galleryObserver = new MutationObserver((mutations) => {
                for (const mut of mutations) {
                    for (const node of Array.from(mut.addedNodes || [])) {
                        if (!(node instanceof HTMLElement)) continue;
                        const newAnchors = node.querySelectorAll
                            ? Array.from(node.querySelectorAll('a[href^="/artworks/"], a[href*="/artworks/"]'))
                            : [];
                        for (const na of newAnchors) {
                            const href = na.getAttribute('href') || '';
                            const m = href.match(/\/artworks\/(\d+)/);
                                if (m) {
                                const id = m[1];
                                const artworkUrl = `https://www.pixiv.net/artworks/${id}`;
                                if (urlSet.has(artworkUrl)) {
                                    insertBadge(na, { artworkId: id, artworkUrl, matchedBy: 'itemUrl', matchedFolderId: null });
                                } else if (folderDescSet.has(String(id))) {
                                    const matchedFolderId = folderDescMap[String(id)] || null;
                                    insertBadge(na, { artworkId: id, artworkUrl, matchedBy: 'folderDesc', matchedFolderId });
                                }
                            }
                        }
                    }
                }
            });

            galleryObserver.observe(document.body, { childList: true, subtree: true });
            // 5 分钟后断开监听以避免长期占用
            setTimeout(() => galleryObserver.disconnect(), 5 * 60 * 1000);
        } catch (err) {
            console.error('标注画师作品保存状态失败:', err);
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
    }

    const monitorConfig = [
        {
            urlSuffix: "/artworks",
            observeID: EAGLE_SAVE_BUTTON_ID,
            handler: addButton,
        },
        {
            urlSuffix: "/user",
            observeID: null,
            handler: markSavedInArtistList,
        },
    ];

    // 启动脚本
    try {
        console.log('[Pixiv2Eagle] 脚本已启动，当前URL:', location.pathname);
        for (const monitorInfo of monitorConfig) {
            if (location.pathname.includes(monitorInfo.urlSuffix)) {
                console.log('[Pixiv2Eagle] 初始加载时触发处理器:', monitorInfo.urlSuffix);
                handlePageChange(monitorInfo);
            }
        }
        observeUrlChanges(monitorConfig);
    } catch (error) {
        console.error("脚本启动失败:", error);
    }
})();
