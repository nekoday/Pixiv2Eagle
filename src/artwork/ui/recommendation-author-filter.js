"use strict";

import {
    getFilterRecSameAuthor,
    getFilterRecSameAuthorMode,
} from "../../tampermonkey/setting.js";
import {
    REC_THUMBNAIL_LINK_SELECTOR,
    REC_USER_NAME_LINK_SELECTOR,
} from "../../config/selectors/index.js";
import {
    ensureBlurOverlay,
    removeBlurOverlay,
} from "../../shared/marking/rec-blur-overlay.js";

const OVERLAY_CLASS = "p2e-rec-author-blur-overlay";

/**
 * @param {HTMLElement} li
 */
export function clearFilterState(li) {
    if (!li || li.nodeType !== 1) return;
    li.style.display = "";
    removeBlurOverlay(li, OVERLAY_CLASS);
    if (li.dataset.p2eAuthorFilterPositionSet === "1") {
        li.style.position = "";
        delete li.dataset.p2eAuthorFilterPositionSet;
    }
    delete li.dataset.p2eAuthorFiltered;
    delete li.dataset.p2eAuthorFilterMode;
}

/**
 * @param {HTMLElement} li
 * @returns {{ pid: string, uid: string } | null}
 */
function extractPidAndUid(li) {
    const titleLink =
        li.querySelector(REC_THUMBNAIL_LINK_SELECTOR) ||
        li.querySelector('a[href*="/artworks/"]');
    if (!titleLink) return null;
    const pid = titleLink.getAttribute("href")?.match(/\/artworks\/(\d+)/)?.[1];
    if (!pid) return null;
    const artistLink =
        li.querySelector(REC_USER_NAME_LINK_SELECTOR) ||
        li.querySelector('a[href*="/users/"]');
    const uid = artistLink?.getAttribute("href")?.match(/\/users\/(\d+)/)?.[1];
    if (!uid) return null;
    return { pid, uid };
}

/**
 * @param {HTMLElement} li
 */
function applyRemoveMode(li) {
    li.style.display = "none";
    li.dataset.p2eAuthorFiltered = "1";
    li.dataset.p2eAuthorFilterMode = "remove";
}

/**
 * @param {HTMLElement} li
 */
function applyBlurMode(li) {
    ensureBlurOverlay(li, {
        overlayClass: OVERLAY_CLASS,
        positionDatasetKey: "p2eAuthorFilterPositionSet",
    });
    li.dataset.p2eAuthorFiltered = "1";
    li.dataset.p2eAuthorFilterMode = "blur";
}

/**
 * @param {HTMLElement} li
 * @param {{ currentPid?: string | null, currentPageArtistUid?: string | null }} context
 */
export function applyAuthorFilter(li, context) {
    const { currentPid = null, currentPageArtistUid = null } = context;

    if (!getFilterRecSameAuthor() || !currentPageArtistUid) {
        clearFilterState(li);
        return;
    }

    const info = extractPidAndUid(li);
    if (!info) {
        clearFilterState(li);
        return;
    }

    const { pid, uid } = info;

    if (currentPid && pid === currentPid) {
        clearFilterState(li);
        return;
    }

    if (uid !== currentPageArtistUid) {
        clearFilterState(li);
        return;
    }

    const mode = getFilterRecSameAuthorMode();
    if (li.dataset.p2eAuthorFiltered === "1" && li.dataset.p2eAuthorFilterMode === mode) {
        // dataset 与 DOM 可能不同步：clearSavedFilterState 会清空 display 但不改作者 dataset
        if (mode === "remove" && li.style.display !== "none") {
            applyRemoveMode(li);
        } else if (mode === "blur" && !li.querySelector(`.${OVERLAY_CLASS}`)) {
            applyBlurMode(li);
        }
        return;
    }

    clearFilterState(li);
    if (mode === "blur") {
        applyBlurMode(li);
    } else {
        applyRemoveMode(li);
    }
}

/**
 * @param {HTMLElement | null | undefined} zoneRoot
 * @param {{ currentPid?: string | null, currentPageArtistUid?: string | null }} context
 */
export function rescanZoneAuthorFilter(zoneRoot, context) {
    if (!zoneRoot) return;
    zoneRoot.querySelectorAll("li").forEach(clearFilterState);
    if (getFilterRecSameAuthor() && context.currentPageArtistUid) {
        zoneRoot.querySelectorAll("li").forEach((li) => applyAuthorFilter(li, context));
    }
}
