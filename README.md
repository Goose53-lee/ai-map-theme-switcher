# ai-map-theme-switcher

Adobe Illustrator 矢量地图双向深浅色主题极速切换 Skill（支持直接通过 Git 仓库安装到 NewMax / Claude Code）。

## 一键安装为 NewMax Skill

在 NewMax 对话中直接发送仓库地址并要求安装：

> 安装这个 Skill：https://github.com/Goose53-lee/ai-map-theme-switcher

或手动克隆到全局 Skill 目录：

```bash
git clone https://github.com/Goose53-lee/ai-map-theme-switcher.git ~/.newmax/skills/ai-map-theme-switcher
chmod +x ~/.newmax/skills/ai-map-theme-switcher/scripts/run_switch.sh
```

## 仓库结构（标准 Skill 布局）

```text
ai-map-theme-switcher/
├── SKILL.md                       # Skill 元数据、触发词与执行规范
├── scripts/
│   ├── run_switch.sh              # 统一调度脚本（备份、文件锁、AppleScript 会话与幂等早停）
│   ├── palette_constants.jsx      # 调色板单例、跨色域归一化、自适应映射与三层 CAD 短路引擎
│   ├── ensure_document.jsx        # 物理路径标准化匹配并置顶激活
│   ├── detect_current_theme.jsx   # 全可见层视觉明度投票探测
│   ├── unified_theme_switch.jsx   # 单遍全层穿透与基于展示效果双向换色
│   └── verify_and_save.jsx        # 同口径残余审计与无损保存
├── references/
│   └── palette-spec.md            # 1109 对偶双向色彩映射表与不可变图元规则
├── LICENSE
└── README.md
```

## 运行环境

- macOS
- Adobe Illustrator（通过 AppleScript `do javascript` 调用 ExtendScript）

## 命令行单独调用

```bash
# 自动探测当前激活文档并切换为相反主题
./scripts/run_switch.sh auto

# 将指定浅色地图转为深色（自动创建 *_备份.ai）
./scripts/run_switch.sh dark "/path/to/map.ai"

# 强制重扫指定文件为浅色（跳过幂等早停）
./scripts/run_switch.sh light "/path/to/map.ai" --force
```
