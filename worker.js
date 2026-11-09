/**
 * 工作台 · 飞书提醒（Cloudflare Worker）
 *
 * 由 Cloudflare Cron 每分钟触发一次：
 *   读私有 Gist 的 workbench.json → 算哪些课/待办正好在 30 分钟后
 *   → POST 到飞书群机器人
 *
 * 环境变量（Settings → Variables and Secrets，全部选 Secret 类型）
 *   FEISHU_HOOK   飞书群机器人 webhook
 *   GH_TOKEN      只勾 gist 权限的 GitHub token
 *   GIST_ID       你的 Gist ID
 * 可选
 *   LEAD_MIN      提前几分钟，默认 30
 *   MORNING_AT    每日汇总时间，默认 07:30（设为 off 关闭）
 *   EVENING_AT    晚间未完成提醒，默认 20:30（设为 off 关闭）
 *
 * 所有时间按北京时间（UTC+8）算，跟服务器时区无关。
 */

const BEIJING_OFFSET = 8 * 3600e3;

/* ---------------- 时间工具 ---------------- */

export function toMin(s) {
  const a = String(s || "").split(":").map(Number);
  if (!a.length || isNaN(a[0])) return -1;
  return a[0] * 60 + (a[1] || 0);
}

export function nowInBeijing() {
  const d = new Date(Date.now() + BEIJING_OFFSET);
  return {
    ymd: d.toISOString().slice(0, 10),
    wd: d.getUTCDay() === 0 ? 7 : d.getUTCDay(), // 你的数据里 7 = 周日
    mins: d.getUTCHours() * 60 + d.getUTCMinutes()
  };
}

export function weekdayName(n) {
  return ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"][n] || "";
}

/**
 * 解析教务导入的周次串
 *   "2-4周(双),5-10周,12-13周" → Set{5..10, 12, 13, 2, 4}
 *   支持：单周 / 双周 / 单点周 / 区间
 */
export function parseWeeks(s) {
  const set = new Set();
  String(s || "").split(/[,，]/).forEach(part => {
    part = part.trim();
    if (!part) return;
    const m = part.match(/[（(](单|双)[)）]/);
    const parity = m ? m[1] : "";
    const nums = part.match(/\d+/g);
    if (!nums) return;
    const a = Number(nums[0]);
    const b = nums[1] === undefined ? a : Number(nums[1]);
    for (let n = a; n <= b; n++) {
      if (parity === "单" && n % 2 === 0) continue;
      if (parity === "双" && n % 2 === 1) continue;
      set.add(n);
    }
  });
  return set;
}

/** 第几教学周；termStart 为空或今天早于开学日返回 0 */
export function weekNo(termStart, ymd) {
  const a = Date.parse(termStart + "T00:00:00Z");
  const b = Date.parse(ymd + "T00:00:00Z");
  if (!a || !b || b < a) return 0;
  return Math.floor((b - a) / 86400e3 / 7) + 1;
}

/* ---------------- 数据筛选 ---------------- */

/** 今天实际上要上的课（已按周次过滤，按开始时间排序） */
export function todayCourses(data, now) {
  const wk = (data.settings || {}).termStart
    ? weekNo(data.settings.termStart, now.ymd) : 0;
  if (wk <= 0) return [];
  return (data.courses || [])
    .filter(c => {
      if (Number(c.day) !== now.wd) return false;
      const set = parseWeeks(c.weeks);
      return !set.size || set.has(wk);
    })
    .sort((a, b) => toMin(a.start) - toMin(b.start));
}

/** 今天还没完成的待办（含没填时间的） */
export function todayTodos(data, now) {
  return (data.todos || []).filter(t => t.date === now.ymd && !t.done);
}

/* ---------------- 消息组装 ---------------- */

/**
 * 返回本次该发的消息数组（空数组 = 这一刻什么都不用发）
 * 靠「正好差 lead 分钟」这一分钟触发，不需要任何去重状态
 */
