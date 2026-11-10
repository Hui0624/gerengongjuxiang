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
    termStart: "",
    /* 周主题：按周号存覆盖项，例如 { "12": { skillId: "s1", goal: "跑通 I2C", target: 5 } }；留空则该周自动轮转技能 */
    weekThemes: {},
    /* 时间线显示时段（小时）。tlStart 可 0~12，tlEnd 可 12~24 */
    tlStart: 6,
    tlEnd: 24,
    /* normal=每小时60px，compact=46px */
    tlDensity: "normal"
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
  ],
  /* 流水（产出的唯一来源）
     type: win 成果 / pit 踩坑 / idea 想法
     detail 存「为什么 / 怎么解的」，tags 用来聚合项目与领域 */
  logs: [],
  /* 项目档案：从流水按 projectId 聚合，不单独维护 */
  projects: [],
  /* 周复盘的人工总结：{ "2026-W45": "这周的一句话" } */
  reviews: {},
  /* 回收站：删除的数据不真删，先挪到这里，30 天内可恢复
     结构 { id, kind, label, deletedAt, item } */
  trash: [],

  /* 应用启动器（wb-v10）
     groups[].apps[]：name 只是内部标识，note 才是图标下面唯一显示的文字。
     scheme 各家 App 不同，一律留空由用户手填，不预置猜测值。
     img 是压缩到 128px 的 dataURL，避免撑大 Gist。 */
  appGroups: [
    { id: "g-campus", name: "校园", apps: [
      { id: "a-jrxy", name: "今日校园", note: "签到",     scheme: "", initial: "今", color: 0, img: "", download: "" },
      { id: "a-yxy",  name: "易校园",   note: "校园缴费", scheme: "", initial: "易", color: 1, img: "", download: "" },
      { id: "a-zhxl", name: "智慧笑联", note: "洗衣热水", scheme: "", initial: "智", color: 2, img: "", download: "" }
    ]},
    { id: "g-study", name: "学习", apps: [
      { id: "a-xxt",  name: "学习通",   note: "学习打卡", scheme: "", initial: "学", color: 3, img: "", download: "" }
    ]}
  ]
};

