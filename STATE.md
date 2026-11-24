# STATE.md — 当前状态

> 最后更新：2026-11-16 20:20（阿诚）
> 任何 agent 改完代码都要回来更新这份文件。开工前必读，收工前必写。

## 版本

| 项 | 值 |
|---|---|
| 线上 `main` HEAD | `1a304ae`（**wb-v11**，"待办象限拖拽"版） |
| 本地工作树 | wb-v11 + 本轮优化（安全清理、文档、同步/转义）未提交 |
| 线上地址 | https://hui0624.github.io/gerengongjuxiang/ |
| 本地预览 | `node server.js` → http://localhost:7788 |
| `sw.js` VERSION | `wb-v13.0`（页面视觉优化大版本；发布新改动前必须往上加） |
| 数据同步 | GitHub 私有 Gist（只传数据 `wb_data_v1`，不传代码） |
| 代码同步 | GitHub REST API 推 `main`（git 协议在本沙箱被 schannel 拦，不可用） |

## 功能清单（wb-v11 实际有的）

导航 5 项：首页（行动中枢+待办+课程+打卡）/ 时间线（日+周课表）/ 待办（列表+四象限+好物欲望清单）/ 记录沉淀（语音+AI 提炼+流水+周复盘）/ 更多（弹出菜单：技能进度 / 打卡 / 倒计时）。
数据层还有 `projects` 字段但**无界面**（留的坑）。
飞书提醒是独立 Cloudflare Worker（cron 每分钟），读 Gist 推飞书，源码在 `飞书提醒/`，设 `off` 可关早晚汇总。

## 已完成

