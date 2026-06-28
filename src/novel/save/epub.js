"use strict";

import { err } from "../../Tampermonkey/logger.js";
import { gmFetchBinary } from "../../Tampermonkey/request.js";
import { ensureJSZipLoaded } from "../../shared/lib-loader.js";

export function createEPUBProgressWindow() {
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

export async function generateEPUB(details, combinedContent, progressWindow = null) {
        
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