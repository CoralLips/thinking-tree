---
name: distill
description: Distill fragments into a structured thought file. Scans fragment pool for related insights, proposes an outline, and synthesizes a new thought document. Accepts optional topic hint.
---

# 碎片提炼

从碎片池中提炼出结构化的思路文件。碎片是原料，思路是产品。

```
/distill                    → AI 扫描碎片池，建议可提炼的主题
/distill 产品定位的核心思路   → 按用户方向找碎片，直接进入提炼
```

`$ARGUMENTS` 是可选的主题方向提示。

---

## 执行步骤

### 1. 读取数据

读取以下文件（`~` = 用户 home 目录）：
- `~/.thinking-tree/fragments.md` — 碎片池（提炼素材）
- 列出 `~/.thinking-tree/` 目录下所有 *.md 思路文件的文件名（避免与已有主题重复）

### 2. 识别素材

#### 有参数时：
按用户给的方向，从碎片池中找出语义相关的碎片（3 条以上才值得提炼）。

#### 无参数时：
扫描碎片池，按主题聚类，识别出 2-3 个可提炼的主题方向。

使用 AskUserQuestion：
- question: "发现以下主题方向可以提炼为思路文件，选哪个？"
- header: "选主题"
- options: 每个主题一个选项，description 列出涉及的碎片数量和核心观点
- multiSelect: false

### 3. 展示素材与大纲

展示：
- 涉及的碎片标题列表
- 一句话主线概述
- 建议的文件名（如 `positioning.md`）
- 三级大纲草案

使用 AskUserQuestion：
- question: "以上是提炼方案，如何处理？"
- header: "大纲确认"
- options:
  - label: "确认，开始提炼", description: "按此大纲生成思路文件"
  - label: "调整方向", description: "补充说明后重新生成大纲"
  - label: "取消", description: "不提炼，返回"
- multiSelect: false

如果用户选「调整方向」，根据补充重新生成大纲，再次确认。

### 4. 生成思路文件

按确认的大纲，将碎片内容**提炼重写**为有主线的结构化文档。

**关键要求：**
- 不是碎片的拼接或复制粘贴
- 是理解碎片群的集体含义后，写出一篇有主线的文档
- 每节在主线上有位置，读完能一句话概括
- 适当使用 ASCII 图、对比表、层级关系来表达结构
- 保留碎片中的锐利表述和关键判断，不要稀释

### 5. 预览成品

将生成的完整文档内容展示给用户。

使用 AskUserQuestion：
- question: "以上是生成的思路文件，如何处理？"
- header: "成品确认"
- options:
  - label: "写入", description: "保存为思路文件，从碎片池移除已提炼的碎片"
  - label: "再改改", description: "补充反馈后重新生成"
  - label: "放弃", description: "不保存，碎片保持原样"
- multiSelect: false

如果用户选「再改改」，根据反馈调整内容，再次预览确认。

### 6. 写入与清理

用户确认后：
1. 在 `~/.thinking-tree/` 创建新 .md 思路文件
2. 从 `fragments.md` 移除已提炼的碎片（按 `<!-- frag:ID -->` 或标题定位）

输出：
```
提炼完成：7 条碎片 → xxx.md
碎片池：120 → 113 条
```

---

## 注意事项

- 所有文件路径使用绝对路径
- 至少 3 条相关碎片才值得提炼，少于 3 条时提示用户再积累
- 不要与已有思路文件的主题重复——如果已有相关文件，建议用 /reduce 的归类功能
- 思路文件的质量标准：主线清晰，每节有位置，能一句话概括全文
- 碎片移除时保持 fragments.md 的格式完整性
