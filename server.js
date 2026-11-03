/* =========================================================
   server.js —— 本地一体化服务（仅用 Node 内置模块，无需 npm install）
   1) 托管工作台静态页面
   2) /api/import-course 代理登录正方教务、抓课表、解析成 JSON
   3) /api/parse-kb      解析手动粘贴的课表 HTML（兜底）
   启动：node server.js  → http://localhost:7788
   ========================================================= */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PORT = Number(process.env.WB_PORT || 7788);
const ROOT = __dirname;
const JW_BASE = process.env.WB_JW_BASE || "https://jwgl.huayu.edu.cn";

/* ---------- 作息时间（第 1 节 08:00 起，可在前端设置里改） ---------- */
const PERIODS = [
  { jc: 1, start: "08:00", end: "08:45" },
  { jc: 2, start: "08:55", end: "09:40" },
  { jc: 3, start: "10:00", end: "10:45" },
  { jc: 4, start: "10:55", end: "11:40" },
  { jc: 5, start: "14:00", end: "14:45" },
  { jc: 6, start: "14:55", end: "15:40" },
  { jc: 7, start: "16:00", end: "16:45" },
  { jc: 8, start: "16:55", end: "17:40" },
  { jc: 9, start: "19:00", end: "19:45" },
  { jc: 10, start: "19:55", end: "20:40" },
  { jc: 11, start: "20:50", end: "21:35" },
  { jc: 12, start: "21:45", end: "22:30" }
];

/* =========================================================
   基础工具
   ========================================================= */
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => {
      data += c;
      if (data.length > 2e6) { reject(new Error("请求体过大")); req.destroy(); }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/* 统一请求：urlStr 必须已是绝对地址；不会再做字符串拼接 */
function request(method, urlStr, { headers = {}, body = null, cookies = "" } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(urlStr);
    } catch (e) {
      return reject(new Error("地址不合法：" + urlStr));
    }
    const isHttps = u.protocol === "https:";
    const mod = isHttps ? https : http;
    const req = mod.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/json,*/*",
          "Accept-Language": "zh-CN,zh;q=0.9",
          ...(cookies ? { Cookie: cookies } : {}),
          ...headers
        },
        timeout: 20000
      },
      res => {
        const chunks = [];
        res.on("data", c => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
            url: urlStr
          })
        );
      }
    );
    req.on("timeout", () => req.destroy(new Error("连接教务系统超时")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/* ---------- RSA 加密（正方新版登录用） ---------- */
function rsaEncrypt(plain, modulusB64, exponentB64) {
  const n = Buffer.from(modulusB64, "base64").toString("base64url");
  const e = Buffer.from(exponentB64, "base64").toString("base64url");
  const key = crypto.createPublicKey({ key: { kty: "RSA", n, e }, format: "jwk" });
  return crypto
    .publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(plain, "utf8"))
    .toString("base64");
}

