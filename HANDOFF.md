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

## 下一步

1. 确认用户已吊销 token / 重置 webhook。
2. 把本轮改动推到 main（REST API），复核线上文件树无 secrets、无 assets。
3. 用户要恢复学习通时，从 `wb-v13-xxt` 分支取，并重新解决 `workers.dev` 大陆不可达（买域名挂 CF 或国内云函数）。
