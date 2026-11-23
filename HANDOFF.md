# HANDOFF.md — 交接信箱

> 规则：只保留最新一条，收工覆盖写，开工读完清空。历史请写进 `.workbuddy/memory/`。

---

**给**：Codex / 下一个接手的 agent
**时间**：2026-11-16 20:20
**来自**：阿诚（WorkBuddy）

## 一句话现状

线上 `main` = `1a304ae`（**wb-v11**，无学习通）。本轮做了安全清理 + 三份文档重写 + 同步/转义优化，改动**尚未推到 main**。

## 你开工必须知道

1. **版本基准是 wb-v11，不是 STATE 旧版里的 wb-v8/v9**。学习通（v12/v13）已整体回退，保全分支 `wb-v13-xxt`@`b5e1eb6` 留着全部代码，别误以为丢了。

2. **密钥已泄露，正等用户吊销**：公开仓库历史里曾有明文 GitHub token + 飞书 webhook。本轮已删两份 `secrets.json` 并加 `.gitignore` 规则，但**token 必须用户去 GitHub 网页吊销、webhook 去飞书重置**才算闭环。用户没做完之前，不要再往仓库放任何密钥。

3. **删过哪些文件（别奇怪）**：根目录的 `secrets.json`/`worker.js`/`local-test.js`/`package.json`/`README.md` 和 `assets/`、`gen-icons.js` 全删了——前四个与 `飞书提醒/` 逐字节相同（重复），后两个零引用（死文件）。权威副本在 `飞书提醒/`。

4. **发布铁律仍有效**：改了 js/css 必须先把 `sw.js` 的 VERSION 往上加（`wb-v11` → `wb-v12`），否则用户看不到更新。

5. **git 推不动，走 REST API**：本沙箱 git fetch/push 被 `schannel: server closed abruptly` 杀。token 从环境变量 `CODEBUDDY_MCP_CONFIG` 读，用 base64 blob + Git Data API 推，别 hardcode。

## 本轮改了什么

- 删：泄露密钥、死目录、重复文件（见上）
- 改：`.gitignore`（加 `*secrets*.json`/`.env`）、`STATE.md`、`HANDOFF.md`、`AGENTS.md`
- 改：`app.js`（自动同步冲突提示 + innerHTML 转义 + safeUrl/safeCssUrl）、`server.js`（ESM 兼容）、`sw.js`（VERSION `wb-v11` → `wb-v11-sec`）
- 再改（同日晚，用户新需求）：`app.js`+`index.html`+`style.css` —— ① 引导式记录（QL_PROMPTS 三组问题，完成待办弹具体引导而非空框）；② 四象限完整拖拽排序（`moveTodoInQuad` 跨格置顶/格内自由排，插入线 CSS）。`sw.js` → `wb-v11-sec2`。单测：`test-quad-sort.mjs` 7 PASS、引导分类 6 PASS
- 2026-11-19 好物欲望清单：`data.js`(三处+回收站映射) / `app.js`(renderWishes 等 5 函数 + normalizeData) / `index.html` / `style.css`(wish-* 样式)。`sw.js` → `wb-v11-sec3`。数据层单测 8 PASS
- 2026-11-19 同日改为独立模块：用户明确「不放待办里、不要时间/重要性」。导航加第 4 项 `data-view=wish`「好物欲望」，`#view-wish` 独立 section；待办 seg 删掉好物按钮恢复两项；`renderTodo` 去掉 wish 分支，`switchView`/`renderAll` 接 `renderWishes`。导航 8 项窄屏适配。`sw.js` → `wb-v11-sec4`
- 2026-11-20 改回待办第三格（用户最终确认）：撤销左侧独立 wish 项与 `#view-wish`，待办 seg 恢复三标签「列表/四象限/好物欲望清单」，`#todoWishView` 搬回待办内；`renderTodo` 恢复 wish 三态，`switchView`/`renderAll` 去掉独立接入；导航恢复 7 项。状态标签化：新加显示「待买」(橙 is-todo)，点一下变「已入手」(灰 is-got + 划线沉底)，`wish-state` 样式。`sw.js` → `wb-v11-sec5`
- 2026-11-20 待办输入区按模式显隐：用户指出切到好物清单时待办输入框还显示。`.todo-add` 加 `id=todoAddBar`，renderTodo 里非 list 模式隐藏 addBar、收起 #todoAdv；list 模式不碰 adv 以保留「更多」展开态。`sw.js` → `wb-v11-sec6`
- 2026-11-22 首页瘦身 + 导航做减法（用户预览后确认）：首页只留行动中枢/待办/课程/打卡，删快捷栏、统计卡、周主题、技能进度、倒计时；`renderHome` 删 elStats early return 及对应渲染。导航 7→5（首页/时间线/待办/记录/更多），技能/打卡/倒计时收进 `openMoreMenu` 弹出菜单，`switchView` 高亮更多按钮。三页面与数据都在。`sw.js` → `wb-v11-sec7`
- 2026-11-22 用户自己在 GitHub 网页删了 `飞书提醒/` 目录（main `8057ab7`）；本地目录仍在但不影响运行，推送基于当前树继承不会还原它

## 下一步

1. 确认用户已吊销 token / 重置 webhook。
2. 把本轮改动推到 main（REST API），复核线上文件树无 secrets、无 assets。
3. 用户要恢复学习通时，从 `wb-v13-xxt` 分支取，并重新解决 `workers.dev` 大陆不可达（买域名挂 CF 或国内云函数）。

## 最新消息（2026-11-23）

- 视觉规范优化 sec8 已上线：四套主题去渐变改纯色、按钮点击/聚焦边缘留光、整周课表隐藏「下一项」、手机端底部导航改左侧竖排窄栏、MORE_ITEMS 与时段/整周按钮 emoji 换线性 SVG。详见 STATE.md 11-23 条。
- 独立预览 `preview-optimize.html` 留本地、未推 GitHub。
- 提醒：用户实际主题是 localStorage 记住的 dark（非 HTML 默认 light），两套主题都已去渐变，故无影响。
- 2026-11-23 sec9：修复手机侧栏按钮偏左（改居中）+ 侧栏占宽导致首页待办文字竖排（首页卡片改单列，修正规则置文件末尾覆盖）。仅改 style.css / sw.js / STATE.md。
- 2026-11-23 sec10：更多菜单加「灵感区」——快速记录灵感、点主题标签归类、「归纳」按钮进入按主题聚合的归纳灵区。数据层 ideas 三处同改+回收站。独立预览 `preview-idea.html` 未推 GitHub。
- 2026-11-23 sec11：用户纠正要的是「归档」不是分类归纳。改为：记录页只显未归档项，每条可归档；归档区可还原/删除。ideas 加 archived/archivedAt；删掉 topic 聚合视图。
