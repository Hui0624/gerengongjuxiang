/* =========================================================
   data.js —— 数据层（纯本地 localStorage，零依赖）
   以后接 GitHub Gist 同步时，只需替换 load/save 两个方法
   ========================================================= */

const WB_KEY = "wb_data_v1";

/* ---------- 日期工具 ---------- */
function pad2(n) { return String(n).padStart(2, "0"); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function todayWeekday() {
  const d = new Date().getDay(); // 0=周日
  return d === 0 ? 7 : d;
}
function weekdayName(n) {
  return ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"][n] || "";
}
function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
function hhmmToMin(s) {
  if (!s) return 0;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}
function minToHHMM(min) {
  min = Math.max(0, Math.min(24 * 60, Math.round(min)));
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- 默认数据 ---------- */
const DEFAULT_DATA = {
  version: 2,
  settings: {
    /* 本学期第 1 周的周一，格式 YYYY-MM-DD；留空则周次显示为「第 ? 周」 */
    termStart: ""
  },
  courses: [
    { id: "c1", name: "高等数学", day: 1, start: "08:00", end: "09:40", room: "3-201" },
    { id: "c2", name: "大学物理", day: 1, start: "10:00", end: "11:40", room: "3-205" },
    { id: "c3", name: "程序设计基础", day: 1, start: "14:00", end: "15:40", room: "实验楼 A302" },

    { id: "c4", name: "高等数学", day: 2, start: "08:00", end: "09:40", room: "3-201" },
    { id: "c5", name: "大学英语", day: 2, start: "10:00", end: "11:40", room: "2-108" },
    { id: "c6", name: "嵌入式系统", day: 2, start: "14:00", end: "15:40", room: "实验楼 A306" },
    { id: "c7", name: "体育（健身）", day: 2, start: "16:00", end: "17:40", room: "体育馆" },

    { id: "c8", name: "线性代数", day: 3, start: "08:00", end: "09:40", room: "3-207" },
    { id: "c9", name: "思想道德与法治", day: 3, start: "10:00", end: "11:40", room: "1-301" },
    { id: "c10", name: "电路分析", day: 3, start: "14:00", end: "15:40", room: "实验楼 A208" },

    { id: "c11", name: "大学英语", day: 4, start: "08:00", end: "09:40", room: "2-108" },
    { id: "c12", name: "高等数学", day: 4, start: "10:00", end: "11:40", room: "3-201" },
    { id: "c13", name: "嵌入式实验", day: 4, start: "14:00", end: "15:40", room: "实验楼 A306" },

    { id: "c14", name: "程序设计基础", day: 5, start: "08:00", end: "09:40", room: "实验楼 A302" },
    { id: "c15", name: "体育（健身）", day: 5, start: "10:00", end: "11:40", room: "体育馆" },
    { id: "c16", name: "单片机原理", day: 5, start: "14:00", end: "15:40", room: "实验楼 A310" }
  ],
  todos: [
    { id: "t1", text: "复习英语单词 20 分钟", time: "16:00", date: todayStr(), quad: 2, done: false },
    { id: "t2", text: "嵌入式：跑通 I2C 编码器读取", time: "19:00", date: todayStr(), quad: 1, done: false },
    { id: "t3", text: "健身：俯卧撑三组 + 深蹲", time: "21:00", date: todayStr(), quad: 4, done: false },
    { id: "t4", text: "交英语作业", time: "", date: todayStr(), quad: 1, done: false },
    { id: "t5", text: "整理竞赛材料", time: "", date: todayStr(), quad: 2, done: false }
  ],
  countdowns: [
    { id: "cd1", name: "考研初试", date: "2026-12-20" }
  ],
  skills: [
    {
      id: "s1", icon: "💪", name: "嵌入式", progress: 40,
      method: "每天 1 小时：上午看 C 语言 / STM32 寄存器，下午动手调板子。\n重点：I2C 编码器 + IMU 双总线闭环。",
      links: {
        bili: "https://search.bilibili.com/all?keyword=STM32%20%E5%85%A5%E9%97%A8",
        dy: "https://www.douyin.com/search/%E5%B5%8C%E5%85%A5%E5%BC%8F"
      }
    },
    {
      id: "s2", icon: "📚", name: "英语", progress: 75,
      method: "每天 30 分钟背单词 + 15 分钟跟读；周末做一套四级真题，错题当天整理。",
      links: {
        bili: "https://search.bilibili.com/all?keyword=%E5%9B%9B%E5%85%AD%E7%BA%A7%20%E8%B7%9F%E8%AF%BB",
        dy: "https://www.douyin.com/search/%E8%8B%B1%E8%AF%AD%E5%8F%A3%E8%AF%AD"
      }
    },
    {
      id: "s3", icon: "🏋", name: "健身", progress: 25,
      method: "周一三五力量：俯卧撑 / 深蹲 / 引体；周二四有氧 30 分钟；训练后拉伸 10 分钟。",
      links: {
        bili: "https://search.bilibili.com/all?keyword=%E5%AE%BF%E8%88%8D%20%E6%97%A0%E5%99%A8%E6%A2%B0%20%E5%81%A5%E8%BA%AB",
        dy: "https://www.douyin.com/search/%E5%BE%92%E6%89%8B%E5%81%A5%E8%BA%AB"
      }
    }
  ],
  habits: [
    { id: "h1", name: "早起 6:30", history: {} },
    { id: "h2", name: "背单词 30 分钟", history: {} },
    { id: "h3", name: "健身打卡", history: {} },
    { id: "h4", name: "喝水 8 杯", history: {} }
  ]
};

/* ---------- 存储 ---------- */
const Store = {
  data: null,

  load() {
    let raw = null;
    try { raw = localStorage.getItem(WB_KEY); } catch (e) { /* 隐私模式忽略 */ }
    let parsed = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    }
    // 合并默认值，保证字段完整（旧数据升级也不炸）
    this.data = {
      version: DEFAULT_DATA.version,
      settings: Object.assign(
        JSON.parse(JSON.stringify(DEFAULT_DATA.settings)),
        (parsed && parsed.settings) || {}
      ),
      courses: parsed && Array.isArray(parsed.courses) ? parsed.courses : JSON.parse(JSON.stringify(DEFAULT_DATA.courses)),
      todos: parsed && Array.isArray(parsed.todos) ? parsed.todos : JSON.parse(JSON.stringify(DEFAULT_DATA.todos)),
      skills: parsed && Array.isArray(parsed.skills) ? parsed.skills : JSON.parse(JSON.stringify(DEFAULT_DATA.skills)),
      habits: parsed && Array.isArray(parsed.habits) ? parsed.habits : JSON.parse(JSON.stringify(DEFAULT_DATA.habits)),
      countdowns: parsed && Array.isArray(parsed.countdowns) ? parsed.countdowns : JSON.parse(JSON.stringify(DEFAULT_DATA.countdowns))
    };
    return this.data;
  },

  save() {
    this.data.updatedAt = Date.now();
    try { localStorage.setItem(WB_KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    if (typeof window !== "undefined" && typeof window.onDataChanged === "function") {
      window.onDataChanged();
    }
  },

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this.save();
  }
};

/* =========================================================
   云同步：GitHub Gist（私有，免费）
   Token 只存在本机浏览器，不会写进导出的数据里
   ========================================================= */
const SyncCfg = {
  get token() { return localStorage.getItem("wb_gh_token") || ""; },
  set token(v) { v ? localStorage.setItem("wb_gh_token", v) : localStorage.removeItem("wb_gh_token"); },
  get gistId() { return localStorage.getItem("wb_gist_id") || ""; },
  set gistId(v) { v ? localStorage.setItem("wb_gist_id", v) : localStorage.removeItem("wb_gist_id"); },
  get auto() { return localStorage.getItem("wb_auto_sync") === "1"; },
  set auto(v) { localStorage.setItem("wb_auto_sync", v ? "1" : "0"); },
  get lastSync() { return Number(localStorage.getItem("wb_last_sync") || 0); },
  set lastSync(v) { localStorage.setItem("wb_last_sync", String(v)); }
};

const GH = {
  async api(method, p, body) {
    if (!SyncCfg.token) throw new Error("请先填 GitHub Token");
    const r = await fetch("https://api.github.com" + p, {
      method,
      headers: {
        Authorization: "Bearer " + SyncCfg.token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await r.text();
    if (!r.ok) {
      let msg = text;
      try { msg = JSON.parse(text).message || text; } catch (e) {}
      throw new Error(r.status + " " + msg);
    }
    return text ? JSON.parse(text) : {};
  },

  async push() {
    const content = JSON.stringify(Store.data, null, 2);
    let gid = SyncCfg.gistId;
    if (!gid) {
      const g = await GH.api("POST", "/gists", {
        description: "我的工作台数据（私有）",
        public: false,
        files: { "workbench.json": { content } }
      });
      gid = g.id;
      SyncCfg.gistId = gid;
    } else {
      await GH.api("PATCH", "/gists/" + gid, {
        files: { "workbench.json": { content } }
      });
    }
    SyncCfg.lastSync = Date.now();
    return gid;
  },

  async pull() {
    if (!SyncCfg.gistId) throw new Error("还没有 Gist，先点「上传」创建一次");
    const g = await GH.api("GET", "/gists/" + SyncCfg.gistId + "?_=" + Date.now());
    const f = g.files && g.files["workbench.json"];
    if (!f) throw new Error("这个 Gist 里没有 workbench.json");
    if (f.truncated) throw new Error("数据太大被截断，建议拆小");
    return JSON.parse(f.content);
  }
};