function htmlText(s) {
  return String(s || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   正方客户端
   - 所有地址都通过 new URL(p, base) 解析，绝对地址（如 http://…）也能正确处理
   - 自动跟随 302，并累计 cookie
   - 每一步写入 trace，失败时回传给前端，便于定位
   ========================================================= */
class JwglClient {
  constructor(base) {
    this.base = base.replace(/\/+$/, "");
    this.cookies = {};
    this.trace = [];
    this.dumps = [];
  }
  /* 把每次响应原文记下来，失败时落盘便于诊断 */
  dump(stage, xnm, xqm, r) {
    if (this.dumps.length > 12) return;
    this.dumps.push({
      stage,
      xnm: String(xnm || ""),
      xqm: String(xqm || ""),
      status: r.status,
      url: String(r.url || "").replace(this.base, ""),
      len: (r.body || "").length,
      body: String(r.body || "").slice(0, 400000)
    });
  }
  log(step, extra) {
    this.trace.push(extra ? step + "：" + extra : step);
    if (this.trace.length > 30) this.trace.shift();
  }
  cookieHeader() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }
  absorb(setCookie) {
    (setCookie || []).forEach(c => {
      const first = c.split(";")[0];
      const i = first.indexOf("=");
      if (i > 0) this.cookies[first.slice(0, i).trim()] = first.slice(i + 1).trim();
    });
  }
  abs(p) {
    return new URL(p, this.base + "/").toString();
  }
  /* 单次请求，唯一入口：p 可以是相对路径或绝对地址 */
  async hit(method, p, opts = {}) {
    const url = this.abs(p);
    const r = await request(method, url, { ...opts, cookies: this.cookieHeader() });
    this.absorb(r.headers["set-cookie"]);
    r.url = url;
    return r;
  }
  /* 跟随跳转，最多 6 次 */
  async hitFollow(method, p, opts = {}) {
    let r = await this.hit(method, p, opts);
    let count = 0;
    while (r.status >= 300 && r.status < 400 && r.headers.location && count < 6) {
      const next = new URL(r.headers.location, r.url).toString();
      this.log("跳转 " + r.status, next.replace(this.base, ""));
      r = await this.hit("GET", next);
      count++;
    }
    return r;
  }

  async login(username, password) {
    /* 1) 取登录页 + csrftoken */
    const page = await this.hitFollow("GET", "/jwglxt/xtgl/login_slogin.html");
    this.log("登录页", "HTTP " + page.status);
    const m =
      page.body.match(/id="csrftoken"[^>]*value="([^"]*)"/) ||
      page.body.match(/name="csrftoken"[^>]*value="([^"]*)"/) ||
      page.body.match(/csrftoken\s*=\s*["']([^"']+)["']/);
    const csrftoken = m ? m[1] : "";
    this.log("csrftoken", csrftoken ? "已获取" : "没取到");
    if (!/login_slogin|登录/.test(page.body)) {
      this.log("提示", "登录页内容和预期不同");
    }

    /* 2) 取公钥并加密密码 */
    let mm = password;
    try {
      const pk = await this.hit("GET", "/jwglxt/xtgl/login_getPublicKey.html?time=" + Date.now(), {
        headers: { Referer: this.abs("/jwglxt/xtgl/login_slogin.html") }
      });
      const j = JSON.parse(pk.body);
      if (j && j.modulus && j.exponent) {
        mm = rsaEncrypt(password, j.modulus, j.exponent);
        this.log("密码加密", "RSA 成功");
      }
    } catch (e) {
      this.log("密码加密", "取公钥失败，按明文提交");
    }

    /* 3) 提交登录 */
    const body =
      "csrftoken=" + encodeURIComponent(csrftoken) +
      "&yhm=" + encodeURIComponent(username) +
      "&mm=" + encodeURIComponent(mm) +
      "&language=zh_CN";
    const r = await this.hitFollow("POST", "/jwglxt/xtgl/login_slogin.html", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: this.abs("/jwglxt/xtgl/login_slogin.html"),
        Origin: this.base
      },
      body
    });

    const text = htmlText(r.body);
    this.log("登录提交", "HTTP " + r.status + (r.headers.location ? " → " + String(r.headers.location).replace(this.base, "") : ""));

    /* 4) 判定结果 */
    const okSign = /index_initMenu|欢迎您|退出|mainfrm|个人中心|教学信息/i;
    if (okSign.test(r.url) || okSign.test(r.body)) {
      this.log("登录结果", "成功");
      return true;
    }
    const bad = text.match(/[^。！\s]{0,14}(密码|用户名|账号|验证码|锁定|冻结)[^。！\s]{0,14}/);
    if (bad && /不正确|错误|失败|不存在|为空|锁定|冻结/.test(bad[0])) {
      throw new Error("登录失败：" + bad[0].replace(/\s+/g, ""));
    }
    if (/统一身份认证|CAS|统一认证/.test(text) && !/jwglxt/.test(r.url)) {
      throw new Error("这个账号可能要走「统一身份认证」，当前方式登录不了");
    }
    throw new Error("登录没有成功（HTTP " + r.status + "），页面提示：" + (text.slice(0, 80) || "无"));
  }

  /* 打开课表查询页：既拿到页面本身，也拿到真实的学年/学期选项 */
  async loadKbIndex() {
    const r = await this.hitFollow("GET", "/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151");
    this.log("课表页", "HTTP " + r.status + "，长度 " + r.body.length);
    this.dump("index", "", "", r);
    if (/login_slogin\.html/.test(r.url) || (/name="yhm"/.test(r.body) && !/kbcx|kbgrid/.test(r.body))) {
      throw new Error("登录状态失效（教务没认可会话），请关掉页面重开再导入一次");
    }
    return r.body;
  }

  /* 从课表页里抓 <select id="xnm"> / <select id="xqm"> 的真实取值 */
  termOptions(html) {
    const grab = id => {
      const seg = html.match(new RegExp('<select[^>]*id="' + id + '"[\\s\\S]*?</select>', "i"));
      if (!seg) return [];
      const out = [];
      const re = /<option[^>]*value=["']([^"']*)["']([^>]*)>([\s\S]*?)<\/option>/gi;
      let m;
      while ((m = re.exec(seg[0]))) {
        const value = String(m[1] || "").trim();
        if (!value) continue;
        out.push({ value, selected: /\bselected\b/i.test(m[2]), label: htmlText(m[3]) });
      }
      return out;
    };
    return { years: grab("xnm"), terms: grab("xqm") };
  }

  /* 查一个（学年, 学期）组合：先试接口 POST，再试整页 GET */
  async queryKb(xnm, xqm) {
    const ref = this.abs("/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151");
    const body =
      "xnm=" + encodeURIComponent(xnm) +
      "&xqm=" + encodeURIComponent(xqm) +
      "&kzlx=ck&xsdm=";

    const r1 = await this.hit("POST", "/jwglxt/kbcx/xskbcx_cxXsKb.html?gnmkdm=N2151", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: ref,
        Origin: this.base,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json, text/javascript, */*; q=0.01"
      },
      body
    });
    this.dump("api", xnm, xqm, r1);
    const kb1 = countKb(r1.body);
    this.log("查 " + xnm + "/" + xqm, "接口 HTTP " + r1.status + "，" + kb1.desc);
    if (kb1.n > 0) return { body: r1.body, kind: kb1.kind };

    /* 教务明确给了 JSON（哪怕里面没课），再抓整页也白搭，直接返回原因 */
    if (kb1.kind === "json" || kb1.kind === "json-msg") {
      return { body: r1.body, kind: kb1.kind, note: kb1.desc, sample: snippet(r1.body) };
    }
    if (kb1.kind === "login") {
      throw new Error("教务会话中途失效了，请重新点一次导入");
    }

    /* 其余情况：有些版本把数据直接渲染在整页里 */
    const r2 = await this.hitFollow(
      "GET",
      "/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&xnm=" +
        encodeURIComponent(xnm) + "&xqm=" + encodeURIComponent(xqm)
    );
    this.dump("page", xnm, xqm, r2);
    const kb2 = countKb(r2.body);
    this.log("查 " + xnm + "/" + xqm + "（整页）", "HTTP " + r2.status + "，" + kb2.desc);
    if (kb2.n > 0) return { body: r2.body, kind: kb2.kind };

    return { body: r1.body, kind: "", note: kb1.desc, sample: snippet(r1.body) };
  }
}

