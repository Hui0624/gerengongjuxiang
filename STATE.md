# STATE.md — 当前状态

> 最后更新：2026-11-12 00:50（WorkBuddy）
> 任何 agent 改完代码都要回来更新这份文件。

## 版本

| 项 | 值 |
|---|---|
| 本地 HEAD | `ceca952`（wb-v8），历史分叉，**勿据此判断线上** |
| 远端 main 最新 | `a3f4f5d`（学习通作业视图，wb-v12） |
| **本地 + 线上当前状态** | **均为 wb-v12**（wb-v9 动效 + 象限调整 + 学习通作业；应用启动器已移除） |
| `sw.js` VERSION | `wb-v12`（本地 / 线上同值，MD5 已比对） |
| 线上地址 | https://hui0624.github.io/gerengongjuxiang/ |
| 线上 manifest 大小 | 1578 字节（图标改真实路径后的版本） |
| 线上 icon-512.png | HTTP 200，64933 字节 |
| 数据同步 | GitHub 私有 Gist（只数据） |
| upstream 跟踪 | **无**（`master` 未设置 tracking） |

## 已完成

- **wb-v8**
  - 回收站：5 处删除改软删，30 天保留、最多 300 条
  - 历史快照：独立 key `wb_snapshots_v1`，环形 20 版，10 分钟节流，>500KB 跳过
  - 云端删前归档：上传前比对条目数，少 ≥3 条或 ≥30% 时旧版存 `archive-*.json`，留 7 份
  - 图标根目录化：`manifest.json` 从 205KB（base64）降到 1.6KB
- 线上部署已核对一遍，与本地 wb-v8 一致
- **协作链路（Codex，18:53）**：修复 SessionStart hook 静默失效（PortableGit bash 缺 /usr/bin，grep/cat/ls/tail 找不到）；Windows 路径 / 未设变量两种入参均能注入三份文件，约 9.6KB
- **wb-v9 动效层（WorkBuddy，18:58，未提交）**
  - `style.css` 末尾追加「动效层 wb-v9」整段（约 110 行）
  - 7 组动效：视图切换分块入场 / 列表逐条入场 / 勾选弹跳+涟漪 / 进度条悬停扫光 / 卡片悬停上浮 / 主卡片渐变流动 / 导航标记展开
  - `app.js`：`switchView()` 挂一次性 `enter` class（700ms 摘除），`init()` 首屏补一次
  - 关键设计：列表动画**不能常驻**，否则勾选待办重渲染会使整列重播，必须由 `.view.enter` 驱动
- **飞书提醒（WorkBuddy，2026-11-09，新目录 `飞书提醒/`）**
  - 用户决定课表 + 待办**全部走飞书机器人**，不走系统日历
  - 已实测通：飞书 webhook 返回 `code:0`；私有 Gist `93cbee...` 可读，`workbench.json` 18.6KB 未截断
  - `worker.js`（Cloudflare Worker，自包含可直贴后台）：每分钟 Cron，读 Gist → 课程/待办提前 30 分钟推送 + 07:30 早间汇总 + 20:30 晚间未完成
  - **关键**：教务导入的课带 `weeks` 字段（如 `2-4周(双),5-10周`），50 条课里同一时段常有 4-5 条；不过滤会一次推 4 门课。已实现 `parseWeeks()` 支持单/双周、区间、单点周
  - 已验证：termStart `2026-08-31` → 今天第 11 周周一，过滤后只有 2 节（10:00 体育、19:00 具身智能），符合实际
  - 端到端已真发成功一条（模拟 18:30 → 19:00 的课）
  - `local-test.js`：本机预览 / `--scan` / `--at HH:MM` / `--send`
  - `secrets.json` 存 webhook + token + gistId，**已加入 .gitignore**
  - **旧 token 已于 2026-11-09 16:08 失效**（`401 Bad credentials`），原因见「安全事件」
  - `local-test.js` 新增 `--file <json>` 离线模式：直接读本地 Gist 副本，不联网、不需要 token。副本在 `.jw-debug/g.json`（11-09 14:20 抓取）
  - 离线实测通过：第 11 周周一过滤出 2 节课，提醒时刻 07:30 / 09:30 / 18:30 / 20:30；`--at 18:30 --send` 真发成功

