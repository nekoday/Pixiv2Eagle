"use strict";

import { getFolderId } from "../../Tampermonkey/setting.js";
import { dbg, err, warn } from "../../Tampermonkey/logger.js";
import { gmFetch } from "../../Tampermonkey/request.js";
import { removeChapterNumber } from "../../shared/chapter-title.js";
import { SERIES_PAGE_LIST_SELECTOR } from "../../config/selectors/index.js";
import { checkEagle } from "../../eagle/client.js";
import { findArtistFolder } from "../../eagle/artist.js";
import { getAllEagleItemsInFolder } from "../../eagle/items.js";
import { findMangaSeriesFolderInArtistTree } from "./folder.js";

export async function updateSeriesChapters() {
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

    const seriesIdMatch = location.pathname.match(/\/series\/(\d+)/);
    if (!seriesIdMatch) {
        alert("无法获取系列 ID");
        return;
    }
    const seriesId = seriesIdMatch[1];

    let artistId = null;
    const artistIdMatch = location.pathname.match(new RegExp(`\\/users?\\/(\\d+)\\/series\\/${seriesId}`));
    if (artistIdMatch) {
        artistId = artistIdMatch[1];
    }

    if (!artistId) {
        alert("无法获取画师 ID");
        return;
    }

    try {
        const artistFolder = await findArtistFolder(folderId, artistId);
        if (!artistFolder) {
            alert("Eagle 中未找到该画师的文件夹");
            return;
        }

        const seriesFolder = findMangaSeriesFolderInArtistTree(artistFolder, artistId, seriesId);

        if (!seriesFolder) {
            alert("Eagle 中未找到该系列的文件夹");
            return;
        }

        const listContainer = document.querySelector(SERIES_PAGE_LIST_SELECTOR);
        if (!listContainer) {
            alert("未找到章节列表");
            return;
        }

        const lis = listContainer.querySelectorAll("li");
        dbg(`找到 ${lis.length} 个章节列表项`);

        if (!seriesFolder.children) {
            dbg("系列文件夹没有子文件夹信息，尝试重新获取");
            seriesFolder.children = [];
        }
        dbg(`Eagle 系列文件夹中有 ${seriesFolder.children.length} 个子文件夹`);

        let updateCount = 0;

        for (const li of lis) {
            let link = li.querySelector("div.sc-fab8f26d-1.kcKSxC a");
            if (!link) link = li.querySelector('a[href*="/artworks/"]');

            if (!link) continue;

            const href = link.getAttribute("href");
            const pidMatch = href.match(/\/artworks\/(\d+)/);
            if (!pidMatch) continue;
            const pid = pidMatch[1];

            const linkClone = link.cloneNode(true);

            const eagleBadge = linkClone.querySelector(".eagle-saved-badge");
            if (eagleBadge) eagleBadge.remove();

            const badges = linkClone.querySelectorAll("div, span");
            badges.forEach((el) => {
                if (el.textContent.trim() === "R-18") el.remove();
            });

            const title = linkClone.textContent.trim();

            let chapterNum = null;
            const numMatch = title.match(/#(\d+)/) || title.match(/第(\d+)[话話]/) || title.match(/^(\d+)$/);
            if (numMatch) {
                chapterNum = numMatch[1];
            }

            if (!chapterNum) {
                dbg(`无法从标题 "${title}" 中提取序号，跳过`);
                continue;
            }

            let chapterFolder = seriesFolder.children.find((c) => (c.description || "").trim() === pid);

            if (!chapterFolder) {
                const searchTitle = removeChapterNumber(title);

                if (searchTitle) {
                    chapterFolder = seriesFolder.children.find((c) => c.name.includes(searchTitle));
                    if (chapterFolder) {
                        dbg(`通过标题 "${searchTitle}" 匹配到文件夹: ${chapterFolder.name}`);
                    }
                }
            }

            if (chapterFolder) {
                let newName = title;
                if (!newName.startsWith(`#${chapterNum}`)) {
                    newName = `#${chapterNum} ${title}`;
                }

                if (chapterFolder.name !== newName) {
                    dbg(`重命名文件夹: ${chapterFolder.name} -> ${newName}`);
                    await gmFetch("http://localhost:41595/api/folder/rename", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ folderId: chapterFolder.id, newName: newName }),
                    });
                    updateCount++;
                }

                const items = await getAllEagleItemsInFolder(chapterFolder.id);
                if (items && items.length > 0) {
                    for (const item of items) {
                        const suffixMatch = item.name.match(/(_p?\d+)$/);
                        let suffix = "";

                        if (suffixMatch) {
                            suffix = suffixMatch[1];
                        } else if (items.length > 1) {
                            warn(`无法识别图片后缀且存在多张图片，跳过重命名: ${item.name}`);
                            continue;
                        }

                        const newItemName = `${newName}${suffix}`;
                        if (item.name !== newItemName) {
                            dbg(`重命名图片: ${item.name} -> ${newItemName}`);
                            await gmFetch("http://localhost:41595/api/item/update", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: item.id, name: newItemName }),
                            });
                        }
                    }
                }
            }
        }

        alert(`更新完成！共更新了 ${updateCount} 个章节文件夹。`);
    } catch (e) {
        err(e);
        alert("更新失败: " + e.message);
    }
}
