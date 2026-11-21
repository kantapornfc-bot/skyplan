/* แผนฟ้า — ตัววาดท้องฟ้าจำลอง (ดาว ทางช้างเผือก ดวงจันทร์ ดาวเคราะห์ สีท้องฟ้า) */
window.Sky = (() => {
'use strict';
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
let ready = false, starQ, starMag, starBV, starHip, names, lines = [], labels = [], mwTex, sprites;
const CON_TH = {
  Ori: 'นายพราน (ดาวเต่า)', Sco: 'แมงป่อง', Sgr: 'คนยิงธนู', UMa: 'หมีใหญ่ (ดาวจระเข้)', UMi: 'หมีเล็ก', Cas: 'แคสซิโอเปีย',
  Cru: 'กางเขนใต้', Cen: 'คนครึ่งม้า', Tau: 'วัว', Gem: 'คนคู่', Cnc: 'ปู', Leo: 'สิงโต', Vir: 'หญิงสาว', Lib: 'คันชั่ง',
  Cap: 'แพะทะเล', Aqr: 'คนแบกหม้อน้ำ', Psc: 'ปลา', Ari: 'แกะ', Cyg: 'หงส์', Lyr: 'พิณ', Aql: 'นกอินทรี', CMa: 'สุนัขใหญ่',
  CMi: 'สุนัขเล็ก', Aur: 'สารถี', Peg: 'ม้าบิน', And: 'แอนดรอมีดา', Per: 'เพอร์ซีอุส', Boo: 'คนเลี้ยงสัตว์', Her: 'เฮอร์คิวลีส',
  Dra: 'มังกร', Car: 'กระดูกงูเรือ', Lup: 'หมาป่า', Oph: 'คนแบกงู', Crv: 'อีกา', Hya: 'งูไฟ', Eri: 'แม่น้ำ', Lep: 'กระต่าย',
  Cep: 'เซฟิอัส', CrA: 'มงกุฎใต้', CrB: 'มงกุฎเหนือ', Vel: 'ใบเรือ', Pup: 'ท้ายเรือ', Cet: 'ปลาวาฬ'
};
const eqVec = (ra, dec) => { ra *= D2R; dec *= D2R; return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]; };
const enuVec = (alt, az) => [Math.cos(alt * D2R) * Math.sin(az * D2R), Math.cos(alt * D2R) * Math.cos(az * D2R), Math.sin(alt * D2R)];
const mul = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
const mulT = (A, v) => [A[0] * v[0] + A[3] * v[1] + A[6] * v[2], A[1] * v[0] + A[4] * v[1] + A[7] * v[2], A[2] * v[0] + A[5] * v[1] + A[8] * v[2]];
const mm = (A, B) => { const C = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return C; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

async function load() {
  if (ready) return;
  const [j, img] = await Promise.all([
    fetch('data/sky.json').then(r => r.json()),
    new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data/mw.png'; })
  ]);
  const n = j.stars.length; starQ = new Float32Array(n * 3); starMag = new Float32Array(n); starBV = new Float32Array(n); starHip = j.hip;
  j.stars.forEach((s, i) => { const q = eqVec(s[0], s[1]); starQ.set(q, i * 3); starMag[i] = s[2]; starBV[i] = s[3]; });
  names = j.names;
  for (const id in j.lines) j.lines[id].forEach(pl => { for (let k = 1; k < pl.length; k++) lines.push([eqVec(...pl[k - 1]), eqVec(...pl[k])]); });
  for (const id in j.labels) if (CON_TH[id]) labels.push({ t: CON_TH[id], q: eqVec(...j.labels[id]) });
  labels.push({ t: 'ดาวลูกไก่', q: eqVec(56.75, 24.12) });
  const c = document.createElement('canvas'); c.width = 720; c.height = 360; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, 720, 360).data; mwTex = new Uint8Array(720 * 360); for (let i = 0; i < mwTex.length; i++) mwTex[i] = d[i * 4];
  sprites = [[170, 191, 255], [205, 218, 255], [248, 247, 255], [255, 241, 224], [255, 214, 165], [255, 184, 128]].map(col => {
    const s = document.createElement('canvas'); s.width = s.height = 64; const g = s.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.12, `rgba(${col},1)`); gr.addColorStop(0.35, `rgba(${col},0.35)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return s;
  });
  ready = true;
}
const BVC = ['rgb(185,202,255)', 'rgb(215,225,255)', 'rgb(250,249,255)', 'rgb(255,243,228)', 'rgb(255,220,175)', 'rgb(255,192,140)'];
const bvIdx = bv => bv < -0.1 ? 0 : bv < 0.15 ? 1 : bv < 0.45 ? 2 : bv < 0.8 ? 3 : bv < 1.3 ? 4 : 5;
const bvColor = bv => BVC[bvIdx(bv)];
const bvSprite = bv => sprites[bv < -0.1 ? 0 : bv < 0.15 ? 1 : bv < 0.45 ? 2 : bv < 0.8 ? 3 : bv < 1.3 ? 4 : 5];

/* ---------- เวลาดาราคติ การหมุนแกน และดาวเคราะห์ ---------- */
function frame(date, lat, lng) {
  const jd = date.getTime() / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;
  const L = ((280.46061837 + 360.98564736629 * (jd - 2451545) + lng) % 360) * D2R, p = lat * D2R;
  const sL = Math.sin(L), cL = Math.cos(L), sp = Math.sin(p), cp = Math.cos(p);
  const M = [-sL, cL, 0, -sp * cL, -sp * sL, cp, cp * cL, cp * sL, sp];
  const z = (0.6406161 * T + 0.0003041 * T * T) * D2R, ze = (0.6406161 * T + 0.0000839 * T * T) * D2R, th = (0.556753 * T - 0.0001185 * T * T) * D2R;
  const Rz = a => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const Ry = a => [Math.cos(a), 0, -Math.sin(a), 0, 1, 0, Math.sin(a), 0, Math.cos(a)];
  const P = mm(Rz(z), mm(Ry(th), Rz(ze)));
  return { A: mm(M, P), T };
}
const EL = { // a, e, I, L, varpi, Omega และอัตราต่อศตวรรษ (JPL)
  me: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  ve: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255, 0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  ea: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  ma: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  ju: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  sa: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]
};
const PL = [['me', 'ดาวพุธ', -0.6, 2], ['ve', 'ดาวศุกร์', -4.4, 3], ['ma', 'ดาวอังคาร', -1.5, 5], ['ju', 'ดาวพฤหัสบดี', -9.4, 3], ['sa', 'ดาวเสาร์', -8.9, 3]];
function helio(k, T) {
  const e0 = EL[k], v = i => e0[i] + e0[i + 6] * T;
  const a = v(0), e = v(1), I = v(2) * D2R, Lm = v(3), w = v(4), O = v(5) * D2R;
  let M = ((Lm - w) % 360 + 540) % 360 - 180; M *= D2R; let E = M + e * Math.sin(M);
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E), om = w * D2R - O;
  const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [(co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp, (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp, so * sI * xp + co * sI * yp];
}
function planets(T) {
  const E = helio('ea', T), eps = 23.43928 * D2R;
  return PL.map(([k, name, H, sz]) => {
    const h = helio(k, T), g = [h[0] - E[0], h[1] - E[1], h[2] - E[2]];
    const r = Math.hypot(...h), dl = Math.hypot(...g);
    const q = norm([g[0], g[1] * Math.cos(eps) - g[2] * Math.sin(eps), g[1] * Math.sin(eps) + g[2] * Math.cos(eps)]);
    return { k, name, q, mag: H + 5 * Math.log10(r * dl), sz };
  });
}

/* ---------- การฉายภาพ ---------- */
function project(c, v) {
  const z = dot(v, c.f), x = dot(v, c.r), y = dot(v, c.u);
  if (c.proj === 'gno') { if (z < 0.02) return null; return [c.W / 2 + x / z * c.fp, c.H / 2 - y / z * c.fp]; }
  if (z < -0.7) return null; const k = 2 / (1 + z); return [c.W / 2 + x * k * c.fp, c.H / 2 - y * k * c.fp];
}
function unproject(c, sx, sy) {
  const X = (sx - c.W / 2) / c.fp, Y = (c.H / 2 - sy) / c.fp;
  if (c.proj === 'gno') return norm([c.f[0] + X * c.r[0] + Y * c.u[0], c.f[1] + X * c.r[1] + Y * c.u[1], c.f[2] + X * c.r[2] + Y * c.u[2]]);
  const rho = Math.hypot(X, Y); if (rho < 1e-9) return c.f.slice();
  const th = 2 * Math.atan(rho / 2), s = Math.sin(th) / rho, cz = Math.cos(th);
  return [cz * c.f[0] + s * (X * c.r[0] + Y * c.u[0]), cz * c.f[1] + s * (X * c.r[1] + Y * c.u[1]), cz * c.f[2] + s * (X * c.r[2] + Y * c.u[2])];
}
function camera(W, H, az, alt, fov, proj) {
  const f = enuVec(alt, az), r = [Math.cos(az * D2R), -Math.sin(az * D2R), 0];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const half = fov * D2R / 2, fp = proj === 'gno' ? (W / 2) / Math.tan(half) : (W / 2) / (2 * Math.tan(half / 2));
  return { W, H, f, r, u, fp, proj };
}

/* ---------- สีท้องฟ้า ---------- */
const KEYS = [ // มุมดวงอาทิตย์, สีจุดเหนือศีรษะ, สีขอบฟ้า, สีแสงฝั่งดวงอาทิตย์, ความแรง
  [-90, [3, 5, 12], [7, 10, 20], [0, 0, 0], 0], [-18, [3, 5, 12], [7, 10, 20], [0, 0, 0], 0],
  [-12, [8, 13, 34], [22, 27, 55], [110, 60, 55], 0.35], [-6, [18, 32, 78], [68, 70, 118], [235, 105, 60], 0.75],
  [-2, [38, 62, 128], [196, 130, 112], [255, 125, 60], 1], [2, [55, 95, 168], [228, 188, 150], [255, 172, 85], 1],
  [10, [45, 105, 200], [182, 208, 236], [255, 238, 205], 0.7], [90, [28, 88, 200], [160, 200, 240], [255, 255, 245], 0.6]
];
function skyKey(h) {
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] < h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1), L = (p, q) => p.map((x, k) => x + (q[k] - x) * t);
  return { zen: L(a[1], b[1]), hor: L(a[2], b[2]), glow: L(a[3], b[3]), gs: a[4] + (b[4] - a[4]) * t };
}
const hill = az => 0.9 + 0.9 * Math.sin(az * 3 * D2R + 0.4) + 0.55 * Math.sin(az * 7 * D2R + 1.3) + 0.3 * Math.sin(az * 17 * D2R + 2.1) + 0.15 * Math.sin(az * 41 * D2R);
function limitMag(h, moonF) {
  let lim = h >= 0 ? -3 : h > -6 ? -1 + (-h) / 6 * 2 : h > -12 ? 1 + (-6 - h) / 6 * 3 : h > -18 ? 4 + (-12 - h) / 6 * 2.3 : 6.3;
  return lim - 2.2 * moonF;
}

let off = null, offImg = null;
function skyBuffer(ctx, c, env, o) {
  const bw = Math.round(clamp(c.W / (o.fast ? 6 : 3.6), 60, 220)), bh = Math.round(bw * c.H / c.W);
  if (!off || off.width !== bw || off.height !== bh) { off = document.createElement('canvas'); off.width = bw; off.height = bh; offImg = off.getContext('2d').createImageData(bw, bh); }
  const D = offImg.data, K = skyKey(env.sunAlt), sv = env.sunV, mv = env.moonV, A = env.A, ar = o.mode === 'ar';
  const night = clamp((-env.sunAlt - 4) / 14, 0, 1);
  const moonF = env.moonAlt > 0 ? env.ill * Math.min(1, Math.sin(env.moonAlt * D2R) * 3) : 0;
  const mwVis = ar ? 0.85 : clamp((-env.sunAlt - 12) / 6, 0, 1) * (1 - 0.8 * moonF);
  const glowW = env.sunAlt > 4 ? 0.04 : 0.025;
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const v = unproject(c, (i + 0.5) / bw * c.W, (j + 0.5) / bh * c.H), alt = Math.asin(clamp(v[2], -1, 1)) * R2D, p = (j * bw + i) * 4;
    let R = 0, G = 0, B = 0, Aa = 255;
    if (ar) {
      Aa = 0;
    } else if (o.show.ground && alt < hill(Math.atan2(v[0], v[1]) * R2D)) {
      const lit = clamp((env.sunAlt + 6) / 20, 0, 1), hz = clamp(1 + alt / 6, 0, 1) * 0.35;
      R = 7 + 48 * lit + K.hor[0] * hz * 0.4; G = 8 + 58 * lit + K.hor[1] * hz * 0.4; B = 11 + 40 * lit + K.hor[2] * hz * 0.4;
      D[p] = R; D[p + 1] = G; D[p + 2] = B; D[p + 3] = 255; continue;
    } else {
      const a2 = Math.max(alt, 0), t = Math.pow(Math.sin(a2 * D2R), 0.45);
      R = K.hor[0] + (K.zen[0] - K.hor[0]) * t; G = K.hor[1] + (K.zen[1] - K.hor[1]) * t; B = K.hor[2] + (K.zen[2] - K.hor[2]) * t;
      const cg = dot(v, sv), gam = Math.acos(clamp(cg, -1, 1));
      const gl = K.gs * Math.exp(-gam * gam / (0.9 + (env.sunAlt < 0 ? 0.6 : 0))) * (1 - 0.65 * t);
      R += K.glow[0] * gl * 0.55; G += K.glow[1] * gl * 0.55; B += K.glow[2] * gl * 0.55;
      if (env.sunAlt > -1) { const hs = Math.exp(-gam / glowW) * 220 + Math.exp(-gam / 0.18) * 60; R += hs; G += hs * 0.95; B += hs * 0.85; }
      if (moonF > 0) { const gm = Math.acos(clamp(dot(v, mv), -1, 1)), k = moonF * night; R += 14 * k + 55 * k * Math.exp(-gm / 0.12); G += 22 * k + 58 * k * Math.exp(-gm / 0.12); B += 42 * k + 70 * k * Math.exp(-gm / 0.12); }
      if (alt < 0) { R *= 0.55; G *= 0.55; B *= 0.6; }
    }
    if (mwVis > 0 && alt > -3) {
      const q = mulT(A, v); let ra = Math.atan2(q[1], q[0]) * R2D; if (ra < 0) ra += 360;
      const dec = Math.asin(clamp(q[2], -1, 1)) * R2D, col = Math.min(719, ra * 2 | 0), row = clamp((90 - dec) * 2 | 0, 0, 359);
      const m = mwTex[row * 720 + col] / 255 * mwVis * clamp((alt + 3) / 18, 0, 1);
      if (ar) { R = 215; G = 205; B = 190; Aa = Math.min(255, m * 210); }
      else { R += m * 175; G += m * 165; B += m * 150; }
    }
    D[p] = Math.min(255, R); D[p + 1] = Math.min(255, G); D[p + 2] = Math.min(255, B); D[p + 3] = Aa;
  }
  off.getContext('2d').putImageData(offImg, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, c.W, c.H);
}

/* ---------- ดวงจันทร์ ---------- */
function drawMoon(ctx, c, env, o) {
  const p = project(c, env.moonV); if (!p) return;
  if (o.mode === 'sim' && o.show.ground && env.moonAlt < hill(env.moonAz)) return;
  const tv = norm(env.sunV.map((s, i) => s - dot(env.sunV, env.moonV) * env.moonV[i]));
  const p2 = project(c, norm(env.moonV.map((m, i) => m + 0.01 * tv[i]))); const ang = p2 ? Math.atan2(p2[1] - p[1], p2[0] - p[0]) : 0;
  const rm = Math.max(c.fp * 0.0045 * (c.proj === 'gno' ? 1 : 1), o.mode === 'ar' ? 9 : 6);
  const dark = o.mode === 'ar' || env.sunAlt < -4;
  if (dark && env.ill > 0.05) { const g = ctx.createRadialGradient(p[0], p[1], rm, p[0], p[1], rm * 9); g.addColorStop(0, `rgba(230,235,255,${0.35 * env.ill})`); g.addColorStop(1, 'rgba(230,235,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], rm * 9, 0, 7); ctx.fill(); }
  ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang);
  ctx.fillStyle = dark ? 'rgba(40,44,58,0.55)' : 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(0, 0, rm, 0, 7); ctx.fill();
  const k = 1 - 2 * env.ill;
  ctx.beginPath(); ctx.moveTo(0, -rm); ctx.arc(0, 0, rm, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, Math.max(0.01, Math.abs(k) * rm), rm, 0, Math.PI / 2, -Math.PI / 2, k > 0); ctx.closePath();
  ctx.save(); ctx.clip();
  const g = ctx.createRadialGradient(-rm * 0.2, -rm * 0.2, 0, 0, 0, rm); g.addColorStop(0, dark ? '#fbf8ec' : '#f6f7fb'); g.addColorStop(1, dark ? '#d9d3bf' : '#dfe5f0');
  ctx.fillStyle = g; ctx.fillRect(-rm, -rm, rm * 2, rm * 2);
  ctx.fillStyle = 'rgba(120,118,110,0.16)';
  [[-0.3, -0.35, 0.28], [0.12, -0.28, 0.17], [0.28, 0.05, 0.2], [-0.05, 0.12, 0.13], [-0.35, 0.25, 0.12], [0.1, 0.48, 0.1]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x * rm, y * rm, r * rm, 0, 7); ctx.fill(); });
  ctx.restore(); ctx.restore();
}

/* ---------- ตัววาดหลัก ---------- */
function render(ctx, c, o) {
  if (!ready) return null;
  const d = o.date, sp = SunCalc.getPosition(d, o.lat, o.lng), mp = SunCalc.getMoonPosition(d, o.lat, o.lng), il = SunCalc.getMoonIllumination(d);
  const sunAlt = sp.altitude * R2D, sunAz = (sp.azimuth * R2D + 180) % 360, moonAlt = mp.altitude * R2D, moonAz = (mp.azimuth * R2D + 180) % 360;
  const { A, T } = frame(d, o.lat, o.lng);
  const env = { A, sunAlt, sunAz, moonAlt, moonAz, ill: il.fraction, sunV: enuVec(sunAlt, sunAz), moonV: enuVec(moonAlt, moonAz) };
  const ar = o.mode === 'ar', show = o.show, ground = !ar && show.ground;
  const moonF = moonAlt > 0 ? il.fraction * Math.min(1, Math.sin(moonAlt * D2R) * 3) : 0;
  const lim = ar ? 5.2 : limitMag(sunAlt, moonF);
  if (!ar || show.sky) skyBuffer(ctx, c, env, o);
  const zoom = clamp(Math.sqrt(c.fp / 300), 0.85, 2.2);
  const occl = v => ground && Math.asin(v[2]) * R2D < hill(Math.atan2(v[0], v[1]) * R2D);
  ctx.save();
  // ดาวฤกษ์
  if (!ar || show.sky) {
    const n = starMag.length;
    for (let i = 0; i < n; i++) {
      const m = starMag[i]; if (m > lim + 0.6 || (o.fast && m > 4.8)) break;
      const v = mul(A, [starQ[i * 3], starQ[i * 3 + 1], starQ[i * 3 + 2]]);
      if (v[2] < -0.05 || occl(v)) continue;
      const p = project(c, v); if (!p || p[0] < -20 || p[1] < -20 || p[0] > c.W + 20 || p[1] > c.H + 20) continue;
      const ext = ar ? 1 : clamp((Math.asin(v[2]) * R2D + 1) / 10, 0.12, 1);
      const a = clamp((lim + 0.6 - m) / 1.6, 0, 1) * ext; if (a < 0.02) continue;
      const s = clamp(1.1 + (lim - m) * 0.75, 1.1, 10) * zoom;
      ctx.globalAlpha = a;
      if (s < 2.6) { ctx.fillStyle = bvColor(starBV[i]); ctx.fillRect(p[0] - s * 0.55, p[1] - s * 0.55, s * 1.1, s * 1.1); }
      else ctx.drawImage(bvSprite(starBV[i]), p[0] - s * 2, p[1] - s * 2, s * 4, s * 4);
    }
  }
  // ดาวเคราะห์
  const pls = planets(T), shown = [];
  pls.forEach(pl => {
    const v = mul(A, pl.q); if (v[2] < -0.02 || occl(v)) return; const p = project(c, v); if (!p) return;
    if (pl.mag > lim + 0.5 && !(ar && show.sky)) return;
    const s = clamp(2.2 + (lim - pl.mag) * 0.6, 2.4, 9) * zoom;
    ctx.globalAlpha = ar ? 1 : clamp((lim + 0.5 - pl.mag) / 1.5, 0.2, 1);
    ctx.drawImage(sprites[pl.k === 'ma' ? 5 : pl.k === 've' ? 2 : 3], p[0] - s * 2, p[1] - s * 2, s * 4, s * 4);
    shown.push({ p, t: pl.name });
  });
  ctx.restore(); ctx.globalAlpha = 1;
  // ดวงอาทิตย์ (โหมดจำลอง)
  if (!ar) { const p = project(c, env.sunV); if (p && !occl(env.sunV)) { const r = Math.max(c.fp * 0.0045, 7); ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); } }
  if (!ar || show.sky) drawMoon(ctx, c, env, o);
  // เส้นกลุ่มดาว
  ctx.font = '600 13px Sarabun, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  if (show.lines) {
    const la = ar ? 1 : clamp((lim + 1) / 4, 0.3, 1); ctx.strokeStyle = `rgba(130,170,255,${0.42 * la})`; ctx.lineWidth = 1.1; ctx.beginPath();
    lines.forEach(([q1, q2]) => {
      const v1 = mul(A, q1), v2 = mul(A, q2); if (ground && (v1[2] < 0 || v2[2] < 0)) return;
      const a = project(c, v1), b = project(c, v2); if (!a || !b || Math.abs(a[0] - b[0]) > c.W || Math.abs(a[1] - b[1]) > c.H) return;
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    });
    ctx.stroke();
    ctx.fillStyle = `rgba(160,190,255,${0.85 * la})`;
    labels.forEach(l => { const v = mul(A, l.q); if (ground && v[2] < 0.02) return; const p = project(c, v); if (p && p[0] > 0 && p[0] < c.W && p[1] > 30 && p[1] < c.H) ctx.fillText(l.t, p[0], p[1]); });
  }
  // ชื่อดาวสว่างและดาวเคราะห์
  if (show.names) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,240,215,0.92)';
    for (let i = 0; i < starHip.length && starMag[i] < 2.2; i++) {
      const nm = names[starHip[i]]; if (!nm || starMag[i] > lim - 0.3) continue;
      const v = mul(A, [starQ[i * 3], starQ[i * 3 + 1], starQ[i * 3 + 2]]); if (v[2] < 0 || occl(v)) continue;
      const p = project(c, v); if (p) ctx.fillText(nm, p[0] + 8, p[1]);
    }
    ctx.fillStyle = '#ffe08a'; shown.forEach(s => ctx.fillText(s.t, s.p[0] + 9, s.p[1]));
    if (!ar) { const p = project(c, env.moonV); if (p && !occl(env.moonV)) ctx.fillText('ดวงจันทร์', p[0] + 12, p[1]); }
  }
  return { lim, sunAlt, moonAlt };
}
// เส้นทางตามเวลา (ดวงอาทิตย์ ดวงจันทร์ ใจกลางทางช้างเผือก)
function drawPath(ctx, c, pts, color, w, dash, labelsOn) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); let on = false;
  pts.forEach(p => { const q = p.alt > -8 ? project(c, enuVec(p.alt, p.az)) : null; if (q && Math.abs(q[0]) < c.W * 3 && Math.abs(q[1]) < c.H * 3) { on ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); on = true; } else on = false; });
  ctx.stroke(); ctx.setLineDash([]);
  if (!labelsOn) return;
  ctx.fillStyle = color; ctx.font = '600 12px Sarabun, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  pts.forEach(p => { if (p.h == null || p.alt < -2) return; const q = project(c, enuVec(p.alt, p.az)); if (q) { ctx.beginPath(); ctx.arc(q[0], q[1], 3, 0, 7); ctx.fill(); ctx.fillText(String(p.h).padStart(2, '0') + ':00', q[0], q[1] - 5); } });
}
function drawCompass(ctx, c, ground) {
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); let on = false;
  for (let z = 0; z <= 360; z += 2) { const q = project(c, enuVec(ground ? 0 : 0, z)); if (q) { on ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); on = true; } else on = false; }
  if (!ground) ctx.stroke();
  const DN = ['เหนือ', 'NE', 'ตะวันออก', 'SE', 'ใต้', 'SW', 'ตะวันตก', 'NW'];
  ctx.font = '700 14px Sarabun, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let z = 0; z < 360; z += 45) { const q = project(c, enuVec(ground ? -1 : 0, z)); if (q && q[1] < c.H - 4) { ctx.fillStyle = z === 0 ? '#ff8a8a' : '#e9eefb'; ctx.fillText(DN[z / 45], q[0], q[1] + 4); } }
}
function drawFrame(ctx, c, wmm, hmm, f, portrait) {
  let tx = wmm / 2 / f, ty = hmm / 2 / f; if (portrait) [tx, ty] = [ty, tx];
  const P = (x, y) => project(c, norm([c.f[0] + x * c.r[0] + y * c.u[0], c.f[1] + x * c.r[1] + y * c.u[1], c.f[2] + x * c.r[2] + y * c.u[2]]));
  const pts = []; const N = 24;
  for (let i = 0; i <= N; i++) pts.push(P(-tx + 2 * tx * i / N, ty)); for (let i = 0; i <= N; i++) pts.push(P(tx, ty - 2 * ty * i / N));
  for (let i = 0; i <= N; i++) pts.push(P(tx - 2 * tx * i / N, -ty)); for (let i = 0; i <= N; i++) pts.push(P(-tx, -ty + 2 * ty * i / N));
  if (pts.some(p => !p)) return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, c.W, c.H); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill('evenodd');
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.strokeStyle = '#ffb84d'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  return [2 * Math.atan(tx) * R2D, 2 * Math.atan(ty) * R2D, pts[0]];
}
return { load, render, camera, project, drawPath, drawCompass, drawFrame, enuVec, get ready() { return ready; } };
})();
