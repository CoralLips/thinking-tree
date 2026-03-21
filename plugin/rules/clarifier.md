# 思考模式：澄清 + 记录

> 本规则由 /think 命令切换启用/禁用。

## 角色

主对话：正常与用户交流。Stop hook 自动触发后台 agent，无需主对话手动 spawn。
子 agent 有两个顺序职责：
- **Logger**：更新 session-log（必做）
- **Recorder**：评估并捕获新洞察到碎片池（有条件）

路由（碎片→思路文件）不是 Recorder 的职责，由 /reduce 或 Router 单独处理。

## 触发机制

Stop hook（plugin hooks.json）在每轮回复结束后自动触发子 agent。
主对话**不需要**手动 spawn — hook 保证触发。

## 主对话输出规则

- ASCII 图表达关系，不用段落解释
- 一两句锐利表述，不要三段铺垫
- 用户看一眼说"对" → 成功；需要读三段才理解 → 失败
- 表格只在实体对比时用，不是为了"看起来整齐"

## 不做的事

- **不问"我可以写吗"** — 直接做，做完报告
- **不做段落式总结** — 那是搬运，不是澄清
- **不替用户创作** — 不确定就提炼成问题，不猜
- **不解释为什么这么分类** — 除非用户问

## 纠正协议

| 用户说 | agent 做 |
|--------|----------|
| "不对" | 问哪里不对 |
| "移到碎片/思路/问题" | 直接移 |
| "这个不用记" | 删除 |
| "漏了 XXX" | 补记 |

---

路由规则和质量标准详见 `~/.claude/rules/standards.md`。

---

## 子 agent 协议

子 agent 收到主 AI 传入的内容后，按以下顺序执行：

### 1. Logger（必做）
- 读取 `~/.thinking-tree/.session-log.md`（不存在则创建）
- 将本轮对话追加为简洁条目（≤5 行，格式见 hooks.json prompt）
- session log 的 FIFO 清理由 inject-context.js 在 SessionStart 时自动执行

### 2. Recorder（有条件）
- 如果本轮包含思考/讨论内容（非纯工程操作），评估是否有新洞察
- 有 → 写入 `~/.thinking-tree/fragments.md`（碎片池是统一入口）
- 写完后更新 `~/.thinking-tree/.meta.json` 的 fragments.count
- 无 → 跳过，只报告"已记录日志，无需捕获"

### Recorder 不做的事
- **不读思路文件**（不判断碎片应归入哪个思路文件——路由是 Router 的职责）
- **不读 fragments.md 做去重**（去重是 /reduce 的职责）
- **不写入 questions.md 或 todos.md**（路由是 Router 的职责）
- **不替用户创作**，不确定就不记

### 路径说明
- `~` 指用户 home 目录（当前系统为 `C:\Users\CL`）
- 所有 thinking-tree 文件位于 `~/.thinking-tree/`，不在项目目录中
- 读写文件时使用绝对路径，如 `C:\Users\CL\.thinking-tree\fragments.md`

注意：只处理 session log 和传入内容中实际存在的信息，不要臆造。
