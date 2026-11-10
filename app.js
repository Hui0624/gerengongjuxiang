/* =========================================================
   app.js —— 界面与交互（原生 JS，无依赖）
   ========================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- 工具 ---------- */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function dateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function daysLeft(dateStrVal) {
  if (!dateStrVal) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStrVal.split("-").map(Number);
  const target = new Date(y, m - 1, d); target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

/* ---------- 时间线常量（可由设置覆盖） ---------- */
let TL_START = 6 * 60;    // 默认 06:00
let TL_END = 24 * 60;     // 默认 24:00
let PX_PER_HOUR = 60;     // normal=60 / compact=46

function applyTlSettings() {
  const st = (Store.data && Store.data.settings) || {};
  const s = Number(st.tlStart), e = Number(st.tlEnd);
  TL_START = (isFinite(s) && s >= 0 && s <= 12) ? s * 60 : 6 * 60;
  TL_END = (isFinite(e) && e >= 12 && e <= 24) ? e * 60 : 24 * 60;
  if (TL_END <= TL_START + 120) TL_END = 24 * 60;
  PX_PER_HOUR = st.tlDensity === "compact" ? 46 : 60;
}

function minToTop(min) { return ((min - TL_START) / 60) * PX_PER_HOUR; }

/* 轻量提示 */
let wbToastTimer = null;
function toast(msg) {
  let el = $("#wbToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "wbToast";
    el.className = "wb-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(wbToastTimer);
  wbToastTimer = setTimeout(() => el.classList.remove("show"), 1900);
}

/* =========================================================
   皮肤 / 主题
   ========================================================= */
const Theme = {
  KEY: "wb_theme",
  IMG: "wb_skin_image",
  DIM: "wb_skin_dim",
  BLUR: "wb_skin_blur",

  /* 用户选择的皮肤名，可能是 auto */
  get stored() {
    try { return localStorage.getItem(this.KEY) || "dark"; } catch (e) { return "dark"; }
  },

  /* 实际生效的皮肤（auto 时跟随系统） */
  get effective() {
    const t = this.stored;
    if (t === "auto") {
      const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      return dark ? "dark" : "light";
    }
    return t;
  },

  get current() { return this.effective; },

  /* 应用皮肤（照片皮肤需要把图片/遮罩写进 CSS 变量） */
  apply() {
    const el = document.documentElement;
    const t = this.effective;
    el.setAttribute("data-theme", t);
    if (t === "photo") {
      const img = this.getImage();
      if (img) el.style.setProperty("--skin-image", 'url("' + img + '")');
      else el.style.removeProperty("--skin-image");
      el.style.setProperty("--skin-dim", (Number(this.getDim()) / 100).toFixed(2));
      el.style.setProperty("--skin-blur", this.getBlur() + "px");
    } else {
      el.style.removeProperty("--skin-image");
      el.style.removeProperty("--skin-dim");
      el.style.removeProperty("--skin-blur");
    }
    /* 让手机浏览器地址栏颜色跟随皮肤 */
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", {
        dark: "#0e1116", light: "#f5f7fb", ink: "#efe6d5", photo: "#0b0e13"
      }[t] || "#0e1116");
    }
  },

  set(name) {
    try { localStorage.setItem(this.KEY, name); } catch (e) {}
    this.apply();
  },

  getImage() { return localStorage.getItem(this.IMG) || ""; },
  getDim() { const v = Number(localStorage.getItem(this.DIM)); return isNaN(v) ? 42 : v; },
  getBlur() { const v = Number(localStorage.getItem(this.BLUR)); return isNaN(v) ? 0 : v; },

  setImage(dataUrl) {
    try {
      if (dataUrl) localStorage.setItem(this.IMG, dataUrl);
      else localStorage.removeItem(this.IMG);
    } catch (e) {
      alert("图片太大，浏览器存不下。换一张小一点的，或先压缩一下。");
      return false;
    }
    this.apply();
    return true;
  },
  setDim(v) { localStorage.setItem(this.DIM, String(v)); this.apply(); },
  setBlur(v) { localStorage.setItem(this.BLUR, String(v)); this.apply(); }
};

/* 把选中的图片压缩成合适大小，避免撑爆浏览器存储 */
function readImageCompressed(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1920;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        const r = Math.min(MAX / w, MAX / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      let q = 0.86, out = cv.toDataURL("image/jpeg", q);
      while (out.length > 3.2e6 && q > 0.4) {
        q -= 0.12;
        out = cv.toDataURL("image/jpeg", q);
      }
      cb(out, w, h);
    };
    img.onerror = () => alert("这张图片读不出来，换一张试试");
    img.src = reader.result;
  };
  reader.onerror = () => alert("读取文件失败");
  reader.readAsDataURL(file);
}

function openThemeModal() {
  const cur = Theme.stored;
  const cards = [
    { id: "auto", name: "跟随系统", desc: "白天白 · 晚上黑", pv: "pv-auto" },
    { id: "light", name: "简洁白", desc: "白天 / 明亮环境", pv: "pv-light" },
    { id: "dark", name: "暗夜黑", desc: "晚上看不刺眼", pv: "pv-dark" },
    { id: "ink", name: "国风", desc: "宣纸水墨 · 朱砂印章", pv: "pv-ink" },
    { id: "photo", name: "照片皮肤", desc: "用自己的照片当背景", pv: "pv-photo" }
  ];

  const html = `
    <h4>选择皮肤</h4>
    <div class="theme-grid" id="themeGrid">
      ${cards.map(c => `
        <button class="theme-card ${cur === c.id ? "active" : ""}" data-theme-id="${c.id}">
          <div class="tc-preview ${c.pv}">
            <i class="p-side"></i>
            <i class="p-main"><i class="p-bar"></i><i class="p-bar s"></i><i class="p-bar"></i></i>
          </div>
          <div class="tc-name">${c.name}</div>
          <div class="tc-desc">${c.desc}</div>
        </button>`).join("")}
    </div>

    <div class="skin-box ${cur === "photo" ? "" : "hidden"}" id="skinBox">
      <div class="skin-thumb" id="skinThumb">还没有图片</div>
      <div class="skin-actions">
        <button class="btn primary" id="pickImg">选一张本地图片</button>
        <button class="btn" id="clearImg">清除</button>
      </div>
      <div class="field" style="margin-top:10px">
        <label>或者填一个图片网址</label>
        <input class="input" id="skinUrl" placeholder="https://... （jpg / png）">
      </div>
      <div class="skin-actions"><button class="btn" id="useUrl">用这个网址</button></div>

      <div class="skin-row">
        <label>压暗</label>
        <input type="range" id="skinDim" min="0" max="80" step="2" value="${Theme.getDim()}">
        <span class="val" id="skinDimVal">${Theme.getDim()}%</span>
      </div>
      <div class="skin-row">
        <label>模糊</label>
        <input type="range" id="skinBlur" min="0" max="24" step="1" value="${Theme.getBlur()}">
        <span class="val" id="skinBlurVal">${Theme.getBlur()}px</span>
      </div>
      <p style="margin-top:8px">照片只存在这台设备的浏览器里，不会上传、也不会同步到云端。</p>
      <input type="file" id="skinFile" accept="image/*" style="display:none">
    </div>

    <p style="margin-top:14px">提示：选完立刻生效，刷新也不会丢。</p>`;

  openModal("外观 / 皮肤", html, body => {
    const grid = $("#themeGrid", body);
    const box = $("#skinBox", body);
    const thumb = $("#skinThumb", body);

    const paintThumb = () => {
      const img = Theme.getImage();
      if (img) {
        thumb.style.backgroundImage = `url("${img}")`;
        thumb.textContent = "";
      } else {
        thumb.style.backgroundImage = "";
        thumb.textContent = "还没有图片";
      }
    };
    paintThumb();

    grid.addEventListener("click", e => {
      const card = e.target.closest("[data-theme-id]");
      if (!card) return;
      $$(".theme-card", grid).forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      Theme.set(card.dataset.themeId);
      box.classList.toggle("hidden", card.dataset.themeId !== "photo");
    });

    $("#pickImg", body).addEventListener("click", () => $("#skinFile", body).click());

    $("#skinFile", body).addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      if (!Theme.getImage()) Theme.set("photo");
      readImageCompressed(f, dataUrl => {
        if (Theme.setImage(dataUrl)) {
          paintThumb();
          $$(".theme-card", grid).forEach(c => c.classList.toggle("active", c.dataset.themeId === "photo"));
          box.classList.remove("hidden");
        }
      });
    });

    $("#useUrl", body).addEventListener("click", () => {
      const url = $("#skinUrl", body).value.trim();
      if (!url) return;
      Theme.set("photo");
      Theme.setImage(url);
      paintThumb();
      $$(".theme-card", grid).forEach(c => c.classList.toggle("active", c.dataset.themeId === "photo"));
      box.classList.remove("hidden");
    });

    $("#clearImg", body).addEventListener("click", () => {
      Theme.setImage("");
      paintThumb();
    });

    const dim = $("#skinDim", body), dimVal = $("#skinDimVal", body);
    dim.addEventListener("input", () => {
      dimVal.textContent = dim.value + "%";
      Theme.setDim(dim.value);
    });

    const blur = $("#skinBlur", body), blurVal = $("#skinBlurVal", body);
    blur.addEventListener("input", () => {
      blurVal.textContent = blur.value + "px";
      Theme.setBlur(blur.value);
    });
  });
}

/* =========================================================
   顶栏
   ========================================================= */
function renderTopbar() {
  const d = new Date();
  $("#todayLabel").textContent =
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${weekdayName(todayWeekday())}`;
}

/* =========================================================
   时间线
   ========================================================= */
function renderTimeline(scrollToNow = false) {
  applyTlSettings();
  const canvas = $("#tlCanvas");
  const scroll = $("#tlScroll");
  const keep = scroll ? scroll.scrollTop : 0;

  const day = todayWeekday();
  const nm = nowMinutes();
  const wk = todayWeekNo();
  const courses = Store.data.courses.filter(c => c.day === day && inWeek(c, wk));
  const todos = Store.data.todos.filter(t => t.date === todayStr() && t.time);

  let html = "";

  // 小时格与半点虚线（起止可配置）
  const h0 = Math.floor(TL_START / 60);
  const h1 = Math.floor(TL_END / 60);
  for (let h = h0; h <= h1; h++) {
    const top = ((h * 60 - TL_START) / 60) * PX_PER_HOUR;
    html += `<div class="tl-hour" style="top:${top}px"><span class="tl-hour-label">${pad2(h)}:00</span></div>`;
    if (h < h1) html += `<div class="tl-half" style="top:${top + PX_PER_HOUR / 2}px"></div>`;
  }

  // 课程块：同一时段有多门课时自动分泳道并排，不再叠在一起
  const sorted = courses
    .map(c => ({ c, s: hhmmToMin(c.start), e: hhmmToMin(c.end) }))
    .sort((a, b) => a.s - b.s || a.e - b.e);

  const groups = [];
  let grp = null;
  sorted.forEach(it => {
    if (!grp || it.s >= grp.end) { grp = { items: [], end: it.e }; groups.push(grp); }
    grp.items.push(it);
    grp.end = Math.max(grp.end, it.e);
  });

  groups.forEach(g => {
    const laneEnd = [];
    g.items.forEach(it => {
      let i = laneEnd.findIndex(end => it.s >= end - 1);
      if (i < 0) { laneEnd.push(it.e); i = laneEnd.length - 1; }
      else laneEnd[i] = Math.max(laneEnd[i], it.e);
      it.lane = i;
    });
    g.items.forEach(it => { it.lanes = laneEnd.length; });
  });

  let courseHtml = "";
  sorted.forEach(({ c, s, e, lane, lanes }) => {
    const top = Math.max(0, minToTop(s));
    const hgt = Math.max(30, ((e - s) / 60) * PX_PER_HOUR);
    const n = lanes || 1;
    const l = Math.min(lane || 0, n - 1);
    const left = n > 1 ? `calc(${((l / n) * 100).toFixed(4)}% + 2px)` : "2px";
    const width = n > 1 ? `calc(${(100 / n).toFixed(4)}% - 4px)` : "calc(100% - 4px)";
    courseHtml += `<div class="tl-block course" style="top:${top}px;height:${hgt}px;left:${left};width:${width};right:auto" data-course="${c.id}">
      <div class="tb-name">${esc(c.name)}</div>
      <div class="tb-meta">${c.start}–${c.end}${c.room ? " · " + esc(c.room) : ""}</div>
    </div>`;
  });
  if (courseHtml) {
    html += `<div class="tl-lane-wrap">${courseHtml}</div>`;
  } else if (Store.data.courses.some(c => c.day === day)) {
    html += `<div class="tl-empty">本周这天没有课程</div>`;
  }

  // 待办块：填了结束时间就按真实时长画；只有真正重叠时才贴着下移，不再无条件推远
  let prevTop = -999, prevH = 0;
  todos
    .slice()
    .sort((a, b) => hhmmToMin(a.time) - hhmmToMin(b.time))
    .forEach(t => {
      const s = hhmmToMin(t.time);
      const en = t.end ? hhmmToMin(t.end) : 0;
      const hgt = en > s ? Math.max(24, ((en - s) / 60) * PX_PER_HOUR) : 42;
      let top = Math.max(0, minToTop(s));
      if (top < prevTop + prevH) top = prevTop + prevH + 2;
      prevTop = top; prevH = hgt;
      const meta = en > s ? `${t.time}–${t.end}` : t.time;
      html += `<div class="tl-block todo ${t.done ? "done" : ""}" style="top:${top}px;height:${hgt}px" data-todo="${t.id}">
        <div class="tb-name">${t.done ? "✔ " : "○ "}${esc(t.text)}</div>
        <div class="tb-meta">${meta}</div>
      </div>`;
    });

  // 当前时刻线
  if (nm >= TL_START && nm <= TL_END) {
    html += `<div class="now-line" style="top:${minToTop(nm)}px"><span class="now-tag">现在 ${minToHHMM(nm)}</span></div>`;
  }

  canvas.style.height = (((TL_END - TL_START) / 60) * PX_PER_HOUR) + "px";
  canvas.innerHTML = html;

  // 滚动位置
  if (scroll) {
    scroll.scrollTop = scrollToNow && nm >= TL_START
      ? Math.max(0, minToTop(nm) - 180)
      : keep;
  }

  // 待办块点击 -> 切换完成
  $$(".tl-block.todo", canvas).forEach(el => {
    el.addEventListener("click", () => toggleTodo(el.dataset.todo));
  });
}

/* ---------- 下一项卡片 ---------- */
function renderNextCard() {
  const el = $("#nextCard");
  const day = todayWeekday();
  const nm = nowMinutes();
  const wk = todayWeekNo();
  const items = [];

  Store.data.courses.filter(c => c.day === day && inWeek(c, wk)).forEach(c => {
    items.push({ type: "course", name: c.name, startMin: hhmmToMin(c.start), endMin: hhmmToMin(c.end) });
  });
  Store.data.todos
    .filter(t => t.date === todayStr() && t.time && !t.done)
    .forEach(t => {
      const s = hhmmToMin(t.time);
      items.push({ type: "todo", name: t.text, startMin: s, endMin: s + 1 });
    });

  items.sort((a, b) => a.startMin - b.startMin);

  const cur = items.find(i => nm >= i.startMin && nm < i.endMin);
  const next = items.find(i => i.startMin > nm);

  if (cur) {
    const left = cur.endMin - nm;
    el.className = "next-card";
    el.innerHTML = `
      <div>
        <div class="nc-label">正在进行</div>
        <div class="nc-main">${esc(cur.name)}</div>
      </div>
      <div class="nc-time">还剩 ${left} 分钟<br>
        <span class="nc-sub">到 ${minToHHMM(cur.endMin)} 结束</span></div>`;
  } else if (next) {
    const wait = next.startMin - nm;
    el.className = "next-card";
    el.innerHTML = `
      <div>
        <div class="nc-label">下一项</div>
        <div class="nc-main">${esc(next.name)}</div>
      </div>
      <div class="nc-time">${minToHHMM(next.startMin)}<br>
        <span class="nc-sub">还有 ${wait} 分钟</span></div>`;
  } else {
    el.className = "next-card empty";
    el.innerHTML = "今天的安排都结束啦，放松一下";
  }
}

/* =========================================================
   周课表
   ========================================================= */
let tlMode = "day";      // day | week
let weekOffset = 0;      // 相对本周的偏移

/* 课程配色：按课名散列出固定色相，同一门课每周同色 */
const WK_HUES = [212, 340, 152, 32, 268, 190, 6, 96, 320, 46];
function hueOf(name) {
  let h = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return WK_HUES[h % WK_HUES.length];
}

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const wd = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (wd - 1));
  return d;
}

function getTermStart() {
  const s = (Store.data.settings && Store.data.settings.termStart) || "";
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d) ? null : mondayOf(d);
}

function getWeekInfo() {
  const start = getTermStart();
  const todayMon = mondayOf(new Date());
  let baseNo = null;
  if (start) baseNo = Math.round((todayMon - start) / 6048e5) + 1;
  const mon = new Date(todayMon);
  mon.setDate(mon.getDate() + weekOffset * 7);
  return { no: baseNo == null ? null : baseNo + weekOffset, mon };
}

/* 今天实际处于第几周（不受周课表翻周偏移影响，仅看真实当前日期） */
function todayWeekNo() {
  const start = getTermStart();
  if (!start) return null;
  return Math.round((mondayOf(new Date()) - start) / 6048e5) + 1;
}

/* 周主题：当前周号（开学周优先，否则用年内 ISO 周，保证没设 termStart 也能轮转） */
function isoWeekNo(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil((((dt - yearStart) / 864e5) + 1) / 7);
}
function currentWeekNo() {
  return todayWeekNo() || isoWeekNo(new Date());
}
function getWeeklyTheme() {
  const wno = currentWeekNo();
  const skills = (Store.data && Store.data.skills) || [];
  if (!skills.length) return { weekNo: wno, skill: null, goal: "", target: 5, isOverride: false };
  const wt = (Store.data.settings && Store.data.settings.weekThemes) || {};
  const ov = wt[wno] || null;
  if (ov && ov.skillId) {
    const s = skills.find(x => x.id === ov.skillId);
    if (s) return { weekNo: wno, skill: s, goal: ov.goal || "", target: Number(ov.target) || 5, isOverride: true };
  }
  const idx = ((wno - 1) % skills.length + skills.length) % skills.length;
  return { weekNo: wno, skill: skills[idx], goal: "", target: 5, isOverride: false };
}

/* 正方周次写法很杂："2周,5-6周,10周,13-17周(单),18周"
   单/双只作用于它所在的那一段，所以逐段解析 */
function parseWeeks(str) {
  if (!str) return null;
  const set = new Set();
  String(str).split(/[,，;；]/).forEach(seg => {
    const m = seg.match(/(\d{1,2})(?:\s*[-~—至到]\s*(\d{1,2}))?/);
    if (!m) return;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    const odd = /单/.test(seg);
    const even = /双/.test(seg);
    for (let i = a; i <= b && i <= 40; i++) {
      if (odd && i % 2 === 0) continue;
      if (even && i % 2 === 1) continue;
      set.add(i);
    }
  });
  return set.size ? set : null;
}

function inWeek(course, weekNo) {
  if (weekNo == null) return true;
  const w = parseWeeks(course.weeks);
  if (!w) return true;          // 没有周次信息（手工加的课）就一直显示
  return w.has(weekNo);
}

/* 把课程的起止时间换成节次区间 */
function jcRangeOf(c) {
  const s = hhmmToMin(c.start);
  const e = hhmmToMin(c.end);
  let sj = 0, ej = 0;
  JB_PERIODS.forEach(p => {
    if (hhmmToMin(p.start) === s) sj = p.jc;
    if (hhmmToMin(p.end) === e) ej = p.jc;
  });
  if (!sj) {
    const p = JB_PERIODS.find(x => s >= hhmmToMin(x.start) && s < hhmmToMin(x.end));
    sj = p ? p.jc : 1;
  }
  if (!ej) {
    const p = JB_PERIODS.find(x => e > hhmmToMin(x.start) && e <= hhmmToMin(x.end));
    ej = p ? p.jc : sj;
  }
  if (ej < sj) ej = sj;
  return [sj, ej];
}

function renderWeek() {
  const grid = $("#wkGrid");
  if (!grid) return;

  const info = getWeekInfo();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(info.mon);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  let hidden = 0;
  const visible = [];
  Store.data.courses.forEach(c => {
    if (!(c.day >= 1 && c.day <= 7)) return;
    if (inWeek(c, info.no)) visible.push(c);
    else hidden++;
  });

  const needJc = visible.reduce((mx, c) => Math.max(mx, jcRangeOf(c)[1]), 8);
  const rows = Math.max(8, Math.min(12, needJc));
  const todayKey = dateStr(new Date());
  const wdNames = ["一", "二", "三", "四", "五", "六", "日"];

  let html = `<div class="wk-corner"></div>`;

  days.forEach((d, i) => {
    const isToday = dateStr(d) === todayKey;
    html +=
      `<div class="wk-day ${isToday ? "is-today" : ""}" style="grid-column:${i + 2}">
        <b>周${wdNames[i]}</b>
        <span class="wd-date">${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}</span>
      </div>`;
  });

  /* 今天那一列整体高亮 */
  const todayIdx = days.findIndex(d => dateStr(d) === todayKey);
  if (todayIdx >= 0) {
    html += `<div class="wk-today" style="grid-column:${todayIdx + 2};grid-row:2/span ${rows}"></div>`;
  }

  for (let jc = 1; jc <= rows; jc++) {
    const p = JB_PERIODS.find(x => x.jc === jc) || JB_PERIODS[JB_PERIODS.length - 1];
    html +=
      `<div class="wk-time" style="grid-row:${jc + 1}">
        <b>${jc}</b><span>${p.start}</span><span>${p.end}</span>
      </div>`;
    for (let d = 1; d <= 7; d++) {
      html +=
        `<div class="wk-cell" style="grid-row:${jc + 1};grid-column:${d + 1}"></div>`;
    }
  }

  /* 同一格里有多门课时分泳道并排，不再互相盖住 */
  const laid = [];
  for (let d = 1; d <= 7; d++) {
    const arr = visible
      .map(c => { const r = jcRangeOf(c); return { c, sj: r[0], ej: r[1] }; })
      .filter(x => x.c.day === d)
      .sort((a, b) => a.sj - b.sj || a.ej - b.ej);

    const groups = [];
    let g = null;
    arr.forEach(it => {
      if (!g || it.sj > g.end) { g = { items: [], end: it.ej }; groups.push(g); }
      g.items.push(it);
      g.end = Math.max(g.end, it.ej);
    });
    groups.forEach(gr => {
      const laneEnd = [];
      gr.items.forEach(it => {
        let i = laneEnd.findIndex(end => it.sj > end);
        if (i < 0) { laneEnd.push(it.ej); i = laneEnd.length - 1; }
        else laneEnd[i] = it.ej;
        it.lane = i;
      });
      gr.items.forEach(it => { it.lanes = laneEnd.length; });
    });
    arr.forEach(it => laid.push(it));
  }

  laid.forEach(({ c, sj, ej, lane, lanes }) => {
    if (sj > rows) return;
    const span = Math.max(1, Math.min(ej, rows) - sj + 1);
    const n = lanes || 1;
    const l = Math.min(lane || 0, n - 1);
    const extra = n > 1
      ? `width:calc(${(100 / n).toFixed(2)}% - 3px);justify-self:start;margin-left:calc(${((l / n) * 100).toFixed(2)}% + 2px);`
      : "";
    const meta = [c.room, c.teacher].filter(Boolean).join(" · ");
    html +=
      `<div class="wk-chip ${n > 2 ? "narrow" : ""}" style="grid-column:${c.day + 1};grid-row:${sj + 1}/span ${span};${extra}--h:${hueOf(c.name)}" title="${esc(c.name + (meta ? " · " + meta : ""))}">
        <div class="wc-name">${esc(c.name)}</div>
        ${meta && n <= 2 ? `<div class="wc-meta">${esc(meta)}</div>` : ""}
      </div>`;
  });
  if (!visible.length) {
    html += `<div class="wk-empty" style="grid-row:2">这一周还没有课程${hidden ? "（另有 " + hidden + " 门不在本周）" : ""}</div>`;
  }

  grid.style.gridTemplateRows = `44px repeat(${rows}, 62px)`;
  grid.innerHTML = html;

  $("#wkLabel").textContent = info.no ? `第 ${info.no} 周` : "第 ? 周";
  const last = days[6];
  $("#wkRange").textContent =
    `${info.mon.getMonth() + 1} 月 ${info.mon.getDate()} 日 – ${last.getMonth() + 1} 月 ${last.getDate()} 日`;
  $("#wkNote").textContent = hidden ? `已过滤 ${hidden} 门非本周课程` : "";

  const inp = $("#wkTermStart");
  if (inp && document.activeElement !== inp) inp.value = (Store.data.settings.termStart || "");
}

function setTlMode(mode) {
  tlMode = mode === "week" ? "week" : "day";
  $$(".seg-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === tlMode));
  $("#tlScroll").classList.toggle("hidden", tlMode !== "day");
  $("#weekPane").classList.toggle("hidden", tlMode !== "week");
  $("#tlTitle").textContent = tlMode === "day" ? "今日时间线" : "本周课表";
  $("#tlHint").textContent = tlMode === "day"
    ? "课程与待办混排 · 红线为当前时刻"
    : "‹ › 翻周 · 今天那列高亮";
  if (tlMode === "week") renderWeek();
  else renderTimeline(true);
}

function bindWeekUI() {
  $$(".seg-btn").forEach(btn =>
    btn.addEventListener("click", () => setTlMode(btn.dataset.mode))
  );
  const prev = $("#wkPrev"), next = $("#wkNext"), now = $("#wkNow");
  if (prev) prev.addEventListener("click", () => { weekOffset--; renderWeek(); });
  if (next) next.addEventListener("click", () => { weekOffset++; renderWeek(); });
  if (now) now.addEventListener("click", () => { weekOffset = 0; renderWeek(); });

  const inp = $("#wkTermStart");
  if (inp) {
    inp.addEventListener("change", () => {
      Store.data.settings.termStart = inp.value || "";
      Store.save();
      weekOffset = 0;
      renderWeek();
    });
  }
}

/* =========================================================
   待办（列表 / 四象限）
   ========================================================= */
const QUADS = {
  1: { name: "重要紧急", cls: "q1", tip: "马上做" },
  2: { name: "重要不急", cls: "q2", tip: "排计划" },
  3: { name: "紧急不重要", cls: "q3", tip: "尽量委托" },
  4: { name: "不重要不急", cls: "q4", tip: "少做/不做" }
};
let todoMode = "list";

function quadOf(t) { return QUADS[t.quad] || QUADS[2]; }
function fmtDateShort(d) {
  if (!d) return "";
  if (d === todayStr()) return "今天";
  const [, m, day] = d.split("-").map(Number);
  return `${m}月${day}日`;
}

function dayLabel(d) {
  if (!d || d === "未排期") return "未排期";
  if (d === todayStr()) return "今天";
  const t = new Date(); t.setDate(t.getDate() + 1);
  const tom = `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
  if (d === tom) return "明天";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return `${d.slice(5).replace("-", "/")} ${weekdayName(dt.getDay() === 0 ? 7 : dt.getDay())}`;
}
function todoItemHTML(t) {
  const q = quadOf(t);
  return `<div class="todo-item ${t.done ? "done" : ""}" data-id="${t.id}">
    <button class="check" data-act="toggle" title="标记完成">✓</button>
    <div class="ti-body">
      <div class="ti-text">${esc(t.text)}</div>
      <div class="ti-tags">
        <span class="ti-tag ${q.cls}">${q.name}</span>
        ${t.date ? `<span class="ti-date">📅 ${fmtDateShort(t.date)}</span>` : ""}
        ${t.time ? `<span class="ti-time">⏰ ${t.time}${t.end ? "–" + t.end : ""}</span>` : ""}
      </div>
    </div>
    <button class="ti-del" data-act="del" title="删除">✕</button>
  </div>`;
}

