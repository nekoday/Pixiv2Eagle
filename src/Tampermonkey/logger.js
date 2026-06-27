"use strict";

import { getDebugMode } from "./setting.js";

export function dbg(msg, ...args) {
    if (getDebugMode()) console.log("[Pixiv2Eagle]", msg, ...args);
}

export function warn(msg, ...args) {
    console.warn("[Pixiv2Eagle]", msg, ...args);
}

export function err(msg, ...args) {
    console.error("[Pixiv2Eagle]", msg, ...args);
}