/* 统计一段返回里有多少门课，并给出可读描述 */
function countKb(text) {
  const s = String(text || "");
  if (!s) return { n: 0, kind: "", desc: "空响应" };
  const t = s.trim();

  if (t.startsWith("{") || t.startsWith("[")) {
    let j = null;
    try { j = JSON.parse(t); } catch (e) { j = null; }
    if (j) {
      const list = j.kbList || j.rows || (Array.isArray(j) ? j : null);
      if (Array.isArray(list)) {
        const n = list.filter(it => (it.kcmc || it.courseName) && Number(it.xqj || it.weekday)).length;
        return { n, kind: "json", desc: "JSON，课程 " + list.length + " 条" };
      }
      const msg = j.message || j.msg || j.error || "";
      return { n: 0, kind: "json-msg", desc: "JSON 无课表" + (msg ? "：" + String(msg).slice(0, 60) : "") };
    }
    return { n: 0, kind: "", desc: "像 JSON 但解析失败" };
  }

  const n = parseKbHtml(s).length;
  if (n) return { n, kind: "html", desc: "网页表格，" + n + " 门" };
  if (/login_slogin/.test(s)) return { n: 0, kind: "login", desc: "返回了登录页（会话失效）" };
  if (/kbgrid_table|kbcontent/.test(s)) return { n: 0, kind: "html-empty", desc: "有表格但没课" };
  return { n: 0, kind: "", desc: "网页，" + s.length + " 字符，无课表特征" };
}