function renderTodo() {
  const list = $("#todoList"), quadView = $("#todoQuadView");
  if (todoMode === "quad") {
    list.classList.add("hidden");
    quadView.classList.remove("hidden");
    renderTodoQuad();
    return;
  }
  list.classList.remove("hidden");
  quadView.classList.add("hidden");

  const all = Store.data.todos;
  if (!all.length) {
    list.innerHTML = `<div class="empty-hint">还没有待办，在上面加一条吧</div>`;
    return;
  }

  // 按天分组：同一天的待办归到一条分割线下面
  const groups = {};
  all.forEach(t => { const k = t.date || "未排期"; (groups[k] = groups[k] || []).push(t); });

  // 排序权重：今天(0) → 未来按近到远(1,2,3…) → 过期沉底(1000+，最近的过期更靠上) → 未排期垫底
  const tStr = todayStr();
  const weight = (k) => {
    if (k === "未排期" || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return 1e9;
    if (k === tStr) return 0;
    const diff = Math.round((new Date(tStr + "T00:00:00") - new Date(k + "T00:00:00")) / 864e5);
    if (diff > 0) return 1000 + diff; // 过期：沉底，越久越远越靠下
    return 1 - diff;                   // 未来：最近的未来最靠上
  };
  const keys = Object.keys(groups).sort((a, b) => weight(a) - weight(b));

  const html = [];
  for (const k of keys) {
    const items = groups[k].slice().sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const qa = a.quad || 2, qb = b.quad || 2;
      if (qa !== qb) return qa - qb;
      const at = a.time ? hhmmToMin(a.time) : 9999, bt = b.time ? hhmmToMin(b.time) : 9999;
      return at - bt;
    });
    const isPast = k !== "未排期" && k < tStr;
    html.push(`<div class="day-divider${isPast ? " past" : ""}" data-date="${esc(k)}"><span class="dd-label">${dayLabel(k)}${isPast ? " · 之前" : ""}</span><span class="dd-count">${items.length} 项</span></div>`);
    items.forEach(t => html.push(todoItemHTML(t)));
  }
  list.innerHTML = html.join("");
}

function renderTodoQuad() {
  const quadView = $("#todoQuadView");
  const items = Store.data.todos.filter(t => !t.done);
  quadView.innerHTML = [1, 2, 3, 4].map(qn => {
    const q = QUADS[qn];
    const list = items.filter(t => (t.quad || 2) === qn);
    return `<div class="quad-cell ${q.cls}">
      <div class="quad-head">
        <span class="quad-title">${q.name}</span>
        <span class="quad-tip">${q.tip}</span>
        <span class="quad-count">${list.length}</span>
      </div>
      <div class="quad-body">
        ${list.length ? list.map(t => `
          <div class="quad-item" data-id="${t.id}">
            <button class="check sm" data-act="toggle" title="完成">✓</button>
            <div class="qi-body">
              <div class="qi-text">${esc(t.text)}</div>
              <div class="qi-meta">${fmtDateShort(t.date)}${t.time ? " · " + t.time : ""}</div>
            </div>
            <button class="ti-del sm" data-act="del" title="删除">✕</button>
          </div>`).join("") : `<div class="empty-hint sm">空</div>`}
      </div>
    </div>`;
  }).join("");
}

/* 中文自然语言解析：把「明天下午3点半 交作业」拆成日期 / 时间 / 象限 */
function parseTodoInput(raw) {
  let s = String(raw == null ? "" : raw).trim();
  const out = { text: s, date: "", time: "", end: "", quad: 2 };
  if (!s) return out;
  const base = new Date();
  let hasDate = false, hasTime = false;
  const mapW = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 7, "天": 7, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7 };

  // 相对日
  const rel = { "大后天": 3, "后天": 2, "明天": 1, "明日": 1, "明早": 1, "明晚": 1, "今天": 0, "今日": 0, "今早": 0, "今晚": 0 };
  let relHit = null;
  for (const k in rel) { if (s.indexOf(k) >= 0) { relHit = k; break; } }
  if (relHit) {
    const d = new Date(base); d.setDate(d.getDate() + rel[relHit]);
    out.date = dateStr(d); hasDate = true;
    if (relHit.indexOf("晚") >= 0) { out.time = "20:00"; hasTime = true; }
    else if (relHit.indexOf("早") >= 0) { out.time = "08:00"; hasTime = true; }
    s = s.replace(relHit, " ");
  }

  // 周几 / 下周几
  if (!hasDate) {
    const wm = s.match(/(下周|这周|本周|周|星期|礼拜)([一二三四五六日天1-7])/);
    if (wm) {
      const target = mapW[wm[2]];
      const cur = base.getDay() === 0 ? 7 : base.getDay();
      let diff = target - cur;
      if (wm[1] === "下周") diff += 7;
      else if (diff < 0) diff += 7;
      const d = new Date(base); d.setDate(d.getDate() + diff);
      out.date = dateStr(d); hasDate = true;
      s = s.replace(wm[0], " ");
    }
  }

  // M月D日 / M-D / M/D
  if (!hasDate) {
    const mm = s.match(/(\d{1,2})\s*[月\-\/]\s*(\d{1,2})\s*日?/);
    if (mm) {
      const y = base.getFullYear();
      const d = new Date(y, Number(mm[1]) - 1, Number(mm[2]));
      if (d < new Date(y, base.getMonth(), base.getDate())) d.setFullYear(y + 1);
      if (!isNaN(d.getTime())) { out.date = dateStr(d); hasDate = true; s = s.replace(mm[0], " "); }
    }
  }

  // 时间：上午/下午/晚上 + 3点 / 3点半 / 3:20
  const tm = s.match(/(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里|夜间)?\s*(\d{1,2})\s*(?:[:：]\s*(\d{1,2})|点(?:半|(\d{1,2})\s*分)?)/);
  if (tm) {
    let h = Number(tm[2]);
    let mi = tm[3] ? Number(tm[3]) : (tm[4] ? Number(tm[4]) : (tm[0].indexOf("半") >= 0 ? 30 : 0));
    const seg = tm[1] || "";
    if (/(下午|傍晚|晚上|夜里|夜间|中午)/.test(seg) && h < 12) h += 12;
    if (/凌晨/.test(seg) && h === 12) h = 0;
    if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) {
      out.time = `${pad2(h)}:${pad2(mi)}`; hasTime = true;
      s = s.replace(tm[0], " ");
    }
  }

  // 结束时间：到5点 / 5点-6点
  const em = s.match(/(?:到|至|~|～|-)\s*(\d{1,2})\s*(?:[:：]\s*(\d{1,2})|点(?:半)?)/);
  if (hasTime && em) {
    let eh = Number(em[1]);
    let emi = em[2] ? Number(em[2]) : (em[0].indexOf("半") >= 0 ? 30 : 0);
    if (/(下午|晚上)/.test((tm && tm[1]) || "") && eh < 12) eh += 12;
    if (eh >= 0 && eh <= 23) { out.end = `${pad2(eh)}:${pad2(emi)}`; s = s.replace(em[0], " "); }
  }

  // 优先级关键词
  if (/重要.*紧急|紧急.*重要/.test(s) && s.indexOf("不重要") < 0) out.quad = 1;
  else if (s.indexOf("紧急") >= 0 && s.indexOf("不重要") < 0) out.quad = 3;

  out.text = s.replace(/\s+/g, " ").replace(/^[,，。、;；\s]+|[,，。、;；\s]+$/g, "").trim() || out.text;
  return out;
}

function addTodo() {
  const raw = ($("#todoText").value || "").trim();
  if (!raw) { $("#todoText").focus(); return; }
  const p = parseTodoInput(raw);
  const advOpen = $("#todoAdv") && !$("#todoAdv").classList.contains("hidden");
  let date = p.date || todayStr();
  let time = p.time || "";
  let end = p.end || "";
  let quad = p.quad || 2;
  if (advOpen) {
    if ($("#todoDate").value) date = $("#todoDate").value;
    if ($("#todoTime").value) time = $("#todoTime").value;
    if ($("#todoEnd").value) end = $("#todoEnd").value;
    quad = parseInt($("#todoQuad").value, 10) || 2;
  }
  Store.data.todos.push({ id: uid(), text: p.text, date, time, end, quad, done: false });
  Store.save();
  $("#todoText").value = "";
  $("#todoTime").value = ""; $("#todoEnd").value = "";
  $("#todoDate").value = todayStr(); $("#todoQuad").value = "2";
  renderTodo(); renderTimeline(); renderNextCard(); renderHome();
  const dLabel = date === todayStr() ? "今天" : date.slice(5).replace("-", "/");
  toast(`已加入 ${dLabel}${time ? " " + time : ""}`);
}

/* 时间线点空白处：快速建一条当天的待办 */
function openQuickTodoModal(time) {
  const html = `
    <div class="field"><label>要做什么</label>
      <input id="qtText" class="input" placeholder="例如：复习英语"></div>
    <div class="field"><label>开始</label>
      <input id="qtTime" class="input" type="time" value="${esc(time || "")}"></div>
    <div class="field"><label>结束（可选）</label>
      <input id="qtEnd" class="input" type="time"></div>
    <div class="modal-actions"><button class="btn primary" id="qtSave">加进今天</button></div>`;
  openModal("在 " + esc(time) + " 加待办", html, b => {
    const inp = $("#qtText", b);
    setTimeout(() => { try { inp.focus(); } catch (e) {} }, 60);
    const save = () => {
      const text = inp.value.trim();
      if (!text) { inp.focus(); return; }
      Store.data.todos.push({
        id: uid(), text, date: todayStr(),
        time: $("#qtTime", b).value || time,
        end: $("#qtEnd", b).value || "", quad: 2, done: false
      });
      Store.save(); closeModal();
      renderTodo(); renderTimeline(); renderNextCard(); renderHome();
      toast("已加进今天");
    };
    $("#qtSave", b).addEventListener("click", save);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") save(); });
  });
}

/* 时间线显示时段 / 密度 */
function openTimelineSettings() {
  const st = (Store.data && Store.data.settings) || {};
  const s0 = isFinite(Number(st.tlStart)) ? Number(st.tlStart) : 6;
  const e0 = isFinite(Number(st.tlEnd)) ? Number(st.tlEnd) : 24;
  const dens = st.tlDensity === "compact" ? "compact" : "normal";
  let optS = "";
  for (let h = 0; h <= 12; h++) optS += `<option value="${h}"${h === s0 ? " selected" : ""}>${pad2(h)}:00</option>`;
  let optE = "";
  for (let h = 12; h <= 24; h++) optE += `<option value="${h}"${h === e0 ? " selected" : ""}>${pad2(h)}:00</option>`;
  const html = `
    <p>只影响「时间线」这一页，不会改动已存的待办时间。</p>
    <div class="field"><label>每天从几点开始显示</label>
      <select id="tlS" class="input">${optS}</select></div>
    <div class="field"><label>显示到几点</label>
      <select id="tlE" class="input">${optE}</select></div>
    <div class="field"><label>密度</label>
      <div class="seg" id="tlDens">
        <button type="button" class="seg-btn ${dens === "normal" ? "active" : ""}" data-d="normal">舒适</button>
        <button type="button" class="seg-btn ${dens === "compact" ? "active" : ""}" data-d="compact">紧凑</button>
      </div></div>
    <div class="modal-actions"><button class="btn primary" id="tlSave">保存</button></div>`;
  openModal("时间线显示", html, b => {
    const seg = $("#tlDens", b);
    seg.addEventListener("click", e => {
      const btn = e.target.closest(".seg-btn"); if (!btn) return;
      $$(".seg-btn", seg).forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
    });
    $("#tlSave", b).addEventListener("click", () => {
      const sv = Number($("#tlS", b).value);
      let ev = Number($("#tlE", b).value);
      if (ev <= sv) ev = 24;
      Store.data.settings.tlStart = sv;
      Store.data.settings.tlEnd = ev;
      const act = seg.querySelector(".seg-btn.active");
      Store.data.settings.tlDensity = act ? act.dataset.d : "normal";
      Store.save();
      closeModal();
      renderTimeline(true);
      toast("时间线已更新");
    });
  });
}

