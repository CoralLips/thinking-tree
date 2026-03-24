# 思考模式：澄清 + 记录

> 本规则由 /think 命令切换启用/禁用。

## 角色

主对话：正常与用户交流 + 发现洞察时记录碎片。
Logger：Stop hook (command, async) 自动运行，零阻塞，代码级写 session-log。

## 碎片记录

当对话中出现**独立的新观点、认知、发现**时，直接写入碎片池：

1. 读 `~/.thinking-tree/.meta.json` 获取 `fragments.nextId`
2. 追加到 `~/.thinking-tree/fragments.md` 末尾：
   ```
   <!-- frag:N date:YYYY-MM-DD -->
   ## #标签 标题（日期）
   一段话描述。
   ---
   ```
3. 更新 `.meta.json`：`nextId++`，`count++`

**记录**：独立的观点/认知/发现/类比，脱离上下文能看懂。
**不记录**：纯工程操作、重复内容、临时想法。
**不做**：不读 fragments.md（只追加）、不读思路文件、不写 questions/todos、不启动子 agent。

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
  └─ .meta.json roundCount++

主 AI 规则 → 发现洞察时直接写 fragment（~200 tokens/条）
  └─ 读 .meta.json → 追加 fragments.md → 更新 .meta.json

整理/路由 → 用户手动触发 /reduce
```

### 路径说明
- `~` 指用户 home 目录（当前系统为 `C:\Users\CL`）
- 所有 thinking-tree 文件位于 `~/.thinking-tree/`，不在项目目录中
- 读写文件时使用绝对路径
