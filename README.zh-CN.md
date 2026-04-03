[English](README.md) | [中文](README.zh-CN.md)

# thinking-tree

代码有 git，思考有什么？

AI 时代你每次对话冒出的好想法比以前多了好几倍，但存下来的还是零。对话一关，刚才那个灵光一闪就再也找不回来了。thinking-tree 帮你在它溜走之前接住。

**工作的时候碎片自然攒起来：**

![Pool 视图 — 跨 session 自动捕获的思维碎片](assets/viewer-pool.png)

**攒够了，慢慢长成完整的思路：**

![Thoughts 视图 — 结构化的思路文档](assets/viewer-thoughts.png)

## 安装

在 Claude Code 里输入：

```bash
# 1. 添加插件源（只需要一次）
/plugin marketplace add github:CoralLips/thinking-tree

# 2. 装插件
/plugin install thinking-tree

# 3. 开始记录
/think
```

搞定。照常工作就行——thinking-tree 每轮对话都会看一眼，有值得留的就自动记下来。

## 怎么运作的

1. **你该干嘛干嘛** — 写代码、聊需求、查 bug
2. **AI 每轮都会判断** — 这轮有没有冒出什么独立的想法？
3. **有料就存** — 自动写到 `~/.thinking-tree/` 里，分碎片和问题
4. **下次开聊** — 最近的碎片和没解决的问题自动带进上下文
5. **随时翻看** — 打开 `http://localhost:3456` 就是你的思维面板

每轮结束你会看到一行提示：
- `📝 标题` — 刚记了一条
- `🌳` — 看过了，这轮没啥好记的

## 四个空间

```
~/.thinking-tree/
├── *.md            思路 — 想明白了的东西，有主线有结构
├── fragments.md    碎片 — 冒出来的点子，还没归位
├── questions.md    问题 — 明确知道自己不知道什么
└── todos.md        行动 — 想清楚之后要做的事
```

碎片攒多了 → 提炼成思路 → 过程中冒出新问题 → 解答后又回到思路里。

## 命令

| 命令 | 干什么用 |
|------|---------|
| `/think` | 开关记录（立即生效，不用重开会话） |
| `/reduce` | 整理碎片池 — 去重、归类、清理旧的 |
| `/catch` | 补捞遗漏 — 告诉它"刚才那段关于 XX 的讨论"就行 |
| `/pref` | 调整记录偏好 — 比如"debug 过程不用记" |

## 思维面板

每次开会话自动启动，浏览器打开 [localhost:3456](http://localhost:3456)。

- 思路、碎片、问题、行动项一目了然
- 点击就能编辑，Ctrl+S 保存
- 实时同步 — 这边 Claude 刚记完，那边面板就能看到
- 深色/浅色随便切，支持导出 Markdown

## 更新

更新要跑两步（这是 Claude Code 自己的限制，不是我们的锅）：

```bash
# 1. 刷新插件源
/plugin marketplace update CoralLips

# 2. 更新插件
/plugin update thinking-tree
```

## 数据安全

所有数据都在 `~/.thinking-tree/`，不碰你的项目文件。卸载插件数据还在，放心。

## 许可证

MIT
