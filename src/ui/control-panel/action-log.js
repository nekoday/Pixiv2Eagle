"use strict";

const MAX_ENTRIES = 5;

/** @type {Array<{ time: Date, label: string, status: "success"|"error"|"pending", message?: string }>} */
let entries = [];

/** @type {Set<() => void>} */
const listeners = new Set();

let mountedListEl = null;

function notify() {
    for (const fn of listeners) {
        fn();
    }
    if (mountedListEl) {
        renderList(mountedListEl);
    }
}

/**
 * @param {{ label: string, status: "success"|"error"|"pending", message?: string }} entry
 */
export function pushAction(entry) {
    entries.unshift({
        time: new Date(),
        label: entry.label,
        status: entry.status,
        message: entry.message,
    });
    if (entries.length > MAX_ENTRIES) {
        entries.length = MAX_ENTRIES;
    }
    notify();
}

/**
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribeActionLog(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** @returns {typeof entries} */
export function getActionEntries() {
    return entries.slice();
}

function renderList(container) {
    container.textContent = "";
    if (entries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "p2e-action-log__empty";
        empty.textContent = "暂无操作记录";
        container.appendChild(empty);
        return;
    }
    for (const item of entries) {
        const row = document.createElement("div");
        row.className = `p2e-action-log__item p2e-action-log__item--${item.status}`;
        const timeStr = item.time.toLocaleTimeString();
        const icon = item.status === "success" ? "✓" : item.status === "error" ? "✗" : "…";
        row.textContent = `[${timeStr}] ${icon} ${item.label}${item.message ? `: ${item.message}` : ""}`;
        container.appendChild(row);
    }
}

/**
 * @param {HTMLElement} container
 */
export function mountActionLog(container) {
    mountedListEl = container;
    renderList(container);
}