function toggleTodo(id) {
  const t = Store.data.todos.find(x => x.id === id);
  if (!t) return;
  const wasDone = !!t.done;
  t.done = !t.done;
  Store.save();
  renderTodo(); renderTimeline(); renderNextCard(); renderHome();
  /* 刚完成的那一刻脑子里细节最全，这时问一句「记一笔」命中率最高 */
  if (!wasDone && t.done) setTimeout(() => showQuickLog(t.text), 240);
}

function deleteTodo(id) {
  const t = Store.data.todos.find(x => x.id === id);
  if (!t) return;
  Trash.add("todo", t, t.text);
  Store.data.todos = Store.data.todos.filter(x => x.id !== id);
  Store.save({ snapshot: true, label: "删除待办前" });
  renderTodo(); renderTimeline(); renderNextCard(); renderHome();
  toast("已移入回收站，30 天内可恢复");
}

/* =========================================================
   倒计时
   ========================================================= */
function renderCountdown() {
  const list = $("#countdownList");
  if (!list) return;
  // 进入倒计时页时，若日期框为空则默认填今天，降低「加不进去」的摩擦
  const dateEl = $("#cdDate");
  if (dateEl && !dateEl.value) dateEl.value = todayStr();

  // 技能下拉（可选绑定，让倒计时和本周训练联动）
  const skSel = $("#cdSkill");
  if (skSel) {
    const skills = Store.data.skills || [];
    const keep = skSel.value;
    skSel.innerHTML = `<option value="">不关联技能</option>` +
      skills.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
    if (keep && skills.some(s => s.id === keep)) skSel.value = keep;
  }

  const cds = [...(Store.data.countdowns || [])].sort((a, b) => daysLeft(a.date) - daysLeft(b.date));
  const hint = $("#cdHint");
  if (hint) hint.textContent = cds.length ? `共 ${cds.length} 个` : "";
  if (!cds.length) {
    list.innerHTML = `<div class="empty-hint">还没有倒计时，在下面加一个吧</div>`;
    return;
  }
  list.innerHTML = cds.map(c => {
    const left = daysLeft(c.date);
    const sk = c.skillId ? Store.data.skills.find(s => s.id === c.skillId) : null;
    const skLine = sk ? `<div class="cd-link">🎯 ${esc(sk.name)} · 本周练 ${trainWeekCount(sk)} 次 · 掌握 ${sk.progress || 0}%</div>` : "";
    return `<div class="cd-card" data-id="${c.id}">
      <div class="cd-info">
        <div class="cd-name">${esc(c.name)}</div>
        <div class="cd-date">${c.date.slice(5).replace("-", "/")}</div>
        ${skLine}
      </div>
      <div class="cd-num ${left < 0 ? "past" : ""}">${left >= 0 ? left : "—"}</div>
      <div class="cd-unit">${left >= 0 ? "天" : "已过期"}</div>
      <button class="cd-del" data-act="cd-del" title="删除">✕</button>
    </div>`;
  }).join("");
}

function addCountdown() {
  const nameEl = $("#cdName");
  const dateEl = $("#cdDate");
  const name = (nameEl.value || "").trim();
  // 日期没填就默认用今天，避免「必须填两项才能加」带来的「加不进去」错觉
  const date = dateEl.value || todayStr();
  if (!name) {
    nameEl.focus();
    const row = nameEl.closest(".add-row");
    if (row) { row.classList.remove("shake"); void row.offsetWidth; row.classList.add("shake"); }
    return;
  }
  try {
    if (!Array.isArray(Store.data.countdowns)) Store.data.countdowns = [];
    const skEl = $("#cdSkill");
    const skillId = skEl ? skEl.value : "";
    Store.data.countdowns.push({ id: uid(), name, date, skillId });
    // 先渲染，再保存；保存（含云同步）即使失败也不影响界面更新
    renderCountdown(); renderHome();
    try { Store.save(); } catch (e) { console.warn("[addCountdown] save 失败:", e); }
  } catch (e) {
    console.warn("[addCountdown] 添加失败:", e);
  }
  nameEl.value = "";
  dateEl.value = "";
  const skClear = $("#cdSkill");
  if (skClear) skClear.value = "";
}

function deleteCountdown(id) {
  const c = Store.data.countdowns.find(x => x.id === id);
  if (!c) return;
  Trash.add("countdown", c, c.name);
  Store.data.countdowns = Store.data.countdowns.filter(x => x.id !== id);
  Store.save({ snapshot: true, label: "删除倒计时前" });
  renderCountdown(); renderHome();
  toast("已移入回收站，30 天内可恢复");
}

/* =========================================================
   技能
   ========================================================= */
function renderSkills() {
  const grid = $("#skillGrid");
  const skills = Store.data.skills;
  const wtId = getWeeklyTheme().skill ? getWeeklyTheme().skill.id : null;

  grid.innerHTML = skills.map(s => {
    const td = trainTodayCount(s);
    const tw = trainWeekCount(s);
    const tgt = Number(s.target) || 100;
    return `
    <div class="skill-card ${s.id === wtId ? "is-week-theme" : ""}" data-id="${s.id}" draggable="true">
      <div class="sc-head">
        <span class="sc-icon">${esc(s.icon || "⭐")}</span>
        <span class="sc-name" data-act="rename" title="点击重命名">${esc(s.name)}</span>
        ${s.id === wtId ? `<span class="sc-badge">本周主题</span>` : ""}
        <span class="sc-pct">${s.progress}%</span>
        <button class="icon-btn" data-act="del" title="删除技能">✕</button>
      </div>

      <div class="sc-train-row">
        <button class="train-btn" data-act="train" title="今天练了一次，进度 +1">＋ 今日训练</button>
        <span class="sc-train-meta">今日 ${td} 次 · 本周 ${tw} 次 · 目标 ${tgt}</span>
      </div>

      <div class="progress" data-act="progress" title="拖动可校准进度">
        <div class="fill" style="width:${s.progress}%"></div>
      </div>

      <details class="method-details">
        <summary>训练方法</summary>
        <textarea class="method" data-act="method" placeholder="写下你的训练方法…">${esc(s.method || "")}</textarea>
      </details>

      <div class="sc-links">
        <a class="link-btn bili" href="${esc((s.links && s.links.bili) || "#")}" target="_blank" rel="noopener">▶ B站</a>
        <a class="link-btn dy" href="${esc((s.links && s.links.dy) || "#")}" target="_blank" rel="noopener">▶ 抖音</a>
        <button class="link-btn set" data-act="link">✎ 链接</button>
      </div>
    </div>`;
  }).join("");

  bindSkillEvents();
}

function bindSkillEvents() {
  $$(".skill-card").forEach(card => {
    const skill = Store.data.skills.find(s => s.id === card.dataset.id);
    if (!skill) return;

    /* 进度条：点击/拖动 */
    const bar = $(".progress", card);
    let dragging = false;
    const apply = clientX => {
      const rect = bar.getBoundingClientRect();
      let p = Math.round(((clientX - rect.left) / rect.width) * 100);
      p = Math.max(0, Math.min(100, p));
      skill.progress = p;
      $(".fill", bar).style.width = p + "%";
      $(".sc-pct", card).textContent = p + "%";
    };
    bar.addEventListener("pointerdown", e => {
      dragging = true;
      try { bar.setPointerCapture(e.pointerId); } catch (err) {}
      apply(e.clientX);
    });
    bar.addEventListener("pointermove", e => { if (dragging) apply(e.clientX); });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      Store.save();
    };
    bar.addEventListener("pointerup", endDrag);
    bar.addEventListener("pointercancel", endDrag);

    /* 训练方法 */
    const ta = $(".method", card);
    ta.addEventListener("blur", () => {
      skill.method = ta.value;
      Store.save();
    });

    /* 按钮：训练 / 重命名 / 删除 / 链接 */
    card.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "train") {
        trainSkill(skill.id);
      } else if (act === "rename") {
        openRenameSkill(skill.id);
      } else if (act === "del") {
        if (confirm(`删除技能「${skill.name}」？会移入回收站，30 天内可恢复。`)) {
          Trash.add("skill", skill, skill.name);
          Store.data.skills = Store.data.skills.filter(x => x.id !== skill.id);
          Store.save({ snapshot: true, label: "删除技能前" });
          renderSkills(); renderHome();
          toast("已移入回收站");
        }
      } else if (act === "link") {
        openLinkModal(skill.id);
      }
    });

    /* 拖拽排序 */
    card.addEventListener("dragstart", e => {
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", skill.id); } catch (err) {}
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("dragover", e => { e.preventDefault(); card.classList.add("drag-over"); });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", e => {
      e.preventDefault();
      card.classList.remove("drag-over");
      const fromId = e.dataTransfer.getData("text/plain");
      if (!fromId || fromId === skill.id) return;
      const arr = Store.data.skills;
      const from = arr.findIndex(x => x.id === fromId);
      const to = arr.findIndex(x => x.id === skill.id);
      if (from < 0 || to < 0) return;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      Store.save(); renderSkills(); renderHome();
    });
  });
}

function openLinkModal(skillId) {
  const s = Store.data.skills.find(x => x.id === skillId);
  if (!s) return;
  const html = `
    <div class="field"><label>B站链接</label>
      <input class="input" id="biliUrl" value="${esc((s.links && s.links.bili) || "")}"></div>
    <div class="field"><label>抖音链接</label>
      <input class="input" id="dyUrl" value="${esc((s.links && s.links.dy) || "")}"></div>
    <div class="modal-actions"><button class="btn primary" id="saveLink">保存</button></div>`;
  openModal(`设置「${s.name}」的链接`, html, body => {
    $("#saveLink", body).addEventListener("click", () => {
      s.links = {
        bili: $("#biliUrl", body).value.trim(),
        dy: $("#dyUrl", body).value.trim()
      };
      Store.save();
      renderSkills();
      closeModal();
    });
  });
}

function openAddSkill() {
  const html = `
    <div class="field"><label>技能名称</label>
      <input class="input" id="skName" placeholder="例如：ROS"></div>
    <div class="field"><label>图标（emoji，可选）</label>
      <input class="input" id="skIcon" placeholder="⭐" maxlength="4"></div>
    <div class="field"><label>初始进度 %</label>
      <input class="input" id="skProg" type="number" min="0" max="100" value="0"></div>
    <div class="modal-actions"><button class="btn primary" id="skSave">添加</button></div>`;
  openModal("添加技能", html, body => {
    $("#skSave", body).addEventListener("click", () => {
      const name = $("#skName", body).value.trim();
      if (!name) return;
      Store.data.skills.push({
        id: uid(),
        icon: $("#skIcon", body).value.trim() || "⭐",
        name,
        progress: Math.max(0, Math.min(100, Number($("#skProg", body).value) || 0)),
        method: "",
        links: {
          bili: "https://search.bilibili.com/all?keyword=" + encodeURIComponent(name),
          dy: "https://www.douyin.com/search/" + encodeURIComponent(name)
        }
      });
      Store.save();
      renderSkills();
      closeModal();
    });
  });
}

function openRenameSkill(id) {
  const s = Store.data.skills.find(x => x.id === id);
  if (!s) return;
  const html = `
    <div class="field"><label>技能名称</label>
      <input id="rnName" class="input" value="${esc(s.name)}"></div>
    <div class="field"><label>图标（emoji）</label>
      <input id="rnIcon" class="input" value="${esc(s.icon || "⭐")}" maxlength="4"></div>
    <div class="field"><label>总训练次数目标（决定每次训练推进多少进度）</label>
      <input id="rnTarget" type="number" min="1" max="999" class="input" value="${Number(s.target) || 100}"></div>
    <div class="modal-actions"><button class="btn primary" id="rnSave">保存</button></div>`;
  openModal("编辑技能", html, b => {
    const inp = $("#rnName", b);
    setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) {} }, 60);
    const save = () => {
      const v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      s.name = v;
      s.icon = ($("#rnIcon", b).value.trim() || "⭐");
      const t = parseInt($("#rnTarget", b).value, 10);
      s.target = (isNaN(t) || t < 1) ? 100 : Math.min(999, t);
      Store.save(); renderSkills(); renderHome(); closeModal();
    };
    $("#rnSave", b).addEventListener("click", save);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") save(); });
  });
}

/* =========================================================
   打卡
   ========================================================= */
const WD_LABEL = ["一", "二", "三", "四", "五", "六", "日"]; // 1=周一 .. 7=周日
function calcStreak(history) {
  let count = 0;
  const d = new Date();
  if (!history[todayStr()]) d.setDate(d.getDate() - 1);
  while (history[dateStr(d)]) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

function last7Days(history) {
  const out = [];
  const today = todayStr();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateStr(d);
    out.push({ date: key, on: !!history[key], isToday: key === today });
  }
  return out;
}

function habitFreqText(h) {
  if (h.freq === "weekly") {
    const ds = (h.days && h.days.length) ? h.days : [1, 2, 3, 4, 5, 6, 7];
    const labels = ds.slice().sort((a, b) => a - b).map(d => WD_LABEL[(d - 1 + 7) % 7]).join("");
    return "每周" + (ds.length >= 7 ? "" : labels);
  }
  return "每天";
}

/* 计算当前周期的打卡进度 */
function habitProgress(h) {
  if (h.freq === "weekly") {
    const allowed = (h.days && h.days.length) ? h.days : [1, 2, 3, 4, 5, 6, 7];
    const mon = mondayOf(new Date());
    let cnt = 0;
    for (const k in (h.history || {})) {
      if (!h.history[k]) continue;
      const d = new Date(k + "T00:00:00");
      if (isNaN(d.getTime())) continue;
      const diff = Math.round((d.getTime() - mon.getTime()) / 864e5);
      if (diff < 0 || diff >= 7) continue;
      const wd = d.getDay() === 0 ? 7 : d.getDay();
      if (allowed.includes(wd)) cnt++;
    }
    const target = (h.target && h.target > 0) ? h.target : 1;
    return { type: "weekly", cur: cnt, target, done: cnt >= target };
  }
  return { type: "daily", done: !!h.history[todayStr()] };
}

function renderCheckin() {
  const list = $("#habitList");
  const habits = Store.data.habits;
  const today = todayStr();

  if (!habits.length) {
    list.innerHTML = `<div class="empty-hint">还没有习惯，添加一个吧</div>`;
    return;
  }

  list.innerHTML = habits.map(h => {
    if (!h.freq) h.freq = "daily";
    if (!h.days || !h.days.length) h.days = [1, 2, 3, 4, 5, 6, 7];
    if (!h.target) h.target = 1;
    const done = !!h.history[today];
    const streak = calcStreak(h.history);
    const prog = habitProgress(h);
    const progText = prog.type === "weekly"
      ? `本周 ${prog.cur}/${prog.target} 次`
      : (prog.done ? "今日已打卡" : "今日未打卡");
    const progClass = prog.done ? "ok" : "no";
    const days = last7Days(h.history);
    return `
      <div class="habit-item" data-id="${h.id}">
        <div class="habit-main">
          <div class="habit-name">${esc(h.name)}</div>
          <div class="habit-meta">
            <span class="habit-streak">🔥 连续 ${streak} 天</span>
            <span class="habit-prog ${progClass}">${progText}</span>
            <span class="habit-freq">${habitFreqText(h)}</span>
            ${h.skillId && Store.data.skills.some(s => s.id === h.skillId) ? `<span class="habit-link-skill">🎯 ${esc(Store.data.skills.find(s => s.id === h.skillId).name)}</span>` : ""}
          </div>
          <div class="habit-days" title="点某天圆点可补卡 / 取消">
            ${days.map(d => `<div class="hd ${d.on ? "on" : ""} ${d.isToday ? "today" : ""}" data-act="day" data-date="${d.date}"></div>`).join("")}
          </div>
        </div>
        <div class="habit-actions">
          <button class="habit-today ${done ? "done" : ""}" data-act="toggle" title="今日打卡">
            <span class="check">✓</span>
          </button>
          <button class="ti-edit" data-act="edit" title="设置周期 / 次数">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.6 1.6 0 0 0 15 19.4a1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.09A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.09A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6 1.6 1.6 0 0 0 10 3.13V3a2 2 0 1 1 4 0v.09A1.6 1.6 0 0 0 15 4.6a1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9v.09a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.51.91z"/></svg>
          </button>
          <button class="ti-del" data-act="del" title="删除习惯">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
      </div>`;
  }).join("");
}

function toggleHabit(id) {
  const h = Store.data.habits.find(x => x.id === id);
  if (!h) return;
  const today = todayStr();
  if (h.history[today]) delete h.history[today];
  else {
    h.history[today] = true;
    if (h.skillId) trainSkill(h.skillId, { silent: true });
  }
  Store.save();
  renderCheckin(); renderHome();
}

/* 补卡 / 取消某一天（点击 7 天圆点） */
function toggleHabitDate(id, date) {
  const h = Store.data.habits.find(x => x.id === id);
  if (!h) return;
  const isToday = date === todayStr();
  if (h.history[date]) {
    if (!isToday && !confirm(`取消 ${date} 的打卡记录？`)) return;
    delete h.history[date];
  } else {
    if (!isToday && !confirm(`补记 ${date} 的打卡？`)) return;
    h.history[date] = true;
  }
  Store.save();
  renderCheckin();
}

function addHabit() {
  const name = $("#habitText").value.trim();
  if (!name) return;
  Store.data.habits.push({
    id: uid(), name, history: {},
    freq: "daily", days: [1, 2, 3, 4, 5, 6, 7], target: 1
  });
  Store.save();
  $("#habitText").value = "";
  renderCheckin();
}

function deleteHabit(id) {
  const h = Store.data.habits.find(x => x.id === id);
  if (!h) return;
  if (!confirm(`删除习惯「${h.name}」？会移入回收站，30 天内可连打卡历史一起恢复。`)) return;
  Trash.add("habit", h, h.name);
  Store.data.habits = Store.data.habits.filter(x => x.id !== id);
  Store.save({ snapshot: true, label: "删除习惯前" });
  renderCheckin(); renderHome();
  toast("已移入回收站");
}

