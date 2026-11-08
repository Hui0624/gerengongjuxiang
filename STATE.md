# STATE.md — 当前状态

> 最后更新：2026-11-08 18:59（WorkBuddy）
> 任何 agent 改完代码都要回来更新这份文件。

## 版本

| 项 | 值 |
|---|---|
| 已提交 HEAD | `ceca952`（**wb-v8**） |
| 工作区 | **wb-v9 动效层，已改未提交**（app.js / style.css / sw.js） |
| 线上 `sw.js` VERSION | `wb-v8`（18:00 实测）→ **wb-v9 尚未上传** |
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

## 未完成

1. **`工作台-单文件.html` 内容陈旧**：仍是 wb-v7，缺 wb-v8 回收站 / 快照，也缺 wb-v9 动效层。文件存在但 git 未跟踪。**现在它的落后差距比之前更大了**。
2. **APK 打包**：用户 2026-11-08 决定**暂缓**。已知结论：PWABuilder 走「Other Android」而非 Play 套餐；Fallback 应从 Custom Tabs 改为 Web View；根因是缺 `https://hui0624.github.io/.well-known/assetlinks.json`（当前 404）。
3. **项目档案功能**：`data.js` 已有 `projects` 字段但无界面，建议等记录模块数据攒两周再做。
4. **WorkBuddy 的 hook 仍未真正跑起来**：截至 2026-11-08 18:59，WorkBuddy 会话上下文里**没有** `<!-- project-context: injected by SessionStart hook -->` 标记，也没出现 STATE.md / HANDOFF.md 内容——只有 IDE 自带的 project_guidance 注入了 AGENTS.md。Codex 已修 PATH 与路径归一化，但需重启 WorkBuddy 后复验。**下次开工先查这一点**。

## Git 分叉（重要）

远端历史与本地**分叉**：用户习惯用 GitHub 网页拖拽上传，每次产生独立提交，本地没有 `origin` 跟踪引用。

- 后果：`git log origin/master..HEAD` 会误报“从未推送”，**不要用这个命令判断**
- 判断线上版本的可靠方法：直接抓 `https://.../sw.js` 看 `VERSION`
- 真要 push 时：`git fetch origin && git reset --soft origin/master`（`--soft` 不动文件，内容已一致）

## 已知风险

| 风险 | 说明 |
|---|---|
| `sw.js` VERSION 未同步 | 改了 js/css 不改 VERSION → 浏览器认为无更新，界面“更新了没反应” |
| 新字段只改两处 | 必须 DEFAULT_DATA / Store.load / normalizeData 三处同时改 |
| GitHub Pages CDN | 缓存约 10 分钟，改完立刻刷新可能看到旧文件 |
| iOS PWA 独立存储 | iPhone 主屏 App 与 Safari 不共享 localStorage，条目数不一致是正常的 |
| `start.bat` 乱码 | UTF-8 + LF 被 GBK cmd 解析，报 `'t'`/`'b'` 碎片错误。已知未修，用 `node server.js` 代替 |

## 环境事实

- Windows + Git Bash，`pwd` 返回 `/d/...` 形式，需要绝对 Windows 路径时手写 `D:/...`
- 无 JDK / Android SDK，本地无法编译 APK
- 语音识别只能在真机验证（无头浏览器无语音引擎）
