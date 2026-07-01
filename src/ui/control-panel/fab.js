"use strict";

const FAB_GM_KEY = "fabPosition";
const FAB_SIZE = 48;
const COLLAPSED_WIDTH = 24;
const EDGE_THRESHOLD = 16;
const DRAG_THRESHOLD = 5;

const DEFAULT_POSITION = {
    x: () => window.innerWidth - 56,
    y: () => window.innerHeight - 120,
    collapsed: false,
};

/**
 * @returns {{ x: number, y: number, edge?: string, collapsed?: boolean }}
 */
function loadFabPosition() {
    const saved = GM_getValue(FAB_GM_KEY, null);
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
        return saved;
    }
    return {
        x: DEFAULT_POSITION.x(),
        y: DEFAULT_POSITION.y(),
        collapsed: false,
    };
}

function saveFabPosition(pos) {
    GM_setValue(FAB_GM_KEY, pos);
}

function clampPosition(pos) {
    const maxX = window.innerWidth - (pos.collapsed ? COLLAPSED_WIDTH : FAB_SIZE);
    const maxY = window.innerHeight - (pos.collapsed ? 64 : FAB_SIZE);
    return {
        ...pos,
        x: Math.max(0, Math.min(pos.x, maxX)),
        y: Math.max(0, Math.min(pos.y, maxY)),
    };
}

function snapToEdge(pos) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const distLeft = pos.x;
    const distRight = w - pos.x - (pos.collapsed ? COLLAPSED_WIDTH : FAB_SIZE);
    const distTop = pos.y;
    const distBottom = h - pos.y - (pos.collapsed ? 64 : FAB_SIZE);
    const min = Math.min(distLeft, distRight, distTop, distBottom);
    if (min > EDGE_THRESHOLD) {
        return { ...pos, edge: undefined };
    }
    if (min === distLeft) return { ...pos, x: 0, edge: "left" };
    if (min === distRight) return { ...pos, x: w - (pos.collapsed ? COLLAPSED_WIDTH : FAB_SIZE), edge: "right" };
    if (min === distTop) return { ...pos, y: 0, edge: "top" };
    return { ...pos, y: h - (pos.collapsed ? 64 : FAB_SIZE), edge: "bottom" };
}

function applyFabStyle(fab, pos) {
    fab.style.left = `${pos.x}px`;
    fab.style.top = `${pos.y}px`;
    fab.classList.toggle("p2e-control-fab--collapsed", !!pos.collapsed);
    fab.textContent = pos.collapsed ? "P2E" : "⚙️";
}

/**
 * @param {{ onTogglePanel: () => void }} options
 * @returns {{ destroy: () => void }}
 */
export function mountFab({ onTogglePanel }) {
    let pos = clampPosition(loadFabPosition());
    let dragging = false;
    let dragMoved = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    const fab = document.createElement("button");
    fab.id = "p2e-control-fab";
    fab.type = "button";
    fab.title = "Re_Pixiv2Eagle 控制面板";
    applyFabStyle(fab, pos);
    document.body.appendChild(fab);

    function onResize() {
        if (pos.edge === "right") {
            pos.x = window.innerWidth - (pos.collapsed ? COLLAPSED_WIDTH : FAB_SIZE);
        } else if (pos.edge === "bottom") {
            pos.y = window.innerHeight - (pos.collapsed ? 64 : FAB_SIZE);
        }
        pos = clampPosition(pos);
        applyFabStyle(fab, pos);
    }

    fab.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        dragging = true;
        dragMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        originX = pos.x;
        originY = pos.y;
        fab.setPointerCapture(e.pointerId);
    });

    fab.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            dragMoved = true;
        }
        pos.x = originX + dx;
        pos.y = originY + dy;
        pos = clampPosition(pos);
        applyFabStyle(fab, pos);
    });

    fab.addEventListener("pointerup", () => {
        if (!dragging) return;
        dragging = false;
        if (dragMoved) {
            pos = snapToEdge(pos);
            pos = clampPosition(pos);
            applyFabStyle(fab, pos);
            saveFabPosition(pos);
        }
    });

    fab.addEventListener("click", (e) => {
        if (dragMoved) {
            e.preventDefault();
            dragMoved = false;
            return;
        }
        if (pos.collapsed) {
            pos.collapsed = false;
            pos = clampPosition(pos);
            applyFabStyle(fab, pos);
            saveFabPosition(pos);
            return;
        }
        onTogglePanel();
    });

    fab.addEventListener("dblclick", (e) => {
        e.preventDefault();
        pos.collapsed = !pos.collapsed;
        if (pos.collapsed && !pos.edge) {
            pos = snapToEdge(pos);
        }
        pos = clampPosition(pos);
        applyFabStyle(fab, pos);
        saveFabPosition(pos);
    });

    window.addEventListener("resize", onResize);

    return {
        destroy() {
            window.removeEventListener("resize", onResize);
            if (fab.parentNode) fab.parentNode.removeChild(fab);
        },
    };
}