/* 设置：名称 / 周期 / 星期 / 目标次数 */
function editHabit(id) {
  const h = Store.data.habits.find(x => x.id === id);
  if (!h) return;
  if (!h.freq) h.freq = "daily";
  if (!h.days || !h.days.length) h.days = [1, 2, 3, 4, 5, 6, 7];
  if (!h.target) h.target = 1;

  const dayChecks = [1, 2, 3, 4, 5, 6, 7].map(d =>
    `<label class="day-chk"><input type="checkbox" value="${d}" ${h.days.includes(d) ? "checked" : ""}/> ${WD_LABEL[(d - 1 + 7) % 7]}</label>`
  ).join("");

  const html = `
    <div class="field">
      <label>习惯名称</label>
      <input id="hbName" class="input" value="${esc(h.name)}" />
    </div>
    <div class="field">
      <label>打卡周期</label>
      <div class="seg" id="hbFreqSeg">
        <button type="button" class="seg-btn ${h.freq === "daily" ? "active" : ""}" data-f="daily">每天</button>
        <button type="button" class="seg-btn ${h.freq === "weekly" ? "active" : ""}" data-f="weekly">每周</button>
      </div>
    </div>
    <div class="field" id="hbDaysField" style="${h.freq === "weekly" ? "" : "display:none"}">
      <label>选哪几天算（不选＝全部）</label>
      <div class="day-chks">${dayChecks}</div>
    </div>
    <div class="field">
      <label>目标次数（每周期）</label>
      <input id="hbTarget" type="number" min="1" max="21" class="input" value="${h.target}" />
    </div>
    <div class="field">
      <label>关联技能（打卡时自动 +1 训练）</label>
      <select id="hbSkill" class="input">
        <option value="">不关联</option>
        ${(Store.data.skills || []).map(s => `<option value="${s.id}" ${h.skillId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn ghost" id="hbCancel">取消</button>
      <button class="btn primary" id="hbSave">保存</button>
    </div>`;

  openModal("设置「" + h.name + "」", html, body => {
    const seg = $("#hbFreqSeg", body);
    const daysField = $("#hbDaysField", body);
    seg.addEventListener("click", e => {
      const b = e.target.closest(".seg-btn");
      if (!b) return;
      seg.querySelectorAll(".seg-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      daysField.style.display = b.dataset.f === "weekly" ? "" : "none";
    });
    $("#hbCancel", body).addEventListener("click", closeModal);
    $("#hbSave", body).addEventListener("click", () => {
      const name = $("#hbName", body).value.trim() || h.name;
      const freq = seg.querySelector(".seg-btn.active").dataset.f;
      const days = Array.from(daysField.querySelectorAll("input:checked")).map(i => Number(i.value));
      let target = parseInt($("#hbTarget", body).value, 10);
      if (isNaN(target) || target < 1) target = 1;
      h.name = name;
      h.freq = freq;
      h.days = freq === "weekly" ? (days.length ? days : [1, 2, 3, 4, 5, 6, 7]) : [1, 2, 3, 4, 5, 6, 7];
      h.target = target;
      h.skillId = $("#hbSkill", body).value;
      Store.save();
      renderCheckin(); renderHome();
      closeModal();
    });
  });
}

/* =========================================================
   弹窗通用
   ========================================================= */
function openModal(title, html, onMount) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  $("#modal").classList.remove("hidden");
  if (onMount) onMount($("#modalBody"));
}
function closeModal() {
  $("#modal").classList.add("hidden");
}

/* ---------- 导入课表 ---------- */
const JB_PERIODS = [
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

function kbCellLines(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|span|font)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .split("\n").map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function kbLooksLikeRoom(s) {
  return /(楼|室|馆|场|中心|实验|机房|[A-Za-z]\s*\d{2,}|\d{3,})/.test(s) && s.length <= 24;
}

function parseKbText(html) {
  if (!html || typeof html !== "string") return [];
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
    const lines = kbCellLines(m[3]).filter(
      l => !/^\[?\d+(-\d+)?周/.test(l) && !/^第?\d+-\d+周/.test(l)
    );
    if (!lines.length) continue;
    const name = lines[0];
    if (!name || /^(无|暂无)$/.test(name)) continue;
    const rest = lines.slice(1);
    const roomIdx = rest.findIndex(kbLooksLikeRoom);
    cells.push({ day, jc, name, room: roomIdx >= 0 ? rest[roomIdx] : "" });
  }

  const grouped = {};
  cells.forEach(c => {
    const key = c.day + "|" + c.name + "|" + c.room;
    (grouped[key] = grouped[key] || []).push(c.jc);
  });

  const out = [];
  Object.entries(grouped).forEach(([key, jcs]) => {
    const parts = key.split("|");
    const day = Number(parts[0]);
    const name = parts[1];
    const room = parts[2] || "";
    jcs.sort((a, b) => a - b);
    let start = jcs[0], prev = jcs[0];
    const flush = (s0, e0) => {
      const ps = JB_PERIODS.find(p => p.jc === s0) || JB_PERIODS[0];
      const pe = JB_PERIODS.find(p => p.jc === e0) || ps;
      out.push({
        id: "imp_" + day + "_" + s0 + "_" + Math.random().toString(36).slice(2, 6),
        name, day, start: ps.start, end: pe.end, room
      });
    };
    for (let k = 1; k < jcs.length; k++) {
      if (jcs[k] === prev + 1) prev = jcs[k];
      else { flush(start, prev); start = jcs[k]; prev = jcs[k]; }
    }
    flush(start, prev);
  });

  out.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  return out;
}

/* 粘贴的内容如果是课表接口返回的 JSON（含 kbList），也能解析 */
function parseKbJsonClient(text) {
  let j;
  try { j = JSON.parse(String(text || "").trim()); } catch (e) { return []; }
  const list = j && (j.kbList || j.rows || (Array.isArray(j) ? j : null));
  if (!Array.isArray(list) || !list.length) return [];
  const map = new Map();
  list.forEach(it => {
    const name = String(it.kcmc || it.courseName || "").trim();
    const day = Number(it.xqj || 0);
    if (!name || !(day >= 1 && day <= 7)) return;
    const m = String(it.jcs || it.jc || "").match(/(\d{1,2})\s*[-~—至]\s*(\d{1,2})/);
    const s = m ? Number(m[1]) : Number(String(it.jcs || it.jc || "").replace(/\D/g, ""));
    const e = m ? Number(m[2]) : s;
    if (!s || !e) return;
    const key = name + "|" + day + "|" + s + "-" + e;
    const room = String(it.cdmc || it.roomName || "").trim();
    const teacher = String(it.xm || "").trim();
    const weeks = String(it.zcd || it.zcmc || "").trim();
    const hit = map.get(key);
    if (hit) {
      if (weeks && hit.weekParts.indexOf(weeks) < 0) hit.weekParts.push(weeks);
      return;
    }
    map.set(key, { name, day, s, e, room, teacher, weekParts: weeks ? [weeks] : [] });
  });

  const out = [];
  map.forEach(v => {
    const ps = JB_PERIODS.find(p => p.jc === v.s) || JB_PERIODS[0];
    const pe = JB_PERIODS.find(p => p.jc === v.e) || ps;
    out.push({
      id: "imp_" + v.day + "_" + v.s + "_" + Math.random().toString(36).slice(2, 6),
      name: v.name, day: v.day, start: ps.start, end: pe.end,
      room: v.room, teacher: v.teacher,
      weeks: v.weekParts.join(",")
    });
  });
  out.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  return out;
}

function courseListHtml() {
  const courses = [...Store.data.courses].sort(
    (a, b) => a.day - b.day || hhmmToMin(a.start) - hhmmToMin(b.start)
  );
  if (!courses.length) return '<div class="empty-hint">暂无课程</div>';
  return courses.map(c => `
    <div class="todo-item" style="padding:9px 12px" data-cid="${c.id}">
      <div class="ti-body">
        <div class="ti-text">${esc(c.name)}</div>
        <div class="ti-time">${weekdayName(c.day)} ${c.start}–${c.end}${c.room ? " · " + esc(c.room) : ""}</div>
      </div>
      <button class="ti-del" data-act="del-course" title="删除课程">✕</button>
    </div>`).join("");
}

function openImportModal() {
  const courses = Store.data.courses;
  const html = `
    <h4>① 一键导入（推荐）</h4>
    <p>输入教务系统学号密码，直接抓课表。<strong>密码只用于本次登录，不会保存到任何地方。</strong>
    学年/学期会自动读取教务里的真实选项逐个尝试，填错也不要紧。</p>
    <div id="jwOnlineTip" class="sync-msg warn" style="display:none"></div>
    <div class="field"><label>学号</label>
      <input class="input" id="jwUser" placeholder="你的学号" autocomplete="off"></div>
    <div class="field"><label>密码</label>
      <input class="input" id="jwPass" type="password" placeholder="教务系统密码" autocomplete="off"></div>
    <div class="field" style="display:flex;gap:8px">
      <div style="flex:1"><label>学年（可留默认）</label>
        <input class="input" id="jwYear" value="2026"></div>
      <div style="flex:1"><label>学期（可留默认）</label>
        <select class="input" id="jwTerm">
          <option value="3">第一学期</option>
          <option value="12">第二学期</option>
          <option value="16">第三学期</option>
        </select></div>
    </div>
    <div class="modal-actions"><button class="btn primary" id="jwImport">一键导入课表</button></div>
    <div id="jwMsg" class="sync-msg"></div>

    <h4>② 粘贴课表数据（兜底）</h4>
    <p>正方课表是脚本动态加载的，<strong>直接 Ctrl+U 看源码是看不到表格的</strong>（会拿到一堆 JS）。
    正确做法：浏览器登录教务 → 打开课表页 → 按 <strong>F12</strong> → 切到「网络 / Network」→ 刷新页面 →
    点名称含 <code>cxXsKb</code> 的请求 → 右键「复制响应 / Copy response」→ 粘贴到这里。</p>
    <div class="field"><textarea class="input" id="kbHtml" rows="3" placeholder="粘贴课表接口返回的 JSON，或课表表格的 HTML…"></textarea></div>
    <div class="modal-actions"><button class="btn" id="kbParse">解析粘贴内容</button></div>
    <div id="kbMsg" class="sync-msg"></div>

    <h4 id="courseHead">③ 手动添加 / 管理（${courses.length} 门）</h4>
    <div class="field"><label>课程名称</label>
      <input class="input" id="cName" placeholder="例如：嵌入式系统"></div>
    <div class="field" style="display:flex;gap:8px">
      <div style="flex:1"><label>星期</label>
        <select class="input" id="cDay">
          ${[1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}">${weekdayName(d)}</option>`).join("")}
        </select></div>
      <div style="flex:1"><label>开始</label>
        <input class="input" id="cStart" type="time" value="08:00"></div>
      <div style="flex:1"><label>结束</label>
        <input class="input" id="cEnd" type="time" value="09:40"></div>
    </div>
    <div class="field"><label>地点（可选）</label>
      <input class="input" id="cRoom" placeholder="例如：实验楼 A306"></div>
    <div class="modal-actions"><button class="btn primary" id="cAdd">添加课程</button></div>
    <div id="courseList">${courseListHtml()}</div>`;

  openModal("导入 / 管理课表", html, body => {
    const jwMsg = $("#jwMsg", body);
    const kbMsg = $("#kbMsg", body);

    /* 在线版（非本机）一键导入不可用，提前说明 */
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const onlineTip = $("#jwOnlineTip", body);
    if (onlineTip && !isLocal) {
      onlineTip.style.display = "block";
      onlineTip.textContent = "当前是在线版：一键导入需要本机服务，点此按钮会失败。请在本机 http://localhost:7788 导入后「上传同步」，这里「拉取同步」；或直接用下方②粘贴 JSON。";
    }

    /* 一键导入 */
    $("#jwImport", body).addEventListener("click", async () => {
      const username = $("#jwUser", body).value.trim();
      const password = $("#jwPass", body).value;
      if (!username || !password) {
        jwMsg.textContent = "请填写学号和密码";
        jwMsg.className = "sync-msg err";
        return;
      }
      jwMsg.textContent = "正在登录教务系统…（约 5-15 秒）";
      jwMsg.className = "sync-msg";
      try {
        const r = await fetch("/api/import-course", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            year: $("#jwYear", body).value.trim() || "2026",
            term: $("#jwTerm", body).value
          })
        });
        const res = await r.json();
        if (!res.ok) {
          const err = new Error(res.error || "导入失败");
          err.trace = res.trace || [];
          throw err;
        }
        applyImported(res.courses, res.count);
        jwMsg.className = "sync-msg ok";
        jwMsg.innerHTML = `成功解析 ${res.count} 门课程`
          + (res.trace && res.trace.length
            ? `<div class="sync-trace">${res.trace.map(esc).join("<br>")}</div>` : "");
      } catch (e) {
        const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
        const tip = isLocal
          ? "（本机服务没在跑：双击 start.bat，用 http://localhost:7788 打开本页面）"
          : "（在线版不支持一键导入：请在本机 http://localhost:7788 导入后点「上传同步」，手机端再「拉取同步」；或直接用下方②粘贴 JSON）";
        jwMsg.className = "sync-msg err";
        jwMsg.innerHTML = "失败：" + esc(e.message) + esc(tip)
          + (e.trace && e.trace.length
            ? `<div class="sync-trace">${e.trace.map(esc).join("<br>")}</div>` : "");
      }
    });

    /* 粘贴源码解析（纯前端，不依赖服务） */
    $("#kbParse", body).addEventListener("click", () => {
      const text = $("#kbHtml", body).value.trim();
      if (!text) { kbMsg.textContent = "先粘贴课表页面源码"; kbMsg.className = "sync-msg err"; return; }
      let list = parseKbText(text);
      if (!list.length) list = parseKbJsonClient(text);
      if (!list.length) {
        let hint = "没解析到课程。";
        if (/<script|<link|function\s*\(|var\s+[\w$]+\s*=/i.test(text) && !/<table/i.test(text)) {
          hint = "这段是页面的脚本（JS），不是课表数据。请按上面 ② 的说明，从 F12 的「网络」里复制 cxXsKb 请求的响应（JSON）。";
        } else if (/kbgrid_table|kbcontent/.test(text)) {
          hint = "页面里有课表表格，但没解析出课程，可能这学期还没排课。";
        } else {
          hint = "没解析到课程，可能粘的不是课表页，或页面结构不同。";
        }
        kbMsg.textContent = hint;
        kbMsg.className = "sync-msg err";
        return;
      }
      applyImported(list, list.length);
      kbMsg.textContent = `解析到 ${list.length} 门课程`;
      kbMsg.className = "sync-msg ok";
    });

    /* 手动添加 */
    $("#cAdd", body).addEventListener("click", () => {
      const name = $("#cName", body).value.trim();
      if (!name) return;
      Store.data.courses.push({
        id: uid(),
        name,
        day: Number($("#cDay", body).value),
        start: $("#cStart", body).value || "08:00",
        end: $("#cEnd", body).value || "09:40",
        room: $("#cRoom", body).value.trim()
      });
      Store.save();
      renderTimeline(); renderNextCard();
      refreshCourseList();
    });

    /* 删除课程（事件委托，列表重绘后依然有效） */
    $("#courseList", body).addEventListener("click", e => {
      const btn = e.target.closest('[data-act="del-course"]');
      if (!btn) return;
      const cid = btn.closest("[data-cid]").dataset.cid;
      Store.data.courses = Store.data.courses.filter(c => c.id !== cid);
      Store.save();
      renderTimeline(); renderNextCard();
      refreshCourseList();
    });
  });
}

/* 只刷新弹窗里的课程列表，不重开弹窗（否则提示信息会被清掉） */
function refreshCourseList() {
  const box = document.querySelector("#courseList");
  if (box) box.innerHTML = courseListHtml();
  const head = document.querySelector("#courseHead");
  if (head) head.textContent = `③ 手动添加 / 管理（${Store.data.courses.length} 门）`;
}

function applyImported(list, count) {
  const overwrite = confirm(
    `解析到 ${count} 门课程。\n\n点「确定」= 覆盖现有课表\n点「取消」= 追加到现有课表`
  );
  if (overwrite) Store.data.courses = list;
  else Store.data.courses = Store.data.courses.concat(list);
  Store.save();
  renderTimeline(); renderNextCard(); renderTodo();
  refreshCourseList();
}

/* ---------- 设置 / 云同步 ---------- */
function setSyncMsg(el, text, cls) {
  if (!el) return;
  el.textContent = text || "";
  el.className = "sync-msg " + (cls || "");
}

function updateSyncBadge() {
  const el = $("#syncBadge");
  if (!el) return;
  el.classList.remove("warn", "err");
  if (!SyncCfg.token) {
    el.textContent = "本地存储";
    el.title = "未开启云同步";
  } else if (!SyncCfg.gistId) {
    el.textContent = "待上传";
    el.classList.add("warn");
    el.title = "已填 Token，还没上传数据";
  } else {
    const t = SyncCfg.lastSync;
    el.textContent = t
      ? "已同步 " + new Date(t).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      : "已连接";
    el.title = "GitHub Gist：" + SyncCfg.gistId;
  }
}

/* 把任意来源（云端 / 导入文件）的数据规范化：
   所有字段必为数组，缺失字段回退到本机现有数据，
   避免「xxx is not iterable」类崩溃，并修复倒计时不同步 */
function normalizeData(obj) {
  obj = obj || {};
  const cur = (Store.data && typeof Store.data === "object") ? Store.data : null;
  const arr = (v, fb) => Array.isArray(v) ? v : (Array.isArray(fb) ? fb : []);
  const out = {
    version: 2,
    updatedAt: obj.updatedAt || (cur && cur.updatedAt) || Date.now(),
    settings: Object.assign(JSON.parse(JSON.stringify(DEFAULT_DATA.settings)), (cur && cur.settings) || {}, obj.settings || {}),
    courses: arr(obj.courses, cur && cur.courses),
    todos: arr(obj.todos, cur && cur.todos),
    skills: arr(obj.skills, cur && cur.skills),
    habits: arr(obj.habits, cur && cur.habits),
    countdowns: arr(obj.countdowns, cur && cur.countdowns),
    logs: arr(obj.logs, cur && cur.logs),
    projects: arr(obj.projects, cur && cur.projects),
    reviews: (obj.reviews && typeof obj.reviews === "object" && !Array.isArray(obj.reviews))
      ? obj.reviews
      : ((cur && cur.reviews) || {}),
    /* 回收站也跟数据走：换设备后仍能恢复；云端没有就沿用本地的 */
    trash: arr(obj.trash, cur && cur.trash)
  };
  return fillItemDefaults(out);
}

function applyRemoteData(obj) {
  if (!obj || !Array.isArray(obj.courses)) throw new Error("云端数据格式不对");
  /* 覆盖本地前留一版（有 10 分钟节流，不会刷爆） */
  try { Snapshot.capture("拉取云端前"); } catch (e) {}
  Store.data = normalizeData(obj);
  // 直接落盘，避免触发自动推送造成回环
  try { localStorage.setItem(WB_KEY, JSON.stringify(Store.data)); } catch (e) {}
  renderAll();
  updateSyncBadge();
}

function openSettings() {
  const html = `
    <h4>外观 / 皮肤</h4>
    <p>简洁白、暗夜黑、国风宣纸，也可以拿自己的照片当背景。</p>
    <div class="modal-actions"><button class="btn" id="themeOpen">换个皮肤</button></div>

    <h4>安装到手机</h4>
    <p>把工作台装到主屏，像 App 一样随时打开，离线也能用。装法因手机而异，点下面看你的手机怎么装。</p>
    <div class="modal-actions"><button class="btn primary" id="installGuideBtn">查看安装方法</button></div>

    <h4>本地提醒</h4>
    <p>开启后，待办到点会弹系统通知；每天晨间给你一份今日重点（下节课 + 最重要待办 + 临近的倒计时）。需要先授权系统通知权限。</p>
    <label class="switch-row"><input type="checkbox" id="notifyOn" ${Notify.on ? "checked" : ""}> 开启本地提醒</label>
    <div class="field"><label>每日晨间提醒时间</label>
      <input class="input" id="notifyMorning" type="time" value="${esc(Notify.morning)}"></div>
    <div id="notifyMsg" class="sync-msg"></div>

    <h4>AI 助手（语音整理）</h4>
    <p>按住麦克风随便说一段，自动整理成「做了什么 · 为什么 · 标签」。<strong>Key 只存在本机浏览器</strong>，不进云端数据、不上传。你这个仓库是公开的，所以千万别把 Key 写进代码。</p>
    <div class="field"><label>服务商</label>
      <select class="input" id="aiPreset">
        ${AI_PRESETS.map(p => `<option value="${p.id}">${esc(p.name)}${p.note ? " — " + esc(p.note) : ""}</option>`).join("")}
      </select></div>
    <div class="field"><label>接口地址</label>
      <input class="input" id="aiBase" placeholder="https://api.deepseek.com" value="${esc(AICfg.base)}"></div>
    <div class="field"><label>模型名</label>
      <input class="input" id="aiModel" value="${esc(AICfg.model)}"></div>
    <div class="field"><label>API Key</label>
      <input class="input" id="aiKey" type="password" placeholder="sk-..." value="${esc(AICfg.key)}"></div>
    <label class="switch-row"><input type="checkbox" id="aiPolishOn" ${AICfg.polish ? "checked" : ""}> 说完自动提炼（关掉则只转文字）</label>
    <div class="modal-actions">
      <button class="btn" id="aiTest" type="button">测试连接</button>
      <button class="btn primary" id="aiSave" type="button">保存</button>
    </div>
    <div id="aiMsg" class="sync-msg"></div>

    <h4>周主题</h4>
    <p>每周自动聚焦一个技能来学；也能给本周指定一个技能 + 一句目标。设置会随云同步，电脑手机一致。</p>
    <div class="modal-actions"><button class="btn" id="wtOpen">设置本周主题</button></div>

    <h4>云同步（GitHub 私有 Gist，免费）</h4>
    <p>填一个 GitHub Token（勾选 gist 权限即可），电脑和手机就能共用同一份数据。<strong>Token 只存在本机浏览器。</strong></p>
    <div class="field"><label>GitHub Token</label>
      <input class="input" id="ghToken" type="password" placeholder="ghp_... 或 github_pat_..." value="${esc(SyncCfg.token)}"></div>
    <div class="field"><label>Gist ID（留空则首次上传自动创建）</label>
      <input class="input" id="ghGist" placeholder="例如 a1b2c3d4..." value="${esc(SyncCfg.gistId)}"></div>
    <label class="switch-row"><input type="checkbox" id="ghAuto" ${SyncCfg.auto ? "checked" : ""}> 改动后自动同步（约 3 秒后上传）</label>
    <div class="modal-actions">
      <button class="btn" id="ghPush">上传到云端</button>
      <button class="btn" id="ghPull">从云端拉取</button>
    </div>
    <div id="ghMsg" class="sync-msg"></div>

    <h4>备份 / 恢复</h4>
    <p>删掉的东西不会立刻消失：待办、倒计时、技能、习惯、记录都会先进<strong>回收站</strong>，30 天内能捞回来；每次删除、导入、拉取云端之前，还会自动留一版<strong>历史快照</strong>。</p>
    <div class="modal-actions">
      <button class="btn" id="trashBtn">回收站（${Trash.count()}）</button>
      <button class="btn" id="snapBtn">历史版本（${Snapshot.list().length}）</button>
    </div>
    <div class="modal-actions">
      <button class="btn" id="snapNow">立刻存一版快照</button>
    </div>
    <p>换设备时也可以先导出 JSON，到新设备再导入。</p>
    <div class="modal-actions">
      <button class="btn" id="expBtn">导出 JSON</button>
      <button class="btn" id="impBtn">导入 JSON</button>
    </div>
    <input type="file" id="impFile" accept="application/json,.json" style="display:none">
    <div class="modal-actions"><button class="btn ghost" id="resetBtn">恢复示例数据</button></div>

    <h4>关于数据</h4>
    <p>当前状态：${SyncCfg.token ? (SyncCfg.gistId ? "已连接 Gist" : "已填 Token，待上传") : "仅本机"}。课表作息按常见高校默认（第 1 节 08:00 起），如果你学校不同，告诉我我改。</p>`;

  openModal("设置", html, body => {
    const msg = $("#ghMsg", body);

    $("#themeOpen", body).addEventListener("click", openThemeModal);

    /* AI 配置 */
    const aiMsg = $("#aiMsg", body);
    const aiBaseEl = $("#aiBase", body);
    const aiModelEl = $("#aiModel", body);
    const aiKeyEl = $("#aiKey", body);
    const aiPresetEl = $("#aiPreset", body);
    const aiPolishEl = $("#aiPolishOn", body);
    const readAI = () => {
      AICfg.key = aiKeyEl.value.trim();
      AICfg.base = aiBaseEl.value.trim() || "https://api.deepseek.com";
      AICfg.model = aiModelEl.value.trim() || "deepseek-chat";
      AICfg.polish = !!(aiPolishEl && aiPolishEl.checked);
    };
    if (aiPresetEl) {
      const hit = AI_PRESETS.find(p => p.base && AICfg.base.indexOf(p.base) === 0);
      if (hit) aiPresetEl.value = hit.id;
      aiPresetEl.addEventListener("change", () => {
        const p = AI_PRESETS.find(x => x.id === aiPresetEl.value);
        if (p && p.id !== "custom" && p.base) {
          aiBaseEl.value = p.base;
          aiModelEl.value = p.model;
        }
      });
    }
    const aiSaveBtn = $("#aiSave", body);
    if (aiSaveBtn) aiSaveBtn.addEventListener("click", () => {
      readAI();
      if (aiMsg) {
        aiMsg.textContent = AICfg.ready ? "已保存，去「记录」页按住 🎤 试试" : "已保存（没填 Key 时先按原话记）";
        aiMsg.className = "sync-msg ok";
      }
    });
    const aiTestBtn = $("#aiTest", body);
    if (aiTestBtn) aiTestBtn.addEventListener("click", async () => {
      readAI();
      if (!AICfg.ready) {
        if (aiMsg) { aiMsg.textContent = "先填 API Key"; aiMsg.className = "sync-msg err"; }
        return;
      }
      if (aiMsg) { aiMsg.textContent = "正在连 " + AICfg.url() + " …"; aiMsg.className = "sync-msg"; }
      try {
        const r = await AI.chat([{ role: "user", content: "只回复两个字：通了" }], { maxTokens: 12 });
        if (aiMsg) { aiMsg.textContent = "通了 ✓ 模型回：" + String(r).trim().slice(0, 24); aiMsg.className = "sync-msg ok"; }
      } catch (e) {
        if (aiMsg) { aiMsg.textContent = "失败：" + e.message; aiMsg.className = "sync-msg err"; }
      }
    });

    const ig = $("#installGuideBtn", body);
    if (ig) ig.addEventListener("click", openInstallGuide);
    const wtOpen = $("#wtOpen", body);
    if (wtOpen) wtOpen.addEventListener("click", openWeekThemeModal);

    /* 本地提醒开关 */
    const nMsg = $("#notifyMsg", body);
    const notifyOn = $("#notifyOn", body);
    const notifyMorning = $("#notifyMorning", body);
    notifyMorning.disabled = !Notify.on;
    notifyOn.addEventListener("change", () => {
      const on = notifyOn.checked;
      Notify.on = on;
      notifyMorning.disabled = !on;
      if (on) {
        if (Notify.permitted) {
          nMsg.textContent = "提醒已开启，到点会弹通知";
          nMsg.className = "sync-msg ok";
        } else {
          requestNotifyPermission(nMsg);
        }
      } else {
        nMsg.textContent = "";
        nMsg.className = "sync-msg";
      }
    });
    notifyMorning.addEventListener("change", () => {
      Notify.morning = notifyMorning.value;
      nMsg.textContent = "已保存，每天 " + notifyMorning.value + " 起推送晨间提醒";
      nMsg.className = "sync-msg ok";
    });

    const readInputs = () => {
      SyncCfg.token = $("#ghToken", body).value.trim();
      SyncCfg.gistId = $("#ghGist", body).value.trim();
      SyncCfg.auto = $("#ghAuto", body).checked;
    };

    $("#ghAuto", body).addEventListener("change", readInputs);

    $("#ghPush", body).addEventListener("click", async () => {
      readInputs();
      setSyncMsg(msg, "上传中…");
      try {
        const gid = await GH.push();
        $("#ghGist", body).value = gid;
        setSyncMsg(msg, "已上传。Gist ID：" + gid + "（手机端填同一个 ID 即可）", "ok");
        updateSyncBadge();
      } catch (e) {
        setSyncMsg(msg, "失败：" + e.message, "err");
      }
    });

    $("#ghPull", body).addEventListener("click", async () => {
      readInputs();
      if (!confirm("从云端拉取会覆盖本机当前数据，继续？")) return;
      setSyncMsg(msg, "拉取中…");
      try {
        const obj = await GH.pull();
        applyRemoteData(obj);
        setSyncMsg(msg, "已从云端拉取并更新", "ok");
      } catch (e) {
        setSyncMsg(msg, "失败：" + e.message, "err");
      }
    });

    $("#trashBtn", body).addEventListener("click", openTrashModal);
    $("#snapBtn", body).addEventListener("click", openSnapshotModal);
    $("#snapNow", body).addEventListener("click", () => {
      const ok = Snapshot.capture("手动保存", true);
      toast(ok ? "已存一版快照" : "快照存不下（数据太大或存储已满）");
    });

    $("#expBtn", body).addEventListener("click", exportJSON);
    $("#impBtn", body).addEventListener("click", () => $("#impFile", body).click());
    $("#impFile", body).addEventListener("change", e => importJSON(e.target.files[0]));
    $("#resetBtn", body).addEventListener("click", () => {
      if (!confirm("恢复示例数据会把当前所有内容清空。\n\n系统已经自动存了一版，之后可以在「历史版本」里找回。\n\n继续吗？")) return;
      Store.reset();
      renderAll();
      closeModal();
      toast("已重置，可在设置 → 历史版本里找回");
    });
  });
}

/* =========================================================
   回收站 / 历史版本
   ========================================================= */
function fmtWhen(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = n => String(n).padStart(2, "0");
  const hm = p(d.getHours()) + ":" + p(d.getMinutes());
  if (d.toDateString() === new Date().toDateString()) return "今天 " + hm;
  return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + hm;
}

function openTrashModal() {
  const list = Trash.list();
  let html;
  if (!list.length) {
    html = `<div class="empty-hint">回收站是空的。<br>删掉的待办、倒计时、技能、习惯、记录都会先出现在这里。</div>`;
  } else {
    html = `
      <p class="rs-tip">保留 ${Trash.KEEP_DAYS} 天，过期自动清理。恢复后会回到原来的位置。</p>
      <div class="rs-list">
        ${list.map(r => `
          <div class="rs-item" data-id="${r.id}">
            <div class="rs-main">
              <div class="rs-name"><span class="rs-kind k-${esc(r.kind)}">${Trash.kindName(r.kind)}</span><span class="rs-label">${esc(r.label || "（无标题）")}</span></div>
              <div class="rs-meta">${fmtWhen(r.deletedAt)} 删除 · 还有 ${Trash.daysLeft(r)} 天</div>
            </div>
            <div class="rs-ops">
              <button class="btn mini" data-act="restore">恢复</button>
              <button class="btn mini ghost" data-act="purge">彻底删</button>
            </div>
          </div>`).join("")}
      </div>
      <div class="modal-actions"><button class="btn ghost" id="trashClear">清空回收站</button></div>`;
  }
  openModal("回收站", html, body => {
    const box = $(".rs-list", body);
    if (box) box.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const row = btn.closest(".rs-item");
      if (!row) return;
      const id = row.dataset.id;
      if (btn.dataset.act === "restore") {
        if (Trash.restore(id)) {
          Store.save();
          renderAll();
          openTrashModal();
          toast("已恢复");
        } else {
          toast("恢复失败，原始列表找不到了");
        }
      } else if (btn.dataset.act === "purge") {
        if (!confirm("彻底删除后无法恢复，确定？")) return;
        Trash.remove(id);
        Store.save();
        openTrashModal();
      }
    });
    const cl = $("#trashClear", body);
    if (cl) cl.addEventListener("click", () => {
      if (!confirm("清空回收站？里面的内容将无法恢复。")) return;
      Trash.clear();
      Store.save();
      openTrashModal();
      toast("已清空");
    });
  });
}

function openSnapshotModal() {
  const list = Snapshot.list();
  let html;
  if (!list.length) {
    html = `<div class="empty-hint">还没有快照。<br>每次删除、导入、拉取云端之前会自动留一版，也可以在设置里手动存。</div>`;
  } else {
    html = `
      <p class="rs-tip">恢复某一版会覆盖当前数据；不过恢复前也会先自动存一版，不会越退越少。</p>
      <div class="rs-list">
        ${list.map(s => `
          <div class="rs-item" data-ts="${s.ts}">
            <div class="rs-main">
              <div class="rs-name">${esc(s.label || "自动")}</div>
              <div class="rs-meta">${fmtWhen(s.ts)} · ${esc(Snapshot.summary(s.data))}</div>
            </div>
            <div class="rs-ops">
              <button class="btn mini" data-act="snapRestore">恢复</button>
              <button class="btn mini ghost" data-act="snapDel">删除</button>
            </div>
          </div>`).join("")}
      </div>`;
  }
  openModal("历史版本", html, body => {
    const box = $(".rs-list", body);
    if (!box) return;
    box.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const row = btn.closest(".rs-item");
      if (!row) return;
      const ts = Number(row.dataset.ts);
      if (btn.dataset.act === "snapRestore") {
        if (!confirm("恢复到这一版？当前数据会被覆盖。")) return;
        if (Snapshot.restore(ts)) {
          renderAll();
          closeModal();
          toast("已恢复到 " + fmtWhen(ts) + " 的版本");
        } else {
          toast("这一版读不出来");
        }
      } else if (btn.dataset.act === "snapDel") {
        Snapshot.remove(ts);
        openSnapshotModal();
      }
    });
  });
}

/* 周主题：给本周指定技能 + 目标（覆盖自动轮转） */
function openWeekThemeModal() {
  const wno = currentWeekNo();
  const skills = (Store.data && Store.data.skills) || [];
  const wt = getWeeklyTheme();
  const opts = skills.map(s => `<option value="${s.id}" ${wt.skill && s.id === wt.skill.id ? "selected" : ""}>${esc(s.icon || "⭐")} ${esc(s.name)}</option>`).join("");
  const html = `
    <p>当前：第 ${wno} 周${wt.isOverride ? "（已自定义，可恢复自动轮转）" : "（自动轮转中）"}</p>
    <div class="field"><label>本周主题技能</label>
      <select id="wtSkill" class="input">${opts || '<option value="">（请先去「技能」加一张卡）</option>'}</select></div>
    <div class="field"><label>本周目标（可选）</label>
      <input id="wtGoal" class="input" placeholder="例如：跑通 I2C 中断" value="${esc(wt.goal || "")}"></div>
    <div class="field"><label>本周训练目标次数</label>
      <input id="wtTarget" type="number" min="1" max="50" class="input" value="${wt.target || 5}"></div>
    <div class="modal-actions">
      <button class="btn primary" id="wtSave">保存本周主题</button>
      <button class="btn ghost" id="wtReset">恢复自动轮转</button>
    </div>`;
  openModal("设置本周主题", html, b => {
    $("#wtSave", b).addEventListener("click", () => {
      const sid = $("#wtSkill", b).value;
      const goal = $("#wtGoal", b).value.trim();
      const target = Math.max(1, Math.min(50, parseInt($("#wtTarget", b).value, 10) || 5));
      Store.data.settings.weekThemes = Store.data.settings.weekThemes || {};
      if (sid) Store.data.settings.weekThemes[wno] = { skillId: sid, goal, target };
      else delete Store.data.settings.weekThemes[wno];
      Store.save();
      renderHome(); renderSkills(); closeModal();
    });
    $("#wtReset", b).addEventListener("click", () => {
      if (Store.data.settings.weekThemes) delete Store.data.settings.weekThemes[wno];
      Store.save();
      renderHome(); renderSkills(); closeModal();
    });
  });
}

/* 安装到手机：按平台给出手动步骤（覆盖微信 / iOS / 安卓 / 桌面） */
function openInstallGuide() {
  const ua = navigator.userAgent;
  const isIOS = /iP(hone|od|ad)/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const inWeChat = /MicroMessenger/i.test(ua);
  let title = "安装到手机";
  let steps;
  if (inWeChat) {
    steps = [
      "你现在是在微信里打开的，微信内置浏览器不支持直接安装。",
      "点右上角的「⋯」→ 选「在浏览器打开」（或「默认浏览器」）。",
      "在系统浏览器（Safari / Chrome）打开后，再按下面对应手机的方法添加。"
    ];
  } else if (isIOS) {
    steps = [
      "用 iPhone 的 Safari 打开这个页面（不要用微信内置浏览器）。",
      "点底部中间的「分享」按钮（一个方框带向上箭头）。",
      "向上滑动，找到并点「添加到主屏幕」。",
      "可改个名字，点右上角「添加」就完成了，桌面会出现工作台图标。"
    ];
  } else if (isAndroid) {
    steps = [
      "用手机 Chrome 打开这个页面。",
      "点右上角「⋮」菜单 → 选「安装应用」或「添加到主屏幕」。",
      "也可以等页面顶部弹出「安装工作台」的横条，直接点「安装」。",
      "装好后桌面出现图标，离线也能打开，和 App 一样。"
    ];
  } else {
    steps = [
      "用电脑 Chrome / Edge 打开这个页面。",
      "地址栏右侧会出现「安装」图标（⊕ 或电脑形状），点它。",
      "或在浏览器菜单里选「安装工作台 / 将此站点作为应用安装」。",
      "装好后它会像独立 App 一样运行，不在浏览器标签里。"
    ];
  }
  const html = '<ol class="install-steps">' + steps.map(s => "<li>" + esc(s) + "</li>").join("") + "</ol>" +
    (inWeChat ? '<p class="sync-msg">小提示：用手机自带浏览器打开后再装，体验最好。</p>' : "");
  openModal(title, html);
}

/* ---------- 自动同步 ----------
   设计：改完本地 → save() 打时间戳 → onDataChanged 防抖上传；
   任何设备打开/切回前台/每 20 秒 → autoPull 拉云端；
   用数据里的 updatedAt 比较，谁新用谁（last-write-wins），避免互相覆盖。 */
let syncTimer = null;
let syncing = false;

window.onDataChanged = function () {
  // 没有 gistId 也不要紧：首次 push 会自动建一个
  if (!SyncCfg.auto || !SyncCfg.token) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    if (syncing) return;
    syncing = true;
    const el = $("#syncBadge");
    if (el) { el.textContent = "同步中…"; el.classList.remove("warn", "err"); }
    try {
      await GH.push();
      updateSyncBadge();
      /* 每 2 小时顺手留一版本地快照，能回溯到今天早些时候的状态 */
      const lastSnap = Number(localStorage.getItem("wb_last_snap_ts") || 0);
      if (Date.now() - lastSnap > 2 * 3600e3) {
        if (Snapshot.capture("自动")) localStorage.setItem("wb_last_snap_ts", String(Date.now()));
      }
    } catch (e) {
      if (el) { el.textContent = "同步失败"; el.classList.add("err"); }
      console.warn("[sync]", e.message);
    } finally {
      syncing = false;
    }
  }, 2000);
};

/* 从云端拉取；remote 比本地新才应用，避免覆盖刚做的本地修改 */
async function autoPull() {
  if (!SyncCfg.token || !SyncCfg.gistId || syncing) return;
  syncing = true;
  try {
    const remote = await GH.pull();
    const rUpd = remote.updatedAt || 0;
    const lUpd = Store.data.updatedAt || 0;
    if (rUpd > lUpd) {
      applyRemoteData(remote);   // 内部会 renderAll + 直接落盘（不触发回环）
      SyncCfg.lastSync = Date.now();
      console.log("[sync] 已拉取云端更新");
    }
  } catch (e) {
    /* 拉取失败不打扰用户（多半是没网 / token 失效） */
    console.warn("[sync pull]", e.message);
  } finally {
    syncing = false;
  }
}

/* 手动「拉取」按钮也走同一套，但先确认 + 强制覆盖 */
async function manualPull() {
  if (!SyncCfg.token || !SyncCfg.gistId) return null;
  const remote = await GH.pull();
  applyRemoteData(remote);
  return remote;
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `workbench-${todayStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!obj || !Array.isArray(obj.courses)) {
        alert("文件格式不对，需要包含 courses 数组");
        return;
      }
      /* 导入会整体覆盖，先把当前数据留一版 */
      Snapshot.capture("导入前", true);
      Store.data = normalizeData(obj);
      Store.save();
      renderAll();
      closeModal();
      alert("导入成功");
    } catch (e) {
      alert("解析失败：" + e.message);
    }
  };
  reader.readAsText(file);
}

