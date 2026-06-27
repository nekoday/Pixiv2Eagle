"use strict";

const BADGE_CLASS = "eagle-saved-badge";

/**
 * 在容器左下角插入「已保存」✅ 徽章
 * @param {HTMLElement} container
 * @param {object} [options]
 * @param {string} [options.zIndex='10']
 * @param {string} [options.fontSize='14px']
 * @param {string} [options.padding='2px 4px']
 * @param {boolean} [options.large=false] 画师列表大号样式（flex + min 尺寸）
 * @param {boolean} [options.markContainer=false] 设置 container.dataset.eagleSaved
 * @param {boolean} [options.ensureOverflowVisible=false]
 * @returns {boolean} 是否视为已标记（含已存在徽章）
 */
export function insertSavedBadge(container, options = {}) {
    if (!container) return false;

    const {
        zIndex = "10",
        fontSize = "14px",
        padding = "2px 4px",
        large = false,
        markContainer = false,
        ensureOverflowVisible = false,
    } = options;

    if (markContainer) {
        if (container.dataset.eagleSaved === "1") return false;
    } else if (container.querySelector(`.${BADGE_CLASS}`)) {
        return true;
    }

    try {
        const cs = window.getComputedStyle(container);
        if (!cs || cs.position === "static") {
            container.style.position = "relative";
        }
        if (ensureOverflowVisible && container.style.overflow !== "visible") {
            container.style.overflow = "visible";
        }
    } catch (e) {
        // ignore
    }

    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.textContent = "✅";
    badge.setAttribute("aria-hidden", "true");
    badge.style.position = "absolute";
    badge.style.left = "6px";
    badge.style.bottom = "6px";
    badge.style.zIndex = zIndex;
    badge.style.fontSize = fontSize;
    badge.style.lineHeight = "1";
    badge.style.pointerEvents = "none";
    badge.style.backgroundColor = "rgba(255,255,255,0.95)";
    badge.style.padding = padding;
    badge.style.borderRadius = "4px";
    badge.style.fontWeight = "bold";

    if (large) {
        badge.style.display = "flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        badge.style.minWidth = "24px";
        badge.style.minHeight = "24px";
    }

    container.appendChild(badge);

    if (markContainer) {
        container.dataset.eagleSaved = "1";
    }

    return true;
}
