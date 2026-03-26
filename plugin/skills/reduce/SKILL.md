---
name: reduce
description: Organize the thinking-tree fragment pool — deduplicate, classify, and clean up. Uses AskUserQuestion for option-based interaction so user can review without typing.
---

# 碎片整理

对 thinking-tree 碎片池进行三层筛选：去重、归类、检验。
使用 AskUserQuestion 提供选项式交互，用户无需打字即可审核。

---

## 执行步骤

### 1. 读取数据

读取以下文件（`~` = 用户 home 目录）：
- `~/.thinking-tree/fragments.md` — 碎片池（主要处理对象）
- `~/.thinking-tree/questions.md` — 已有问题（判断是否有碎片应转为问题）
- 列出 `~/.thinking-tree/` 目录下所有 *.md 思路文件（判断碎片是否可归入已有思路）

### 2. 分析碎片

对每个碎片（以 `## ` 开头、由 `---` 分隔的段落）逐条评估，分为四组：

| 组 | 判断标准 | 动作 |
|----|---------|------|
| **重复组** | 核心论点与另一条碎片相同（仅措辞/例子不同） | 合并为一条 |
| **归类组** | 主题与某个已有思路文件的主线高度匹配 | 整合进该思路文件 |
| **过时组** | 已被后续思考覆盖、推翻、或已无参考价值 | 删除 |
| **保留组** | 独立有效，不重复不过时 | 保留原位 |

### 3. 输出总览

先输出一行统计，让用户了解整体情况：

```
整理分析完成：73 条碎片 → 重复 12 条，可归类 8 条，疑似过时 5 条，保留 48 条
```

### 4. 逐组确认（AskUserQuestion 交互）

**重要：使用 AskUserQuestion 工具让用户通过选项确认，不要让用户打字。**

#### 4a. 重复组 — 每组重复碎片一起确认

对每组重复碎片（2-3 条一组），使用 AskUserQuestion：
- question: "这 N 条碎片表达了相似观点，如何处理？"
- header: "去重"
- options:
  - label: "合并 (Recommended)", description: "保留最精炼的表述，删除冗余"
  - label: "全部保留", description: "不做改动"
- preview: 展示这几条碎片的标题和关键内容对比
- multiSelect: false

#### 4b. 归类组 — 逐条确认归入哪个思路文件

对每条可归类碎片，使用 AskUserQuestion：
- question: "「碎片标题」可以归入已有思路文件，确认？"
- header: "归类"
- options:
  - label: "归入 XXX.md (Recommended)", description: "整合进该思路文件，从碎片池移除"
  - label: "保留在碎片池", description: "不归类，继续作为独立碎片"
- multiSelect: false

如果可归类碎片较多（>4 条），可以批量处理：
- question: "以下碎片可以归入对应思路文件，选择要归类的"
- multiSelect: true
- options: 每条碎片作为一个选项（最多 4 条一批）

#### 4c. 过时组 — 批量确认删除

使用 AskUserQuestion：
- question: "以下碎片可能已过时，选择要删除的"
- header: "清理"
- multiSelect: true
- options: 每条过时碎片作为一个选项，description 说明过时原因
- 用户可选择部分删除，或全选，或不选

#### 4d. 保留组 — 不需要确认

保留组直接跳过，不打扰用户。

### 5. 执行改动

按用户在每一步选择的结果修改文件：
- 合并：保留精炼版，删除冗余版
- 归类：将碎片内容追加到对应思路文件末尾（加 `---` 分隔），从碎片池删除
- 删除：直接从碎片池移除
- 保留：不动

### 6. 输出统计

```
整理完成：合并 X 条，归类 Y 条，删除 Z 条，保留 W 条
碎片池：73 → 58 条
```

---

## 注意事项

- 所有文件路径使用绝对路径
- 不要创造新内容，只做整理和搬运
- 碎片合并时保留最完整的表述
- AskUserQuestion 每次最多 4 个选项、4 个问题，碎片多时分批
- 如果碎片数量很多（50+），优先处理重复和过时（确定性高），归类组可适当放宽
- 归类到思路文件时保持该文件的既有风格和结构