/* =========================================================
   训练系统：技能训练记录 / 周统计 / 一键打卡 / 首页聚合条
   ========================================================= */
function habitDueToday(h) {
  if (!h) return false;
  const days = (h.days && h.days.length) ? h.days : [1, 2, 3, 4, 5, 6, 7];
  if (h.freq === "weekly") return days.indexOf(todayWeekday()) >= 0;
  return true;
}
function trainTodayCount(skill) {
  if (!skill || !skill.trainLog) return 0;
  return Number(skill.trainLog[todayStr()]) || 0;
}
function trainWeekCount(skill) {
  if (!skill || !skill.trainLog) return 0;
  const start = dateStr(mondayOf(new Date()));
  const end = todayStr();
  let n = 0;
  for (const k in skill.trainLog) {
    if (k >= start && k <= end) n += Number(skill.trainLog[k]) || 0;
  }
  return n;
}
function trainSkill(id, opts) {
  const s = Store.data.skills.find(x => x.id === id);
  if (!s) return false;
  s.trainLog = s.trainLog || {};
  s.target = Number(s.target) || 100;
  const today = todayStr();
  s.trainLog[today] = (Number(s.trainLog[today]) || 0) + 1;
  const step = Math.max(1, Math.round(100 / s.target));
  s.progress = Math.min(100, (Number(s.progress) || 0) + step);
  Store.save();
  renderSkills(); renderHome(); renderCheckin();
  if (!(opts && opts.silent)) toast(`「${s.name}」+1 · 进度 ${s.progress}%`);
  return true;
}
function planTrainTodo(skill) {
  if (!skill) return;
  const text = `练「${skill.name}」30 分钟`;
  const exist = Store.data.todos.find(t => t.date === todayStr() && t.text === text && !t.done);
  if (exist) { toast("今天已经有这条训练待办了"); switchView("todo"); return; }
  Store.data.todos.push({ id: uid(), text, date: todayStr(), time: "", end: "", quad: 1, done: false, src: "week-theme" });
  Store.save();
  renderTodo(); renderTimeline(); renderNextCard(); renderHome();
  toast("已生成今日训练待办");
}
function oneTapCheckin() {
  const today = todayStr();
  const list = (Store.data.habits || []).filter(h => habitDueToday(h) && !(h.history && h.history[today]));
  if (!list.length) { toast("今天该打的卡都打完了 🎉"); switchView("checkin"); return; }
  if (!confirm(`一键打卡：把今天还没打的 ${list.length} 个习惯都打上？`)) return;
  list.forEach(h => {
    h.history = h.history || {};
    h.history[today] = true;
    if (h.skillId) {
      const s = Store.data.skills.find(x => x.id === h.skillId);
      if (s) {
        s.trainLog = s.trainLog || {};
        s.trainLog[today] = (Number(s.trainLog[today]) || 0) + 1;
        const tgt = Number(s.target) || 100;
        s.progress = Math.min(100, (Number(s.progress) || 0) + Math.max(1, Math.round(100 / tgt)));
      }
    }
  });
  Store.save();
  renderCheckin(); renderHome(); renderSkills();
  toast(`已打卡 ${list.length} 项`);
}
function renderQuick() {
  const el = $("#homeQuick");
  if (!el) return;
  const today = todayStr();
  const habits = Store.data.habits || [];
  const dueH = habits.filter(h => habitDueToday(h));
  const doneH = dueH.filter(h => h.history && h.history[today]).length;
  const pendingH = dueH.length - doneH;
  const todoPending = (Store.data.todos || []).filter(t => !t.done && t.date === today).length;
  const overdue = (Store.data.todos || []).filter(t => !t.done && t.date && t.date < today).length;
  const wt = getWeeklyTheme();
  const wkDone = wt.skill ? trainWeekCount(wt.skill) : 0;
  const wkTarget = wt.target || 5;

  el.innerHTML = `
    <button class="qk qk-check" data-qk="checkin" type="button">
      <span class="qk-ico">✅</span>
      <span class="qk-body">
        <span class="qk-main">今日打卡 <b>${doneH}/${dueH.length}</b></span>
        <span class="qk-sub">${pendingH ? `还差 ${pendingH} 项 · 点我全打` : "已完成"}</span>
      </span>
    </button>
    <button class="qk qk-todo" data-qk="todo" type="button">
      <span class="qk-ico">📝</span>
      <span class="qk-body">
        <span class="qk-main">今日待办 <b>${todoPending} 项</b></span>
        <span class="qk-sub">${overdue ? `含逾期 ${overdue} 项 · 去处理` : "去处理"}</span>
      </span>
    </button>
    <button class="qk qk-train" data-qk="train" type="button">
      <span class="qk-ico">🎯</span>
      <span class="qk-body">
        <span class="qk-main">${wt.skill ? "练「" + esc(wt.skill.name) + "」" : "本周主题"}</span>
        <span class="qk-sub">${wt.skill ? `本周 ${wkDone}/${wkTarget} 次 · 点我 +1` : "去技能页设置"}</span>
      </span>
    </button>`;
}

