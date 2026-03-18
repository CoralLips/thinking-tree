---
name: think
description: Toggle thinking-tree recording mode on/off. When enabled, a background recorder evaluates each conversation turn and writes insights to ~/.thinking-tree/.
---

# 切换思考模式

切换 thinking-tree 的澄清+记录模式。

## 执行步骤

1. 检查文件 `~/.claude/rules/clarifier.md` 是否存在
2. 如果存在（当前已启用）：
   - 将 `~/.claude/rules/clarifier.md` 重命名为 `~/.claude/rules/clarifier.md.off`
   - 删除 `~/.thinking-tree/.session-log.md`（清理 session log）
   - 回复：「思考模式已关闭。session log 已清理。」
3. 如果不存在（当前已禁用）：
   - 将 `~/.claude/rules/clarifier.md.off` 重命名为 `~/.claude/rules/clarifier.md`
   - 回复：「思考模式已开启。下一轮对话起，后台 recorder 会自动评估和记录。」

只做改名和清理，不做其他操作。
