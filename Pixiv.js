// ==UserScript==
// @name            Pixiv2Eagle
// @name:en         Pixiv2Eagle
// @description     一键将 Pixiv 艺术作品保存到 Eagle 图片管理软件，支持多页作品、自动创建画师文件夹、保留标签和元数据
// @description:en  Save Pixiv artworks to Eagle image management software with one click. Supports multi-page artworks, automatic artist folder creation, and preserves tags and metadata
// @version         1.0

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

(function() {
    'use strict';

    // 常量定义
    const EAGLE_SAVE_BUTTON_ID = 'eagle-save-button-wrapper';
    const PIXIV_SECTION_CLASS = 'sc-a74b10e0-0';

    // 获取文件夹ID
    function getFolderId() {
        return GM_getValue('pixivFolderId', '');
    }

    // 设置文件夹ID
    function setFolderId() {
        const currentId = getFolderId();
        const newId = prompt('请输入 Pixiv 文件夹 ID:', currentId);
        if (newId !== null) {
            const trimmedId = newId.trim();
            GM_setValue('pixivFolderId', trimmedId);
            if (trimmedId === '') {
                alert('已清空文件夹 ID，将默认在根目录创建画师文件夹');
            } else {
                alert(`文件夹 ID 已设置为: ${trimmedId}`);
            }
        }
    }

    // 获取是否使用投稿时间
    function getUseUploadDate() {
        return GM_getValue('useUploadDate', false);
    }

    // 切换是否使用投稿时间
    function toggleUseUploadDate() {
        const currentMode = getUseUploadDate();
        GM_setValue('useUploadDate', !currentMode);
        alert(`使用投稿时间作为添加日期已${!currentMode ? '开启 ✅' : '关闭 ❌'}`);
    }

    // 获取调试模式状态
    function getDebugMode() {
        return GM_getValue('debugMode', false);
    }

    // 切换调试模式
    function toggleDebugMode() {
        const currentMode = getDebugMode();
        GM_setValue('debugMode', !currentMode);
        alert(`调试模式已${!currentMode ? '开启 ✅' : '关闭 ❌'}`);
    }

    // 注册菜单命令
    GM_registerMenuCommand('设置 Pixiv 文件夹 ID', setFolderId);
    GM_registerMenuCommand('切换：调试模式', toggleDebugMode);
    GM_registerMenuCommand('切换：使用投稿时间作为添加日期', toggleUseUploadDate);
    GM_registerMenuCommand('保存当前作品到 Eagle', saveCurrentArtwork);

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
                method: options.method || 'GET',
                url: url,
                headers: options.headers || {},
                data: options.body,
                responseType: 'json',
                onload: function(response) {
                    resolve(response.response);
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // 检查Eagle是否运行
    async function checkEagle() {
        try {
            const data = await gmFetch('http://localhost:41595/api/application/info');
            return {
                running: true,
                version: data.data.version
            };
        } catch (error) {
            console.error('Eagle 未启动或无法连接:', error);
            return {
                running: false,
                version: null
            };
        }
    }

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

    // 获取画师专属文件夹信息
    async function getArtistFolder(pixivFolderId, artistId, artistName) {
        try {
            // 获取所有文件夹列表
            const data = await gmFetch('http://localhost:41595/api/folder/list');
            
            if (!data.status || !Array.isArray(data.data)) {
                throw new Error('无法获取文件夹列表');
            }

            // 递归查找 Pixiv 主文件夹
            const pixivFolder = findFolderRecursively(data.data, pixivFolderId);
            if (!pixivFolder) {
                throw new Error('找不到指定的 Pixiv 文件夹，请检查文件夹 ID 是否正确');
            }

            // 在 Pixiv 文件夹的子文件夹中查找画师专属文件夹
            const artistFolder = pixivFolder.children?.find(folder => {
                const description = folder.description || '';
                const match = description.match(/pid\s*=\s*(\d+)/);
                return match && match[1] === artistId;
            });

            if (artistFolder) {
                return {
                    exists: true,
                    id: artistFolder.id,
                    name: artistFolder.name
                };
            }

            // 如果找不到画师文件夹，创建新的画师文件夹
            return await createArtistFolder(artistName, artistId, pixivFolderId);
        } catch (error) {
            console.error('获取画师文件夹信息失败:', error);
            throw error;
        }
    }

    // 监听URL变化
    function observeUrlChanges() {
        // 监听 popstate 事件（后退/前进按钮触发）
        window.addEventListener('popstate', () => {
            if (location.pathname.includes('/artworks/')) {
                handleArtworkPageChange();
            }
        });

        // 重写 history.pushState
        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);
            if (location.pathname.includes('/artworks/')) {
                handleArtworkPageChange();
            }
        };

        // 重写 history.replaceState
        const originalReplaceState = history.replaceState;
        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            if (location.pathname.includes('/artworks/')) {
                handleArtworkPageChange();
            }
        };
    }

    // 处理作品页面变化
    function handleArtworkPageChange() {
        // 立即尝试添加按钮
        addButton();

        // 设置一个观察器来监视DOM变化
        const observer = new MutationObserver((mutations, obs) => {
            // 检查目标section是否存在
            const targetSection = document.querySelector(`section[class*="${PIXIV_SECTION_CLASS}"]`);
            if (targetSection) {
                // 检查section中是否存在保存按钮，若不存在则添加
                const button = document.getElementById(EAGLE_SAVE_BUTTON_ID);
                if (!button) {
                    addButton();
                }
            }
        });

        // 配置观察器
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 30秒后停止观察（避免无限观察）
        setTimeout(() => {
            observer.disconnect();
        }, 30000);

        // 同时设置一个间隔检查
        let checkCount = 0;
        const intervalId = setInterval(() => {
            const targetSection = document.querySelector(`section[class*="${PIXIV_SECTION_CLASS}"]`);
            if (targetSection) {
                const button = document.getElementById(EAGLE_SAVE_BUTTON_ID);
                if (!button) {
                    addButton();
                }
            }
            
            checkCount++;
            if (checkCount >= 10) { // 5秒后停止检查（500ms * 10）
                clearInterval(intervalId);
            }
        }, 500);
    }

    // 等待目标section元素加载
    function waitForElement(selector) {
        return new Promise(resolve => {
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
                subtree: true
            });

            // 10秒后超时
            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, 10000);
        });
    }

    // 创建 Pixiv 风格的按钮
    function createPixivStyledButton(text) {
        const button = document.createElement('div');
        button.textContent = text;
        button.style.cursor = 'pointer';
        button.style.fontSize = '14px';
        button.style.padding = '8px 16px';
        button.style.borderRadius = '999px';
        button.style.color = '#333';
        button.style.backgroundColor = 'transparent';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.gap = '4px';
        button.style.transition = 'all 0.2s ease';
        button.style.border = '1px solid #d6d6d6';

        // 添加鼠标悬浮效果
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#0096fa';
            button.style.color = 'white';
            button.style.border = '1px solid #0096fa';
        });
        
        // 添加鼠标离开效果
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'transparent';
            button.style.color = '#333';
            button.style.border = '1px solid #d6d6d6';
        });
        
        // 添加点击效果
        button.addEventListener('mousedown', () => {
            button.style.backgroundColor = '#0075c5';
            button.style.border = '1px solid #0075c5';
        });
        
        button.addEventListener('mouseup', () => {
            button.style.backgroundColor = '#0096fa';
            button.style.border = '1px solid #0096fa';
        });

        return button;
    }

    // 获取作品ID
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
            addTagIfNotExists('AI生成');
        }
        
        // 如果是原创作品，添加"原创"标签
        if (isOriginal) {
            addTagIfNotExists('原创');
        }
        
        // 处理原始标签，保持顺序但去除重复
        tags.forEach(tagInfo => {
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
                throw new Error('无法获取作品页面信息');
            }

            return {
                pageCount: data.body.length,
                originalUrls: data.body.map(page => page.urls.original)
            };
        } catch (error) {
            console.error('获取作品页面信息失败:', error);
            throw error;
        }
    }

    // 获取作品详细信息
    async function getArtworkDetails(artworkId) {
        try {
            const [basicInfo, pagesInfo] = await Promise.all([
                fetch(`https://www.pixiv.net/ajax/illust/${artworkId}?lang=zh`).then(r => r.json()),
                getArtworkPages(artworkId)
            ]);
            
            if (!basicInfo.body) {
                throw new Error('无法获取作品信息');
            }

            const details = {
                userName: basicInfo.body.userName,
                userId: basicInfo.body.userId,
                illustTitle: basicInfo.body.illustTitle,
                pageCount: pagesInfo.pageCount,
                originalUrls: pagesInfo.originalUrls,
                uploadDate: basicInfo.body.uploadDate,
                tags: processTags(basicInfo.body.tags.tags, basicInfo.body.isOriginal, basicInfo.body.aiType)
            };

            return details;
        } catch (error) {
            console.error('获取作品信息失败:', error);
            throw error;
        }
    }

    // 保存图片到Eagle
    async function saveToEagle(imageUrls, folderId, details, artworkId) {
        try {
            const baseTitle = details.illustTitle;
            const isMultiPage = imageUrls.length > 1;
            const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;
            
            // 根据设置决定是否使用投稿时间
            const useUploadDate = getUseUploadDate();
            const modificationTime = useUploadDate ? new Date(details.uploadDate).getTime() : undefined;
            
            // 批量添加图片
            const data = await gmFetch('http://localhost:41595/api/item/addFromURLs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    items: imageUrls.map((url, index) => ({
                        url: url,
                        name: isMultiPage ? `${baseTitle}_${index}` : baseTitle,
                        website: artworkUrl,
                        tags: details.tags,
                        ...(modificationTime && { modificationTime: modificationTime }),
                        headers: {
                            "referer": "https://www.pixiv.net/"
                        },
                    })),
                    folderId: folderId
                })
            });

            if (!data.status) {
                throw new Error('保存图片失败');
            }

            return data.data;
        } catch (error) {
            console.error('保存图片失败:', error);
            throw error;
        }
    }

    // 创建画师专属文件夹
    async function createArtistFolder(artistName, artistId, parentId = null) {
        try {
            // 创建画师文件夹
            const createData = await gmFetch('http://localhost:41595/api/folder/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    folderName: artistName,
                    ...(parentId && { parent: parentId })
                })
            });
            
            if (!createData.status) {
                throw new Error('创建文件夹失败');
            }

            const newFolderId = createData.data.id;

            // 更新文件夹描述
            const updateData = await gmFetch('http://localhost:41595/api/folder/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    folderId: newFolderId,
                    newDescription: `pid = ${artistId}`
                })
            });

            if (!updateData.status) {
                throw new Error('更新文件夹描述失败');
            }
            
            return {
                id: newFolderId,
                name: artistName
            };
        } catch (error) {
            console.error('创建画师文件夹失败:', error);
            throw error;
        }
    }

    // 保存当前作品到Eagle
    async function saveCurrentArtwork() {
        const folderId = getFolderId();
        const folderInfo = folderId ? `Pixiv 文件夹 ID: ${folderId}` : '未设置 Pixiv 文件夹 ID';

        // 首先检查Eagle是否运行
        const eagleStatus = await checkEagle();
        if (!eagleStatus.running) {
            showMessage(`${folderInfo}\nEagle 未启动，请先启动 Eagle 应用！`, true);
            return;
        }

        const artworkId = getArtworkId();
        if (!artworkId) {
            showMessage('无法获取作品 ID', true);
            return;
        }

        try {
            const details = await getArtworkDetails(artworkId);
            
            // 检查或创建画师专属文件夹
            let artistFolder = null;
            if (folderId) {
                // 如果设置了文件夹ID，检查文件夹是否存在并创建画师文件夹
                artistFolder = await getArtistFolder(folderId, details.userId, details.userName);
            } else {
                // 如果未设置文件夹ID，在根目录创建画师文件夹
                const rootFolders = await gmFetch('http://localhost:41595/api/folder/list');
                if (!rootFolders.status || !Array.isArray(rootFolders.data)) {
                    throw new Error('无法获取根目录文件夹列表');
                }
                
                // 在根目录中查找画师专属文件夹
                const existingFolder = rootFolders.data.find(folder => {
                    const description = folder.description || '';
                    const match = description.match(/pid\s*=\s*(\d+)/);
                    return match && match[1] === details.userId;
                });

                if (existingFolder) {
                    artistFolder = {
                        id: existingFolder.id,
                        name: existingFolder.name
                    };
                } else {
                    // 在根目录创建新的画师文件夹
                    artistFolder = await createArtistFolder(details.userName, details.userId);
                }
            }

            if (!artistFolder) {
                throw new Error('无法获取或创建画师文件夹');
            }

            // 保存图片到Eagle
            await saveToEagle(details.originalUrls, artistFolder.id, details, artworkId);
            
            const message = [
                folderInfo,
                `画师专属文件夹: ${artistFolder.name} (ID: ${artistFolder.id})`,
                '----------------------------',
                `Eagle版本: ${eagleStatus.version}`,
                '----------------------------',
                `作品ID: ${artworkId}`,
                `作者: ${details.userName} (ID: ${details.userId})`,
                `作品名称: ${details.illustTitle}`,
                `页数: ${details.pageCount}`,
                `上传时间: ${details.uploadDate}`,
                `标签: ${details.tags.join(', ')}`,
                '----------------------------',
                '✅ 图片已成功保存到 Eagle'
            ].join('\n');

            showMessage(message);
        } catch (error) {
            console.error(error);
            showMessage(`${folderInfo}\n保存图片失败: ${error.message}`, true);
        }
    }

    // 主函数
    async function addButton() {
        // 移除旧按钮（如果存在）
        const oldWrapper = document.getElementById(EAGLE_SAVE_BUTTON_ID);
        if (oldWrapper) {
            oldWrapper.remove();
        }

        // 等待目标section加载
        const targetSection = await waitForElement(`section[class*="${PIXIV_SECTION_CLASS}"]`);
        if (!targetSection) return;  // 如果找不到目标section，直接返回
        
        // 检查按钮是否已经存在（双重检查，以防在等待过程中已添加）
        if (document.getElementById(EAGLE_SAVE_BUTTON_ID)) return;

        // 找到section中最后一个div作为参考
        const lastDiv = targetSection.querySelector('div:last-of-type');
        if (!lastDiv) return;
        
        // 创建包裹div
        const buttonWrapper = document.createElement('div');
        buttonWrapper.id = EAGLE_SAVE_BUTTON_ID;
        buttonWrapper.className = lastDiv.className;
        buttonWrapper.style.display = 'flex';
        buttonWrapper.style.alignItems = 'center';
        buttonWrapper.style.justifyContent = 'center';
        
        // 创建按钮
        const button = createPixivStyledButton('保存到 Eagle');
        
        // 添加点击事件
        button.addEventListener('click', saveCurrentArtwork);
        
        // 将按钮添加到包裹div中
        buttonWrapper.appendChild(button);
        
        // 将按钮添加到section的最后
        targetSection.appendChild(buttonWrapper);
    }

    // 启动脚本
    try {
        if (location.pathname.includes('/artworks/')) {
            handleArtworkPageChange();
        }
        observeUrlChanges();
    } catch (error) {
        console.error('脚本启动失败:', error);
    }
})();
