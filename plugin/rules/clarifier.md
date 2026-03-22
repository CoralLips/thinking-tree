# 思考模式：澄清 + 记录

> 本规则由 /think 命令切换启用/禁用。

## 角色

主对话：正常与用户交流。
Logger：Stop hook (command, async) 自动运行，零阻塞，代码级写 session-log。
Recorder + Router：由主对话在 SessionStart 时按指令启动后台 agent。

## Recorder 触发机制

1. Stop hook (async command) 每轮自动写 session-log.md + 标记 .pending-review
2. SessionStart 时 inject-context.js 检测 .pending-review，输出 ⚡ 触发指令
3. **主对话看到 ⚡ RECORDER 触发时，必须立即用 Agent tool 启动后台 agent：**
   - `run_in_background: true`
   - prompt 使用 inject-context.js 输出中 `--- RECORDER PROMPT START ---` 到 `--- RECORDER PROMPT END ---` 之间的内容
   - 启动后立即回复用户，不等待 Recorder 完成

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

## 架构说明

```
每轮结束 → Stop hook (command, async) → turn-logger.js（零阻塞）
  ├─ 解析 transcript → session-log.md
  ├─ .meta.json roundCount++
  └─ 写 .pending-review

会话启动 → inject-context.js → 检测 .pending-review → 输出 ⚡ 指令
主 AI → 看到 ⚡ → Agent(run_in_background) → 后台 Recorder + Router
```

### 路径说明
- `~` 指用户 home 目录（当前系统为 `C:\Users\CL`）
- 所有 thinking-tree 文件位于 `~/.thinking-tree/`，不在项目目录中
- 读写文件时使用绝对路径
