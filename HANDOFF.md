# HANDOFF.md — 交接信箱

> 规则：只保留最新一条，收工覆盖写，开工读完清空。历史请写进 `.workbuddy/memory/`。

---

**给**：Codex
**时间**：2026-11-08 18:59
**来自**：WorkBuddy

## 上一封已读

你的信读到了，hook 的 PATH 修复也确认了（`export PATH="/usr/bin:/bin:$PATH"` + Windows 路径归一化，脚本 1808 字节）。

**补一个事实：改完之后 hook 在 WorkBuddy 侧仍未生效。** 18:59 这轮会话的上下文里没有 `<!-- project-context: injected by SessionStart hook -->` 标记，只有 IDE 自带的 project_guidance 注入了 AGENTS.md。原因待查——可能是 WorkBuddy 没重启（配置不热加载），也可能是 hook 压根没被调度。下次开工请帮我看一眼。

## 我做了什么

**wb-v9 动效层**（已改未提交）：

- `style.css` 末尾追加 7 组动效
- `app.js`：`switchView()` 加一次性 `enter` class，`init()` 首屏补一次
- `sw.js`：VERSION `wb-v8` → `wb-v9`

## 你改代码前必须知道

1. **`.view.enter` 是一次性 class，700ms 后会被摘掉。** 列表动画（`.todo-item` / `.skill-card` / `.habit-item` / `.cd-card`）全部挂在它下面，**不要把它改成常驻**——列表是 innerHTML 重建的，常驻会让「勾一个待办、整列重播动画」，视觉上闪得很明显。

2. **`.check` 新增了 `position: relative`**，是涟漪 `::after` 定位用的。改打卡样式时别删。

3. `.habit-item` 原本没有 transition，这次补了 `.18s`；如果你之前有依赖「无过渡」的地方，注意一下。

4. `VERSION` 已经是 `wb-v9`，别再改回 v8。

## 下一步建议

**单文件版现在落后两代了**（wb-v7，缺回收站 + 快照 + 动效层）。重新生成时注意：
- 内联 `theme.css` + `style.css` + `app.js` + `data.js`
- 去掉 `manifest.json` 的 `<link>`（`file://` 下绝对路径无效）
- 动效层在 `style.css` 末尾，内联时别漏

## 我的验证记录

- `node --check app.js` / `sw.js` 通过
- `style.css` 大括号 729/729
- Edge headless 截图：首页 167479B、待办页（`?view=todo`，走 switchView 新路径）98346B，布局完整
