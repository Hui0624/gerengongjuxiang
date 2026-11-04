/* 用 sharp 把矢量图标栅格化成各尺寸 PNG（含 maskable / apple-touch-icon）
   仅本地生成用，不进运行期依赖 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = __dirname;

// 仪表盘/工作台标记，基于 24x24 视图，白色
const MARK = `
  <g fill="#ffffff" transform="translate(256 256) scale(16) translate(-12 -12)">
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.7"/>
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.7"/>
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.7"/>
    <g fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round">
      <path d="M17.25 13.8v7"/>
      <path d="M13.75 17.3h7"/>
    </g>
  </g>`;

// 普通图标：圆角矩形 + 薄荷绿渐变 + 顶部柔光（固定 512 坐标系，后续 resize 到目标尺寸）
function anyIcon(size) {
  const r = Math.round(512 * 0.21875); // 112
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1ebd80"/>
        <stop offset="1" stop-color="#14a06a"/>
      </linearGradient>
      <radialGradient id="hl" cx="0.32" cy="0.26" r="0.9">
        <stop offset="0" stop-color="#cdf8e6" stop-opacity="0.42"/>
        <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="512" height="512" rx="${r}" fill="url(#g)"/>
    <rect x="0" y="0" width="512" height="512" rx="${r}" fill="url(#hl)"/>
    ${MARK}
  </svg>`;
}

// maskable：满铺背景（无圆角），标记缩小到安全区内
function maskableIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1ebd80"/>
        <stop offset="1" stop-color="#14a06a"/>
      </linearGradient>
      <radialGradient id="hl" cx="0.32" cy="0.26" r="0.8">
        <stop offset="0" stop-color="#bff5dd" stop-opacity="0.45"/>
        <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="512" height="512" fill="url(#g)"/>
    <rect x="0" y="0" width="512" height="512" fill="url(#hl)"/>
    <g fill="#ffffff" transform="translate(256 256) scale(8) translate(-12 -12)">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.7"/>
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.7"/>
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.7"/>
      <g fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round">
        <path d="M17.25 13.8v7"/>
        <path d="M13.75 17.3h7"/>
      </g>
    </g>
  </svg>`;
}

async function run() {
  const jobs = [
    { size: 192, out: "icon-192.png", svg: anyIcon(192) },
    { size: 512, out: "icon-512.png", svg: anyIcon(512) },
    { size: 512, out: "icon-maskable-512.png", svg: maskableIcon() },
  ];
  for (const j of jobs) {
    await sharp(Buffer.from(j.svg))
      .resize(j.size, j.size, { fit: "fill" })
      .png()
      .toFile(path.join(OUT, j.out));
    console.log("wrote", j.out, j.size + "x" + j.size);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
