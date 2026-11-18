#target illustrator
// ensure_document.jsx
// 幂等式文档激活与加载：物理路径规范化匹配，彻底防止重复打开或反复开关同一个文件

(function() {
    function jsonEscape(str) {
        if (str === null || typeof str === "undefined") return "";
        return String(str).replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
    }

    function normalizePathStr(p) {
        if (!p) return "";
        var s = String(p).replace(/\/+$/, "");
        // macOS /private/var 或 /private/tmp 前缀兼容
        if (s.indexOf("/private/") === 0) {
            s = s.substring(8);
        }
        return s.toLowerCase();
    }

    function getResolvedFsPath(fileObj) {
        try {
            var resolved = fileObj.resolve();
            if (resolved && resolved.fsName) return normalizePathStr(resolved.fsName);
        } catch(e) {}
        try {
            return normalizePathStr(fileObj.fsName);
        } catch(e2) {}
        return "";
    }

    function ensureDocument(filePathStr) {
        if (!filePathStr || filePathStr === "" || filePathStr === "current") {
            if (app.documents.length === 0) {
                return '{"status":"error","message":"当前 Illustrator 没有打开任何文档，且未提供有效文件路径"}';
            }
            var cur = app.activeDocument;
            return '{"status":"ok","action":"use_active","doc_name":"' + jsonEscape(cur.name) + '","message":"直接使用当前正在编辑的活动文档"}';
        }

        var targetFile = new File(filePathStr);
        if (!targetFile.exists) {
            return '{"status":"error","message":"目标文件在磁盘上不存在: ' + jsonEscape(filePathStr) + '"}';
        }

        var targetNormPath = getResolvedFsPath(targetFile);
        var targetBaseName = String(targetFile.name || "").toLowerCase();
        var foundDoc = null;

        // 1. 遍历当前已打开的所有文档，优先通过物理规范路径匹配，其次通过文件名容错
        for (var i = 0; i < app.documents.length; i++) {
            var d = app.documents[i];
            try {
                if (d.fullName) {
                    var docNormPath = getResolvedFsPath(d.fullName);
                    if (docNormPath && docNormPath === targetNormPath) {
                        foundDoc = d;
                        break;
                    }
                }
            } catch(e) {}
        }

        // 若 fullName 因未保存/别名差异未匹配到，再用文件名比对（防止重复开启同名文档）
        if (!foundDoc) {
            for (var j = 0; j < app.documents.length; j++) {
                var d2 = app.documents[j];
                try {
                    if (String(d2.name || "").toLowerCase() === targetBaseName) {
                        foundDoc = d2;
                        break;
                    }
                } catch(e2) {}
            }
        }

        // 2. 如果已经打开，直接置顶激活，绝不关闭或二次从磁盘打开
        if (foundDoc) {
            app.activeDocument = foundDoc;
            return '{"status":"ok","action":"activated","doc_name":"' + jsonEscape(foundDoc.name) + '","message":"文档已在编辑中，已直接激活，未重复打开"}';
        }

        // 3. 如果尚未打开，由 Illustrator 引擎同步加载
        try {
            var newDoc = app.open(targetFile);
            app.activeDocument = newDoc;
            return '{"status":"ok","action":"opened","doc_name":"' + jsonEscape(newDoc.name) + '","message":"文档已安全同步加载"}';
        } catch(err) {
            return '{"status":"error","message":"打开文件失败: ' + jsonEscape(err.toString()) + '"}';
        }
    }

    if (typeof $.global.MAP_TARGET_FILE !== "undefined") {
        return ensureDocument($.global.MAP_TARGET_FILE);
    } else {
        return ensureDocument("current");
    }
})();
