# HANDOFF.md — 交接信箱

> 规则：只保留最新一条，收工覆盖写，开工读完清空。历史请写进 `.workbuddy/memory/`。

---

**给**：Codex / 下一轮 WorkBuddy
**时间**：2026-11-12 01:30
**来自**：WorkBuddy

## 01:30 学习通作业：根因已破，capture 重放方案已落地并验证

**根因**（前几轮一直卡在这）：学习通 `work/list` 的 `enc`/`workEnc` 是**浏览器会话绑定、带时效的动态签名**。服务端用账号密码重放必然「无权限的操作！」——这不是参数拼错，是反爬机制。公开逆向项目也明写「过不去」。

**解法 = 捕获重放（capture-and-replay）**：用户在已登录浏览器里 F12 复制 `work/list` 的 cURL → 工作台把 `url + cookie` 发给 Worker → Worker **原样重放这条真实请求** → 解析返回。因为是用户自己会话的真实签名，所以能通过校验。

| 项 | 值 |
|---|---|
| Worker | `https://xxt-homework.hui0624-wb.workers.dev`（已部署，capture 模式 + 修正路径 `mooc1.chaoxing.com/mooc2/work/list`） |
| `XT_KEY` | `wb-xxt-4928a9beb846fe45`（未变） |
| 调用方式 | `POST {worker}?capture=1`，body `{url, cookie}`，header `X-Workbench-Key: <XT_KEY>` |

**本轮回合已做的事**：
1. `worker.js` 的 `parseWorkList()` 硬化：原来会匹配嵌套 `<div>` 产生重复/垃圾条目（mock 测出 3 条真实作业被解析成 7 条，含「不含作业关键字」误命中）。重写后：`aria-label` 优先、无标签则取子节点标题、按信号词+嵌套去重。
2. 用一份贴近真实的 mock HTML 跑 Node 单测（`.jw-debug/test-parser.js`），**9 项断言全 PASS**：3 条真实作业恰好解析为 3 条干净条目；「无权限」页/登录页解析为 0 条（replayCaptured 据此抛错不返假数据）；div 结构 + aria-label 也能解析。
3. **重新部署 Worker**（`.jw-debug/cf-upload.py` 走 `api.cloudflare.com` 代理，HTTP 200，保留 Secrets/XT_KEY）→ 线上已是硬化后的解析器。
4. 工作台 `app.js` 已有「📥 导入浏览器里抓取的真实请求」面板：粘 cURL → 调 capture 模式 → 解析入库存为手动快照（`manual:true`，刷新不覆盖）。`sw.js` 升到 **wb-v13**。
5. `学习通作业/README.md` 已重写为 capture 重放为主、账号密码自动抓取为辅的说明。

**仍卡点（需用户）**：
- **A. `workers.dev` 可达性**：沙箱里 DNS 污染打不开，但 `api.cloudflare.com` 正常（属国内常见污染，非部署失败）。需用户在自己网络打开 `?ping=1` 验证；不通则绑自有域名或换国内中转。
- **B. 真实数据验证**：mock 只能验证解析逻辑，不能替代学习通真实 `work/list` 页面结构。用户抓一次真实 cURL 导入即可验证；若某门课解析出 0 条，把那段 HTML 发来改 `parseWorkList()`。

**wb-v13 工作台代码尚未推到 GitHub Pages**：本会话 `github` MCP 处于 disabled、git 协议被沙箱 SSL 拦，无法推送。本地 `localhost:7788` 可跑可测。上线需用户重连 GitHub（我推）或走 GitHub 网页上传。

## 你改代码前必须知道

1. **判断线上版本一律现场抓 `sw.js` 看 `VERSION`**。Pages CDN 缓存约 10 分钟；部署中途会出现「sw.js 新版、app.js 旧字节」混合态，连测几轮再下结论。
2. **待办页三种 `todoMode`**：`list` / `quad` / `xxt`。`renderTodo()` 分派，xxt 模式隐藏待办输入行。改待办渲染别漏第三种。
3. **`assignments` 字段四处**：`DEFAULT_DATA`、`Store.load`、`fillItemDefaults`(data.js)、`normalizeData`(app.js)。云端旧数据缺这字段时沿用本地，别写成 `arr(...)` 清空。
4. **手动状态优先**：`manual:true` 条目在 `xxtRefresh()` 里单独收集再合并，别让服务端结果覆盖。capture 导入的条目标 `manual:true`。
5. **`pub` 留空显示「发布 —」，绝不编造**。`due` 由页面解析或扫描时刻+剩余时长反推。
6. **不定时、不自动抓**：只有点「立即刷新」才 fetch Worker；15 分钟缓存只提示不硬拦；失败不更新 `lastSync`、保留旧数据。用户明确否决过「打开就抓」。
7. 设置里 `xxtWorker`/`xxtKey` 存 `settings`，随 Gist 同步。**账号密码不在这**，只在 Cloudflare Secret。
8. `window.onDataChanged` 是防抖推 Gist，写测试页时置 null。

## 用户现在怎么用（capture 方案，主路径）

1. 电脑浏览器登录学习通网页版 → 进一门课 → 点「作业」标签，等列表加载。
2. F12 → Network → 清空 → 刷新 → 找 `work/list` 那条 → 右键 **Copy as cURL (bash)**。
3. 工作台 → 学习通作业视图 → 展开「📥 导入浏览器里抓取的真实请求」→ 粘 cURL → 点导入。
4. 解析结果存为手动快照，进列表；多门课就多抓几次。enc 过期后重抓一次再导入。

（账号密码自动抓取仍有，但大概率「无权限」，仅作兜底。）

## 红线

- 账号密码只在 Cloudflare Secret，**不进代码、不进仓库、不贴对话**。
- `学习通作业/` 已 gitignore，但**网页拖拽上传绕过 .gitignore** —— 别拖进上传框（上次 `secrets.json` 就这么漏的）。
- Worker 代码只粘到 Cloudflare 后台 / 经 cf-upload.py 上传，不放 Pages。

## 验证资产

- `.jw-debug/test-parser.js` — `parseWorkList` 单测，9 项断言全 PASS（mock HTML + 边界）。
- `.jw-debug/xxt-live-test.html` — 真实工作台 iframe 内 30 项交互测试，全 PASS（wb-v12 视图）。
- `.jw-debug/cf-upload.py` / `cf-deploy.py` / `cf-secrets.json`（gitignore）— 部署用，凭据不进仓库。
- `.jw-debug/bak-xxt/` — 改动前备份。

## 其他未完事项（沿用）

- `工作台-单文件.html` 仍是 wb-v7，落后多代。
- 应用启动器 wb-v10 等带原生桥的 APK；TWA/WebView 加回也打不开（无 JDK/Android SDK）。
- 飞书提醒暂不部署；`secrets.json` 仍在公开仓库根目录，飞书 webhook 仍有效（历史安全事件，待用户处理）。
- SessionStart hook 未复验。
