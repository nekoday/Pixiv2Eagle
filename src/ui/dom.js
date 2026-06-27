"use strict";

// 等待目标 section 元素加载
export function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
        // 首先检查元素是否已经存在
        const element = document.querySelector(selector);
        if (element) {
            return resolve(element);
        }

        // 如果元素不存在，设置观察器
        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // 超时
        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

export function waitForSectionWithin(parent, timeout = 10000) {
    const getFirstSection = () => {
        const children = parent.children ? Array.from(parent.children) : [];
        const directChild = children.find((child) => child.tagName && child.tagName.toLowerCase() === "section");
        if (directChild) {
            return directChild;
        }
        return parent.querySelector("section");
    };

    const existing = getFirstSection();
    if (existing) {
        return Promise.resolve(existing);
    }

    return new Promise((resolve) => {
        const observer = new MutationObserver((mutations, obs) => {
            const section = getFirstSection();
            if (section) {
                obs.disconnect();
                resolve(section);
            }
        });

        observer.observe(parent, {
            childList: true,
            subtree: true,
        });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}
