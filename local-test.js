/**
 * 本地测试 / 预览脚本（不会自动跑，只在你手动执行时跑一次）
 *
 *   node 飞书提醒/local-test.js                 干跑「现在」这一刻
 *   node 飞书提醒/local-test.js --scan          列出今天所有会触发的提醒时刻
 *   node 飞书提醒/local-test.js --at 18:30      模拟某个时刻
 *   node 飞书提醒/local-test.js --at 18:30 --send   真发一条到飞书
 *   node 飞书提醒/local-test.js --date 2026-11-10 --scan   看别的日子
 *
 * 说明：本机 Node 的 fetch 不走系统代理，所以网络请求走 curl；
 * 提醒逻辑（周次过滤、提前量判断、消息组装）用的仍是 worker.js 里同一份代码。
 *
 * 密钥放在同目录 secrets.json（已被 .gitignore 排除，不会进公开仓库）
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildMessages, nowInBeijing,
  todayCourses, todayTodos, weekNo, weekdayName, toMin
} from "./worker.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const pad2 = n => String(n).padStart(2, "0");
const hhmm = m => pad2(Math.floor(m / 60)) + ":" + pad2(m % 60);

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : def;
}
const doSend = process.argv.includes("--send");
const doScan = process.argv.includes("--scan");

const secrets = JSON.parse(fs.readFileSync(path.join(DIR, "secrets.json"), "utf8"));

/* ---------------- 网络（走 curl，自动继承系统代理） ---------------- */

function curl(args, input) {
  /* 本机走代理才能出网；显式传 -x，光靠环境变量 curl 不认 */
  const px = process.env.https_proxy || process.env.HTTPS_PROXY || "";
  const full = px ? ["-x", px].concat(args) : args;
  return execFileSync("curl", full, {
    encoding: "utf8",
    input,
    maxBuffer: 20 * 1024 * 1024
  });
}

function loadData() {
  const out = curl([
    "-s", "--max-time", "25",
    "-H", "Authorization: Bearer " + secrets.token,
    "-H", "Accept: application/vnd.github+json",
    "-H", "User-Agent: workbench-reminder",
    "https://api.github.com/gists/" + secrets.gistId
  ]);
  const j = JSON.parse(out);
  const f = j.files && j.files["workbench.json"];
  if (!f) throw new Error("这个 Gist 里没有 workbench.json");
  return JSON.parse(f.content);
}

function postFeishu(text) {
  const body = JSON.stringify({ msg_type: "text", content: { text: "【工作台】\n" + text } });
  const out = curl([
    "-s", "--max-time", "20",
    "-X", "POST",
    "-H", "Content-Type: application/json",
    "-d", "@-",
    secrets.hook
  ], body);
  let j = {};
  try { j = JSON.parse(out); } catch (e) { return { ok: false, resp: out }; }
  return { ok: j.code === 0 || j.StatusCode === 0, resp: j };
}

/* ---------------- 主流程 ---------------- */

const now = nowInBeijing();
const date = arg("--date", "");
const at = arg("--at", "");

if (date) {
  now.ymd = date;
  const d = new Date(date + "T00:00:00Z");
  now.wd = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
}
if (at) {
  const [h, m] = at.split(":").map(Number);
  now.mins = h * 60 + (m || 0);
}

const data = loadData();
const wk = (data.settings || {}).termStart ? weekNo(data.settings.termStart, now.ymd) : 0;

console.log("=".repeat(54));
console.log("日期 " + now.ymd + " " + weekdayName(now.wd) + "  第 " + wk + " 周");
console.log("=".repeat(54));

const cs = todayCourses(data, now);
const ts = todayTodos(data, now);

console.log("\n今天要上的课（已按周次过滤）：" + cs.length + " 节");
cs.forEach(c => console.log("  " + c.start + "-" + c.end + "  " + c.name +
  "  [" + (c.weeks || "每周") + "]" + (c.room ? "\n      📍" + c.room : "")));

console.log("\n今天的待办：" + ts.length + " 件");
ts.forEach(t => console.log("  " + (t.time ? t.time : "未定时间").padEnd(9) + " " + t.text));

if (doScan) {
  const plan = [];
  cs.forEach(c => plan.push({ at: toMin(c.start) - 30, text: "📚 " + c.name + "（" + c.start + " 上课）" }));
  ts.filter(t => t.time).forEach(t => plan.push({ at: toMin(t.time) - 30, text: "⏰ " + t.text + "（" + t.time + "）" }));
  plan.push({ at: toMin("07:30"), text: "🌅 早间汇总" });
  plan.push({ at: toMin("20:30"), text: "🌙 晚间未完成" });
  plan.sort((a, b) => a.at - b.at);
  console.log("\n今天会触发提醒的时刻：");
  plan.forEach(p => console.log("  " + hhmm(p.at) + "  " + p.text));
}

const msgs = buildMessages(data, now, { lead: 30, morningAt: "07:30", eveningAt: "20:30" });
console.log("\n" + "-".repeat(54));
console.log("模拟时刻 " + hhmm(now.mins) + " → 命中 " + msgs.length + " 条提醒");
msgs.forEach((m, i) => console.log("\n【第 " + (i + 1) + " 条】\n" + m));

if (doSend) {
  if (!msgs.length) {
    console.log("\n这个时刻没有要发的，换 --at 参数再试");
  } else {
    for (const m of msgs) {
      const r = postFeishu(m);
      console.log("\n发送结果：" + (r.ok ? "成功 ✅" : "失败 ❌ " + JSON.stringify(r.resp)));
    }
  }
}