/* =========================================================
   首页总览（聚合今日待办 / 课程 / 打卡 / 技能）
   ========================================================= */
function renderHome() {
  const elStats = $("#homeStats"), elTodo = $("#homeTodo"), elCourses = $("#homeCourses");
  const elHabits = $("#homeHabits"), elSkills = $("#homeSkills");
  if (!elStats) return;

  renderQuick();

  const now = new Date();
  const day = todayWeekday();
  const wno = todayWeekNo();
  const today = todayStr();

  // 今日待办 + 逾期未完成（逾期并入，避免「写完就忘」）
  const todayT = Store.data.todos.filter(t => t.date === today);
  const overdueT = Store.data.todos
    .filter(t => !t.done && t.date && t.date < today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const todos = [...overdueT, ...todayT];
  const todoDone = todayT.filter(t => t.done).length;
  // 今日课程（按周次过滤）
  const courses = Store.data.courses
    .filter(c => c.day === day && inWeek(c, wno))
    .sort((a, b) => hhmmToMin(a.start) - hhmmToMin(b.start));
  // 打卡（只统计今天该打的）
  const habits = Store.data.habits;
  const dueHabits = habits.filter(habitDueToday);
  const todayChecked = dueHabits.filter(x => x.history && x.history[today]).length;
  // 技能平均进度
  const skills = Store.data.skills;
  const avg = skills.length ? Math.round(skills.reduce((s, k) => s + (k.progress || 0), 0) / skills.length) : 0;

  $("#homeDate").textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${weekdayName(day)}`;

  // 行动中枢：下节课倒计时 / 今天课程结束后推最重要待办
  const elAction = $("#homeAction");
  if (elAction) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nextC = courses.find(c => hhmmToMin(c.start) > nowMin);
    const startedC = courses.filter(c => hhmmToMin(c.start) <= nowMin).length;
    const frac = courses.length ? startedC / courses.length : 0;
    const R = 26, C = 2 * Math.PI * R, off = C * (1 - frac);
    if (nextC) {
      const mins = hhmmToMin(nextC.start) - nowMin;
      elAction.innerHTML = `
        <div class="ah-ring">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="${R}" class="ah-track"/>
            <circle cx="32" cy="32" r="${R}" class="ah-fill" style="stroke-dasharray:${C};stroke-dashoffset:${off}"/>
            <text x="32" y="30" class="ah-num">${mins}</text>
            <text x="32" y="42" class="ah-unit">分钟</text>
          </svg>
        </div>
        <div class="ah-body">
          <div class="ah-label">下节课</div>
          <div class="ah-name">${esc(nextC.name)}</div>
          <div class="ah-meta">${esc(nextC.start)}–${esc(nextC.end)}${nextC.room ? " · " + esc(nextC.room) : ""} · 今天第 ${startedC + 1}/${courses.length} 节</div>
        </div>`;
    } else {
      const top = Store.data.todos
        .filter(t => t.date === today && !t.done)
        .sort((a, b) => (a.quad || 2) - (b.quad || 2) || (a.time ? hhmmToMin(a.time) : 9999) - (b.time ? hhmmToMin(b.time) : 9999))[0];
      elAction.innerHTML = `
        <div class="ah-ring done">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="${R}" class="ah-track"/>
            <circle cx="32" cy="32" r="${R}" class="ah-fill" style="stroke-dasharray:${C};stroke-dashoffset:0"/>
            <text x="32" y="39" class="ah-check">✓</text>
          </svg>
        </div>
        <div class="ah-body">
          <div class="ah-label">今日课程已结束</div>
          ${top ? `<div class="ah-name">现在专注：${esc(top.text)}</div><div class="ah-meta">${quadOf(top).name}${top.time ? " · " + esc(top.time) : ""}</div>` : `<div class="ah-name">今天没有更多安排了 🌿</div><div class="ah-meta">休息一下，或看看技能进度</div>`}
        </div>`;
    }
  }

  /* 周主题焦点块：本周自动聚焦一个技能，可自定义 */
  const elWT = $("#homeWeekTheme");
  if (elWT) {
    const wt = getWeeklyTheme();
    if (!wt.skill) {
      elWT.innerHTML = `<div class="wt-empty">🎯 周主题：先去「技能」加一张技能卡，每周会自动聚焦一个来学</div>`;
    } else {
      const wkDone = trainWeekCount(wt.skill);
      const wkTarget = wt.target || 5;
      elWT.innerHTML = `
        <div class="wt-card">
          <div class="wt-head">
            <span class="wt-badge">🎯 本周主题</span>
            <span class="wt-week">第 ${wt.weekNo} 周${wt.isOverride ? " · 已自定义" : " · 自动轮转"}</span>
          </div>
          <div class="wt-body">
            <span class="wt-icon">${esc(wt.skill.icon || "⭐")}</span>
            <div class="wt-info">
              <div class="wt-name">${esc(wt.skill.name)}</div>
              <div class="wt-goal">${wt.goal ? "本周目标：" + esc(wt.goal) : "本周聚焦这个技能"}</div>
              <div class="wt-train">本周已练 <b>${wkDone}/${wkTarget}</b> 次 · 掌握度 ${wt.skill.progress || 0}%</div>
            </div>
            <div class="wt-prog"><div class="wt-ring" style="--p:${Math.min(100, wt.skill.progress || 0)}"><span>${wt.skill.progress || 0}%</span></div></div>
          </div>
          <div class="wt-actions">
            <button class="btn primary" data-train="${wt.skill.id}">＋ 练一次</button>
            <button class="btn ghost" data-plan="${wt.skill.id}">生成今日训练待办</button>
            <button class="btn ghost" data-view="skills">技能页 →</button>
          </div>
        </div>`;
      const tr = elWT.querySelector("[data-train]");
      if (tr) tr.addEventListener("click", () => { trainSkill(tr.dataset.train); });
      const pl = elWT.querySelector("[data-plan]");
      if (pl) pl.addEventListener("click", () => planTrainTodo(wt.skill));
      const go = elWT.querySelector("[data-view]");
      if (go) go.addEventListener("click", () => switchView("skills"));
    }
  }

  const I = {
    todo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5 6 8.5 9.5 5"/><path d="M4 13.5 6 15.5 9.5 12"/><path d="M4 20.5 6 22 9.5 19" opacity=".45"/><path d="M12.5 6.5H20M12.5 13.5H20M12.5 20.5H18"/></svg>`,
    course: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.4"/><path d="M8 3.2v3.4M16 3.2v3.4M3.5 10h17"/><path d="M8 14h3.5M8 17.2h6"/></svg>`,
    checkin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c3.6 0 6.5-2.7 6.5-6.2 0-2.4-1.3-4.2-3-6.1-1.3-1.5-2.6-3.1-3-5.2-.6 1.6-1.7 2.7-2.9 4C8 9.2 6.4 11 6.4 13.5 6.4 17.8 8.9 21 12 21z"/></svg>`,
    skill: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9.5M9.3 19V5M14.6 19v-7.5M20 19v-4.5"/><path d="M3 21h18"/></svg>`
  };
  const stats = [
    { c: "blue", icon: I.todo, label: "今日待办", value: `${todoDone}/${todayT.length}`, sub: overdueT.length ? `逾期 ${overdueT.length} 项` : (todayT.length ? (todoDone === todayT.length ? "全部完成 🎉" : "进行中") : "暂无") },
    { c: "green", icon: I.course, label: "今日课程", value: `${courses.length} 门`, sub: courses.length ? courses[0].name : "今天没课" },
    { c: "orange", icon: I.checkin, label: "今日打卡", value: `${todayChecked}/${dueHabits.length}`, sub: dueHabits.length ? (todayChecked === dueHabits.length ? "已全打卡" : "待打卡") : "今天不用打卡" },
    { c: "purple", icon: I.skill, label: "技能进度", value: `${avg}%`, sub: skills.length ? `共 ${skills.length} 项` : "暂无" }
  ];
  elStats.innerHTML = stats.map(s => `
    <div class="stat-card" data-c="${s.c}">
      <div class="stat-ic">${s.icon}</div>
      <div class="stat-body">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-sub">${s.sub}</div>
      </div>
    </div>`).join("");

  // 今日待办（逾期置顶并标红）
  if (!todos.length) elTodo.innerHTML = `<div class="empty-hint">今天还没有待办</div>`;
  else elTodo.innerHTML = todos.slice(0, 8).map(t => {
    const od = !t.done && t.date && t.date < today;
    return `
    <div class="home-todo-item ${t.done ? "done" : ""} ${od ? "overdue" : ""}" data-id="${t.id}">
      <span class="ht-check ${t.done ? "on" : ""}">${t.done ? "✓" : ""}</span>
      <span class="ht-text">${esc(t.text)}</span>
      ${od ? `<span class="ht-od">逾期</span>` : `<span class="ht-tag ${quadOf(t).cls}">${quadOf(t).name}</span>`}
      ${t.time ? `<span class="ht-time">${t.time}</span>` : ""}
    </div>`; }).join("");

  // 今日课程
  if (!courses.length) elCourses.innerHTML = `<div class="empty-hint">今天没有课程</div>`;
  else elCourses.innerHTML = courses.map(c => {
    const hue = hueOf(c.name);
    const r = jcRangeOf(c);
    return `<div class="home-course" style="--hue:${hue}">
      <span class="hc-time">${esc(c.start)}<br>${esc(c.end)}</span>
      <div class="hc-body">
        <div class="hc-name">${esc(c.name)}</div>
        <div class="hc-meta">${r[0] === r[1] ? r[0] + " 节" : r[0] + "-" + r[1] + " 节"}${c.room ? " · " + esc(c.room) : ""}${c.teacher ? " · " + esc(c.teacher) : ""}</div>
      </div>
    </div>`;
  }).join("");

  // 今日打卡
  if (!habits.length) elHabits.innerHTML = `<div class="empty-hint">还没有习惯</div>`;
  else elHabits.innerHTML = habits.map(x => {
    const done = !!(x.history && x.history[today]);
    const due = habitDueToday(x);
    const sk = x.skillId ? Store.data.skills.find(s => s.id === x.skillId) : null;
    return `<div class="home-habit ${done ? "done" : ""} ${due ? "" : "offday"}" data-id="${x.id}">
      <button class="hh-check ${done ? "on" : ""}" data-act="home-toggle" title="今日打卡">✓</button>
      <span class="hh-name">${esc(x.name)}${sk ? `<span class="hh-link">→ ${esc(sk.name)}</span>` : ""}</span>
      <span class="hh-streak">🔥${calcStreak(x.history)}</span>
    </div>`;
  }).join("");

  // 技能进度
  if (!skills.length) elSkills.innerHTML = `<div class="empty-hint">还没有技能</div>`;
  else elSkills.innerHTML = skills.map(k => `
    <div class="home-skill">
      <div class="hs-top"><span class="hs-name">${esc(k.name)}</span><span class="hs-pct">${k.progress || 0}%</span></div>
      <div class="hs-bar"><div class="hs-fill" style="width:${Math.min(100, k.progress || 0)}%"></div></div>
    </div>`).join("");

  // 最近倒计时
  const elCD = $("#homeCountdown");
  if (elCD) {
    const cds = [...(Store.data.countdowns || [])].sort((a, b) => daysLeft(a.date) - daysLeft(b.date));
    const cdHint = $("#homeCountHint");
    if (cdHint) cdHint.textContent = cds.length ? `共 ${cds.length} 个` : "";
    if (!cds.length) elCD.innerHTML = `<div class="empty-hint">还没有倒计时</div>`;
    else {
      const c = cds[0], left = daysLeft(c.date);
      elCD.innerHTML = `<div class="home-cd-item">
        <span class="hcd-name">${esc(c.name)}</span>
        <span class="hcd-date">${c.date.slice(5).replace("-", "/")}</span>
        <span class="hcd-left ${left < 0 ? "past" : ""}">${left >= 0 ? "还有 " + left + " 天" : "已过期"}</span>
      </div>` + (cds.length > 1 ? `<div class="home-cd-more">另有 ${cds.length - 1} 个 →</div>` : "");
    }
  }
}

/* 周课表：整周适配 / 原生全屏 */
function toggleWkFull() {
  const pane = $("#weekPane");
  if (!pane) return;
  const on = pane.classList.toggle("compact");
  const btn = $("#wkFull");
  if (btn) { btn.classList.toggle("on", on); btn.textContent = on ? "⤡ 退出" : "⤢ 整周"; }
  if (on) { if (pane.requestFullscreen) pane.requestFullscreen().catch(() => {}); }
  else { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
}

/* =========================================================
   记录 / 沉淀
   打通链路：说完（语音）→ 提炼（AI）→ 流水 → 自动汇总成复盘
   原则：AI 只输出结构化建议，写库永远要经过一次人工确认
   ========================================================= */
const LOG_TYPES = {
  win: { name: "成果", icon: "◆" },
  pit: { name: "踩坑", icon: "▲" },
  idea: { name: "想法", icon: "○" }
};
let logFilter = "all";
let logQuery = "";
let logMode = "stream";
let pendingLog = null;

function logTypeOf(t) { return LOG_TYPES[t] || LOG_TYPES.win; }

/* ---------- 语音识别（浏览器原生，免费，无需 Key） ---------- */
const Voice = {
  rec: null,
  active: false,
  buf: "",
  supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
  start(onUpdate, onEnd) {
    if (!this.supported()) {
      toast("这个浏览器不支持网页语音，用手机输入法的 🎤 键也一样");
      return false;
    }
    if (this.active) return false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let r;
    try { r = new SR(); } catch (e) { toast("麦克风启动失败"); return false; }
    r.lang = "zh-CN";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    this.buf = "";
    this.active = true;
    r.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) this.buf += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (onUpdate) onUpdate((this.buf + interim).trim());
    };
    r.onerror = e => {
      this.active = false;
      const map = {
        "not-allowed": "麦克风没授权，去浏览器地址栏左边允许一下",
        "service-not-allowed": "这个浏览器不支持网页语音，用输入法语音键",
        "audio-capture": "找不到麦克风",
        "network": "语音服务连不上（网页语音大多要联网）"
      };
      if (e.error !== "no-speech" && e.error !== "aborted") toast(map[e.error] || ("语音出错：" + e.error));
    };
    r.onend = () => {
      this.active = false;
      if (onEnd) onEnd(this.buf.trim());
    };
    try { r.start(); } catch (e) { this.active = false; return false; }
    this.rec = r;
    return true;
  },
  stop() {
    if (this.rec) { try { this.rec.stop(); } catch (e) {} }
    this.active = false;
  }
};