export function buildMessages(data, now, opt = {}) {
  const lead = opt.lead == null ? 30 : Number(opt.lead);
  const morningAt = opt.morningAt === undefined ? "07:30" : opt.morningAt;
  const eveningAt = opt.eveningAt === undefined ? "20:30" : opt.eveningAt;
  const out = [];
  const wk = (data.settings || {}).termStart
    ? weekNo(data.settings.termStart, now.ymd) : 0;

  /* 1. 课程 · 提前 lead 分钟 */
  for (const c of todayCourses(data, now)) {
    if (toMin(c.start) - now.mins !== lead) continue;
    let s = "📚 " + lead + " 分钟后上课\n" + c.name + "  " + c.start + "-" + c.end;
    if (c.room) s += "\n📍 " + c.room;
    if (c.teacher) s += "\n👤 " + c.teacher;
    out.push(s);
  }

  /* 2. 待办 · 提前 lead 分钟（只对填了时间的） */
  for (const t of todayTodos(data, now)) {
    if (!t.time) continue;
    if (toMin(t.time) - now.mins !== lead) continue;
    out.push("⏰ " + lead + " 分钟后待办\n" + (t.text || "未命名") + "（" + t.time + "）");
  }

  /* 3. 早间汇总（覆盖没填时间的待办） */
  if (morningAt !== "off" && toMin(morningAt) === now.mins) {
    const cs = todayCourses(data, now);
    const ts = todayTodos(data, now);
    if (cs.length || ts.length) {
      const lines = ["🌅 今天" + (wk > 0 ? "第 " + wk + " 周 " : "") + weekdayName(now.wd)];
      if (cs.length) {
        lines.push("课程 " + cs.length + " 节");
        cs.slice(0, 4).forEach(c => lines.push("  " + c.start + " " + c.name));
        if (cs.length > 4) lines.push("  …还有 " + (cs.length - 4) + " 节");
      }
      if (ts.length) {
        lines.push("待办 " + ts.length + " 件");
        ts.slice(0, 6).forEach(t => lines.push("  · " + (t.text || "") + (t.time ? " " + t.time : "")));
        if (ts.length > 6) lines.push("  …还有 " + (ts.length - 6) + " 件");
      }
      out.push(lines.join("\n"));
    }
  }

  /* 4. 晚间 · 今天还没勾掉的 */
  if (eveningAt !== "off" && toMin(eveningAt) === now.mins) {
    const left = todayTodos(data, now);
    if (left.length) {
      const lines = ["🌙 今天还有 " + left.length + " 件待办没勾"];
      left.slice(0, 6).forEach(t => lines.push("  · " + (t.text || "") + (t.time ? " " + t.time : "")));
      if (left.length > 6) lines.push("  …还有 " + (left.length - 6) + " 件");
      out.push(lines.join("\n"));
    }
  }

  return out;
}

/* ---------------- IO ---------------- */

export async function fetchData(env) {
  const r = await fetch("https://api.github.com/gists/" + env.GIST_ID, {
    headers: {
      Authorization: "Bearer " + env.GH_TOKEN,
      Accept: "application/vnd.github+json",
      "User-Agent": "workbench-reminder"
    }
  });
  if (!r.ok) {
    throw new Error("读 Gist 失败 " + r.status + " " + (await r.text()).slice(0, 120));
  }
  const j = await r.json();
  const f = j.files && j.files["workbench.json"];
  if (!f) throw new Error("这个 Gist 里没有 workbench.json");
  if (f.truncated) throw new Error("workbench.json 太大被截断");
  return JSON.parse(f.content);
}

/** 前缀「【工作台】」用来过飞书机器人的「自定义关键词」校验，别删 */
export async function send(hook, text) {
  const r = await fetch(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msg_type: "text", content: { text: "【工作台】\n" + text } })
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && (j.code === 0 || j.StatusCode === 0), resp: j };
}

/* ---------------- Worker 入口 ---------------- */

export default {
  /* Cron 每分钟调这个 */
  async scheduled(event, env, ctx) {
    try {
      const data = await fetchData(env);
      const msgs = buildMessages(data, nowInBeijing(), {
        lead: env.LEAD_MIN || 30,
        morningAt: env.MORNING_AT || "07:30",
        eveningAt: env.EVENING_AT || "20:30"
      });
      for (const m of msgs) {
        const r = await send(env.FEISHU_HOOK, m);
        if (!r.ok) console.error("飞书拒收:", JSON.stringify(r.resp));
      }
      console.log("本轮发送 " + msgs.length + " 条");
    } catch (e) {
      console.error("提醒失败:", e.message);
    }
  },

  /* 用浏览器打开 Worker 地址 → 干跑一次，只返回“这一刻会发什么”，不会真发 */
  async fetch(request, env) {
    try {
      const data = await fetchData(env);
      const now = nowInBeijing();
      const msgs = buildMessages(data, now, {
        lead: env.LEAD_MIN || 30,
        morningAt: env.MORNING_AT || "07:30",
        eveningAt: env.EVENING_AT || "20:30"
      });
      const wk = (data.settings || {}).termStart
        ? weekNo(data.settings.termStart, now.ymd) : 0;
      return Response.json({
        现在: now.ymd + " " + weekdayName(now.wd) + " 第 " + wk + " 周 " +
              String(Math.floor(now.mins / 60)).padStart(2, "0") + ":" +
              String(now.mins % 60).padStart(2, "0"),
        这一刻会发: msgs,
        今天的课: todayCourses(data, now).map(c => c.start + " " + c.name),
        今天的待办: todayTodos(data, now).map(t => (t.time || "未定时间") + " " + t.text)
      });
    } catch (e) {
      return Response.json({ 出错: e.message }, { status: 500 });
    }
  }
};
