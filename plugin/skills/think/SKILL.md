---
name: think
description: Toggle thinking-tree recording mode on/off. When enabled, a background recorder evaluates each conversation turn and writes insights to ~/.thinking-tree/.
---

# 切换思考模式

运行脚本完成切换，然后**原样输出脚本的输出**，不要额外解释：

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/think-toggle.js"
```

`CLAUDE_PLUGIN_ROOT` 由 plugin 机制注入，指向本 plugin 安装目录。