- **wb-v10 应用启动器（WorkBuddy，2026-11-10 12:18，未提交）**
  - 底部栏第 4 位新增「应用」入口（第 8 项），新增 `view-apps` 视图
  - `appGroups` 字段：**新增字段三处全改**——`DEFAULT_DATA` / `Store.load`（data.js）、`normalizeData`（app.js）；云端旧版没这个字段时保留本地清单，不会被清空
  - 预置 4 个校园 App（今日校园 / 易校园 / 智慧笑联 / 学习通）+ 2 个分组；**`scheme` 一律留空**，真实协议未知不编造，图标左上小橙点提示待填
  - 图标下面只显示用户写的备注（`note`），不显示 App 名；首字母字块 6 色 / 上传图片（canvas 压到 128px）
  - 唤起遵循 Chromium `external_intents`：一次点击同步只发一个 scheme，**不自动重试**；`visibilitychange` 只判断切走与否；失败弹「去下载」由用户再点一次
  - 编辑 / 上移下移 / 移到分组 / 删除 / 分组改名增删，全走 `openModal`；删除前 `Store.save({snapshot:true})` 留快照
  - 同步：沿用 `Store.save()` → `window.onDataChanged` 防抖推 Gist，前提是设置里配了 token
  - 验证：`node --check` 三个 JS 全过、CSS 括号平衡、DOM 渲染 4 图标 4 备注、桌面/560px 截图正常、**23 项交互逻辑测试全 PASS**
  - **已于 2026-11-10 13:35 回退**：用户决定等做出 PWA 的 APK 再启用。线上用 GitHub API 创建反向提交 `e064d39`，本地 5 个文件覆盖回 wb-v9；wb-v10 全套存于 `应用启动器-补丁包/`（已 gitignore），恢复步骤见该目录 README

- **回退时纠正了一个长期误判**：此前一直以为「wb-v9 动效层从未上传」。实际查父提交 `780aa81` 的 `sw.js` 是 `wb-v9`——11月9日那次网页上传已经带动效上线了。以后判断线上版本必须现场抓 `sw.js`，不能沿用旧记录。

- **wb-v11 象限调整（WorkBuddy，2026-11-11 22:58，已同步线上）**
  - 列表视图：点彩色象限标签（加了 ▾）弹下拉，选一个象限直接改
  - 四象限视图：拖拽改象限。用 **Pointer Events** 自实现（HTML5 `draggable` 在安卓 Chrome 不工作）；桌面整条可拖（8px 阈值），触屏**只有左侧 `⋮⋮` 把手**可拖，其余区域保留页面滚动；拖起生成幽灵、目标格子高亮
  - `setTodoQuad()` 统一改 `t.quad` → `Store.save({snapshot:true})` → 重渲染 `renderTodo / renderHome / renderTimeline / renderNextCard`。列表标签、格子与计数、首页「现在专注」、排序、Gist 同步全部自动跟着变；松手 toast 提示
  - 已完成待办保持不在四象限显示；拖到同一格子不改数据
  - 验证：`node --check`、CSS 括号 754/754、列表/四象限截图正常、**28 项交互测试全 PASS**（含真实 PointerEvent 拖拽模拟）
  - 线上通过 GitHub API 一次提交 3 个文件（`app.js` / `style.css` / `sw.js`），commit `1a304ae`；仓库与 Pages 均已比对 MD5 一致

## 未完成

1. **`工作台-单文件.html` 内容陈旧**：仍是 wb-v7，缺 wb-v8 回收站 / 快照、wb-v9 动效、wb-v11 象限调整、wb-v12 学习通作业，**落后四代**（wb-v10 已停用，不用再追）。文件存在但 git 未跟踪。
2. **APK 打包**：用户 2026-11-08 决定**暂缓**。已知结论：PWABuilder 走「Other Android」而非 Play 套餐；Fallback 应从 Custom Tabs 改为 Web View；根因是缺 `https://hui0624.github.io/.well-known/assetlinks.json`（当前 404）。
3. **项目档案功能**：`data.js` 已有 `projects` 字段但无界面，建议等记录模块数据攒两周再做。
4. **WorkBuddy 的 hook 仍未真正跑起来**：截至 2026-11-08 18:59，WorkBuddy 会话上下文里**没有** `<!-- project-context: injected by SessionStart hook -->` 标记，也没出现 STATE.md / HANDOFF.md 内容——只有 IDE 自带的 project_guidance 注入了 AGENTS.md。Codex 已修 PATH 与路径归一化，但需重启 WorkBuddy 后复验。**下次开工先查这一点**。
5. **飞书提醒尚未部署（唯一的硬缺口）**：代码、周次过滤、文案、真发全部已验证，但没有服务端在定时跑，所以现在**不会自动提醒**。两条路：Cloudflare Worker（1 分钟精度，需注册账号）或 GitHub Actions（零注册，cron 可能延迟 5-15 分钟）。**前置条件：先新建 GitHub token 填回 `飞书提醒/secrets.json`**（旧的已被吊销）。

   > **用户 2026-11-09 16:16 决定：功能保留，暂不部署，后续再接。** 代码与本地验证全部有效，`--file` 离线模式可在无 token 时继续预览。重启时按序做三步：①换新 token（只勾 gist）填回 `secrets.json` ②Cloudflare 部署（步骤见 `飞书提醒/README.md`）③加 Cron `* * * * *`。
