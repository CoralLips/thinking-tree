# thinking-tree

持久化思考系统 — 跨 Claude Code 会话捕获、组织、演化散落的想法。

> 思考模式由 `/thinking-tree:think` 命令切换启用/禁用。

## 数据位置

所有思考内容存储在 `~/.thinking-tree/`（`~` = 用户 home 目录）。
读写文件使用绝对路径。

## 四个空间

```
~/.thinking-tree/
├── 思路体系（*.md）── 结晶态，有主线（理解）
├── fragments.md    ── 有价值但还没归位（观察）
├── questions.md    ── 明确的"不知道"（探索）
├── todos.md        ── 想清楚后的行动意图（行动）
├── .session-log.md ── 对话日志索引（代码级自动维护）
└── .meta.json      ── 碎片计数、轮次统计等元数据
```

## 架构

```
每轮结束 → Stop hook (command, async) → turn-logger.js（零阻塞）
  ├─ 解析 transcript JSONL → 提取用户消息 + AI 回复
  ├─ 追加到 .session-log.md
  └─ .meta.json roundCount++

主 AI 规则 → 发现洞察时直接写 fragment（~200 tokens/条）
  └─ 读 .meta.json → 追加 fragments.md → 更新 .meta.json

整理/路由 → 用户手动触发 /reduce

会话启动 → SessionStart hook (command) → inject-context.js
  ├─ 同步 plugin rules → ~/.claude/rules/
  ├─ 注入近期碎片/问题/行动项上下文
  └─ 无条件拉起 Web Viewer server（EADDRINUSE 自动退出）
```

两个角色：
- **Logger**：代码级（turn-logger.js），每轮自动运行，零 token
- **主 AI 规则**：clarifier.md 规则驱动，发现洞察时直接写碎片，~200 tokens/条

## 路由规则

| 如果… | 则放入… |
|-------|---------|
| 一个独立的点，脱离上下文能看懂 | 碎片池 |
| 有主线，能串起多个点成一篇 | 思路文件 |
| 明确知道自己不知道什么，有方向性 | 开放问题 |
| 从思考自然衍生的"接下来要做"，具体且可执行 | 行动项 |
| 项目工程相关，不是产品思考 | 项目 .claude/ 体系（不进 thinking-tree） |

### 边界冲突

- 碎片 vs 思路 → 先放碎片，积累够了再提炼
- 碎片 vs 问题 → 有明确的"不知道"就是问题，否则是碎片
- 已有思路文件能接上 → 进该思路文件，不新建碎片

### 流转

```
碎片积累 ──→ 提炼成思路文件
思路中发现未解 ──→ 进 questions.md
问题解答后 ──→ 结论进思路体系，问题标记 ✓
思路/碎片/问题 ──→ 衍生行动项 ──→ 执行后反馈进各空间
```

## 碎片格式

```markdown
<!-- frag:N date:YYYY-MM-DD -->
## #标签 标题（日期）
内容
---
```

HTML 注释用于代码级计数（inject-context.js），渲染时不可见。

## 技能

- `/think` — 开关思考模式（重命名 clarifier.md ↔ clarifier.md.off）
- `/reduce` — 交互式碎片整理（去重、归类、清理过时）

## Web Viewer

- 访问：http://localhost:3456
- SessionStart 时无条件拉起（零 token，纯 Node.js）
- 绿点：/think 模式状态指示（绿=开启，灰=关闭）
- 功能：思路文件浏览/编辑 + 碎片/问题/行动 block 编辑 + done 勾选
