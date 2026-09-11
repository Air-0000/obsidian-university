/**
 * 注入到 main.js 末尾
 * 
 * 从 Excalidraw 学到的:
 *   view.ViewPlugin.fromClass() → CM6 ViewPlugin
 *   view.Decoration.replace({widget}) → 用 widget 替换文本, 显示 "..."
 * 
 * widget 对象实现 CM6 要求的全部方法:
 *   toDOM, eq, destroy, coordsAt, compare, updateDOM, ignoreEvent
 */

(function(){
    "use strict";

    // 匹配 data:...;base64,... 以及 Excalidraw 压缩的 base64 数据
    var base64Re = /data:[^;]+;base64,[A-Za-z0-9+/=]{20,}/g;

    // CM6 兼容 widget: 显示 "..."
    var ellipsisWidget = {
        _id: "base64-fold-widget-v1",
        toDOM: function() {
            var span = document.createElement("span");
            span.className = "cm-base64-fold";
            span.setAttribute("aria-label", "base64 data hidden");
            span.textContent = "...";
            span.style.color = "var(--text-faint)";
            span.style.cursor = "default";
            span.style.userSelect = "none";
            return span;
        },
        eq: function(other) {
            return other && other._id === this._id;
        },
        compare: function(other) {
            return other && other._id === this._id ? 0 : 1;
        },
        destroy: function(dom) {},
        updateDOM: function(dom, view) { return false; },
        ignoreEvent: function(event) { return false; },
        coordsAt: function(dom, pos, side) {
            // 确保光标经过 widget 时坐标正确
            var rect = dom.getBoundingClientRect();
            if (pos <= 0 || side < 0) {
                return { left: rect.left, right: rect.left, top: rect.top, bottom: rect.bottom };
            }
            return { left: rect.right, right: rect.right, top: rect.top, bottom: rect.bottom };
        },
        get estimatedHeight() { return 20; }
    };

    function buildDecorations(editorView) {
        var widgets = [];
        var text = editorView.state.doc.toString();
        var match;
        base64Re.lastIndex = 0;
        while ((match = base64Re.exec(text)) !== null) {
            var from = match.index;
            var to = match.index + match[0].length;
            widgets.push(
                view.Decoration.replace({ widget: ellipsisWidget }).range(from, to)
            );
        }
        // 降序排列, 避免 position 偏移
        widgets.sort(function(a, b) { return b.from - a.from; });
        return view.Decoration.set(widgets, true);
    }

    function Base64Hider(editorView) {
        this.decorations = buildDecorations(editorView);
    }
    Base64Hider.prototype.update = function(update) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = buildDecorations(update.view);
        }
    };
    Base64Hider.prototype.destroy = function() {};

    var hideBase64Plugin = view.ViewPlugin.fromClass(
        Base64Hider,
        { decorations: function(v) { return v.decorations; } }
    );

    // 等待 EXCALIDRAW_PLUGIN 就绪后注册
    var attempts = 0, maxAttempts = 30;
    var initTimer = setInterval(function(){
        attempts++;
        try {
            var p = EXCALIDRAW_PLUGIN;
            if (!p || !p.app || !p.isReady) {
                if (attempts >= maxAttempts) clearInterval(initTimer);
                return;
            }
            clearInterval(initTimer);
            p.registerEditorExtension(hideBase64Plugin);
        } catch(e) {
            if (attempts >= maxAttempts) clearInterval(initTimer);
        }
    }, 500);

})();
