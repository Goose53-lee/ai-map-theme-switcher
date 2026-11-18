# ai-map-theme-switcher

Adobe Illustrator 矢量地图双向深浅色主题极速切换工具（NewMax Skill + 独立可执行脚本）。支持将浅色地图转深色、深色地图转浅色，或自动探测当前主题反向切换。具备三层 CAD 路径零成本短路、全可见层统一扫描、基于展示效果双向自适应换色、原始备份防覆写与防循环开关控制。

## 目录结构

```text
.
├── SKILL.md                       # NewMax Skill 定义与色彩规范说明
├── scripts/
│   ├── run_switch.sh              # 统一调度脚本（备份、锁、AppleScript 会话与幂等控制）
│   ├── palette_constants.jsx      # 共享调色板单例、跨色域归一化、自适应映射与三层 CAD 短路引擎
│   ├── ensure_document.jsx        # 物理路径标准化匹配并置顶激活，防止重复打开
│   ├── detect_current_theme.jsx   # 全可见层视觉明度投票探测当前主题
│   ├── unified_theme_switch.jsx   # 单遍全层穿透与基于展示效果双向换色
│   └── verify_and_save.jsx        # 同口径残余审计与无损保存
├── LICENSE
└── README.md
```

## 环境要求

- macOS
- Adobe Illustrator（通过 AppleScript `do javascript` 调用 ExtendScript）

## 快速使用

克隆仓库后可直接运行脚本：

```bash
git clone https://github.com/Goose53-lee/ai-map-theme-switcher.git
cd ai-map-theme-switcher
chmod +x scripts/run_switch.sh

# 1. 自动探测 Illustrator 当前激活文档并切换为相反主题
./scripts/run_switch.sh auto

# 2. 将指定浅色地图转为深色（会自动生成 *_备份.ai）
./scripts/run_switch.sh dark "/path/to/map.ai"

# 3. 强制重扫指定文件为浅色（跳过高置信度幂等早停）
./scripts/run_switch.sh light "/path/to/map.ai" --force
```

## 作为 NewMax Skill 安装

```bash
mkdir -p ~/.newmax/skills/ai-map-theme-switcher
cp -R SKILL.md scripts ~/.newmax/skills/ai-map-theme-switcher/
```

详细色彩映射表与内部设计说明见 [`SKILL.md`](./SKILL.md)。
