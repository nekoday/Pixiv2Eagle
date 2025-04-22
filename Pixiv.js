// ==UserScript==
// @name         Save to Eagle
// @icon         https://www.pixiv.net/favicon.ico
// @version      0.1
// @description  Save Pixiv Artworks to Eagle
// @author       neko
// @match        https://www.pixiv.net/artworks/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // 获取文件夹ID
    function getFolderId() {
        return GM_getValue('pixivFolderId', '');
    }

    // 设置文件夹ID
    function setFolderId() {
        const currentId = getFolderId();
        const newId = prompt('请输入 Pixiv 文件夹 ID:', currentId);
        if (newId !== null) {
            GM_setValue('pixivFolderId', newId.trim());
            alert(`文件夹 ID 已设置为: ${newId.trim()}`);
        }
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
    GM_registerMenuCommand('切换调试模式', toggleDebugMode);

    // 显示消息（根据调试模式决定是否显示）
    function showMessage(message, forceShow = false) {
        if (getDebugMode() || forceShow) {
            alert(message);
        }
    }

    // 检查Eagle是否运行
    async function checkEagle() {
        try {
            const response = await fetch('http://localhost:41595/api/application/info');
            const data = await response.json();
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
    async function getArtistFolder(pixivFolderId, artistId) {
        try {
            // 获取所有文件夹列表
            const response = await fetch('http://localhost:41595/api/folder/list');
            const data = await response.json();
            
            if (!data.status || !Array.isArray(data.data)) {
                throw new Error('无法获取文件夹列表');
            }

            // 递归查找 Pixiv 主文件夹
            const pixivFolder = findFolderRecursively(data.data, pixivFolderId);
            if (!pixivFolder || !Array.isArray(pixivFolder.children)) {
                throw new Error('无法找到 Pixiv 文件夹或其子文件夹');
            }

            // 在子文件夹中查找画师专属文件夹
            const artistFolder = pixivFolder.children.find(folder => {
                const description = folder.description || '';
                const match = description.match(/pid\s*=\s*(\d+)/);
                return match && match[1] === artistId;
            });

            return artistFolder ? {
                exists: true,
                id: artistFolder.id,
                name: artistFolder.name
            } : {
                exists: false
            };
        } catch (error) {
            console.error('获取画师文件夹信息失败:', error);
            return { exists: false };
        }
    }

    // 等待目标section元素加载
    function waitForElement(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    // 创建Pixiv风格的按钮
    function createPixivStyledButton(text) {
        const button = document.createElement('div');
        button.textContent = text;
        button.style.cursor = 'pointer';
        button.style.fontSize = '14px';
        button.style.padding = '8px 16px';
        button.style.marginRight = '1em';
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
        
        const processedTags = tags.flatMap(tagInfo => {
            const tags = [tagInfo.tag];
            // 如果有翻译且有英文翻译，添加英文翻译作为额外的标签
            if (tagInfo.translation && tagInfo.translation.en) {
                tags.push(tagInfo.translation.en);
            }
            return tags;
        });

        // 如果是原创作品，在标签列表开头添加"原创"标签
        if (isOriginal) {
            processedTags.unshift('原创');
        }

        // 如果是AI生成的作品，在标签列表开头添加"AI生成"标签
        if (aiType === 2) {
            processedTags.unshift('AI生成');
        }

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
                tags: processTags(basicInfo.body.tags.tags, basicInfo.body.isOriginal, basicInfo.body.aiType)
            };

            return details;
        } catch (error) {
            console.error('获取作品信息失败:', error);
            throw error;
        }
    }

    // 主函数
    async function addButton() {
        // 等待目标section加载
        const targetSection = await waitForElement('section[class*="sc-a74b10e0-0"]');
        
        // 找到section中最后一个div的类名作为参考
        const lastDiv = targetSection.querySelector('div[class*="sc-a74b10e0-"]');
        if (!lastDiv) return;
        
        // 创建包裹div
        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = lastDiv.className;
        buttonWrapper.style.display = 'flex';
        buttonWrapper.style.alignItems = 'center';
        buttonWrapper.style.justifyContent = 'center';
        
        // 创建按钮
        const button = createPixivStyledButton('保存到 Eagle');
        
        // 添加点击事件
        button.addEventListener('click', async () => {
            const folderId = getFolderId();
            const folderInfo = folderId ? `目标文件夹 ID: ${folderId}` : '未设置目标文件夹 ID';

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
                
                // 检查画师专属文件夹
                let artistFolderInfo = '未找到画师专属文件夹';
                if (folderId) {
                    const artistFolder = await getArtistFolder(folderId, details.userId);
                    if (artistFolder.exists) {
                        artistFolderInfo = `画师专属文件夹: ${artistFolder.name} (ID: ${artistFolder.id})`;
                    }
                }

                const message = [
                    folderInfo,
                    artistFolderInfo,
                    '----------------------------',
                    `Eagle版本: ${eagleStatus.version}`,
                    '----------------------------',
                    `作品ID: ${artworkId}`,
                    `作者: ${details.userName} (ID: ${details.userId})`,
                    `作品名称: ${details.illustTitle}`,
                    `页数: ${details.pageCount}`,
                    `标签: ${details.tags.join(', ')}`,
                    `原图地址:`,
                    ...details.originalUrls.map((url, index) => `[${index + 1}] ${url}`)
                ].join('\n');

                showMessage(message);
            } catch (error) {
                showMessage(`${folderInfo}\n获取作品信息失败`, true);
            }
        });
        
        // 将按钮添加到包裹div中
        buttonWrapper.appendChild(button);
        
        // 将按钮添加到section的最后
        targetSection.appendChild(buttonWrapper);
    }

    // 启动脚本
    addButton();
})();
