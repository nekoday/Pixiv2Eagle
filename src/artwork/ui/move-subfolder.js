"use strict";

import {
    getFolderId,
    getCreateSubFolder,
    getSaveByType,
} from "../../Tampermonkey/setting.js";
import { dbg, err } from "../../Tampermonkey/logger.js";
import { gmFetch } from "../../Tampermonkey/request.js";
import { createPixivStyledButton } from "../../ui/button.js";
import {
    ARTWORK_BUTTON_CONTAINER_SELECTOR,
    ARTWORK_BUTTON_REF_SELECTOR,
} from "../../config/selectors/index.js";
import { checkEagle } from "../../eagle/client.js";
import { createEagleFolder } from "../../eagle/folder.js";
import { findArtistFolder } from "../../eagle/artist.js";
import { getTypeFolderInfo, getOrCreateTypeFolder } from "../../eagle/type-folder.js";
import { findSavedFolderForArtwork } from "../find-saved-folder.js";
import { removeChapterNumber } from "../../shared/chapter-title.js";
import { getArtworkId } from "../id.js";
import { getArtworkDetails } from "../details.js";

export async function moveArtworkToSubfolder(artworkId) {
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

    const createSubFolderMode = getCreateSubFolder();
    if (createSubFolderMode === "off") {
        alert("请先启用多页作品子文件夹功能！");
        return;
    }

    try {
        const details = await getArtworkDetails(artworkId);
        if (!details) {
            alert("无法获取作品详情");
            return;
        }

        const artistFolder = await findArtistFolder(folderId, details.userId);
        if (!artistFolder) {
            alert("未找到画师文件夹");
            return;
        }

        let targetParentFolder = artistFolder;
        if (getSaveByType()) {
            const typeInfo = getTypeFolderInfo(details.illustType);
            targetParentFolder = await getOrCreateTypeFolder(artistFolder, typeInfo);
            dbg(`按类型保存开启，目标父文件夹: ${targetParentFolder.name}`);
        }

        const shouldCreateSubfolder =
            createSubFolderMode === "always" ||
            (createSubFolderMode === "multi-page" && details.pageCount > 1) ||
            details.illustType === 1;

        if (!shouldCreateSubfolder) {
            alert("根据当前设置，此作品不需要子文件夹");
            return;
        }

        let subFolder = null;
        if (targetParentFolder.children) {
            subFolder = targetParentFolder.children.find((c) => c.description === artworkId);
        }

        if (!subFolder) {
            const subFolderId = await createEagleFolder(details.illustTitle, targetParentFolder.id, artworkId);
            subFolder = { id: subFolderId, name: details.illustTitle };
            dbg(`已创建子文件夹: ${details.illustTitle} (在 ${targetParentFolder.name} 下)`);
        } else {
            dbg(`子文件夹已存在: ${subFolder.name}`);
        }

        const allFolderIds = [artistFolder.id];
        function collectFolderIds(folder) {
            if (folder.children) {
                folder.children.forEach((child) => {
                    allFolderIds.push(child.id);
                    collectFolderIds(child);
                });
            }
        }
        collectFolderIds(artistFolder);

        const searchKeyword = removeChapterNumber(details.illustTitle);

        dbg(`正在搜索待移动文件，关键字: "${searchKeyword}", 范围: ${allFolderIds.length} 个文件夹`);

        const params = new URLSearchParams({
            folders: allFolderIds.join(","),
            keyword: searchKeyword,
            limit: "200",
        });

        const searchUrl = `http://localhost:41595/api/item/list?${params.toString()}`;
        const data = await gmFetch(searchUrl);

        let artworkItems = [];
        if (data && data.status === "success") {
            const items = Array.isArray(data.data) ? data.data : data.data?.items || [];
            const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;

            artworkItems = items.filter((item) => item.url === artworkUrl);

            if (artworkItems.length === 0 && items.length > 0) {
                dbg(`列表 URL 未匹配，尝试深度检查 ${items.length} 个项目...`);
                const concurrency = 5;
                for (let i = 0; i < items.length; i += concurrency) {
                    const chunk = items.slice(i, i + concurrency);
                    const results = await Promise.all(
                        chunk.map(async (item) => {
                            try {
                                const infoData = await gmFetch(`http://localhost:41595/api/item/info?id=${item.id}`);
                                if (infoData && infoData.data && infoData.data.url === artworkUrl) {
                                    return item;
                                }
                            } catch (e) {
                                return null;
                            }
                            return null;
                        })
                    );
                    const found = results.filter((r) => r);
                    artworkItems.push(...found);
                }
            }
        }

        artworkItems = artworkItems.filter(() => true);

        if (artworkItems.length === 0) {
            alert("未找到需要移动的文件 (请确认文件已保存且 URL 正确)");
            return;
        }

        dbg(`找到 ${artworkItems.length} 个文件，准备移动...`);

        for (const item of artworkItems) {
            await gmFetch("http://localhost:41595/api/item/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: item.id,
                    folders: [subFolder.id],
                }),
            });
            dbg(`已移动文件: ${item.name} -> ${subFolder.name}`);
        }

        alert(`✅ 成功将 ${artworkItems.length} 个文件移动到子文件夹 "${subFolder.name}"`);
    } catch (error) {
        err(error);
        alert("移动失败: " + error.message);
    }
}

export async function addMoveToSubfolderButton() {
    const artworkId = getArtworkId();
    if (!artworkId) return;

    try {
        await findSavedFolderForArtwork(artworkId);

        await new Promise((resolve) => setTimeout(resolve, 500));
        const container = document.querySelector(ARTWORK_BUTTON_CONTAINER_SELECTOR);
        const refButton = document.querySelector(ARTWORK_BUTTON_REF_SELECTOR);

        if (!container) {
            dbg("未找到按钮容器:", ARTWORK_BUTTON_CONTAINER_SELECTOR);
            return;
        }

        if (!refButton) {
            dbg("未找到参考按钮:", ARTWORK_BUTTON_REF_SELECTOR);
        }

        if (document.getElementById("eagle-move-to-subfolder-btn")) {
            return;
        }

        const btn = createPixivStyledButton("更新系列漫画至序列文件夹");
        btn.id = "eagle-move-to-subfolder-btn";
        btn.style.marginLeft = "8px";
        btn.onclick = async () => {
            btn.textContent = "正在移动...";
            btn.style.pointerEvents = "none";
            await moveArtworkToSubfolder(artworkId);
            btn.textContent = "更新系列漫画至序列文件夹";
            btn.style.pointerEvents = "auto";
        };

        if (refButton) {
            container.insertBefore(btn, refButton);
        } else {
            container.appendChild(btn);
        }
        dbg('✅ 成功添加"移动到子文件夹"按钮');
    } catch (error) {
        err('❌ 添加"移动到子文件夹"按钮失败:', error);
    }
}