6. **待办全部没有时间**：云端 9 条待办的 `time` 字段全为空，所以「到点前 30 分钟」的待办提醒现在一条都不会触发，只能靠 07:30 早间汇总兜底。想用到点提醒，得在工作台里给待办填时间。
7. **应用启动器 wb-v10 停用待重启**：完整代码在 `应用启动器-补丁包/`（已 gitignore），恢复步骤见该目录 README。用户决定等做出**带原生桥的 APK** 后再启用——TWA / WebView 里 scheme 依然受限，加回来也打不开。
8. **学习通作业 wb-v12 已落地（2026-11-12 00:05）**：用户看过独立原型后说「可以，直接生成」，本轮把视图接进工作台并同步线上（commit `a3f4f5d`，6 个文件）。
   - 待办页第三段「学习通作业」：统计条 / 立即刷新 / 缓存倒计时 / 筛选 / 卡片（科目·作业名·发布·截止·剩余·状态）/ 手动添加 / 删除 / 手动改状态
   - 不做定时、不在打开时抓，**只有点「立即刷新」才请求 Worker**；15 分钟缓存只提示不硬拦；失败保留旧数据、不假更新同步时刻
   - `assignments` 新字段三处全改（`DEFAULT_DATA` / `Store.load` / `normalizeData`）+ `fillItemDefaults` 兜底；云端旧数据没有该字段时沿用本地
   - `manual` 标记保证手动改的状态不被刷新覆盖；`pub` 抓不到留空显示「发布 —」，**不编造**
   - 设置里加 Worker 地址 / 调用密钥 / 测试连接；`xxtWorker`、`xxtKey` 存在 settings 里随 Gist 同步
   - 验证：4 个 JS 语法全过、CSS 括号 803/803、**30 项真实工作台交互测试全 PASS**、截图正常、线上 MD5 连测第 3 轮全一致
9. **Cloudflare Worker 已部署（00:50）**，但有**两个真实卡点**，见下节「学习通作业云端状态」。用户仍需：① 浏览器工作台设置里填 Worker 地址 + `XT_KEY` ② 用手机测 `workers.dev` 域名通不通 ③ 若要打通作业列表，提供一次浏览器真实 `work/list` 请求。
   - 作业视图在 Worker 不通时**可用「手动添加」正常录入**，刷新会显示具体错误，不会白屏。
   - 红线：账号密码只在 Cloudflare Secret + 本机 `.jw-debug/cf-secrets.json`（已 gitignore），不进代码/仓库/对话；`学习通作业/` 别拖进网页上传框。用完建议 revoke API Token。

## 学习通作业云端状态（2026-11-12 00:50）

**已部署**：`https://xxt-homework.hui0624-wb.workers.dev`，`XT_KEY = wb-xxt-4928a9beb846fe45`。CF API 一次完成：KV `xxt-cache` → Worker 上传并绑 `CACHE` → 5 个 Secret → 子域 `hui0624-wb` 创建并启用。部署脚本 `.jw-debug/cf-deploy.py` 可复现。

**真实账号只读探测结果**（低频、不提交任何数据）：

| 步骤 | 结果 |
|---|---|
| `fanyalogin` 登录 | ✅ `{"status":true}` + 12 Cookie，无验证码 |
| `courselistdata` | ✅ 70KB；真实字段是 `clazzId`（不是 `classId`），课程名在 `course-name` |
| 跟随 SSO 到 `mooc2-ans` 课程页 | ✅ 133KB，自动拿到 `workEnc` + 最终 `enc` → **`XT_ENC` 不用手抄** |
| `work/list` 作业列表 | ❌ 「无权限的操作！」 |

`work/list` 试过 workEnc / 最终 enc / 双参数 / GET / POST / mooc1 与 mooc2-ans 两域 / 完整 Referer / 严格同一会话，全被拒。Worker 遇此**明确报错、不返回假数据**。要打通需用户提供一次浏览器里真实的 `work/list` 请求 URL + Cookie 名列表。

**Worker 已按真实页面结构重写**（`getCourses()` / `openCourse()` / `parseWorkList()`），本地 `.jw-debug/worker-unit-test.mjs` **22 项全 PASS**；最终版已重传 CF。

