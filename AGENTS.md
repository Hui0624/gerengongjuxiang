# AGENTS.md — 个人工作台协作协议

本项目是纯前端 PWA 个人工作台（待办四象限 / 课程表时间线 / 打卡 / 技能 / 倒计时 / 记录沉淀 / 回收站）。

- 线上：https://hui0624.github.io/gerengongjuxiang/
- 本地：`node server.js` → http://localhost:7788
- 数据同步：GitHub 私有 Gist（只传数据，不传代码）
- 代码同步：git push → GitHub Pages

**两个 agent 共用这一个目录：Codex（终端）和 WorkBuddy（桌面端）。**
开工前必须读完本文件 + `STATE.md` + `HANDOFF.md`，收工前必须写日志 + 更新 `STATE.md` + 回写 `HANDOFF.md`。

---

## 铁律

1. **先看 STATE.md 再动手**。它记录当前版本、未完成事项、已知风险。改完必须回来更新它。

2. **日志按 agent 分文件，绝不写同一个文件。**
   - Codex → `.workbuddy/memory/YYYY-MM-DD-codex.md`
   - WorkBuddy → `.workbuddy/memory/YYYY-MM-DD-workbuddy.md`

   原因：往同一个文件“追加”的实际行为是「各自读全文 → 各自写全文」，后写的人会把前一个人的内容**整段静默覆盖**，不报错，查不出来。历史遗留的 `2026-11-0X.md`（无后缀）不要再往里写。

3. **改代码前先看 `git status`。**
   如果有未提交改动且来路不明，停下来问用户，不要直接覆盖。同一时间只允许一方改动 `app.js` / `style.css` / `data.js` / `index.html`。

4. **发布前必须改 `sw.js` 第 7 行的 `VERSION`。**
   浏览器判断有无新版本，只比对 `sw.js` 文件的字节。只改 `app.js` 不改 `VERSION`，用户看到的还是旧界面（第一次打开旧版，第二次才变），极易误判为部署失败。

5. **新增数据字段必须同时改三处。**
   `DEFAULT_DATA`（data.js）、`Store.load`（data.js）、`normalizeData`（app.js）。漏任何一处，从云端拉回数据时字段会丢。

6. **`工作台-单文件.html` 是生成物，不要手改。**
   它由内联脚本从 `index.html` + CSS + JS 产出，手改下次生成就被覆盖。当前该文件**内容陈旧（仍是 wb-v7）**。

7. **不要再用 `assets/` 路径引用图标。**
   线上 `assets/` 目录整体 404。图标已迁到项目根目录（`icon-192.png` / `icon-512.png` / `icon-maskable-512.png`），`manifest.json`、`index.html`、`sw.js`、`app.js` 全部引用根目录相对路径。

8. **不要单独 `git push`。** 见 `STATE.md` 的「Git 分叉」一节，需要先 `git fetch` 处理。

---

## 日志格式（两边统一）

```markdown
# YYYY-MM-DD

## HH:MM 一句话标题

- 改了哪些文件、改了什么
- 根因（修 bug 时必写，写清为什么会这样，不要只写“已修复”）
- 怎么验证的（命令 / 截图 / 字节数比对，要能被别人复现）
- 没做的 / 遗留
- 风险
```

## 交接

`HANDOFF.md` 是唯一的信箱。**只保留最新一条未读消息**，收工覆盖写，开工读完清空（或标记已读）。不要在信箱里堆历史，历史属于日志。

## 当前状态

见 `STATE.md`。