/* 按住说话：pointer 事件比 mousedown 在手机上更稳 */
function bindHold(el, onStart, onStop) {
  if (!el) return;
  let holding = false;
  const down = e => {
    if (e.preventDefault) e.preventDefault();
    if (holding) return;
    holding = true;
    el.classList.add("rec");
    onStart();
  };
  const up = () => {
    if (!holding) return;
    holding = false;
    el.classList.remove("rec");
    onStop();
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("pointerleave", up);
}

/* ---------- AI 调用（任何 OpenAI 兼容接口） ---------- */
const AI = {
  async chat(messages, opt) {
    if (!AICfg.ready) throw new Error("还没填 AI Key，去「设置 → AI 助手」填一个");
    let res;
    try {
      res = await fetch(AICfg.url(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + AICfg.key },
        body: JSON.stringify({
          model: AICfg.model,
          messages,
          temperature: (opt && opt.temperature != null) ? opt.temperature : 0.2,
          max_tokens: (opt && opt.maxTokens) || 400
        })
      });
    } catch (e) {
      throw new Error("连不上接口。多半是这个服务不允许浏览器直连，换「硅基流动」或自建代理试试");
    }
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { const j = JSON.parse(text); msg = (j.error && j.error.message) || j.message || text; } catch (e) {}
      throw new Error(res.status + " " + msg);
    }
    let j;
    try { j = JSON.parse(text); } catch (e) { throw new Error("接口返回的不是 JSON"); }
    const c = j.choices && j.choices[0];
    return (c && c.message && c.message.content) || "";
  }
};

function parseAIJson(s) {
  if (!s) return null;
  let t = String(s).trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch (e) { return null; }
}

/* 把一段口语提炼成 {type, text, detail, tags} */
async function aiPolish(raw) {
  const sys = [
    "你把用户随口说的口语整理成一条工作记录。用户是工科学生，说话可能啰嗦、带语气词、只说不写。",
    "语音识别常把技术词听错，你要按上下文纠正，例如「爱二塞」→ I2C、「S T M 三二」→ STM32、「哈儿库」→ HAL 库。",
    "只输出一个 JSON 对象，不要任何解释、不要代码块标记。格式：",
    '{"type":"win|pit|idea","text":"做了什么，25字内，客观陈述","detail":"原因或怎么解决的，40字内，没有就空字符串","tags":["1到3个名词标签"]}',
    "type 判断：完成了事/解决了问题=win；踩了坑并说清原因=pit；只是念头/计划=idea。",
    "tags 优先用项目名或技术名（如 AELOS、I2C、STM32、ROS、英语、考研）。"
  ].join("\n");
  const out = await AI.chat([
    { role: "system", content: sys },
    { role: "user", content: "现在时间：" + todayStr() + "。原话：" + raw }
  ], { maxTokens: 300 });
  const j = parseAIJson(out);
  if (!j) return null;
  const type = ["win", "pit", "idea"].indexOf(j.type) >= 0 ? j.type : "win";
  let tags = Array.isArray(j.tags) ? j.tags : [];
  tags = tags.filter(x => typeof x === "string" && x.trim()).slice(0, 4).map(x => x.replace(/^#/, "").trim());
  return {
    type,
    text: String(j.text || raw).slice(0, 60),
    detail: String(j.detail || "").slice(0, 120),
    tags
  };
}

/* 本地兜底：AI 没配或失败时，也不让用户白说 */
function localPolish(raw) {
  const s = String(raw || "").trim();
  let type = "win";
  if (/卡|报错|失败|不对|坑|搞不定|一直|找不到|问题是/.test(s)) type = "pit";
  else if (/想|要不要|也许|打算|以后|考虑/.test(s)) type = "idea";
  const tags = [];
  const pool = ["AELOS", "I2C", "STM32", "ESP32", "ROS", "OpenCV", "Python", "英语", "考研", "竞赛", "单片机"];
  pool.forEach(k => { if (s.toUpperCase().indexOf(k.toUpperCase()) >= 0) tags.push(k); });
  return { type, text: s.slice(0, 60), detail: "", tags: tags.slice(0, 3) };
}

/* ---------- 写库 ---------- */
function pushLog(obj) {
  if (!Array.isArray(Store.data.logs)) Store.data.logs = [];
  const item = {
    id: uid(),
    date: obj.date || todayStr(),
    ts: Date.now(),
    type: obj.type || "win",
    text: String(obj.text || "").trim(),
    detail: String(obj.detail || "").trim(),
    tags: Array.isArray(obj.tags) ? obj.tags.filter(Boolean).slice(0, 4) : [],
    link: obj.link || "",
    projectId: obj.projectId || ""
  };
  if (!item.text) return false;
  Store.data.logs.push(item);
  Store.save();
  renderLog(); renderReview();
  return true;
}

function deleteLog(id) {
  const it = (Store.data.logs || []).find(x => x.id === id);
  if (!it) return;
  Trash.add("log", it, it.text);
  Store.data.logs = (Store.data.logs || []).filter(x => x.id !== id);
  Store.save({ snapshot: true, label: "删除记录前" });
  renderLog(); renderReview();
  toast("已移入回收站，30 天内可恢复");
}

/* ---------- 流水渲染 ---------- */
function logDayLabel(k) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return "未标日期";
  const t = todayStr();
  if (k === t) return "今天";
  const d = new Date(t + "T00:00:00");
  d.setDate(d.getDate() - 1);
  if (k === dateStr(d)) return "昨天";
  return k.slice(5).replace("-", "/");
}

function logItemHTML(l) {
  const ty = logTypeOf(l.type);
  const tags = (l.tags || []).filter(Boolean);
  return `<div class="log-item ${ty.name === "成果" ? "win" : ty.name === "踩坑" ? "pit" : "idea"}" data-id="${l.id}">
    <span class="li-mark">${ty.icon}</span>
    <div class="li-body">
      <div class="li-text">${esc(l.text || "")}</div>
      ${l.detail ? `<div class="li-detail">${esc(l.detail)}</div>` : ""}
      <div class="li-meta">
        <span class="li-type">${ty.name}</span>
        ${tags.map(x => `<span class="li-tag">#${esc(x)}</span>`).join("")}
        ${l.link ? `<a class="li-link" href="${esc(l.link)}" target="_blank" rel="noopener">链接</a>` : ""}
      </div>
    </div>
    <button class="li-del" data-act="log-del" title="删除">✕</button>
  </div>`;
}

function renderLog() {
  const box = $("#logStream");
  const hint = $("#logHint");
  const all = Array.isArray(Store.data.logs) ? Store.data.logs : [];
  if (hint) hint.textContent = all.length ? `共 ${all.length} 条` : "";
  if (!box) return;

  if (!all.length) {
    box.innerHTML = `<div class="empty-hint">还没有记录。<br>在上面说一句，或者去完成一个待办——完成时它会问你一句。</div>`;
    return;
  }

  let arr = all.slice().sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || "")) || (b.ts || 0) - (a.ts || 0));
  if (logFilter !== "all") arr = arr.filter(l => l.type === logFilter);
  if (logQuery) {
    const q = logQuery.toLowerCase();
    arr = arr.filter(l =>
      String(l.text || "").toLowerCase().indexOf(q) >= 0 ||
      String(l.detail || "").toLowerCase().indexOf(q) >= 0 ||
      (l.tags || []).join(" ").toLowerCase().indexOf(q) >= 0
    );
  }
  if (!arr.length) { box.innerHTML = `<div class="empty-hint">没有符合条件的结果</div>`; return; }

  const groups = {};
  arr.forEach(l => { const k = l.date || "未知"; (groups[k] = groups[k] || []).push(l); });
  const keys = Object.keys(groups).sort((a, b) => String(b).localeCompare(String(a)));

  box.innerHTML = keys.map(k => `
    <div class="log-day">
      <div class="ld-head"><span class="ld-name">${esc(logDayLabel(k))}</span><span class="ld-count">${groups[k].length}</span></div>
      ${groups[k].map(logItemHTML).join("")}
    </div>`).join("");
}

/* ---------- 周复盘（不靠写，靠汇总） ---------- */
function weekKeyOf(d) {
  const dt = d || new Date();
  return dt.getFullYear() + "-W" + pad2(isoWeekNo(dt));
}

function renderReview() {
  const box = $("#reviewBox");
  if (!box) return;
  /* 正在写「这周一句话」时不重绘，免得打字被打断 */
  const editing = $("#rvNote");
  if (editing && document.activeElement === editing) return;
  const mon = mondayOf(new Date());
  const start = dateStr(mon);
  const today = todayStr();
  const logs = (Store.data.logs || []).filter(l => l.date && l.date >= start && l.date <= today);
  const wins = logs.filter(l => l.type === "win");
  const pits = logs.filter(l => l.type === "pit");
  const ideas = logs.filter(l => l.type === "idea");

  const tagCount = {};
  logs.forEach(l => (l.tags || []).forEach(t => { if (t) tagCount[t] = (tagCount[t] || 0) + 1; }));
  const tagKeys = Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a]).slice(0, 8);
  const maxTag = tagKeys.length ? tagCount[tagKeys[0]] : 1;

  const weekTodos = (Store.data.todos || []).filter(t => t.date && t.date >= start && t.date <= today);
  const todoDone = weekTodos.filter(t => t.done).length;

  let chkDone = 0, chkAll = 0;
  (Store.data.habits || []).forEach(h => {
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(d.getDate() + i);
      const k = dateStr(d);
      if (k > today) break;
      chkAll++;
      if (h.history && h.history[k]) chkDone++;
    }
  });

  const wno = currentWeekNo();
  const wk = weekKeyOf();
  const note = (Store.data.reviews || {})[wk] || "";

  box.innerHTML = `
    <div class="rv-head">
      <div>
        <div class="rv-title">第 ${wno == null ? "?" : wno} 周 · 本周复盘</div>
        <div class="rv-range">${start.slice(5).replace("-", "/")} — ${today.slice(5).replace("-", "/")}</div>
      </div>
      <button class="btn ghost rv-share" id="rvCopy">复制成文字</button>
    </div>

    <div class="rv-nums">
      <div class="rv-num"><span class="rv-v">${logs.length}</span><span class="rv-k">记录</span></div>
      <div class="rv-num"><span class="rv-v win">${wins.length}</span><span class="rv-k">成果</span></div>
      <div class="rv-num"><span class="rv-v pit">${pits.length}</span><span class="rv-k">踩坑</span></div>
      <div class="rv-num"><span class="rv-v idea">${ideas.length}</span><span class="rv-k">想法</span></div>
    </div>

    <div class="rv-sec">
      <div class="rv-sec-t">时间花在哪</div>
      ${tagKeys.length ? tagKeys.map(t => `
        <div class="rv-tag-row">
          <span class="rv-tag-name">${esc(t)}</span>
          <span class="rv-bar"><i style="width:${Math.max(6, Math.round(tagCount[t] / maxTag * 100))}%"></i></span>
          <span class="rv-tag-n">${tagCount[t]}</span>
        </div>`).join("") : `<div class="empty-hint sm">这周还没有打标签的记录</div>`}
    </div>

    <div class="rv-sec">
      <div class="rv-sec-t">本周产出</div>
      ${wins.length ? `<ul class="rv-list win">${wins.map(l => `<li>${esc(l.text)}${l.detail ? `<span class="rv-li-sub">${esc(l.detail)}</span>` : ""}</li>`).join("")}</ul>`
        : `<div class="empty-hint sm">这周还没记成果。完成待办时顺手记一条，三个月后就是简历。</div>`}
    </div>

    <div class="rv-sec">
      <div class="rv-sec-t">踩过的坑</div>
      ${pits.length ? `<ul class="rv-list pit">${pits.map(l => `<li>${esc(l.text)}${l.detail ? `<span class="rv-li-sub">${esc(l.detail)}</span>` : ""}</li>`).join("")}</ul>`
        : `<div class="empty-hint sm">这周没记踩坑</div>`}
    </div>

    <div class="rv-sec">
      <div class="rv-sec-t">执行情况</div>
      <div class="rv-line"><span>待办</span><span>${todoDone}/${weekTodos.length}</span></div>
      <div class="rv-line"><span>打卡</span><span>${chkDone}/${chkAll}</span></div>
    </div>

    <div class="rv-note">
      <label for="rvNote">这周一句话（只写这一句就够）</label>
      <textarea id="rvNote" class="input" rows="2" placeholder="最大的收获，或者最大的问题">${esc(note)}</textarea>
      <button class="btn primary" id="rvSave" type="button">保存</button>
    </div>`;
}

function saveReviewNote() {
  const ta = $("#rvNote");
  if (!ta) return;
  Store.data.reviews = Store.data.reviews || {};
  Store.data.reviews[weekKeyOf()] = ta.value.trim();
  Store.save();
  toast("这周的一句话已存下");
}

/* 复盘一键复制成纯文本（方便发给别人或贴进文档） */
function copyReviewText() {
  const mon = mondayOf(new Date());
  const start = dateStr(mon);
  const today = todayStr();
  const logs = (Store.data.logs || []).filter(l => l.date && l.date >= start && l.date <= today);
  const wno = currentWeekNo();
  const ta = $("#rvNote");
  const lines = [];
  lines.push(`第 ${wno == null ? "?" : wno} 周复盘（${start.slice(5)} — ${today.slice(5)}）`);
  lines.push(`记录 ${logs.length} 条：成果 ${logs.filter(l => l.type === "win").length} · 踩坑 ${logs.filter(l => l.type === "pit").length}`);
  const wins = logs.filter(l => l.type === "win");
  if (wins.length) {
    lines.push("");
    lines.push("产出：");
    wins.forEach(l => lines.push("· " + l.text + (l.detail ? "（" + l.detail + "）" : "")));
  }
  const pits = logs.filter(l => l.type === "pit");
  if (pits.length) {
    lines.push("");
    lines.push("踩坑：");
    pits.forEach(l => lines.push("· " + l.text + (l.detail ? "（" + l.detail + "）" : "")));
  }
  if (ta && ta.value.trim()) { lines.push(""); lines.push("一句话：" + ta.value.trim()); }
  const txt = lines.join("\n");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => toast("已复制，可以直接粘出去"), () => toast("复制失败，手动选一下吧"));
  } else {
    toast("这个浏览器不支持一键复制");
  }
}

/* ---------- 记录页：说一句 → 提炼 → 确认 ---------- */
function showLogLive(text) {
  const live = $("#lcLive");
  if (!live) return;
  if (!text) { live.classList.add("hidden"); live.textContent = ""; return; }
  live.classList.remove("hidden");
  live.innerHTML = `<span class="lv-dot"></span>${esc(text)}`;
}

function showLogPreview(p, raw) {
  const box = $("#lcPreview");
  if (!box) return;
  pendingLog = Object.assign({}, p, { _raw: raw });
  const ty = logTypeOf(p.type);
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="lp-card">
      <div class="lp-head">
        <span class="lp-badge">帮我整理好了</span>
        <span class="lp-src">${AICfg.ready ? "AI" : "本地"}</span>
      </div>
      <div class="lp-types">
        <button class="lp-type ${p.type === "win" ? "on" : ""}" data-t="win" type="button">成果</button>
        <button class="lp-type ${p.type === "pit" ? "on" : ""}" data-t="pit" type="button">踩坑</button>
        <button class="lp-type ${p.type === "idea" ? "on" : ""}" data-t="idea" type="button">想法</button>
      </div>
      <input class="input lp-text" id="lpText" value="${esc(p.text || "")}" placeholder="做了什么" />
      <input class="input lp-detail" id="lpDetail" value="${esc(p.detail || "")}" placeholder="原因 / 怎么解的（可空）" />
      <input class="input lp-tags" id="lpTags" value="${(p.tags || []).map(t => "#" + t).join(" ")}" placeholder="标签，空格分开" />
      <div class="lp-actions">
        <button class="btn ghost" id="lpCancel" type="button">不用了</button>
        <button class="btn ghost" id="lpRaw" type="button">看原话</button>
        <button class="btn primary" id="lpSave" type="button">存下</button>
      </div>
      <div class="lp-raw hidden" id="lpRawBox">${esc(raw || "")}</div>
    </div>`;

  box.querySelectorAll(".lp-type").forEach(b => b.addEventListener("click", () => {
    if (!pendingLog) return;
    pendingLog.type = b.dataset.t;
    box.querySelectorAll(".lp-type").forEach(x => x.classList.toggle("on", x === b));
  }));
  const rawBtn = $("#lpRaw", box);
  if (rawBtn) rawBtn.addEventListener("click", () => {
    const rb = $("#lpRawBox", box);
    if (rb) rb.classList.toggle("hidden");
  });
  const cancelBtn = $("#lpCancel", box);
  if (cancelBtn) cancelBtn.addEventListener("click", () => {
    box.classList.add("hidden");
    box.innerHTML = "";
    pendingLog = null;
  });
  const saveBtn = $("#lpSave", box);
  if (saveBtn) saveBtn.addEventListener("click", () => {
    if (!pendingLog) return;
    const ok = pushLog({
      type: pendingLog.type,
      text: $("#lpText", box).value.trim(),
      detail: $("#lpDetail", box).value.trim(),
      tags: $("#lpTags", box).value.split(/\s+/).map(s => s.replace(/^#/, "").trim()).filter(Boolean)
    });
    if (ok) toast("已记下");
    box.classList.add("hidden");
    box.innerHTML = "";
    pendingLog = null;
  });
}

async function handleSpoken(text) {
  const raw = String(text || "").trim();
  const tip = $("#logTip");
  showLogLive("");
  if (tip) tip.textContent = "说完不用整理，会帮你提炼成「做了什么 · 为什么 · 标签」";
  if (!raw) return;
  let p = null;
  if (AICfg.polish && AICfg.ready) {
    if (tip) tip.textContent = "正在整理…";
    try { p = await aiPolish(raw); } catch (e) {
      if (tip) tip.textContent = "整理失败：" + e.message + "（先按原话记下了）";
      p = localPolish(raw);
    }
  } else {
    p = localPolish(raw);
    if (tip) tip.textContent = AICfg.polish ? "没填 Key，先按原话记；去设置里填一个就能自动提炼" : "已关掉自动提炼，按原话记";
  }
  if (tip) tip.textContent = "说完不用整理，会帮你提炼成「做了什么 · 为什么 · 标签」";
  showLogPreview(p || localPolish(raw), raw);
}

function addLogFromInput() {
  const el = $("#logText");
  if (!el) return;
  const raw = el.value.trim();
  if (!raw) { el.focus(); return; }
  el.value = "";
  handleSpoken(raw);
}

/* ---------- 完成待办后的「记一笔」 ---------- */
let quickLogType = "win";
let quickLogTodo = "";

function showQuickLog(todoText) {
  const box = $("#quickLog");
  if (!box) return;
  quickLogTodo = todoText || "";
  const sub = $("#qlSub");
  if (sub) sub.textContent = todoText ? "「" + todoText + "」" : "";
  const inp = $("#qlText");
  if (inp) inp.value = "";
  Array.prototype.forEach.call(box.querySelectorAll(".ql-type"), x =>
    x.classList.toggle("on", x.dataset.type === quickLogType));
  box.classList.remove("hidden");
  setTimeout(() => { if (inp) inp.focus(); }, 60);
}

function hideQuickLog() {
  const box = $("#quickLog");
  if (box) box.classList.add("hidden");
}

function saveQuickLog() {
  const inp = $("#qlText");
  const text = inp ? inp.value.trim() : "";
  if (!text) { hideQuickLog(); return; }
  pushLog({ type: quickLogType, text, detail: "" });
  hideQuickLog();
  toast("已记下，周末复盘会自己汇总");
}

/* =========================================================
   视图切换 & 初始化
   ========================================================= */
/* 切换「流水 / 复盘」两个子页 */
function setLogMode(mode) {
  logMode = mode === "review" ? "review" : "stream";
  const seg = $("#logSeg");
  if (seg) $$(".seg-btn", seg).forEach(x => x.classList.toggle("active", x.dataset.mode === logMode));
  const paneS = $("#logPane"), paneR = $("#reviewPane");
  if (paneS) paneS.classList.toggle("hidden", logMode !== "stream");
  if (paneR) paneR.classList.toggle("hidden", logMode !== "review");
  if (logMode === "review") renderReview(); else renderLog();
}

function switchView(view) {
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));

  // 入场动画：enter 只在切换瞬间挂上，700ms 后摘掉。
  // 不能常驻，否则列表重渲染（勾一个待办）会让整列重新播放动画。
  const cur = document.getElementById("view-" + view);
  if (cur) {
    cur.classList.remove("enter");
    void cur.offsetWidth;                 // 强制重排，保证连续切换也能重启动画
    cur.classList.add("enter");
    clearTimeout(cur._enterT);
    cur._enterT = setTimeout(() => cur.classList.remove("enter"), 700);
  }

  if (view === "home") {
    renderHome();
  } else if (view === "timeline") {
    renderNextCard();
    if (tlMode === "week") renderWeek();
    else renderTimeline(true);
  } else if (view === "todo") {
    renderTodo();
  } else if (view === "log") {
    if (logMode === "review") renderReview(); else renderLog();
  } else if (view === "countdown") {
    renderCountdown();
  }
}

function renderAll(scrollToNow = true) {
  renderTopbar();
  renderHome();
  renderTimeline(scrollToNow);
  if (tlMode === "week") renderWeek();
  renderNextCard();
  renderTodo();
  renderSkills();
  renderCheckin();
  renderCountdown();
  renderLog();
  if (logMode === "review") renderReview();
  updateSyncBadge();
}

/* =========================================================
   PWA + 本地提醒
   - Service Worker 注册 / 安装引导 / 离线提示 / 版本更新
   - 待办到点通知 + 每日晨间重点（下节课 / 重点待办 / 临近倒计时）
   ========================================================= */
const Notify = {
  KEY_ON: "wb_notify_on",
  KEY_MORNING: "wb_notify_morning",
  KEY_LAST_MORNING: "wb_notify_last_morning",
  KEY_TODO: "wb_notif_todo_",
  KEY_DISMISS: "wb_install_dismissed",
  get on() { return localStorage.getItem(this.KEY_ON) === "1"; },
  set on(v) { localStorage.setItem(this.KEY_ON, v ? "1" : "0"); },
  get morning() { return localStorage.getItem(this.KEY_MORNING) || "08:00"; },
  set morning(v) { localStorage.setItem(this.KEY_MORNING, v || "08:00"); },
  get permitted() { return ("Notification" in window) && Notification.permission === "granted"; },
  lastMorning() { return localStorage.getItem(this.KEY_LAST_MORNING) || ""; },
  markMorning() { localStorage.setItem(this.KEY_LAST_MORNING, todayStr()); }
};

function requestNotifyPermission(msgEl) {
  if (!("Notification" in window)) {
    if (msgEl) { msgEl.textContent = "当前浏览器不支持系统通知"; msgEl.className = "sync-msg err"; }
    return;
  }
  if (Notification.permission === "granted") {
    if (msgEl) { msgEl.textContent = "已授权，提醒已开启"; msgEl.className = "sync-msg ok"; }
    return;
  }
  try {
    Notification.requestPermission().then(p => {
      if (p === "granted") {
        if (msgEl) { msgEl.textContent = "已授权，提醒已开启"; msgEl.className = "sync-msg ok"; }
        checkNotify();
      } else {
        Notify.on = false;
        const nb = $("#notifyOn"); if (nb) nb.checked = false;
        const nm = $("#notifyMorning"); if (nm) nm.disabled = true;
        if (msgEl) { msgEl.textContent = "未授权，提醒不会弹出（可在浏览器设置里开启）"; msgEl.className = "sync-msg err"; }
      }
    }).catch(() => {});
  } catch (e) {
    /* 老版本回调式 API 兜底 */
    Notification.requestPermission(() => {});
  }
}

/* 统一通知入口：优先用 SW（可点击回到应用），失败回退到页面内 Notification */
async function notify(title, body, tag) {
  if (!Notify.permitted) return;
  const opts = {
    body,
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: tag || undefined,
    renotify: !!tag
  };
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
      return;
    }
  } catch (e) { /* 落到下方兜底 */ }
  try { new Notification(title, opts); } catch (e) { /* 彻底不支持就静默 */ }
}

