---
name: ai-map-theme-switcher
description: >
  Adobe Illustrator 矢量地图双向深浅色主题极速切换工具（macOS AppleScript + ExtendScript）。
  支持浅色地图转深色、深色地图转浅色或自动探测当前主题反向切换，具备三层 CAD 路径零成本短路、
  全可见层穿透扫描、跨色域感知明度双向自适应换色、原始备份防覆写与防循环开关控制。
  当用户提到“把浅色地图改成深色”、“把 AI 地图改成浅色”、“AI 地图深浅色互换”、“浅色转深色”、
  “深色转浅色”、“根据深色样例修改浅色文件颜色”、“根据浅色规范还原深色地图”或“将当前打开的
  Illustrator 地图换色”时使用此技能。
license: MIT
compatibility: Requires macOS, Adobe Illustrator, and osascript (AppleScript + ExtendScript).
metadata:
  author: Goose53-lee
  version: "1.0.0"
---

# AI 矢量地图双向主题切换 (ai-map-theme-switcher)

**适用环境**：macOS（AppleScript + Adobe Illustrator ExtendScript）  
**设计基准**：3 万+ 复杂矢量路径（含数万条 CAD 工程线）3~5 秒级换色、0 几何形变、幂等防重入。

## 执行工作流

在当前 Skill 所在目录下调用脚本 `scripts/run_switch.sh`（路径相对于 `SKILL.md` 所在根目录；不同 Agent 的默认安装路径不同，例如 `~/.agents/skills/ai-map-theme-switcher/`、`~/.claude/skills/ai-map-theme-switcher/`、`~/.newmax/skills/ai-map-theme-switcher/` 或项目内 `.claude/skills/` / `.agents/skills/`，请以实际加载到的 Skill 根目录为准）：

```bash
# 格式: bash scripts/run_switch.sh <目标主题: dark|light|auto> [地图文件绝对路径] [--force]

# 1. 自动探测 Illustrator 当前打开文档并切换为相反主题
bash scripts/run_switch.sh auto

# 2. 将指定浅色地图转为深色
bash scripts/run_switch.sh dark "/path/to/your/map.ai"

# 3. 强制重扫指定文件为浅色（跳过幂等早停）
bash scripts/run_switch.sh light "/path/to/your/map.ai" --force
```

## 核心约束与防循环规范

1. **严禁循环开关与自动盲目重试**：
   - 单次任务**只调用一次** `scripts/run_switch.sh`，严禁在脚本返回后用 `open` / AppleScript `close` / 重开文件进行循环重试。
   - `scripts/ensure_document.jsx` 采用物理路径规范化匹配（兼容软链与 `/private/` 前缀），文档已打开时直接激活内存窗口，绝不重复打开。
   - 若文档高置信度（>= 90%）已处于目标主题，`scripts/run_switch.sh` 自动触发幂等早停（需强制重扫时传入 `--force`）。
2. **原始备份防覆写保护**：
   - 仅当 `${文件名}_备份.ai` 不存在时拷贝原稿生成备份；若备份已存在，严格保留原稿不被二次覆盖。
3. **三层 CAD 路径极速短路**：
   - **第一层**：容器名关键词（`cad/dwg/dxf/defpoints/track/agv/航道/作业线/工程/需求/参考/路径/route`）零成本跳过。
   - **第二层**：无命名/深层嵌套容器跨层首/中/尾分散采样（12 个样本），若 >= 75% 为无填充纯描边且属工程色或未闭合极细线（`<= 0.35pt`），整组 0ms 短路跳过。
   - **第三层**：散落单体 CAD 路径在主循环最前哨直接拦截（不读取 `visibleBounds`、不做明度计算）。
4. **统一全量扫描 + 基于展示效果切换**：
   - 从 `doc.layers` 递归穿透所有**可见**顶层图层、子图层、`GroupItem` 与 `CompoundPathItem`（跳过隐藏层/隐藏对象）。
   - 支持 `RGBColor`、`CMYKColor`、`GrayColor`、`SpotColor` 归一化为等效 RGB 与感知明度，并拍平父容器透明度算出真实展示透明度。
   - 优先精确命中 1109 标准色板，未命中的新增方块/非标色块根据相对画板面积与感知明度执行**双向自适应**（`dark` 压暗微透 75%，`light` 提亮恢复 100%）。
5. **严格色彩限定与单例复用**：只改 `fillColor`、`strokeColor`、`strokeWidth`、`opacity`，0 几何形变；全局复用预编译颜色单例，减少 GC 压力。

## 色彩规范与脚本架构

- 1109 对偶双向色彩映射规范与公共不可变图元规则：见 [references/palette-spec.md](references/palette-spec.md)
- 内部执行架构：
  1. `scripts/palette_constants.jsx`：共享单例调色板、跨色彩空间归一化、有效透明度算法、双向自适应映射与三层 CAD 短路引擎（`$.global.MAP_LIB`）。
  2. `scripts/ensure_document.jsx`：物理路径标准化匹配并置顶激活，防重复打开。
  3. `scripts/detect_current_theme.jsx`：全可见层视觉明度投票，无特征票返回 `unknown`。
  4. `scripts/unified_theme_switch.jsx`：单遍全层穿透 + 基于展示效果双向换色。
  5. `scripts/verify_and_save.jsx`：同口径跳过隐藏项与 CAD 容器审计残留，并执行无损 `doc.save()`。
