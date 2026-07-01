"use strict";

import { getFolderId } from "../../tampermonkey/setting.js";
import { dbg, err, warn } from "../../tampermonkey/logger.js";
import { gmFetch } from "../../tampermonkey/request.js";
import { removeChapterNumber } from "../../shared/chapter-title.js";
import { SERIES_PAGE_LIST_SELECTOR } from "../../config/selectors/index.js";
import { checkEagle } from "../../eagle/client.js";
import { findArtistFolder } from "../../eagle/artist.js";
import { getAllEagleItemsInFolder } from "../../eagle/items.js";
import { findMangaSeriesFolderInArtistTree } from "./folder.js";
import { createBatchSaveProgressTask } from "../../ui/save-progress/index.js";
import { publishSaved } from "../../shared/marking/saved-event-bus.js";

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

    let task;
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

        if (!seriesFolder.children) {
            seriesFolder.children = [];
        }

        const lis = listContainer.querySelectorAll("li");
        dbg(`找到 ${lis.length} 个章节列表项`);

        // 预扫描：收集可处理章节（有序号且能匹配 Eagle 文件夹）
        const chapters = [];
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
            linkClone.querySelectorAll("div, span").forEach((el) => {
                if (el.textContent.trim() === "R-18") el.remove();
            });
            const title = linkClone.textContent.trim();

            let chapterNum = null;
            const numMatch = title.match(/#(\d+)/) || title.match(/第(\d+)[话話]/) || title.match(/^(\d+)$/);
            if (numMatch) chapterNum = numMatch[1];
            if (!chapterNum) {
                dbg(`无法从标题 "${title}" 中提取序号，跳过`);
                continue;
            }

            let chapterFolder = seriesFolder.children.find((c) => (c.description || "").trim() === pid);
            if (!chapterFolder) {
                const searchTitle = removeChapterNumber(title);
                if (searchTitle) {
                    chapterFolder = seriesFolder.children.find((c) => c.name.includes(searchTitle));
                }
            }
            if (!chapterFolder) continue;

            chapters.push({ pid, title, chapterNum, chapterFolder });
        }

        const totalWorks = chapters.length;
        if (totalWorks === 0) {
            alert("没有可更新的章节文件夹。");
            return;
        }

        task = createBatchSaveProgressTask({
            totalWorks,
            initialArtworkId: seriesId,
            initialTitle: "系列章节更新",
            headerText: "批量更新中",
        });

        let updateCount = 0;

        for (let idx = 0; idx < totalWorks; idx++) {
            if (task.signal.aborted) {
                const abortErr = new Error("已取消");
                abortErr.name = "AbortError";
                throw abortErr;
            }

            const { pid, title, chapterNum, chapterFolder } = chapters[idx];
            task.reportWorkIndex({ current: idx + 1, total: totalWorks });
            task.beginWork({ artworkId: chapterFolder.description || seriesId, title, pageCount: 1 });

            let newName = title;
            if (!newName.startsWith(`#${chapterNum}`)) {
                newName = `#${chapterNum} ${title}`;
            }

            if (chapterFolder.name !== newName) {
                dbg(`重命名文件夹: ${chapterFolder.name} -> ${newName}`);
                await gmFetch("http://localhost:41595/api/folder/rename", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ folderId: chapterFolder.id, newName }),
                });
                updateCount++;
            }
            task.reportSubmitProgress({ current: 1, total: 1 });

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
            task.reportEagleProgress({ current: 1, total: 1 });
            publishSaved({
                kind: "manga-chapter",
                id: pid,
                userId: artistId,
                folderId: chapterFolder.id,
                savedAt: Date.now(),
            });
        }

        task.reportWorkIndex({ current: totalWorks, total: totalWorks });
        task.complete();
        dbg(`更新完成！共更新了 ${updateCount} 个章节文件夹。`);
    } catch (e) {
        err(e);
        if (e.name === "AbortError") {
            if (task && !task.signal.aborted) task.abort();
            return;
        }
        if (task) {
            task.fail(`更新失败: ${e.message}`.replace(/\n/g, " "));
        } else {
            alert("更新失败: " + e.message);
        }
    }
}