**卡点 A｜`workers.dev` 域名**：本机 DNS 把该域解析到无关 IP，直连 + 代理 + 5 个 anycast IP 全失败；`api.cloudflare.com` / `hui0624.github.io` 正常。属国内常见污染，**不是部署失败**。需用户手机实测 `?ping=1`。不通则绑自有域名或换国内可达中转。

**卡点 B｜学习通作业接口**：见上表。

验证资产：`.jw-debug/worker-unit-test.mjs`（22 PASS）、`xt-probe.mjs` / `xt-structure.mjs` / `xt-enc.mjs`（真实接口探测）、`学习通作业/README.md`（已写明两个卡点与复现步骤）。

## Git 分叉（重要）

远端历史与本地**分叉**：用户习惯用 GitHub 网页拖拽上传，每次产生独立提交，本地没有 `origin` 跟踪引用。

- 后果：`git log origin/master..HEAD` 会误报“从未推送”，**不要用这个命令判断**
- 判断线上版本的可靠方法：直接抓 `https://.../sw.js` 看 `VERSION`（**别沿用旧记录，会误判**）
- 2026-11-10 的回退走 **GitHub API 创建反向提交 + PATCH ref**，非 force push，历史完整保留。本机 github MCP 的 token 有 `push` 权限，可用于这类远端操作
- 真要 push 时：`git fetch origin && git reset --soft origin/master`（`--soft` 不动文件，内容已一致）

## 安全事件 2026-11-09

GitHub 网页上传 `飞书提醒/` 时把 `secrets.json` 一并提交（PR #2 / commit `ea9649b`），仓库是公开仓库，Pages 已把它发布成可访问 URL。

| 项 | 状态 |
|---|---|
| 泄露内容 | 飞书 webhook、GitHub classic token（仅 `gist`）、Gist ID |
| GitHub token | ✅ **已被 GitHub 自动吊销**（16:08 实测 `401 Bad credentials`），无需手动删 |
| 飞书 webhook | ❌ **仍然有效**（16:08、16:12 两次发送均 `code:0`）→ 需用户删除机器人并重建 |
| 仓库形态 | 5 个文件散落根目录，未形成 `飞书提醒/`；`README.md` / `package.json` 疑似覆盖原文件 |

根因：① `.gitignore` 对网页拖拽上传完全无效；② 拖的是文件夹「内容」而非文件夹本身，路径丢失；③ 合并前未核对 PR 的 Files changed。

待办：删仓库中的 `secrets.json`、重建飞书机器人、恢复被覆盖的 `README.md` / `package.json`（内容可从 git 历史 `ea9649b` 之前取回）。

## 已知风险

| 风险 | 说明 |
|---|---|
| `sw.js` VERSION 未同步 | 改了 js/css 不改 VERSION → 浏览器认为无更新，界面“更新了没反应” |
| 新字段只改两处 | 必须 DEFAULT_DATA / Store.load / normalizeData 三处同时改 |
| GitHub Pages CDN | 缓存约 10 分钟，改完立刻刷新可能看到旧文件 |
| iOS PWA 独立存储 | iPhone 主屏 App 与 Safari 不共享 localStorage，条目数不一致是正常的 |
| `start.bat` 乱码 | UTF-8 + LF 被 GBK cmd 解析，报 `'t'`/`'b'` 碎片错误。已知未修，用 `node server.js` 代替 |
| 外部 scheme 唤起不保证成功 | Chrome 会弹外部协议确认框；同一手势里连跳多个协议 / 延迟跳转会被当指纹探测拦掉；微信、QQ 内置浏览器会拦；TWA 与 WebView fallback 行为未真机验证。见 `app.js` 应用启动器模块注释 |

## 环境事实

- Windows + Git Bash，`pwd` 返回 `/d/...` 形式，需要绝对 Windows 路径时手写 `D:/...`
- 无 JDK / Android SDK，本地无法编译 APK
- 语音识别只能在真机验证（无头浏览器无语音引擎）
- **本机出网必须走代理**：端口每次可能变，取 `$https_proxy`（本次会话是 `http://127.0.0.1:4662`，11-09 上午是 `14002`）。`curl` 需显式加 `-x` 才生效（环境变量 curl 不认）；Node 22 的 `fetch` 完全不读代理，直接 `fetch` 外网会 `ConnectTimeoutError`。本地脚本一律用 `execFileSync("curl", ["-x", px, ...])`
- 飞书 `open.feishu.cn` 是国内域名，**走代理反而可能失败**，直连即可（Python 用 `ProxyHandler({})` 显式禁代理）