/* 待办到点提醒（每 30s 检查一次，当天只提醒一遍） */
function checkTodoReminders() {
  if (!Notify.on || !Notify.permitted) return;
  const today = todayStr();
  const now = nowMinutes();
  (Store.data.todos || []).forEach(t => {
    if (t.done || t.date !== today || !t.time) return;
    const tm = hhmmToMin(t.time);
    if (tm <= 0) return;
    if (Math.abs(now - tm) <= 1) {
      const key = Notify.KEY_TODO + t.id + "_" + today;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
      notify("⏰ 待办提醒", (t.text || "有一项待办") + "（" + t.time + "）", "todo-" + t.id);
    }
  });
}

/* 每日晨间重点：仅当天首次、且过了设定时间后发送 */
function morningDigest() {
  if (!Notify.on || !Notify.permitted) return;
  const today = todayStr();
  if (Notify.lastMorning() === today) return;
  if (nowMinutes() < hhmmToMin(Notify.morning)) return;
  Notify.markMorning();

  const day = todayWeekday();
  const now = nowMinutes();
  const next = (Store.data.courses || [])
    .filter(c => c.day === day && hhmmToMin(c.start) >= now)
    .sort((a, b) => hhmmToMin(a.start) - hhmmToMin(b.start))[0];
  const top = (Store.data.todos || [])
    .filter(t => t.date === today && !t.done)
    .sort((a, b) => (a.quad || 9) - (b.quad || 9))[0];
  const cd = (Store.data.countdowns || [])
    .map(c => ({ c, d: daysLeft(c.date) }))
    .filter(x => x.d >= 0 && [7, 3, 1, 0].includes(x.d))
    .sort((a, b) => a.d - b.d)[0];

  const lines = [];
  if (next) lines.push("下节课：" + next.name + " " + next.start + (next.room ? (" @" + next.room) : ""));
  if (top) lines.push("重点待办：" + top.text);
  if (cd) lines.push("📅 " + cd.c.name + " 还有 " + cd.d + " 天");
  if (!lines.length) lines.push("今天没有安排，好好休息或提前准备～");
  notify("🌅 今日重点", lines.join("\n"), "morning-" + today);
}

function checkNotify() {
  checkTodoReminders();
  morningDigest();
}

/* ---------------- PWA 安装引导 / SW / 离线 / 更新 ---------------- */
let deferredPrompt = null;
let swReg = null;

function isStandalone() {
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
         window.navigator.standalone === true;
}

function showInstallBar(ios) {
  const bar = $("#installBar");
  if (!bar || isStandalone()) return;
  if (localStorage.getItem(Notify.KEY_DISMISS) === "1") return;
  const sub = $("#installSub");
  if (sub) sub.textContent = ios
    ? "iPhone：点 Safari 底部「分享」→「添加到主屏幕」"
    : "像 App 一样随时打开，离线也能用";
  bar.classList.remove("hidden");
}
function hideInstallBar() {
  const b = $("#installBar");
  if (b) b.classList.add("hidden");
}

function showUpdateToast() {
  const t = $("#updateToast");
  if (!t) return;
  t.classList.remove("hidden");
  const btn = $("#updateBtn"), x = $("#updateClose");
  if (btn) btn.onclick = () => {
    if (swReg && swReg.waiting) swReg.waiting.postMessage("SKIP_WAITING");
    else location.reload();
  };
  if (x) x.onclick = () => t.classList.add("hidden");
}

function setupPWA() {
  /* 1) Service Worker */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(reg => {
      swReg = reg;
      try { if (reg.update) reg.update(); } catch (e) {}
      setInterval(() => { try { if (swReg && swReg.update) swReg.update(); } catch (e) {} }, 60000);
      if (reg.waiting) showUpdateToast();
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (installing) installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) showUpdateToast();
        });
      });
    }).catch(() => {});

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }

  /* 2) 安装引导（Android / 桌面 Chrome） */
  const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) && !window.MSStream;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBar(false);
  });
  window.addEventListener("appinstalled", () => {
    hideInstallBar();
    localStorage.setItem(Notify.KEY_DISMISS, "1");
  });
  const ib = $("#installBtn"), ic = $("#installClose");
  if (ib) ib.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (e) {}
      deferredPrompt = null;
    }
    hideInstallBar();
    localStorage.setItem(Notify.KEY_DISMISS, "1");
  });
  if (ic) ic.addEventListener("click", () => {
    hideInstallBar();
    localStorage.setItem(Notify.KEY_DISMISS, "1");
  });
  /* iOS 没有 beforeinstallprompt，用引导式提示 */
  if (isIOS && !isStandalone()) setTimeout(() => showInstallBar(true), 2500);

  /* 3) 离线 / 在线提示 */
  const off = $("#offlineToast");
  function updateOnline() {
    if (!off) return;
    if (navigator.onLine) off.classList.add("hidden");
    else off.classList.remove("hidden");
  }
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
  updateOnline();
}

function init() {
  Store.load();

  /* ?skin=图片地址 可直接预览照片皮肤 */
  const skinParam = new URLSearchParams(location.search).get("skin");
  if (skinParam) {
    Theme.set("photo");
    Theme.setImage(skinParam);
  }
  Theme.apply();

  /* 跟随系统：系统亮/暗切换时实时更新 */
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => { if (Theme.stored === "auto") Theme.apply(); };
    if (mq.addEventListener) mq.addEventListener("change", onScheme);
    else if (mq.addListener) mq.addListener(onScheme);
  }

  renderAll(true);

  /* 首屏入场：初始视图不经过 switchView，这里补一次 enter */
  const firstView = $(".view.active");
  if (firstView) {
    firstView.classList.add("enter");
    setTimeout(() => firstView.classList.remove("enter"), 700);
  }

  /* 支持 ?view=skills 之类直接打开某视图 */
  const v = new URLSearchParams(location.search).get("view");
  if (v && document.getElementById("view-" + v)) switchView(v);
  /* 直达记录页的复盘：?view=log&tab=review */
  if (v === "log" && new URLSearchParams(location.search).get("tab") === "review") setLogMode("review");

  /* 导航 */
  $$(".nav-item").forEach(btn =>
    btn.addEventListener("click", () => switchView(btn.dataset.view))
  );

  /* 今日 / 本周 切换 */
  bindWeekUI();

  /* 窗口尺寸变化时重排（泳道宽度按比例算，需要重绘） */
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (tlMode === "week") renderWeek();
      else renderTimeline(false);
    }, 160);
  });

  /* 待办 */
  $("#todoAdd").addEventListener("click", addTodo);
  $("#todoText").addEventListener("keydown", e => { if (e.key === "Enter") addTodo(); });
  const todoMore = $("#todoMore");
  if (todoMore) todoMore.addEventListener("click", () => {
    const adv = $("#todoAdv");
    if (!adv) return;
    adv.classList.toggle("hidden");
    const open = !adv.classList.contains("hidden");
    todoMore.classList.toggle("on", open);
    if (open) {
      const dEl = $("#todoDate");
      if (dEl && !dEl.value) dEl.value = todayStr();
      const t = $("#todoText");
      if (t) t.focus();
    }
  });
  const todoDateEl = $("#todoDate");
  if (todoDateEl) todoDateEl.value = todayStr();
  function bindTodoClicks(rootSel, itemSel) {
    const root = $(rootSel);
    if (!root) return;
    root.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const item = btn.closest(itemSel);
      if (!item) return;
      const id = item.dataset.id;
      if (btn.dataset.act === "toggle") toggleTodo(id);
      if (btn.dataset.act === "del") deleteTodo(id);
    });
  }
  bindTodoClicks("#todoList", ".todo-item");
  bindTodoClicks("#todoQuadView", ".quad-item");
  const todoSeg = $("#todoSeg");
  if (todoSeg) todoSeg.addEventListener("click", e => {
    const b = e.target.closest(".seg-btn");
    if (!b) return;
    todoMode = b.dataset.mode;
    $$(".seg-btn", todoSeg).forEach(x => x.classList.toggle("active", x === b));
    renderTodo();
  });

  /* 倒计时 */
  $("#cdAdd").addEventListener("click", addCountdown);
  $("#cdName").addEventListener("keydown", e => { if (e.key === "Enter") addCountdown(); });
  const countdownList = $("#countdownList");
  if (countdownList) countdownList.addEventListener("click", e => {
    const btn = e.target.closest("[data-act='cd-del']");
    if (!btn) return;
    const id = btn.closest(".cd-card").dataset.id;
    deleteCountdown(id);
  });

  /* 打卡 */
  $("#habitAdd").addEventListener("click", addHabit);
  $("#habitText").addEventListener("keydown", e => { if (e.key === "Enter") addHabit(); });
  $("#habitList").addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const item = btn.closest(".habit-item");
    if (!item) return;
    const id = item.dataset.id;
    const act = btn.dataset.act;
    if (act === "toggle") toggleHabit(id);
    else if (act === "del") deleteHabit(id);
    else if (act === "edit") editHabit(id);
    else if (act === "day") toggleHabitDate(id, btn.dataset.date);
  });

  /* 记录页：输入 / 语音 / 筛选 / 复盘 */
  const logAddBtn = $("#logAdd");
  if (logAddBtn) logAddBtn.addEventListener("click", addLogFromInput);
  const logTextEl = $("#logText");
  if (logTextEl) logTextEl.addEventListener("keydown", e => { if (e.key === "Enter") addLogFromInput(); });

  bindHold($("#logVoice"), () => {
    const tip = $("#logTip");
    if (Voice.start(t => showLogLive(t), t => handleSpoken(t))) {
      if (tip) tip.textContent = "在听… 松开就结束";
    }
  }, () => { Voice.stop(); });

  const logSegEl = $("#logSeg");
  if (logSegEl) logSegEl.addEventListener("click", e => {
    const b = e.target.closest(".seg-btn");
    if (!b) return;
    setLogMode(b.dataset.mode);
  });

  const logFilterEl = $("#logFilter");
  if (logFilterEl) logFilterEl.addEventListener("click", e => {
    const b = e.target.closest(".lf-btn");
    if (!b) return;
    logFilter = b.dataset.ltype;
    $$(".lf-btn", logFilterEl).forEach(x => x.classList.toggle("active", x === b));
    renderLog();
  });
  const logSearchEl = $("#logSearch");
  if (logSearchEl) logSearchEl.addEventListener("input", () => {
    logQuery = logSearchEl.value.trim();
    renderLog();
  });

  const logStreamEl = $("#logStream");
  if (logStreamEl) logStreamEl.addEventListener("click", e => {
    const del = e.target.closest("[data-act='log-del']");
    if (!del) return;
    const item = del.closest(".log-item");
    if (!item) return;
    if (confirm("删掉这条记录？")) deleteLog(item.dataset.id);
  });

  const reviewBoxEl = $("#reviewBox");
  if (reviewBoxEl) reviewBoxEl.addEventListener("click", e => {
    if (e.target.closest("#rvSave")) saveReviewNote();
    else if (e.target.closest("#rvCopy")) copyReviewText();
  });

  /* 完成待办后的「记一笔」浮层 */
  const qlSave = $("#qlSave");
  if (qlSave) qlSave.addEventListener("click", saveQuickLog);
  const qlClose = $("#qlClose");
  if (qlClose) qlClose.addEventListener("click", hideQuickLog);
  const qlTextEl = $("#qlText");
  if (qlTextEl) qlTextEl.addEventListener("keydown", e => { if (e.key === "Enter") saveQuickLog(); });
  const qlTypeBtns = Array.prototype.slice.call(document.querySelectorAll(".ql-type"));
  qlTypeBtns.forEach(b => b.addEventListener("click", () => {
    quickLogType = b.dataset.type;
    qlTypeBtns.forEach(x => x.classList.toggle("on", x === b));
  }));
  bindHold($("#qlVoice"), () => {
    Voice.start(t => { if (qlTextEl) qlTextEl.value = t; }, t => { if (qlTextEl) qlTextEl.value = t; });
  }, () => { Voice.stop(); });

  /* 技能 / 导入 / 设置 / 皮肤 */
  $("#skillAdd").addEventListener("click", openAddSkill);
  $("#importBtn").addEventListener("click", openImportModal);
  $("#settingsBtn").addEventListener("click", openSettings);
  $("#themeBtn").addEventListener("click", openThemeModal);

  /* 首页：今日打卡快捷切换 */
  $("#homeHabits").addEventListener("click", e => {
    const btn = e.target.closest("[data-act='home-toggle']");
    if (!btn) return;
    const id = btn.closest(".home-habit").dataset.id;
    toggleHabit(id);
    renderHome();
  });

  /* 首页：一键聚合条 */
  const quickBar = $("#homeQuick");
  if (quickBar) quickBar.addEventListener("click", e => {
    const btn = e.target.closest("[data-qk]");
    if (!btn) return;
    const k = btn.dataset.qk;
    if (k === "checkin") oneTapCheckin();
    else if (k === "todo") switchView("todo");
    else if (k === "train") {
      const wt = getWeeklyTheme();
      if (wt.skill) trainSkill(wt.skill.id);
      else switchView("skills");
    }
  });

  /* 首页：点待办即可完成 */
  const homeTodoEl = $("#homeTodo");
  if (homeTodoEl) homeTodoEl.addEventListener("click", e => {
    const row = e.target.closest(".home-todo-item");
    if (!row) return;
    if (row.dataset.id) toggleTodo(row.dataset.id);
  });

  /* 时间线：点空白处建待办 / 打开显示设置 */
  const tlCanvas = $("#tlCanvas");
  if (tlCanvas) tlCanvas.addEventListener("click", e => {
    if (e.target.closest(".tl-block")) return;
    const rect = tlCanvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let min = TL_START + (y / PX_PER_HOUR) * 60;
    min = Math.round(min / 5) * 5;
    if (min < TL_START || min > TL_END) return;
    openQuickTodoModal(minToHHMM(min));
  });
  const tlSetBtn = $("#tlSetting");
  if (tlSetBtn) tlSetBtn.addEventListener("click", openTimelineSettings);

  /* 周课表：整周适配 / 全屏 */
  const fullBtn = $("#wkFull");
  if (fullBtn) fullBtn.addEventListener("click", toggleWkFull);
  document.addEventListener("fullscreenchange", () => {
    const pane = $("#weekPane");
    if (!document.fullscreenElement && pane && pane.classList.contains("compact")) {
      pane.classList.remove("compact");
      const b = $("#wkFull");
      if (b) { b.classList.remove("on"); b.textContent = "⤢ 整周"; }
    }
  });

  /* 弹窗关闭 */
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  /* 每 30 秒刷新时间线（不打断滚动）与顶栏，并检查本地提醒 */
  setInterval(() => {
    if (tlMode === "week") renderWeek();
    else renderTimeline(false);
    renderNextCard();
    renderTopbar();
    checkNotify();
  }, 30000);

  /* 自动同步拉取：启动时拉一次 + 每 20 秒轮询 + 切回前台立即拉 */
  setTimeout(autoPull, 1200);
  setInterval(autoPull, 20000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) autoPull();
  });

  /* 快捷入口：?open=settings / ?open=import / ?open=theme */
  const openParam = new URLSearchParams(location.search).get("open");
  if (openParam === "settings") setTimeout(openSettings, 300);
  if (openParam === "import") setTimeout(openImportModal, 300);
  if (openParam === "theme") setTimeout(openThemeModal, 300);

  /* PWA：注册 Service Worker、安装引导、离线/更新提示 */
  setupPWA();
  /* 启动即检查一次本地提醒（晨间重点 / 已过点的待办） */
  checkNotify();
}

document.addEventListener("DOMContentLoaded", init);
