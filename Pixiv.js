// ==UserScript==
// @name         Save to Eagle
// @icon         https://www.pixiv.net/favicon.ico
// @version      0.1
// @description  Save Pixiv Artworks to Eagle
// @author       neko
// @match        https://www.pixiv.net/artworks/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

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

    // 获取作品详细信息
    async function getArtworkDetails(artworkId) {
        try {
            const response = await fetch(`https://www.pixiv.net/ajax/illust/${artworkId}?lang=zh`);
            const data = await response.json();
            
            if (!data.body) {
                throw new Error('无法获取作品信息');
            }

            const details = {
                userName: data.body.userName,
                userId: data.body.userId,
                illustTitle: data.body.illustTitle,
                pageCount: data.body.pageCount,
                originalUrl: data.body.urls.original,
                tags: processTags(data.body.tags.tags, data.body.isOriginal, data.body.aiType)
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
            const artworkId = getArtworkId();
            if (!artworkId) {
                alert('无法获取作品ID');
                return;
            }

            try {
                const details = await getArtworkDetails(artworkId);
                const message = [
                    `作品ID: ${artworkId}`,
                    `作者: ${details.userName} (ID: ${details.userId})`,
                    `作品名称: ${details.illustTitle}`,
                    `页数: ${details.pageCount}`,
                    `标签: ${details.tags.join(', ')}`,
                    `原图地址: ${details.originalUrl}`
                ].join('\n');

                alert(message);
            } catch (error) {
                alert('获取作品信息失败');
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
