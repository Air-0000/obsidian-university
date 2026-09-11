/**
 * image-inline-fold-patch.js
 * ===========================
 * 从 obsidian-excalidraw-plugin (v2.22.3) 提取的 base64 折叠技术方案。
 *
 * 核心 API (由 Excalidraw 的 foldExcalidrawSection 揭示):
 *   MarkdownView.currentMode.getFoldInfo()   -> { folds: [{from,to}], lines }
 *   MarkdownView.currentMode.applyFoldInfo()  -> 写入折叠状态
 *
 * Excalidraw 的做法:
 *   1. 把绘图数据放在 # Excalidraw Data / ## Drawing 等标题下
 *   2. 扫描行号找到每个标题位置
 *   3. getFoldInfo() 读取已有折叠, 追加新的 {from,to} 区间
 *   4. applyFoldInfo() 写入
 *   5. 在 onload / 视图切换时调用, 保持折叠
 *
 * 本补丁的改造:
 *   - 不依赖标题, 直接逐行正则匹配 data:...;base64, 模式
 *   - 对含 base64 的每一行做 {from:line, to:line} 单行折叠
 *   - 用 setInterval(300ms) 定时重折叠, 彻底锁死手动展开
 *   - 作用于所有 .md 文件, 不只是 .excalidraw
 *
 * 使用方式:
 *   将 inject-fold-lock.js 追加到 main.js 末尾:
 *     cat inject-fold-lock.js >> main.js
 *   重启 Obsidian 生效
 */

// ============================================================
// 通用函数: 折叠含 base64 的行
// ============================================================
// 参数: view - obsidian.MarkdownView 实例
//
// 逻辑:
//   1. getFoldInfo() 读当前折叠状态(保留用户对其他段落的折叠)
//   2. 逐行扫描, 正则匹配 data:...;base64,
//   3. 对匹配行构造 {from:line, to:line} 折叠区间
//   4. applyFoldInfo() 应用折叠

function foldBase64Lines(view) {
    const MarkdownView = view.constructor;
    if (!(view instanceof MarkdownView)) return;

    const info = view.currentMode.getFoldInfo();
    const existing = (info && info.folds) ? info.folds : [];
    const total = view.editor.lineCount();

    // 收集已有折叠, 用于去重
    const foldSet = {};
    for (let i = 0; i < existing.length; i++) {
        foldSet[existing[i].from + ":" + existing[i].to] = true;
    }

    // 逐行扫描 base64 数据 URI
    const newFolds = [];
    for (let line = 0; line < total; line++) {
        const text = view.editor.getLine(line);
        // 匹配: data:image/png;base64,  data:image/svg+xml;base64, 等
        if (/data:[^;]+;base64,/.test(text)) {
            const key = line + ":" + line;
            if (!foldSet[key]) {
                newFolds.push({ from: line, to: line });
                foldSet[key] = true;
            }
        }
    }

    if (newFolds.length > 0 || existing.length > 0) {
        view.currentMode.applyFoldInfo({
            folds: existing.concat(newFolds),
            lines: total
        });
    }
}

// ============================================================
// 定时扫描 + 锁死折叠
// ============================================================
// 300ms 间隔遍历所有打开的 .md 文件, 对其中的 base64 行强制折叠。
// 即使手动点击展开, 也会在 300ms 内被收回。

const FOLD_LOCK_INTERVAL_MS = 300;

function startBase64FoldLock(app, plugin) {
    setInterval(() => {
        try {
            if (!plugin || !app || !plugin.isReady) return;
            const leaves = app.workspace.getLeavesOfType("markdown");
            for (const leaf of leaves) {
                const view = leaf.view;
                if (!view || !view.file) continue;
                if (view.file.extension === "md") {
                    foldBase64Lines(view);
                }
            }
        } catch (e) {
            // 静默吞错, 避免干扰 Obsidian 正常运行
        }
    }, FOLD_LOCK_INTERVAL_MS);
}

// ============================================================
// 按标题折叠版 (保留, 供需要结构化折叠的场景使用)
// ============================================================
// Excalidraw 原始方案: 按 # 标题段落折叠

function foldSectionsUnderHeadings(view, headingTexts) {
    const MarkdownView = view.constructor;
    if (!(view instanceof MarkdownView)) return;

    const markers = headingTexts.map(h => ({ text: h, line: -1 }));
    const info = view.currentMode.getFoldInfo();
    const existing = (info && info.folds) ? info.folds : [];
    const total = view.editor.lineCount();

    for (let i = 0; i < total; i++) {
        const lineText = view.editor.getLine(i);
        for (const m of markers) {
            if (m.line === -1 && lineText === m.text) m.line = i;
        }
        if (markers.every(m => m.line !== -1)) break;
    }

    const found = markers.filter(m => m.line !== -1);
    if (found.length === 0) return;
    found.sort((a, b) => a.line - b.line);

    const folds = [...existing];
    for (let i = 0; i < found.length - 1; i++) {
        folds.push({ from: found[i].line, to: found[i + 1].line - 1 });
    }
    const last = found[found.length - 1];
    folds.push({ from: last.line, to: total - 1 });

    view.currentMode.applyFoldInfo({ folds, lines: total });
}

// ============================================================
// 导出
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        foldBase64Lines,
        foldSectionsUnderHeadings,
        startBase64FoldLock,
        FOLD_LOCK_INTERVAL_MS
    };
}
