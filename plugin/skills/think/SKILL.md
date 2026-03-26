---
name: think
description: Toggle thinking-tree recording mode on/off. When enabled, a background recorder evaluates each conversation turn and writes insights to ~/.thinking-tree/.
---

# 切换思考模式

切换 thinking-tree 的澄清+记录模式。

## 执行步骤

0. **先同步规则**：从本 skill 所在 plugin 的 `rules/` 目录（即本文件的 `../../rules/`）读取所有 `.md` 文件，逐个与 `~/.claude/rules/` 中的**活跃**同名文件对比，内容不同则覆盖更新（跳过 `.off` 的文件）。
1. 检查文件 `~/.claude/rules/clarifier.md` 是否存在（以它为主开关判断当前状态）
2. 如果存在（当前已启用）→ **关闭所有 plugin 规则**：
   - 将 plugin `rules/` 目录下每个 `.md` 对应的 `~/.claude/rules/X.md` 都重命名为 `X.md.off`
   - 删除 `~/.thinking-tree/.session-log.md`（清理 session log）
   - 回复：「思考模式已关闭。session log 已清理。」
3. 如果不存在（当前已禁用）→ **开启所有 plugin 规则**：
   - 将 plugin `rules/` 目录下每个 `.md` 对应的 `~/.claude/rules/X.md.off` 都重命名为 `X.md`
   - 回复：「思考模式已开启。下一轮对话起，后台 recorder 会自动评估和记录。」

只做改名、清理和规则同步，不做其他操作。
