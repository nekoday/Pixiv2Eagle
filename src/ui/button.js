"use strict";

/**
 * 创建 Pixiv 风格按钮
 * @param {string} text
 * @param {"default"|"primary"} [variant="default"]
 */
export function createPixivStyledButton(text, variant = "default") {
    const button = document.createElement("div");
    button.textContent = text;
    button.className = variant === "primary" ? "p2e-btn p2e-btn--primary" : "p2e-btn";
    return button;
}
