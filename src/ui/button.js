"use strict";

// 创建 Pixiv 风格的按钮
export function createPixivStyledButton(text) {
    const button = document.createElement("div");
    button.textContent = text;
    button.style.cursor = "pointer";
    button.style.fontSize = "14px";
    button.style.padding = "8px 16px";
    button.style.borderRadius = "999px";
    button.style.color = "#333";
    button.style.backgroundColor = "transparent";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.gap = "4px";
    button.style.transition = "all 0.2s ease";
    button.style.border = "1px solid #d6d6d6";

    // 添加鼠标悬浮效果
    button.addEventListener("mouseenter", () => {
        button.style.backgroundColor = "#0096fa";
        button.style.color = "white";
        button.style.border = "1px solid #0096fa";
    });

    // 添加鼠标离开效果
    button.addEventListener("mouseleave", () => {
        button.style.backgroundColor = "transparent";
        button.style.color = "#333";
        button.style.border = "1px solid #d6d6d6";
    });

    // 添加点击效果
    button.addEventListener("mousedown", () => {
        button.style.backgroundColor = "#0075c5";
        button.style.border = "1px solid #0075c5";
    });

    button.addEventListener("mouseup", () => {
        button.style.backgroundColor = "#0096fa";
        button.style.border = "1px solid #0096fa";
    });

    return button;
}