/* 给旧数据补齐新字段（训练记录 / 技能绑定 / 待办结束时间 / 流水），避免升级后读到 undefined */
function fillItemDefaults(d) {
  if (!d) return d;
  d.todos = (Array.isArray(d.todos) ? d.todos : []).map(t => Object.assign({ end: "" }, t));
  d.skills = (Array.isArray(d.skills) ? d.skills : []).map(s => Object.assign({ trainLog: {}, target: 100 }, s));
  d.habits = (Array.isArray(d.habits) ? d.habits : []).map(h => Object.assign({ skillId: "" }, h));
  d.countdowns = (Array.isArray(d.countdowns) ? d.countdowns : []).map(c => Object.assign({ skillId: "" }, c));
  d.logs = (Array.isArray(d.logs) ? d.logs : []).map(l =>
    Object.assign({ detail: "", tags: [], link: "", projectId: "", type: "win", ts: 0 }, l));
  d.projects = Array.isArray(d.projects) ? d.projects : [];
  d.reviews = (d.reviews && typeof d.reviews === "object" && !Array.isArray(d.reviews)) ? d.reviews : {};
  /* 回收站：只保留结构正确的记录，丢掉脏数据 */
  d.trash = (Array.isArray(d.trash) ? d.trash : []).filter(t => t && t.kind && t.item);
  /* 应用启动器：空数组是合法的（用户可能删光分组），不要强行恢复默认 */
  d.appGroups = Array.isArray(d.appGroups)
    ? d.appGroups.filter(g => g && Array.isArray(g.apps))
    : JSON.parse(JSON.stringify(DEFAULT_DATA.appGroups));
  return d;
}

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
      countdowns: parsed && Array.isArray(parsed.countdowns) ? parsed.countdowns : JSON.parse(JSON.stringify(DEFAULT_DATA.countdowns)),
      logs: parsed && Array.isArray(parsed.logs) ? parsed.logs : [],
      projects: parsed && Array.isArray(parsed.projects) ? parsed.projects : [],
      reviews: (parsed && parsed.reviews && typeof parsed.reviews === "object") ? parsed.reviews : {},
      trash: parsed && Array.isArray(parsed.trash) ? parsed.trash : [],
      appGroups: parsed && Array.isArray(parsed.appGroups)
        ? parsed.appGroups
        : JSON.parse(JSON.stringify(DEFAULT_DATA.appGroups))
    };
    return fillItemDefaults(this.data);
  },

  /* opts.snapshot=true 时，写入前先留一版快照（破坏性操作专用）
     opts.force=true 跳过 10 分钟节流 */
  save(opts) {
    const o = opts || {};
    if (o.snapshot) {
      try { Snapshot.capture(o.label || "自动", !!o.force); } catch (e) {}
    }
    this.data.updatedAt = Date.now();
    try { localStorage.setItem(WB_KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    if (typeof window !== "undefined" && typeof window.onDataChanged === "function") {
      window.onDataChanged();
    }
  },

  reset() {
    /* 重置前先强行存一版，否则这步下去就真没退路了 */
    try { Snapshot.capture("重置前", true); } catch (e) {}
    this.data = fillItemDefaults(JSON.parse(JSON.stringify(DEFAULT_DATA)));
    this.save();
  }
};

/* =========================================================
   回收站：删除 = 挪进 trash，不真删
   ========================================================= */
const Trash = {
  KEEP_DAYS: 30,     // 保留 30 天
  MAX: 300,          // 最多存 300 条，防止无限膨胀

  /* kind → 数据数组的字段名 */
  arrKey(kind) {
    return { todo: "todos", countdown: "countdowns", skill: "skills", habit: "habits", log: "logs" }[kind] || "";
  },

  /* 可读名字，回收站里显示 */
  kindName(kind) {
    return { todo: "待办", countdown: "倒计时", skill: "技能", habit: "习惯", log: "记录" }[kind] || "条目";
  },

  /* 移入回收站并返回被删的对象（方便调用方继续 filter 原数组） */
  add(kind, item, label) {
    if (!item) return null;
    if (!Array.isArray(Store.data.trash)) Store.data.trash = [];
    Store.data.trash.unshift({
      id: uid(),
      kind,
      label: String(label || "").slice(0, 80),
      deletedAt: Date.now(),
      item: JSON.parse(JSON.stringify(item))
    });
    this.prune();
    return item;
  },

  /* 清掉超过 30 天 / 超量的记录 */
  prune() {
    const cutoff = Date.now() - this.KEEP_DAYS * 864e5;
    const t = Array.isArray(Store.data.trash) ? Store.data.trash : [];
    Store.data.trash = t
      .filter(x => x && (x.deletedAt || 0) >= cutoff)
      .slice(0, this.MAX);
    return Store.data.trash;
  },

  list() {
    this.prune();
    return Store.data.trash || [];
  },

  /* 剩余可恢复天数 */
  daysLeft(rec) {
    const gone = Math.floor((Date.now() - (rec.deletedAt || 0)) / 864e5);
    return Math.max(0, this.KEEP_DAYS - gone);
  },

  /* 恢复一条 */
  restore(recId) {
    const rec = (Store.data.trash || []).find(x => x.id === recId);
    if (!rec) return false;
    const key = this.arrKey(rec.kind);
    if (!key) return false;
    if (!Array.isArray(Store.data[key])) Store.data[key] = [];
    const item = JSON.parse(JSON.stringify(rec.item));
    /* 同 id 已存在（可能后来手动又建了一个），换新 id 避免冲突 */
    if (Store.data[key].some(x => x && x.id === item.id)) item.id = uid();
    Store.data[key].push(item);
    Store.data.trash = (Store.data.trash || []).filter(x => x.id !== recId);
    return true;
  },

  remove(recId) {
    Store.data.trash = (Store.data.trash || []).filter(x => x.id !== recId);
  },

  clear() {
    Store.data.trash = [];
  },

  count() {
    return (Store.data.trash || []).length;
  }
};

/* =========================================================
   本地历史快照：环形缓冲，存最近 N 版
   放独立 localStorage key，不进 Gist、不进导出 JSON
   ========================================================= */
const Snapshot = {
  KEY: "wb_snapshots_v1",
  MAX: 20,            // 保留 20 版
  THROTTLE: 10 * 60000, // 非强制时，10 分钟内不重复存
  MAX_SIZE: 500 * 1024, // 单版超过 500KB 就不存，避免撑爆 5MB 限额

  list() {
    try {
      const raw = localStorage.getItem(this.KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  },

  /* 存一版；force=true 无视节流 */
  capture(label, force) {
    const arr = this.list();
    const now = Date.now();
    if (!force && arr[0] && now - arr[0].ts < this.THROTTLE) return false;

    const copy = JSON.parse(JSON.stringify(Store.data));
    delete copy.trash;              // 回收站不进快照，重复数据会撑爆配额
    const size = JSON.stringify(copy).length;
    if (size > this.MAX_SIZE) {
      console.warn("[snapshot] 数据过大，跳过：", size);
      return false;
    }
    arr.unshift({ ts: now, label: label || "自动", size, data: copy });
    try {
      localStorage.setItem(this.KEY, JSON.stringify(arr.slice(0, this.MAX)));
      return true;
    } catch (e) {
      /* 配额满了：砍一半再试一次 */
      try {
        localStorage.setItem(this.KEY, JSON.stringify(arr.slice(0, Math.max(3, Math.floor(this.MAX / 2)))));
        return true;
      } catch (e2) {
        console.warn("[snapshot] 写入失败：", e2.message);
        return false;
      }
    }
  },

  /* 恢复到某一版（恢复前会先把当前数据再存一版，防止恢复错了没退路） */
  restore(ts) {
    const rec = this.list().find(x => x.ts === ts);
    if (!rec || !rec.data) return false;
    this.capture("恢复前", true);
    const keepTrash = Store.data.trash;
    Store.data = fillItemDefaults(JSON.parse(JSON.stringify(rec.data)));
    Store.data.trash = Array.isArray(keepTrash) ? keepTrash : [];
    Store.save();
    return true;
  },

  remove(ts) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.list().filter(x => x.ts !== ts)));
    } catch (e) {}
  },

  /* 给列表显示用的摘要 */
  summary(data) {
    if (!data) return "";
    const n = k => (Array.isArray(data[k]) ? data[k].length : 0);
    return `待办 ${n("todos")} · 记录 ${n("logs")} · 技能 ${n("skills")} · 打卡 ${n("habits")} · 倒计时 ${n("countdowns")}`;
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

/* =========================================================
   AI 配置：只存在本机浏览器，不进 Gist、不进导出的 JSON
   Key 不写进代码（仓库是公开的），由用户在设置里自己填
   ========================================================= */
const AI_PRESETS = [
  { id: "deepseek", name: "DeepSeek", base: "https://api.deepseek.com", model: "deepseek-chat", note: "便宜，官方接口可能不允许浏览器直接调用" },
  { id: "siliconflow", name: "硅基流动", base: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-7B-Instruct", note: "支持浏览器直连，免费额度够用" },
  { id: "zhipu", name: "智谱 GLM", base: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash", note: "免费模型，速度较快" },
  { id: "custom", name: "自定义", base: "", model: "", note: "任何 OpenAI 兼容接口 / 自建代理" }
];

const AICfg = {
  get key() { return localStorage.getItem("wb_ai_key") || ""; },
  set key(v) { v ? localStorage.setItem("wb_ai_key", v) : localStorage.removeItem("wb_ai_key"); },
  get base() { return localStorage.getItem("wb_ai_base") || "https://api.deepseek.com"; },
  set base(v) { localStorage.setItem("wb_ai_base", (v || "").replace(/\/+$/, "")); },
  get model() { return localStorage.getItem("wb_ai_model") || "deepseek-chat"; },
  set model(v) { localStorage.setItem("wb_ai_model", v || "deepseek-chat"); },
  /* 语音说完自动提炼，关掉则只转文字 */
  get polish() { return localStorage.getItem("wb_ai_polish") !== "0"; },
  set polish(v) { localStorage.setItem("wb_ai_polish", v ? "1" : "0"); },
  get ready() { return !!this.key; },
  /* 拼出 chat/completions 地址，兼容用户填到 /v1 或不到 /v1 */
  url() {
    let b = (this.base || "").replace(/\/+$/, "");
    if (/\/chat\/completions$/.test(b)) return b;
    if (/\/v\d+$/.test(b)) return b + "/chat/completions";
    return b + "/v1/chat/completions";
  }
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

  /* 数一下核心条目总数，用来判断这次上传是不是「变少了」 */
  countItems(d) {
    const n = k => (Array.isArray(d[k]) ? d[k].length : 0);
    return n("todos") + n("logs") + n("skills") + n("habits") + n("countdowns");
  },

  /* 条目骤减（少 3 条以上，或减少 ≥30%）时，先把云端当前版本留档
     返回需要随 PATCH 一起提交的 files，或 null */
  async archiveIfShrunk(gid, data) {
    const prev = Number(localStorage.getItem("wb_last_count") || 0);
    const cur = this.countItems(data);
    localStorage.setItem("wb_last_count", String(cur));
    if (prev <= 0) return null;

    const drop = prev - cur;
    const shrunk = drop >= 3 || (prev >= 5 && drop / prev >= 0.3);
    if (!shrunk) return null;

    const g = await this.api("GET", "/gists/" + gid + "?_=" + Date.now());
    const f = g.files && g.files["workbench.json"];
    if (!f || f.truncated) return null;

    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    const files = {};
    files["archive-" + stamp + ".json"] = { content: f.content };

    /* 归档只留最近 7 份，多的传 null 删掉 */
    const olds = Object.keys(g.files || {})
      .filter(k => /^archive-.*\.json$/.test(k))
      .sort();
    olds.slice(0, Math.max(0, olds.length - 6)).forEach(k => { files[k] = null; });

    console.log("[archive] 条目 " + prev + " → " + cur + "，已留存云端旧版");
    return files;
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
      localStorage.setItem("wb_last_count", String(GH.countItems(Store.data)));
    } else {
      const files = { "workbench.json": { content } };
      /* 正常情况零额外请求；只有条目骤减才会多一次 GET 去留档 */
      try {
        const extra = await GH.archiveIfShrunk(gid, Store.data);
        if (extra) Object.assign(files, extra);
      } catch (e) {
        console.warn("[archive] 留档失败，继续上传：", e.message);
      }
      await GH.api("PATCH", "/gists/" + gid, { files });
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