- **wb-v8**：回收站（软删 30 天/300 条）、本地历史快照（环形 20 版）、云端删前归档、图标根目录化
- **wb-v9**：7 组动效层（`.view.enter` 一次性 class 驱动，700ms 摘除）
- **wb-v11**：待办象限支持拖拽与下拉调整
- **2026-11-12**：学习通作业功能（wb-v12/v13）已按用户要求**整体回退**，main 退回 wb-v11；保全分支 `wb-v13-xxt` @ `b5e1eb6` 保留全部学习通代码，随时可恢复
- **2026-11-16 安全清理**：删除泄露的 `secrets.json`（根+飞书提醒各一份）、死目录 `assets/`、`gen-icons.js`、根目录整套重复文件（worker/local-test/package/README，与 `飞书提醒/` 逐字节相同）；`.gitignore` 增加 `*secrets*.json` / `.env`
- **2026-11-16 体验优化**：① 引导式记录——完成待办后的"记一笔"浮层改成一组具体问题按钮（按待办文本分技术/学习/杂事三类），点一下带半句进输入框，解决"不知道写啥"；② 四象限拖拽排序——跨格拖到目标象限置顶、格内可自由前后排（Pointer Events 命中条目上/下半决定插前插后，插入线视觉反馈），排序本质是重排 `todos` 数组，`moveTodoInQuad()`（`app.js`），列表下拉改象限仍走原 `setTodoQuad()`
- **2026-11-19 好物欲望清单**：数据结构 `wishes=[{id,name,price,note,wantedAt,got}]`，三处同改（DEFAULT_DATA/Store.load/normalizeData）+ 回收站 wish 映射。未入手在前、已入手划线沉底，可标记入手/删除（进回收站）。汇总条显示想买件数、已入手、预计总额。相关函数 `renderWishes/addWish/toggleWishGot/deleteWish/fmtPrice`（app.js）。**同日改为独立一级模块**（用户要求不放待办里）：左侧导航加 `data-view=wish`「好物欲望」第 4 项，`#view-wish` 独立 section，待办 seg 恢复成列表/四象限两项；`switchView`/`renderAll` 接入 `renderWishes`。导航 8 项，窄屏样式已适配（≤560px 9.5px 字、≤390px 9px）。**11-20 又改回**：用户确认还是要放回待办第三格（列表/四象限/好物欲望清单），撤销左侧独立项与 `#view-wish`；状态文案从动作按钮改成状态标签——新加显示「待买」（橙），点一下变「已入手」（灰+划线沉底），走 `wish-state` 样式类。导航恢复 7 项。
- **11-20 待办输入区按模式显隐**：用户指出切到「好物欲望清单」时，待办的输入框（"试试：明天下午3点交作业"+更多+添加）还显示、与好物清单无关。给 `.todo-add` 加 id `todoAddBar`，`renderTodo` 里只在列表模式显示它（四象限/好物清单隐藏），`#todoAdv` 非列表模式强制收起；列表模式不碰 adv 的 hidden 以保留「更多」展开状态
- **11-22 首页瘦身 + 导航做减法**：用户觉得按钮太多。① 首页只留「行动中枢 + 今日待办 + 今日课程 + 今日打卡」，删掉顶部快捷栏(`#homeQuick`)、4 张统计卡(`#homeStats`)、周主题(`#homeWeekTheme`)、技能进度(`#homeSkills`)、最近倒计时(`#homeCountdown`)；`renderHome` 去掉 `elStats` 的 early return 和对应渲染，只保留待办/课程/打卡/行动中枢。② 导航 7→5：首页/时间线/待办/记录 + 「更多」按钮(`data-more`)，技能/打卡/倒计时收进「更多」弹出菜单(`openMoreMenu`/`MORE_ITEMS`)，切到这三页时高亮「更多」。三个页面与数据都没删，只是入口收起；`?view=skills` 仍可用
- **11-22 飞书提醒目录删除**：用户在 GitHub 网页端自行删除了 `飞书提醒/` 目录（main HEAD `8057ab7`）。本地该目录仍在（未同步删除），但主程序从不引用它，不影响运行
- **11-23 视觉规范优化（sec8）**：用户给五条规范，先出独立预览 `preview-optimize.html`（未推）。正式接入：① 去渐变——theme.css 四套主题(app-bg/nav-active-bg/hero-bg/course-bg/todo-bg/accent-grad/fill-grad)全部拍平纯色，style.css 装饰渐变(stat-card/顶饰线等)拍平；保留 2 处功能性渐变(conic 环形进度、tc-preview 双色预览)和照片主题文字遮罩。② 按钮点击/聚焦边缘留光——全局 `:focus`/`:focus-visible` 加柔光圈(box-shadow 0 0 0 2px panel + 4px green-line + 12px green-soft)。③ 整周课表隐藏「下一项」——`setTlMode` 里 `nextCard` 按 week 模式 toggle hidden。④ 手机端底部导航改左侧竖排窄栏(760px 断点 layout 恢复 row、sidenav 66px 竖排；560px 收窄到 58px)。⑤ 图标线性化——MORE_ITEMS emoji 换线性 SVG、时段/整周按钮 emoji 换 SVG(整周按钮文字包 `.wk-full-label` span，切换时只改 span 不覆盖 SVG)。注意：用户实际主题是 localStorage 记住的 dark，两套主题都已去渐变。独立预览文件不推 GitHub
- **11-23 个人中枢 v20 做了又退回**：v20（个人中枢 8 模块）先上线 `fbef5d0`，用户要求退回，已用新提交 `fce92f9` 回退到 sec7（保留 git 历史）。v20 文件备份在 `.workbuddy/backup-20261116/v20-backup/`，详情见 11-23 工作日志
- **11-23 手机侧栏居中修复（sec9）**：用户截图反馈侧栏按钮图标文字偏左。根因：760 断点给 `.nav-item` 设了 `align-items:flex-start`（为守"文字左对齐"规范，但窄栏按钮竖排时必须居中）。改为 `align-items:center`+`text-align:center`；560 断点同步。顺带发现侧栏占宽后首页 `home-cols` 两列把待办文字挤成竖排——因为基础定义 `.home-cols{grid-template-columns:repeat(2)}` 在文件后面覆盖了断点内的单列规则（同源特异性后者覆盖），把单列修正**追加到文件末尾**才生效，待办/课程改单列、`.ht-text` nowrap+省略号。另外把 `.nav-item:focus` 从我加的按钮光圈里移除（导航已有 active 高亮，再加光圈显杂乱）。截图验证侧栏居中、待办文字完整、无光圈框。仅改 style.css + sw.js + STATE.md
- **11-23 灵感区（sec10）**：「更多」菜单加第 4 项「灵感区」(灯泡线性图标，inMore 高亮)。数据层 `ideas=[{id,text,topic,createdAt}]` 三处同改 + 回收站 idea 映射。独立 `#view-ideas`：快速记录(回车即存)、灵感列表(点主题标签改 topic)、「归纳」按钮切到归纳灵区(按 topic 聚合分组，主题名匹配猜图标)。`renderIdeas/addIdea/editIdeaTopic/deleteIdea/renderIdeaSummary/switchIdeaPane/bindIdeaUI`，switchView+renderAll+init 接入。视觉五规范(局部 --if1..5 五档字号)。先出独立预览 `preview-idea.html`(未推)。用户确认按手填主题聚合、不搞 AI 分类。数据单测 6 PASS，无头浏览器灵感视图渲染正常无 JS 错误
- **11-23 灵感区改为归档（sec11）**：用户指出方向做错——要的是「归档」不是「按主题分类归纳」。ideas 加 `archived`/`archivedAt` 字段（fillItemDefaults 兼容旧数据）。记录页只显示未归档项，每条按钮从「归纳」换成「归档」；点归档移入归档区（不真删），归档区可「还原」或「删除」（删除仍进回收站）。删掉按 topic 聚合的归纳视图和相关图标，主题标签保留为可选备注。index.html 的 ID/文案全改（ideaGoArchive/ideaArchive/ideaArchiveBox），app.js 加 archiveIdea/restoreIdea/renderIdeaArchive，switchIdeaPane 改 archive 语义。单测归档分流 5 项过，浏览器渲染无旧「归纳」残留、无 JS 错误
- **11-24 四象限顶部直接添加（sec12）**：用户要像列表那样在四象限上方加任务。新增 `#quadAddBar`（在 `#todoQuadView` **外面**上方，避免破坏 quad 的 grid 布局）：输入框 + 象限下拉(#quadTodoQuad) + 添加按钮，回车即加。app.js `renderTodo` 里按 todoMode 显隐 quadAddBar（list 显 todoAddBar、quad 显 quadAddBar、wish 都隐），hint 文案加"上方直接添加"；新增 `addQuadTodo()`（复用 parseTodoInput 解析时间/日期，quad 以下拉为准），init 里绑按钮+回车。CSS 加 `.quad-add` 及 560px 窄屏折行。单测象限写入/时间解析/象限筛选过，浏览器 DOM 四元素在、初始 list 模式 hidden、无 JS 错误
- **11-25 页面视觉优化大版本 v13.0**：用户挂 web-design-layout+zxh-html-design 技能要求备份后优化页面。备份到 `.workbuddy/backup-20261116/v12-before-optimize/`（9 文件，线上提交点 79589f9）。AskUserQuestion 确认方向：按 5 点方案全面优化 + 先出 HTML 预览（`preview-redesign.html`，shot.py 自检桌面/手机截图，未推）。用户 ok 推送后正式接入：① `.content > .view` max-width 1100px 居中限宽（820px 以下取消）② 首页 HTML 结构改为左待办 / 右课程+打卡堆叠（`.home-grid-v13`），两列 flex 拉伸底部齐平 ③ 待办/首页卡片 padding/gap 收紧、删除按钮靠近内容 ④ 字号放大一档（正文 13→14、辅助 11→12、next-main 16→17，仍守 5 档）⑤ 保留暗色主题不强切（样式适用所有主题，用户切简洁白即得预览效果）。CSS 用**末尾覆盖块**写法（同源特异性后者覆盖，之前踩过坑）。截图验证限宽/等高/字号生效无错位。仅改 index.html/style.css/sw.js/STATE/HANDOFF。**没动**：功能/数据/导航/主题选择/砍掉的模块

## 未完成 / 待用户

1. **吊销已泄露的密钥（用户 MUST 亲自做）**：公开仓库历史里曾有明文 GitHub token（以 `ghp_` 开头的个人令牌）和飞书 webhook。删文件不能让 token 失效——去 GitHub Settings → Developer settings → Tokens 吊销那枚曾用于本项目的 token；去飞书群机器人详情页重置 webhook。完成后本项目的飞书提醒本地 `--send` 需新建 `飞书提醒/secrets.json`（格式见 `飞书提醒/README.md`）才能用。
2. **APK 打包**：暂缓。PWABuilder 走 "Other Android"，Fallback 从 Custom Tabs 改 Web View；根因是缺 `https://hui0624.github.io/.well-known/assetlinks.json`（404）。
3. **项目档案界面**：`data.js` 的 `projects` 有字段无界面。
4. **WorkBuddy 的 SessionStart hook**：截至 11-08 未在会话上下文注入 `project-context` 标记，Codex 修过 PATH 但需重启 WorkBuddy 后复验。

## 已知风险

| 风险 | 说明 |
|---|---|
| `sw.js` VERSION 未同步 | 改 js/css 不改 VERSION → 浏览器认为无更新，界面"更新了没反应" |
| 新字段只改两处 | 必须 DEFAULT_DATA / Store.load / normalizeData 三处同改，否则云端拉回丢字段 |
| GitHub Pages CDN | 缓存约 10 分钟，改完立刻刷新可能看到旧文件 |
| 密钥泄露（进行中） | 见"待用户"第 1 条，token/webhook 必须吊销重置才算闭环 |
| 自动同步 last-write-wins | 多端同时改会静默覆盖，本轮已加冲突提示改进（见 app.js） |
| iOS PWA 独立存储 | iPhone 主屏 App 与 Safari 不共享 localStorage，条目数不一致是正常的 |

## 协作约定

- 两个 agent 共用目录：Codex（终端）、WorkBuddy/阿诚（桌面端）。日志分文件写，绝不写同一个。
- 日志：`.workbuddy/memory/YYYY-MM-DD-codex.md` / `...-workbuddy.md`。
- `HANDOFF.md` 是唯一信箱，只留最新一条。
- **git 分叉**：本地 master 与线上 main 历史分叉，且本地 master 停在 wb-v8。判断线上版本以抓 `sw.js` 的 VERSION 为准，不要用 `git log origin/master..HEAD`。推送走 REST API。
- **发布铁律**：先改 `sw.js` 的 VERSION，再传文件。

## 环境事实

- Windows + Git Bash；`pwd` 返回 `/d/...`，需要绝对 Windows 路径时手写 `D:/...`
- 无 JDK / Android SDK，本地无法编译 APK
- git CLI 在本沙箱可用 ls-remote 但 fetch/push 被 `schannel: server closed abruptly` 杀；统一走 GitHub REST API
- API token 运行时从环境变量 `CODEBUDDY_MCP_CONFIG` → `mcpServers.github.env.GITHUB_PERSONAL_ACCESS_TOKEN` 读取，不落盘
- 语音识别只能在真机验证（无头浏览器无语音引擎）
