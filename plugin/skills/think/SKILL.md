---
name: think
description: Toggle thinking-tree recording mode on/off. When enabled, a background recorder evaluates each conversation turn and writes insights to ~/.thinking-tree/.
---

# 切换思考模式

运行脚本完成切换，然后**原样输出脚本的输出**，不要额外解释：

```bash
node "../../scripts/think-toggle.js"
```

路径相对于本文件，即 `plugin/scripts/think-toggle.js`。如果相对路径不对，用绝对路径：`node "<CLAUDE_PLUGIN_ROOT>/scripts/think-toggle.js"`，其中 `CLAUDE_PLUGIN_ROOT` 是本 plugin 安装目录。
