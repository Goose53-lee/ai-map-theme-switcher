#!/bin/bash
# run_switch.sh
# ai-map-theme-switcher 统一引擎调度脚本
# 特性：原始备份防覆写保护 + 幂等文档激活 + 幂等早停防反转 + 单次合并会话防重复开关

set -o pipefail

TARGET_THEME="$1"
AI_FILE="$2"
FORCE_FLAG="$3"

if [ -z "$TARGET_THEME" ]; then
    TARGET_THEME="auto"
fi

# 支持将 --force 作为第2或第3参数
if [ "$AI_FILE" = "--force" ]; then
    FORCE_FLAG="--force"
    AI_FILE=""
fi

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. 校验目标文件并执行原始备份防覆写保护
if [ -n "$AI_FILE" ]; then
    if [ ! -f "$AI_FILE" ]; then
        echo "❌ 错误: 传入的文件不存在: $AI_FILE"
        exit 1
    fi

    TARGET_ABS_PATH="$(cd "$(dirname "$AI_FILE")" && pwd)/$(basename "$AI_FILE")"
    EXT="${TARGET_ABS_PATH##*.}"
    BASE="${TARGET_ABS_PATH%.*}"
    BACKUP_FILE="${BASE}_备份.${EXT}"

    if [ ! -f "$BACKUP_FILE" ]; then
        echo "📦 正在创建原始前置备份..."
        cp "$TARGET_ABS_PATH" "$BACKUP_FILE"
        echo "✅ 已生成原始备份: $BACKUP_FILE"
    else
        echo "🛡️ 检测到原始备份已存在，保留原稿不覆写: $BACKUP_FILE"
    fi
else
    TARGET_ABS_PATH="current"
fi

# 简单文件锁：防止并发重入或同一时刻重复拉起脚本
LOCK_DIR="/tmp/ai_map_theme_switcher.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    LOCK_PID=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
    if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
        echo "❌ 错误: 已有换色任务正在执行中 (PID: $LOCK_PID)，请勿重复并发触发。"
        exit 1
    else
        rm -rf "$LOCK_DIR"
        mkdir "$LOCK_DIR" 2>/dev/null || true
    fi
fi
echo "$$" > "$LOCK_DIR/pid" 2>/dev/null || true
trap 'rm -rf "$LOCK_DIR"' EXIT

# 转义路径中的双引号和反斜杠，供 AppleScript/ExtendScript 使用
ESCAPED_PATH=$(printf '%s' "$TARGET_ABS_PATH" | sed 's/\\/\\\\/g; s/"/\\"/g')

# 2. 合并会话：一次性完成激活文档、探测主题、必要时换色及审计保存（单次 osascript 会话防反复开关）
echo "📂 步骤 1/3: 激活目标文档并探测当前主题..."
PREPARE_RES=$(osascript -e "with timeout of 600 seconds
tell application \"Adobe Illustrator\"
    do javascript (file \"$SCRIPTS_DIR/palette_constants.jsx\")
    do javascript \"$.global.MAP_TARGET_FILE = \\\"$ESCAPED_PATH\\\";\"
    set ensureRes to do javascript (file \"$SCRIPTS_DIR/ensure_document.jsx\")
    if ensureRes contains \"\\\"status\\\":\\\"error\\\"\" then
        return \"ENSURE_ERR::\" & ensureRes
    end if
    set detectRes to do javascript (file \"$SCRIPTS_DIR/detect_current_theme.jsx\")
    return ensureRes & \"||\" & detectRes
end tell
end timeout")

if [ $? -ne 0 ]; then
    echo "❌ Illustrator 脚本执行异常: $PREPARE_RES"
    exit 1
fi

if printf '%s' "$PREPARE_RES" | grep -q '^ENSURE_ERR::'; then
    echo "❌ 文档激活失败: ${PREPARE_RES#ENSURE_ERR::}"
    exit 1
fi

ENSURE_RES="${PREPARE_RES%%||*}"
DETECT_RES="${PREPARE_RES#*||}"
echo "文档状态回执: $ENSURE_RES"
echo "主题探测回执: $DETECT_RES"

CURRENT_THEME=$(printf '%s' "$DETECT_RES" | grep -o '"current_theme":"[^"]*' | cut -d'"' -f4)
CONFIDENCE_NUM=$(printf '%s' "$DETECT_RES" | grep -o '"confidence_num":[0-9.]*' | cut -d':' -f2)
RECOMMEND=$(printf '%s' "$DETECT_RES" | grep -o '"recommend_target":"[^"]*' | cut -d'"' -f4)

# 解析 auto 目标主题（unknown/mixed 默认切换为 dark）
if [ "$TARGET_THEME" = "auto" ]; then
    if [ -n "$RECOMMEND" ]; then
        TARGET_THEME="$RECOMMEND"
    else
        TARGET_THEME="dark"
    fi
    echo "🎯 自动推荐目标主题: $TARGET_THEME (当前探测: ${CURRENT_THEME:-unknown})"
fi

# 幂等早停：若明确指定主题且文档已高置信度处于该主题（>= 90%），未传 --force 时避免无效重复开关与反复涂抹
if [ "$FORCE_FLAG" != "--force" ] && [ "$CURRENT_THEME" = "$TARGET_THEME" ]; then
    IS_HIGH_CONF=$(awk -v c="${CONFIDENCE_NUM:-0}" 'BEGIN { print (c >= 90) ? "1" : "0" }')
    if [ "$IS_HIGH_CONF" = "1" ]; then
        echo "✅ 幂等早停：当前文档已处于 ${TARGET_THEME} 主题（置信度 ${CONFIDENCE_NUM}%），无需重复切换。（如需强制重扫可附加 --force 参数）"
        exit 0
    fi
fi

echo "🎨 步骤 2/3 & 3/3: 单次会话执行全量视觉换色、审计与无损保存 (目标: $TARGET_THEME)..."
EXEC_RES=$(osascript -e "with timeout of 600 seconds
tell application \"Adobe Illustrator\"
    do javascript (file \"$SCRIPTS_DIR/palette_constants.jsx\")
    do javascript \"$.global.MAP_TARGET_THEME = \\\"$TARGET_THEME\\\";\"
    set swRes to do javascript (file \"$SCRIPTS_DIR/unified_theme_switch.jsx\")
    set vfRes to do javascript (file \"$SCRIPTS_DIR/verify_and_save.jsx\")
    return swRes & \"||\" & vfRes
end tell
end timeout")

if [ $? -ne 0 ]; then
    echo "❌ 换色或保存执行异常: $EXEC_RES"
    exit 1
fi

SWITCH_RES="${EXEC_RES%%||*}"
VERIFY_RES="${EXEC_RES#*||}"
echo "统一切换回执: $SWITCH_RES"
echo "审计与落盘回执: $VERIFY_RES"

RESIDUAL=$(printf '%s' "$VERIFY_RES" | grep -o '"residual_count":[0-9]*' | cut -d':' -f2)
SAVED=$(printf '%s' "$VERIFY_RES" | grep -o '"saved":true')

if [ -n "$RESIDUAL" ] && [ "$RESIDUAL" -gt 0 ]; then
    echo "⚠️ 注意：检测到 ${RESIDUAL} 个非标/边缘图元可能需要人工复核（请勿盲目重复开关文件重试）。"
fi

if [ -n "$SAVED" ]; then
    echo "🎉 换色与无损保存已完成！"
else
    echo "⚠️ 换色已执行，但保存返回非 true，请检查 Illustrator 文档权限或弹窗状态。"
fi
