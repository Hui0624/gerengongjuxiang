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

/* ---------- 时间线常量 ---------- */
const TL_START = 6 * 60;    // 06:00
const TL_END = 24 * 60;     // 24:00
const PX_PER_HOUR = 60;

function minToTop(min) { return ((min - TL_START) / 60) * PX_PER_HOUR; }

/* =========================================================
   皮肤 / 主题
   ========================================================= */
const Theme = {
  KEY: "wb_theme",
  IMG: "wb_skin_image",
  DIM: "wb_skin_dim",
  BLUR: "wb_skin_blur",

  get current() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  },

  /* 应用皮肤（照片皮肤需要把图片/遮罩写进 CSS 变量） */
  apply() {
    const el = document.documentElement;
    const t = this.current;
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
    /* 先落到元素上，apply 里读到的才是新值 */
    document.documentElement.setAttribute("data-theme", name);
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
  const cur = Theme.current;
  const cards = [
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
  const canvas = $("#tlCanvas");
  const scroll = $("#tlScroll");
  const keep = scroll ? scroll.scrollTop : 0;

  const day = todayWeekday();
  const nm = nowMinutes();
  const wk = todayWeekNo();
  const courses = Store.data.courses.filter(c => c.day === day && inWeek(c, wk));
  const todos = Store.data.todos.filter(t => t.date === todayStr() && t.time);

  let html = "";

  // 小时格与半点虚线
  for (let h = 6; h <= 24; h++) {
    const top = (h - 6) * PX_PER_HOUR;
    html += `<div class="tl-hour" style="top:${top}px"><span class="tl-hour-label">${pad2(h)}:00</span></div>`;
    if (h < 24) html += `<div class="tl-half" style="top:${top + 30}px"></div>`;
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

  // 待办块：时间挨得太近时往下错开，避免互相盖住
  let prevTop = -999;
  todos
    .slice()
    .sort((a, b) => hhmmToMin(a.time) - hhmmToMin(b.time))
    .forEach(t => {
      let top = Math.max(0, minToTop(hhmmToMin(t.time)));
      if (top < prevTop + 46) top = prevTop + 46;
      prevTop = top;
      html += `<div class="tl-block todo ${t.done ? "done" : ""}" style="top:${top}px;height:42px" data-todo="${t.id}">
        <div class="tb-name">${t.done ? "✔ " : "○ "}${esc(t.text)}</div>
        <div class="tb-meta">${t.time}</div>
      </div>`;
    });

  // 当前时刻线
  if (nm >= TL_START && nm <= TL_END) {
    html += `<div class="now-line" style="top:${minToTop(nm)}px"><span class="now-tag">现在 ${minToHHMM(nm)}</span></div>`;
  }

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
   待办
   ========================================================= */
function renderTodo() {
  const list = $("#todoList");
  const arr = [...Store.data.todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const at = a.time ? hhmmToMin(a.time) : 9999;
    const bt = b.time ? hhmmToMin(b.time) : 9999;
    return at - bt;
  });

  if (!arr.length) {
    list.innerHTML = `<div class="empty-hint">还没有待办，在上面加一条吧</div>`;
    return;
  }

  list.innerHTML = arr.map(t => `
    <div class="todo-item ${t.done ? "done" : ""}" data-id="${t.id}">
      <button class="check" data-act="toggle" title="标记完成">✓</button>
      <div class="ti-body">
        <div class="ti-text">${esc(t.text)}</div>
        ${t.time ? `<div class="ti-time">⏰ ${t.time}</div>` : ""}
      </div>
      <button class="ti-del" data-act="del" title="删除">✕</button>
    </div>`).join("");
}

function addTodo() {
  const text = $("#todoText").value.trim();
  if (!text) return;
  Store.data.todos.push({
    id: uid(), text,
    time: $("#todoTime").value || "",
    date: todayStr(), done: false
  });
  Store.save();
  $("#todoText").value = "";
  $("#todoTime").value = "";
  renderTodo(); renderTimeline(); renderNextCard();
}

function toggleTodo(id) {
  const t = Store.data.todos.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  Store.save();
  renderTodo(); renderTimeline(); renderNextCard();
}

function deleteTodo(id) {
  Store.data.todos = Store.data.todos.filter(x => x.id !== id);
  Store.save();
  renderTodo(); renderTimeline(); renderNextCard();
}

/* =========================================================
   技能
   ========================================================= */
function renderSkills() {
  const grid = $("#skillGrid");
  const skills = Store.data.skills;

  grid.innerHTML = skills.map(s => `
    <div class="skill-card" data-id="${s.id}">
      <div class="sc-head">
        <span class="sc-icon">${esc(s.icon || "⭐")}</span>
        <span class="sc-name" data-act="rename" title="点击重命名">${esc(s.name)}</span>
        <span class="sc-pct">${s.progress}%</span>
        <button class="icon-btn" data-act="del" title="删除技能">✕</button>
      </div>

      <div class="progress" data-act="progress" title="拖动或点击设定进度">
        <div class="fill" style="width:${s.progress}%"></div>
      </div>

      <div class="method-label">训练方法</div>
      <textarea class="method" data-act="method" placeholder="写下你的训练方法…">${esc(s.method || "")}</textarea>

      <div class="sc-links">
        <a class="link-btn bili" href="${esc((s.links && s.links.bili) || "#")}" target="_blank" rel="noopener">▶ B站</a>
        <a class="link-btn dy" href="${esc((s.links && s.links.dy) || "#")}" target="_blank" rel="noopener">▶ 抖音</a>
        <button class="link-btn set" data-act="link">✎ 链接</button>
      </div>
    </div>`).join("");

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

    /* 按钮：重命名 / 删除 / 链接 */
    card.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "rename") {
        const name = prompt("技能名称", skill.name);
        if (name && name.trim()) {
          skill.name = name.trim();
          Store.save(); renderSkills();
        }
      } else if (act === "del") {
        if (confirm(`删除技能「${skill.name}」？`)) {
          Store.data.skills = Store.data.skills.filter(x => x.id !== skill.id);
          Store.save(); renderSkills();
        }
      } else if (act === "link") {
        openLinkModal(skill.id);
      }
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
  else h.history[today] = true;
  Store.save();
  renderCheckin();
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
  if (!confirm(`删除习惯「${h.name}」？历史记录会一起删除。`)) return;
  Store.data.habits = Store.data.habits.filter(x => x.id !== id);
  Store.save();
  renderCheckin();
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
      Store.save();
      renderCheckin();
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

function applyRemoteData(obj) {
  if (!obj || !Array.isArray(obj.courses)) throw new Error("云端数据格式不对");
  Store.data = {
    version: 2,
    updatedAt: obj.updatedAt || Date.now(),
    settings: Object.assign({ termStart: "" }, obj.settings || (Store.data && Store.data.settings) || {}),
    courses: obj.courses || [],
    todos: obj.todos || [],
    skills: obj.skills || [],
    habits: obj.habits || []
  };
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

    <h4>备份 / 迁移</h4>
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

    $("#expBtn", body).addEventListener("click", exportJSON);
    $("#impBtn", body).addEventListener("click", () => $("#impFile", body).click());
    $("#impFile", body).addEventListener("change", e => importJSON(e.target.files[0]));
    $("#resetBtn", body).addEventListener("click", () => {
      if (confirm("确定恢复成示例数据？当前数据会被覆盖。")) {
        Store.reset();
        renderAll();
        closeModal();
      }
    });
  });
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
      Store.data = {
        version: 2,
        settings: Object.assign({ termStart: "" }, obj.settings || Store.data.settings || {}),
        courses: obj.courses || [],
        todos: obj.todos || [],
        skills: obj.skills || [],
        habits: obj.habits || []
      };
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
   视图切换 & 初始化
   ========================================================= */
function switchView(view) {
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
  if (view === "timeline") {
    renderNextCard();
    if (tlMode === "week") renderWeek();
    else renderTimeline(true);
  }
}

function renderAll(scrollToNow = true) {
  renderTopbar();
  renderTimeline(scrollToNow);
  if (tlMode === "week") renderWeek();
  renderNextCard();
  renderTodo();
  renderSkills();
  renderCheckin();
  updateSyncBadge();
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
  renderAll(true);

  /* 支持 ?view=skills 之类直接打开某视图 */
  const v = new URLSearchParams(location.search).get("view");
  if (v && document.getElementById("view-" + v)) switchView(v);

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
  $("#todoList").addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest(".todo-item").dataset.id;
    if (btn.dataset.act === "toggle") toggleTodo(id);
    if (btn.dataset.act === "del") deleteTodo(id);
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

  /* 技能 / 导入 / 设置 / 皮肤 */
  $("#skillAdd").addEventListener("click", openAddSkill);
  $("#importBtn").addEventListener("click", openImportModal);
  $("#settingsBtn").addEventListener("click", openSettings);
  $("#themeBtn").addEventListener("click", openThemeModal);

  /* 弹窗关闭 */
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  /* 每 30 秒刷新时间线（不打断滚动）与顶栏 */
  setInterval(() => {
    if (tlMode === "week") renderWeek();
    else renderTimeline(false);
    renderNextCard();
    renderTopbar();
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
}

document.addEventListener("DOMContentLoaded", init);
