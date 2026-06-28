"use strict";

export const STORAGE_KEYS = Object.freeze({
    EAGLE_INDEX: "eagleIndex",
});

export function loadEagleIndexCache() {
    return GM_getValue(STORAGE_KEYS.EAGLE_INDEX, null);
}

export function saveEagleIndexCache(payload) {
    GM_setValue(STORAGE_KEYS.EAGLE_INDEX, payload);
}

export function clearEagleIndexCache() {
    GM_setValue(STORAGE_KEYS.EAGLE_INDEX, null);
}