/* 取一小段纯文本，方便排错 */
function snippet(text) {
  return htmlText(text).slice(0, 160);
}

/* =========================================================
   课表 HTML 解析
   ========================================================= */
function cellLines(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|span|font|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .split("\n")
    .map(s => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function looksLikeRoom(s) {
  return /(楼|室|馆|场|中心|实验|机房|[A-Za-z]\s*\d{2,}|\d{3,})/.test(s) && s.length <= 24;
}

function parseKbHtml(html) {
  let scope = html;
  const tb = html.match(/<table[^>]*id="[^"]*kbgrid_table[^"]*"[\s\S]*?<\/table>/i);
  if (tb) scope = tb[0];

  const re = /<td[^>]*id="(?:td_)?(\d{1,2})[-_](\d{1,2})"[^>]*>([\s\S]*?)<\/td>/gi;
  const cells = [];
  let m;
  while ((m = re.exec(scope))) {
    const day = Number(m[1]);
    const jc = Number(m[2]);
    if (day < 1 || day > 7) continue;
    const lines = cellLines(m[3]).filter(
      l => !/^\[?\d+(-\d+)?周/.test(l) && !/^第?\d+-\d+周/.test(l)
    );
    if (!lines.length) continue;
    const name = lines[0];
    if (!name || /^(无|暂无)$/.test(name)) continue;
    const rest = lines.slice(1);
    let room = "";
    const roomIdx = rest.findIndex(looksLikeRoom);
    if (roomIdx >= 0) room = rest[roomIdx];
    cells.push({ day, jc, name, room });
  }

  /* 合并连续节次 */
  const out = [];
  const grouped = {};
  cells.forEach(c => {
    const key = c.day + "|" + c.name + "|" + c.room;
    (grouped[key] = grouped[key] || []).push(c.jc);
  });

  Object.entries(grouped).forEach(([key, jcs]) => {
    const [dayS, name, room] = key.split("|");
    const day = Number(dayS);
    jcs.sort((a, b) => a - b);
    let start = jcs[0], prev = jcs[0];
    const flush = (s, e) => {
      const ps = PERIODS.find(p => p.jc === s) || PERIODS[0];
      const pe = PERIODS.find(p => p.jc === e) || ps;
      out.push({
        id: "imp_" + day + "_" + s + "_" + Math.random().toString(36).slice(2, 6),
        name,
        day,
        start: ps.start,
        end: pe.end,
        room: room || "",
        jc: `${s}-${e}`
      });
    };
    for (let i = 1; i < jcs.length; i++) {
      if (jcs[i] === prev + 1) {
        prev = jcs[i];
      } else {
        flush(start, prev);
        start = jcs[i];
        prev = jcs[i];
      }
    }
    flush(start, prev);
  });

  out.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  return out;
}

/* 新版正方部分接口直接返回 JSON（kbList），一并支持 */
function parseKbJson(text) {
  let j;
  try { j = JSON.parse(String(text || "").trim()); } catch (e) { return []; }
  const list = j && (j.kbList || j.rows || (Array.isArray(j) ? j : null));
  if (!Array.isArray(list) || !list.length) return [];

  /* 正方会把同一门课按"不同周次 / 不同任课教师"拆成多行，
     这里按 课名+星期+节次 合并，周次拼接而不是丢掉 */
  const map = new Map();
  list.forEach(it => {
    const name = (it.kcmc || it.courseName || it.kcname || "").trim();
    if (!name) return;
    const day = Number(it.xqj || it.weekday || it.xingqi || 0);
    if (!(day >= 1 && day <= 7)) return;

    const jcRaw = String(it.jc || it.jcs || it.jcstr || it.jcor || "").trim();
    const m = jcRaw.match(/(\d{1,2})\s*[-~—至]\s*(\d{1,2})/);
    let s = 0, e = 0;
    if (m) {
      s = Number(m[1]);
      e = Number(m[2]);
    } else if (/^\d{1,2}$/.test(jcRaw)) {
      s = e = Number(jcRaw);
    }
    if (!s || !e) return;
    if (e > 12) e = 12;
    if (s > 12) s = 12;

    const key = name + "|" + day + "|" + s + "-" + e;
    const room = (it.cdmc || it.roomName || it.jxdd || "").trim();
    const teacher = (it.xm || it.teacherName || "").trim();
    const weeks = (it.zcd || it.zcmc || "").trim();

    const hit = map.get(key);
    if (hit) {
      if (weeks && !hit.weekParts.includes(weeks)) hit.weekParts.push(weeks);
      if (room && !hit.rooms.includes(room)) hit.rooms.push(room);
      if (teacher && !hit.teachers.includes(teacher)) hit.teachers.push(teacher);
      return;
    }
    map.set(key, {
      name,
      day,
      s,
      e,
      weekParts: weeks ? [weeks] : [],
      rooms: room ? [room] : [],
      teachers: teacher ? [teacher] : []
    });
  });

  const out = [];
  map.forEach(v => {
    const ps = PERIODS.find(p => p.jc === v.s) || PERIODS[0];
    const pe = PERIODS.find(p => p.jc === v.e) || ps;
    out.push({
      id: "imp_" + v.day + "_" + v.s + "_" + Math.random().toString(36).slice(2, 6),
      name: v.name,
      day: v.day,
      start: ps.start,
      end: pe.end,
      room: v.rooms.join(" / "),
      teacher: v.teachers.slice(0, 2).join(" / "),
      weeks: v.weekParts.join(","),
      jc: v.s + "-" + v.e
    });
  });
  out.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  return out;
}

/* =========================================================
   API
   ========================================================= */
/* 把本次导入的原始响应对照写成本地文件，方便事后定位（不含密码） */
function saveDebug(client, meta) {
  try {
    const dir = path.join(ROOT, ".jw-debug");
    fs.mkdirSync(dir, { recursive: true });
    const data = Object.assign(
      { time: new Date().toISOString(), trace: client.trace, dumps: client.dumps },
      meta
    );
    fs.writeFileSync(path.join(dir, "last.json"), JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    /* 写不了就算了，不影响主流程 */
  }
}

async function handleImport(req, res) {
  let trace = [];
  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw || "{}");
    const { username, password, year, term } = body;
    if (!username || !password) return json(res, 400, { ok: false, error: "请填写学号和密码" });

    const client = new JwglClient(JW_BASE);
    try {
      await client.login(username.trim(), password);
      trace = client.trace.slice();

      /* 1) 打开课表页，拿真实的学年 / 学期选项 */
      const indexHtml = await client.loadKbIndex();
      trace = client.trace.slice();

      /* 页面本身如果有表格，直接用 */
      let courses = parseKbHtml(indexHtml);
      if (courses.length) {
        client.log("结果", "课表页直接带数据，" + courses.length + " 门");
        saveDebug(client, { ok: true, count: courses.length, from: "index" });
        return json(res, 200, { ok: true, courses, count: courses.length, trace: client.trace });
      }

      const opt = client.termOptions(indexHtml);
      client.log(
        "学年/学期选项",
        "学年 " + (opt.years.map(o => o.value).join(",") || "未找到") +
          "；学期 " + (opt.terms.map(o => o.value + "=" + o.label).join(",") || "未找到")
      );
      trace = client.trace.slice();

      /* 2) 组候选：页面选中项 → 用户指定 → 页面全部组合 → 常见代码兜底 */
      const cands = [];
      const push = (y, t) => {
        y = String(y || "").trim();
        t = String(t || "").trim();
        if (!y || !t) return;
        if (cands.some(c => c.y === y && c.t === t)) return;
        cands.push({ y, t });
      };
      const selY = (opt.years.find(o => o.selected) || {}).value;
      const selT = (opt.terms.find(o => o.selected) || {}).value;
      push(selY, selT);
      push(year || "2026", term || "3");
      opt.years.forEach(o => opt.terms.forEach(t2 => push(o.value, t2.value)));
      ["3", "12", "16"].forEach(t2 => push(year || "2026", t2));
      ["1", "2", "3"].forEach(t2 => push(year || "2026", t2));

      /* 3) 依次尝试 */
      let lastNote = "";
      let lastSample = "";
      let hit = null;
      for (const c of cands.slice(0, 8)) {
        const r = await client.queryKb(c.y, c.t);
        const list = parseKbHtml(r.body);
        const js = list.length ? list : parseKbJson(r.body);
        if (js.length) {
          courses = js;
          client.log("结果", "学年 " + c.y + " / 学期 " + c.t + " 取到 " + js.length + " 门");
          hit = c;
          break;
        }
        lastNote = r.note || lastNote;
        lastSample = r.sample || lastSample;
      }
      trace = client.trace.slice();

      if (!courses.length) {
        const noSelects = !opt.years.length && !opt.terms.length;
        const head = noSelects
          ? "登录成功，但打开的课表页里没有「学年/学期」选择框，说明这个页面结构和我预期的不一样。"
          : "登录成功，但拿到的课表是空的。";
        saveDebug(client, { ok: false, error: head, noSelects, candidates: cands.map(c => c.y + "/" + c.t) });
        return json(res, 200, {
          ok: false,
          error:
            head +
            (lastNote ? " 教务最后一次返回：" + lastNote + "。" : "") +
            (lastSample ? " 原文片段：" + lastSample : "") +
            " 可以换个学期再试一次。",
          trace,
          debug: {
            candidates: cands.map(c => c.y + "/" + c.t),
            years: opt.years.map(o => o.value),
            terms: opt.terms.map(o => o.value),
            sample: lastSample
          }
        });
      }
      saveDebug(client, { ok: true, count: courses.length, spot: hit });
      return json(res, 200, { ok: true, courses, count: courses.length, trace });
    } catch (e) {
      saveDebug(client, { ok: false, error: e.message || String(e) });
      return json(res, 200, { ok: false, error: e.message || String(e), trace: client.trace });
    }
  } catch (e) {
    json(res, 200, { ok: false, error: e.message || String(e), trace });
  }
}

async function handleParseKb(req, res) {
  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw || "{}");
    if (!body.html) return json(res, 400, { ok: false, error: "没有内容" });
    const courses = parseKbHtml(body.html);
    json(res, 200, {
      ok: courses.length > 0,
      courses,
      count: courses.length,
      error: courses.length ? "" : "没解析到课程"
    });
  } catch (e) {
    json(res, 200, { ok: false, error: e.message || String(e) });
  }
}

/* =========================================================
   静态文件
   ========================================================= */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json"
};

function serveStatic(pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found: " + rel);
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(buf);
  });
}

/* =========================================================
   启动
   ========================================================= */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  if (u.pathname === "/api/ping") return json(res, 200, { ok: true, port: PORT });
  if (u.pathname === "/api/import-course" && req.method === "POST") return handleImport(req, res);
  if (u.pathname === "/api/parse-kb" && req.method === "POST") return handleParseKb(req, res);

  serveStatic(u.pathname, res);
});

function lanIPs() {
  const out = [];
  Object.values(os.networkInterfaces()).forEach(list => {
    (list || []).forEach(ni => {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    });
  });
  return out;
}

server.on("error", e => {
  if (e.code === "EADDRINUSE") {
    console.log("端口 " + PORT + " 已被占用，服务可能已经在运行：http://localhost:" + PORT);
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("  我的工作台已启动");
  console.log("  ----------------------------------------");
  console.log("  电脑打开： http://localhost:" + PORT);
  lanIPs().forEach(ip => console.log("  手机打开： http://" + ip + ":" + PORT + "  (需同一 WiFi)"));
  console.log("  ----------------------------------------");
  console.log("  关掉这个窗口 = 关闭服务");
  console.log("");
});
