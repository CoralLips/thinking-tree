[English](README.md) | [中文](README.zh-CN.md)

# thinking-tree

代码有 git，思考有什么？

AI 让问题更严重——每次对话产出的洞察是以前的 5 倍，但保存下来的还是零。最好的想法在对话结束时消失。thinking-tree 是一个 Claude Code 插件，在它们消失之前抓住它们。

**碎片在工作中自然积累：**

![Pool 视图 — 跨 session 捕获的碎片](assets/viewer-pool.png)

**逐渐结晶为结构化的思路体系：**

![Thoughts 视图 — 带图表和结构的体系化思考](assets/viewer-thoughts.png)

## 安装

在 Claude Code 终端中：

```bash
# 1. 添加 marketplace（仅需一次）
/plugin marketplace add github:CoralLips/thinking-tree

# 2. 安装插件
/plugin install thinking-tree

# 3. 开启记录
/think
```

就这样。正常工作即可——thinking-tree 会评估每轮对话，保存值得留下的洞察。

## 工作原理

1. **你正常工作** — 写代码、讨论、调试
2. **AI 评估每轮对话** — 这里有独立的洞察吗？
3. **值得记录 → 保存**为碎片或问题，存入 `~/.thinking-tree/`
4. **下次会话** — 近期碎片和未解问题自动注入上下文
5. **随时查看** — Web 查看器在 `http://localhost:3456`

每轮对话结束时会显示状态：
- `📝 标题` — 记录了碎片或问题
- `🌳` — 已检查，无需记录

## 四个空间

```
~/.thinking-tree/
├── *.md            思路 — 有主线的结晶态理解
├── fragments.md    碎片 — 独立的洞察，尚未归位
├── questions.md    问题 — 有方向的明确未知
└── todos.md        行动 — 从思考中衍生的可执行项
```

碎片积累 → 提炼成思路文件 → 问题浮现 → 答案回流。

## 命令

| 命令 | 功能 |
|------|------|
| `/think` | 开关记录模式（立即生效） |
| `/reduce` | 交互式整理 — 去重、分类、清理过时碎片 |
| `/catch` | 手动补捕遗漏的洞察 — 用自然语言描述要找什么 |
| `/pref` | 用自然语言调整记录偏好 |

## Web 查看器

会话开始时自动启动，访问 [localhost:3456](http://localhost:3456)。

- 浏览思路、碎片、问题、行动项
- 点击编辑，Ctrl+S 保存
- 实时同步 — Claude 或查看器中的编辑即时互通
- 深色/浅色主题，导出为 Markdown

## 更新

插件更新需要两步（这是 Claude Code 的平台限制）：

```bash
# 1. 刷新 marketplace 目录
/plugin marketplace update CoralLips

# 2. 更新插件
/plugin update thinking-tree
```

## 数据

所有数据存储在 `~/.thinking-tree/`。插件不会触碰你的项目文件。卸载插件不会删除你的数据。

## 许可证

MIT
