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
| `sw.js` VERSION | `wb-v11-sec`（本轮安全修复版；发布新改动前必须往上加） |
| 数据同步 | GitHub 私有 Gist（只传数据 `wb_data_v1`，不传代码） |
| 代码同步 | GitHub REST API 推 `main`（git 协议在本沙箱被 schannel 拦，不可用） |

## 功能清单（wb-v11 实际有的）

首页总览 / 时间线（日+周课表）/ 待办（列表+四象限、自然语言录入）/ 记录沉淀（语音+AI 提炼+流水+周复盘）/ 技能进度 / 打卡 / 倒计时。
数据层还有 `projects` 字段但**无界面**（留的坑）。
飞书提醒是独立 Cloudflare Worker（cron 每分钟），读 Gist 推飞书，源码在 `飞书提醒/`，设 `off` 可关早晚汇总。

## 已完成

- **wb-v8**：回收站（软删 30 天/300 条）、本地历史快照（环形 20 版）、云端删前归档、图标根目录化
- **wb-v9**：7 组动效层（`.view.enter` 一次性 class 驱动，700ms 摘除）
- **wb-v11**：待办象限支持拖拽与下拉调整
- **2026-11-12**：学习通作业功能（wb-v12/v13）已按用户要求**整体回退**，main 退回 wb-v11；保全分支 `wb-v13-xxt` @ `b5e1eb6` 保留全部学习通代码，随时可恢复
- **2026-11-16 安全清理**：删除泄露的 `secrets.json`（根+飞书提醒各一份）、死目录 `assets/`、`gen-icons.js`、根目录整套重复文件（worker/local-test/package/README，与 `飞书提醒/` 逐字节相同）；`.gitignore` 增加 `*secrets*.json` / `.env`

## 未完成 / 待用户

1. **吊销已泄露的密钥（用户 MUST 亲自做）**：公开仓库历史里曾有明文 GitHub token（`ghp_calX…0154icE`）和飞书 webhook。删文件不能让 token 失效——去 GitHub Settings → Developer settings → Tokens 吊销该 token；去飞书群机器人详情页重置 webhook。完成后本项目的飞书提醒本地 `--send` 需新建 `飞书提醒/secrets.json`（格式见 `飞书提醒/README.md`）才能用。
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
