"use strict";

import {
    REC_ZONE_SELECTOR,
    REC_SIDEBAR_OTHER_WORKS_NAV,
    REC_THUMBNAIL_LINK_SELECTOR,
    REC_CONTAINER_FALLBACK_SELECTORS,
    REC_WORK_LINK_FALLBACK_SELECTORS,
} from "../../config/selectors/artwork.js";

/**
 * 在 root 内按作品链接收集推荐卡片 li。
 * @param {ParentNode} root
 * @param {{ requireArtistLink?: boolean }} [options]
 * @returns {HTMLElement[]}
 */
function collectLisFromArtworkLinks(root, { requireArtistLink = false } = {}) {
    const liSet = new Set();

    root.querySelectorAll('a[href*="/artworks/"]').forEach((link) => {
        const href = link.getAttribute("href") || "";
        if (!/\/artworks\/(\d+)/.test(href)) return;

        const li = link.closest("li");
        if (!li) return;
        if (requireArtistLink && !li.querySelector('a[href*="/users/"]')) return;

        liSet.add(li);
    });

    return Array.from(liSet);
}

function isLikelyRecGridItem(li) {
    const ul = li.closest("ul");
    if (!ul) return false;
    return ul.querySelectorAll(":scope > li").length >= 2;
}

function findRecommendationRootByHeading() {
    for (const h of document.querySelectorAll("h2, h3")) {
        const text = (h.textContent || "").trim();
        if (!/^(関連作品|関連イラスト|おすすめ|相关作品|相关插画|推荐作品|Recommended|Related)/i.test(text)) {
            continue;
        }

        const section = h.closest("section");
        if (section) return section;

        let el = h.parentElement;
        for (let i = 0; i < 5 && el; i++, el = el.parentElement) {
            if (el.querySelectorAll('a[href*="/artworks/"]').length >= 2) return el;
        }
    }
    return null;
}

function collectFromRoots(roots, options) {
    const liSet = new Set();
    for (const root of roots) {
        if (!root) continue;
        collectLisFromArtworkLinks(root, options).forEach((li) => liSet.add(li));
    }
    return Array.from(liSet);
}

function getRecommendationRoots() {
    const gtmZoneRoots = Array.from(document.querySelectorAll(REC_ZONE_SELECTOR));
    const containerRoots = Array.from(
        document.querySelectorAll(REC_CONTAINER_FALLBACK_SELECTORS.join(", "))
    );
    const headingRoot = findRecommendationRootByHeading();
    return [...gtmZoneRoots, ...containerRoots, ...(headingRoot ? [headingRoot] : [])];
}

/**
 * 收集推荐区作品 li（GTM/标题/哈希容器 → 作品链接 → aside/main fallback）。
 * @returns {HTMLElement[]}
 */
export function resolveRecommendationItems() {
    const roots = getRecommendationRoots();

    for (const requireArtistLink of [true, false]) {
        const items = collectFromRoots(roots, { requireArtistLink });
        if (items.length > 0) return items;
    }

    const workLinkSelectors = [REC_THUMBNAIL_LINK_SELECTOR, ...REC_WORK_LINK_FALLBACK_SELECTORS];
    const liSet = new Set();
    document.querySelectorAll(workLinkSelectors.join(", ")).forEach((link) => {
        const li = link.closest("li");
        if (li) liSet.add(li);
    });
    if (liSet.size > 0) return Array.from(liSet);

    const root =
        document.querySelector("aside") ||
        document.querySelector("main") ||
        document.body;
    return collectLisFromArtworkLinks(root).filter(isLikelyRecGridItem);
}

export function resolveRecRoots() {
    const roots = [];
    const gtmZoneUl = document.querySelector(REC_ZONE_SELECTOR);
    if (gtmZoneUl) roots.push(gtmZoneUl);
    const sidebarLink = document.querySelector(REC_SIDEBAR_OTHER_WORKS_NAV);
    const sidebarNav = sidebarLink?.closest("nav");
    if (sidebarNav) roots.push(sidebarNav);
    return roots;
}

/**
 * 等待推荐区作品 li 出现（轮询 resolver + MutationObserver）。
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<HTMLElement[]>}
 */
export function waitForRecommendationItems({ timeout = 10000 } = {}) {
    return new Promise((resolve) => {
        const tryResolve = () => {
            const items = resolveRecommendationItems();
            return items.length > 0 ? items : null;
        };

        const immediate = tryResolve();
        if (immediate) return resolve(immediate);

        const obs = new MutationObserver(() => {
            const items = tryResolve();
            if (items) {
                obs.disconnect();
                resolve(items);
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            obs.disconnect();
            resolve(tryResolve() || []);
        }, timeout);
    });
}
