# OmniAI Search

[中文介绍](#中文介绍) · [English](#english)

---

## 中文介绍

### 项目简介

OmniAI Search 是一款面向 Chromium 浏览器的聚合式 AI 助手扩展。它把传统搜索引擎、网页划词、右键菜单、悬浮小窗、原生侧边栏、内容对比、提示词库和本地收藏整合到同一套工作流中，让用户不必在多个 AI 网站之间来回切换，就能把当前问题快速发往指定平台并继续对话。

这个项目的核心目标不是简单地“把几个 AI 网站塞进 iframe”，而是围绕真实使用场景重新组织交互链路：当你正在搜索结果页查资料时，可以直接在页面侧边调出 AI；当你在任意网页阅读文章、文档或代码时，可以通过划词或右键把选中内容立即发送到 AI；当你需要比较不同模型回答差异时，可以一键打开内容对比页；当你有高频固定任务时，可以通过提示词库和快捷动作把这些操作沉淀成稳定工作流。

### 这个插件解决了什么问题

日常使用多个 AI 平台时，最常见的问题通常不是“模型不够多”，而是操作被打断得太频繁：

- 搜索资料时，需要复制关键词，再分别打开不同 AI 页面提问。
- 阅读网页时，想解释、总结、翻译或润色一段内容，通常还要手动复制、切换标签页、粘贴。
- 不同 AI 的回答风格差异很大，但人工逐个平台切换和比对非常耗时。
- 很多工具只强调搜索增强，却没有把“划词、右键、收藏、导出、提示词”串成完整闭环。

OmniAI Search 的优势就在于：它把这些高频、琐碎、重复的动作统一到浏览器内部完成。你不用离开当前页面，也不用重新整理上下文，就可以把“搜索 → 阅读 → 提问 → 对比 → 收藏”变成一条连续流程。

### 核心优势

#### 1. 搜索、阅读、提问在一个界面完成

- 支持在 **百度 / Google / Bing** 结果页自动显示 AI 小窗。
- 搜索词会在结果页和 AI 面板之间联动，减少手动复制和重新输入。
- 在搜索结果页重新搜索时，AI 面板会继续承接新问题，而不是粗暴重置整个体验。

#### 2. 划词与右键是真正可用的高频入口

- 支持网页任意位置划词后直接发起 AI 操作。
- 默认内置 **解释、总结、翻译、润色** 等常用动作。
- 支持更多菜单扩展动作，如 **代码审查、改写、文章提炼**。
- 支持浏览器右键 **“使用 AI 处理”**。
- 右键默认平台可在设置页单独指定，不和界面展示顺序强绑定。

#### 3. 同时支持悬浮小窗与原生侧边栏

- **悬浮小窗模式** 适合边看搜索结果边查看 AI 回答。
- **原生侧边栏模式** 更适合长对话、连续追问和沉浸式阅读。
- 两种模式共用同一套平台与发送链路，减少割裂感。
- 小窗支持拖拽移动；侧边栏支持调宽，更适合不同屏幕尺寸和使用习惯。

#### 4. 多平台聚合，但不牺牲切换效率

当前已接入的平台包括：

- 豆包
- 通义千问
- 元宝
- DeepSeek
- Kimi
- Z.AI
- 智谱清言
- ChatGPT
- Gemini
- Claude
- Perplexity
- Copilot
- Grok

你可以在统一界面中快速切换平台，而不需要每次重新打开新页面再重新整理上下文。

#### 5. 不只“能问”，还支持“能比较”

项目内置独立的内容对比页，可把多个平台的回答放在同一页面中对照查看，适合：

- 比较不同模型的观点差异
- 对比摘要质量
- 对比翻译风格
- 对比代码解释与审查建议
- 做信息筛选和交叉验证

同时支持差异洞察、导出 Markdown、本地保存等能力，适合做更严肃的信息整理和二次沉淀。

#### 6. 提示词库与收藏能力让效率真正可复用

- 内置可管理的提示词库
- 支持新增、编辑、搜索、启停、恢复默认
- 支持导入 / 导出 JSON
- 支持 `{{text}}`、`{{context}}`、`{{page}}`、`{{url}}`、`{{time}}` 等变量
- 当前回答、对比内容都可以保存到本地收藏，后续统一查看和导出

这意味着它不仅是一个“临时提问入口”，更是一个可以长期积累使用习惯的工具。

### 主要功能

#### 搜索助手

- 在百度、Google、Bing 搜索结果页显示 AI 小窗
- 支持在结果页持续同步搜索词变化
- 支持当前会话继续提问，而不是每次重新开始

#### 划词工具栏

- 任意网页划词后弹出快捷菜单
- 支持文字模式 / 图标模式
- 支持快捷动作顺序调整
- 支持更多菜单显示项配置

#### 右键 AI 处理

- 右键菜单直接把选中文本发给 AI
- 支持在设置页选择默认右键平台
- 适合“快速处理当前选中文本”的轻量操作

#### 原生侧边栏

- 浏览器原生 Side Panel 形态
- 支持定向发送文本到当前平台对话
- 支持打开提示词库、备忘录、对比页和官网页面

#### 内容对比

- 可并排比较 2～4 个 AI 平台结果
- 支持平台切换、刷新、重试、摘要、导出 Markdown
- 更适合深度阅读、整理和筛选答案

#### 本地收藏 / 备忘录

- 可保存当前回答和对比内容
- 便于沉淀重要结论、优秀提示词和对比结果

### 设置能力

设置页目前支持：

- 开启 / 关闭 AI 平台显示
- 主题模式切换：Auto / Dark / Light
- 划词工具栏开关
- 划词工具栏展示模式切换
- 划词菜单与更多菜单配置
- 右键默认 AI 平台设置
- 搜索助手总开关
- 百度 / Google / Bing 独立开关

### 技术特点

这个项目的一个明显优势，是它并不依赖庞大的前端框架，而是尽量保持轻量、直接、可控：

- 主要使用原生 **HTML / CSS / JavaScript**
- 基于 **Manifest V3**
- 通过 `chrome.storage`、运行时消息和 `postMessage` 协同不同页面与 iframe
- 使用本地队列和定向发送机制，增强侧边栏与嵌入页面之间的稳定通信
- 尽量兼容搜索引擎和 AI 页面中的 SPA 局部刷新场景

这类实现方式的优势是：依赖少、包体轻、调试直接、平台接入路径清晰，更适合持续扩展 AI 平台和交互能力。

### 为什么这个插件有优势

如果把 OmniAI Search 和一般“搜索页加一个 AI 面板”的扩展相比，它的优势主要在于：

- **入口更完整**：不仅有搜索结果页，还有划词、右键、侧边栏、对比页。
- **场景更连贯**：搜索、提问、对比、收藏、导出在同一个插件中闭环完成。
- **平台更丰富**：覆盖国内外多个主流 AI 平台。
- **设置更实用**：不仅控制开关，还能控制划词和右键等高频交互。
- **使用更贴近日常工作流**：特别适合信息检索、内容总结、跨模型比较、写作辅助和代码阅读场景。

### 安装方法

1. 下载或克隆本仓库到本地。
2. 打开 Chrome 或 Edge 浏览器，进入 `chrome://extensions/` 或 `edge://extensions/`。
3. 开启右上角 **开发者模式**。
4. 点击 **加载已解压的扩展程序**。
5. 选择本项目根目录，也就是包含 `manifest.json` 的文件夹。
6. 建议把扩展固定到浏览器工具栏，便于快速打开和调试。

### 使用建议

- 日常搜索时，直接在搜索结果页配合 AI 小窗使用。
- 阅读文章或文档时，优先用划词快捷菜单处理局部内容。
- 想快速把选中文本交给固定平台时，使用右键 AI 处理。
- 想对比多个平台质量时，打开对比页集中查看。
- 有固定工作流时，把常用任务沉淀到提示词库中。

### 适用场景

- 搜索资料与快速问答
- 文章理解与摘要整理
- 外文翻译与润色
- 代码解释、代码审查与改写
- 多模型答案比较
- 写作、研究和知识整理

---

## English

### Overview

OmniAI Search is a browser extension for Chromium-based browsers that turns search pages, text selection, context menus, floating panels, native side panels, prompt workflows, and multi-model comparison into one unified AI workspace.

Instead of forcing users to copy text, open multiple AI sites, and repeat the same question over and over again, the extension keeps the workflow inside the browser. You can search, read, highlight text, send it to a selected AI platform, compare answers, and save useful results without constantly breaking your focus.

### What problem does it solve

Most people who use multiple AI products face the same friction:

- Search results and AI answers live in different places.
- Highlighted content must be copied and pasted manually.
- Comparing different models is slow and repetitive.
- Prompt reuse, saving, exporting, and revisiting useful answers are often disconnected.

OmniAI Search is designed to solve exactly those workflow problems. It is not only an “AI panel on top of search.” It is a practical browser-side productivity layer for reading, asking, comparing, and organizing AI-assisted work.

### Key strengths

#### 1. Search, reading, and AI interaction stay in one flow

- Automatically shows an AI panel on **Baidu, Google, and Bing** result pages.
- Keeps search terms connected with the AI workspace.
- Continues working with updated queries on the result page instead of forcing a full restart every time.

#### 2. Text selection and right-click actions are first-class features

- Send highlighted text directly to AI from any webpage.
- Built-in quick actions include **Explain, Summarize, Translate, and Polish**.
- More advanced actions include **Code Review, Rewrite, and Article Extraction**.
- Supports browser context-menu based **AI processing**.
- Lets users define a dedicated default platform for right-click actions in settings.

#### 3. Floating window and native side panel are both supported

- The **floating window** is ideal when you want AI assistance beside a search page.
- The **native side panel** is better for longer conversations and continuous follow-up questions.
- Both modes share the same platform ecosystem and communication logic.
- The floating panel supports dragging, while the side panel supports width adjustment.

#### 4. Multi-platform access without multi-tab chaos

Currently supported AI platforms include:

- Doubao
- Qianwen
- Yuanbao
- DeepSeek
- Kimi
- Z.AI
- ChatGLM
- ChatGPT
- Gemini
- Claude
- Perplexity
- Copilot
- Grok

This allows users to move across major AI products from a unified interface instead of manually hopping between websites.

#### 5. Comparison is built in

The project includes a dedicated comparison page where answers from multiple AI platforms can be viewed side by side. This is especially useful for:

- comparing reasoning styles
- checking summary quality
- comparing translation tone
- reviewing code explanations
- validating information across models

It also supports export and local saving, making it useful for research and structured review.

#### 6. Prompt library and local favorites make the workflow reusable

- Built-in prompt library management
- Create, edit, search, enable, disable, and restore prompts
- Import and export prompt libraries as JSON
- Supports variables such as `{{text}}`, `{{context}}`, `{{page}}`, `{{url}}`, and `{{time}}`
- Save useful answers and comparison results locally for later review

This turns the extension from a temporary convenience tool into a reusable long-term productivity system.

### Main capabilities

#### Search assistant

- Shows AI on supported search result pages
- Synchronizes updated search terms
- Keeps asking within the current conversation flow

#### Text selection toolbar

- Appears on arbitrary webpages after text selection
- Supports text mode and icon mode
- Supports configurable quick actions and extra menu items

#### Right-click AI processing

- Sends selected text directly to a chosen AI platform
- Supports a dedicated default platform in settings
- Useful for fast one-step processing

#### Native side panel

- Uses the browser’s native side panel
- Supports directed sending into the current platform conversation
- Integrates prompt library, favorites, comparison, and official platform page entry points

#### Comparison workspace

- Compare answers from 2 to 4 AI platforms side by side
- Refresh, retry, summarize, export, and analyze responses

#### Local favorites

- Save answers and comparison results locally
- Useful for research notes, reusable materials, and follow-up work

### Configuration options

The current settings page supports:

- enable or disable AI platforms
- switch theme mode: Auto / Dark / Light
- enable or disable the text-selection toolbar
- switch selection toolbar display mode
- configure quick actions and “more” menu items
- choose the default AI platform for right-click actions
- enable or disable the search assistant
- independently control Baidu / Google / Bing support

### Technical highlights

OmniAI Search is intentionally lightweight and practical:

- built mainly with native **HTML / CSS / JavaScript**
- based on **Manifest V3**
- uses `chrome.storage`, runtime messages, and `postMessage` for coordination
- uses local queueing and directed-send communication for side-panel delivery
- is designed to work more reliably with SPA-style page updates in both search engines and AI sites

This architecture keeps the extension easier to debug, lighter to run, and easier to expand with more platforms and workflows over time.

### Why it stands out

Compared with many “AI beside search” tools, OmniAI Search has stronger real-world workflow coverage:

- **more entry points**: search, selection, right-click, side panel, comparison
- **better continuity**: search, ask, compare, save, and export happen in one system
- **broader platform support**: major Chinese and global AI products are covered
- **more practical settings**: not only platform switches, but also real interaction settings such as right-click defaults
- **better fit for daily work**: ideal for research, reading, writing, coding, reviewing, and comparing answers

### Installation

1. Clone or download this repository.
2. Open `chrome://extensions/` or `edge://extensions/`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the project root folder that contains `manifest.json`.
6. Pin the extension to the toolbar for easier access.

### Recommended usage

- Use it directly on search result pages for AI-assisted search.
- Use the selection toolbar when reading articles, documents, or code.
- Use the right-click AI action when you want a fixed one-step workflow.
- Use the comparison page when response quality and model differences matter.
- Use the prompt library to turn repetitive tasks into reusable workflows.

### Typical scenarios

- research and information search
- article reading and summarization
- translation and polishing
- code explanation and review
- cross-model comparison
- writing assistance and knowledge organization

---

## License

MIT License
