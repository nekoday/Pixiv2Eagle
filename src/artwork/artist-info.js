"use strict";

import { getFolderId } from "../Tampermonkey/setting.js";
import { err } from "../Tampermonkey/logger.js";
import { gmFetch } from "../Tampermonkey/request.js";
import { showMessage } from "../ui/toast.js";
import { PIXIV_ARTIST_DIV_CLASS } from "../config/constants.js";
import { checkEagle } from "../eagle/client.js";
import { findArtistFolder, getArtistMatcher } from "../eagle/artist.js";
import { getArtworkId } from "./id.js";

/**
 * @deprecated 通过 DOM 获取画师 UID 和用户名
 */
export function getArtistInfoFromDOM() {
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

export async function getArtistInfoFromArtwork(artworkId) {
    const artworkInfo = await gmFetch(`https://www.pixiv.net/ajax/illust/${artworkId}?lang=zh`, {
        headers: { referer: "https://www.pixiv.net/" },
        timeout: 10000,
    });
    if (artworkInfo && artworkInfo.body) {
        return {
            userId: artworkInfo.body.userId,
            userName: artworkInfo.body.userName,
        };
    }
    return null;
}

async function updateFolderNameInEagle(folderId, newName) {
    await gmFetch("http://localhost:41595/api/folder/update", {
        method: "POST",
        body: JSON.stringify({
            folderId: folderId,
            newName: newName,
        }),
    });
}

export async function openArtistFolderInEagle(artistInfo) {
    const folderId = getFolderId();

    const artistFolder = await findArtistFolder(folderId, artistInfo.userId);

    if (!artistFolder) {
        showMessage(`无法找到画师文件夹，请先保存作品。`, true);
        return;
    }

    const eagleUrl = `http://localhost:41595/folder?id=${artistFolder.id}`;
    window.location.href = eagleUrl;

    const artistMatcher = getArtistMatcher();
    const targetFolderName = artistMatcher.generate(artistInfo.userId, artistInfo.userName);

    if (artistFolder.name !== targetFolderName) {
        updateFolderNameInEagle(artistFolder.id, targetFolderName);
    }
}

export async function openArtistFolderFromArtworkPage() {
    const eagleStatus = await checkEagle();
    if (!eagleStatus.running) {
        showMessage("Eagle 未启动，请先启动 Eagle 应用！", true);
        return;
    }

    const artworkId = getArtworkId();
    const artistInfo = await getArtistInfoFromArtwork(artworkId);
    if (!artistInfo) {
        showMessage("无法获取画师信息", true);
        return;
    }

    try {
        await openArtistFolderInEagle(artistInfo);
    } catch (error) {
        err(error);
        showMessage(`打开画师文件夹失败: ${error.message}`, true);
    }
}
