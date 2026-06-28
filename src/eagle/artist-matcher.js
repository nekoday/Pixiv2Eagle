"use strict";

import { SETTING_KEYS, SETTING_DEFAULTS } from "../Tampermonkey/setting.js";

class ArtistMatcher {
    constructor(template) {
        this.template = template;
        this.regex = this.createRegex(template);
    }

    /**
     * 根据模板创建正则表达式
     * @param {string} template - 模板字符串，如 "$uid_$name" 或 "pid = $uid"
     * @returns {RegExp} 生成的正则表达式
     */
    createRegex(template) {
        // 转义正则表达式特殊字符，但保留占位符
        let regexStr = template
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // 转义特殊字符
            .replace(/\\\$uid/g, "(\\d+)") // $uid 匹配数字
            .replace(/\\\$name/g, "(.+?)"); // $name 匹配任意字符（非贪婪）

        return new RegExp(`^${regexStr}$`);
    }

    /**
     * 检测字符串是否匹配指定的画师（仅比较 uid）
     * @param {string} str - 待检测的字符串
     * @param {number|string} uid - 画师 ID
     * @returns {boolean} 是否匹配
     */
    match(str, uid) {
        const extracted = this.extract(str);
        if (!extracted || !extracted.uid) {
            return false;
        }
        return extracted.uid.toString() === uid.toString();
    }

    /**
     * 从字符串中提取画师信息
     * @param {string} str - 待解析的字符串
     * @returns {Object|null} 包含 uid 和 name 的对象，如果不匹配则返回 null
     */
    extract(str) {
        const match = str.match(this.regex);
        if (!match) {
            return null;
        }

        const result = {};
        const uidMatch = this.template.match(/\$uid/g);
        const nameMatch = this.template.match(/\$name/g);

        let groupIndex = 1;

        // 按照模板中的顺序提取字段
        if (this.template.indexOf("$uid") < this.template.indexOf("$name")) {
            if (uidMatch) result.uid = match[groupIndex++];
            if (nameMatch) result.name = match[groupIndex++];
        } else {
            if (nameMatch) result.name = match[groupIndex++];
            if (uidMatch) result.uid = match[groupIndex++];
        }

        return result;
    }

    /**
     * 使用指定字段生成对应的字符串
     * @param {number|string} uid - 画师ID
     * @param {string} name - 画师名称
     * @returns {string} 根据模板生成的字符串
     */
    generate(uid, name) {
        return this.template.replace(/\$uid/g, uid).replace(/\$name/g, name);
    }

    /**
     * 更新模板
     * @param {string} newTemplate - 新的模板字符串
     */
    updateTemplate(newTemplate) {
        this.template = newTemplate;
        this.regex = this.createRegex(newTemplate);
    }
}

// 设置画师文件夹匹配模板串
export function setArtistMatcher() {
    const template = prompt(
        "请输入画师文件夹匹配模板，$uid 为画师 ID，$name 为画师名称。\n默认值：$name",
        GM_getValue(SETTING_KEYS.FOLDER_NAME_TEMPLATE, SETTING_DEFAULTS[SETTING_KEYS.FOLDER_NAME_TEMPLATE])
    );
    if (template === null) return;
    GM_setValue(SETTING_KEYS.FOLDER_NAME_TEMPLATE, template);
    alert(`✅ 模板字符串已设置为 ${template}`);
}

// 根据用户模板串创建 ArtistMatcher 实例
export function getArtistMatcher() {
    return new ArtistMatcher(
        GM_getValue(SETTING_KEYS.FOLDER_NAME_TEMPLATE, SETTING_DEFAULTS[SETTING_KEYS.FOLDER_NAME_TEMPLATE])
    );
}
