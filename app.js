/* แผนฟ้า SkyPlan — วางแผนถ่ายภาพดวงอาทิตย์ ดวงจันทร์ และทางช้างเผือก */
(() => {
'use strict';
const R2D = 180 / Math.PI, D2R = Math.PI / 180;
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('skyplan.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('skyplan.' + k, JSON.stringify(v)); } catch (e) {} }
};
SunCalc.addTime(-4, 'blueEnd', 'blueStart');

/* ---------- state ---------- */
const now0 = new Date();
const S = {
  lat: store.get('lat', 13.7563), lng: store.get('lng', 100.5018), name: store.get('name', 'กรุงเทพฯ (ค่าเริ่มต้น)'),
  y: now0.getFullYear(), mo: now0.getMonth(), d: now0.getDate(), min: now0.getHours() * 60 + now0.getMinutes()
};
let places = store.get('places', []);
const curDate = () => new Date(S.y, S.mo, S.d, 0, S.min);
const dayAt = (h, m = 0, add = 0) => new Date(S.y, S.mo, S.d + add, h, m);
function setDate(dt) { S.y = dt.getFullYear(); S.mo = dt.getMonth(); S.d = dt.getDate(); S.min = dt.getHours() * 60 + dt.getMinutes(); }

/* ---------- astronomy ---------- */
const sunPos = (d, la = S.lat, ln = S.lng) => { const p = SunCalc.getPosition(d, la, ln); return { alt: p.altitude * R2D, az: (p.azimuth * R2D + 180 + 360) % 360 }; };
const moonPos = (d, la = S.lat, ln = S.lng) => { const p = SunCalc.getMoonPosition(d, la, ln); return { alt: p.altitude * R2D, az: (p.azimuth * R2D + 180 + 360) % 360 }; };
// ใจกลางทางช้างเผือก (Sgr A*, J2000): RA 266.4168°, Dec −29.0078°
function corePos(d, la = S.lat, ln = S.lng) {
  const jd = d.getTime() / 86400000 + 2440587.5;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545);
  const H = ((gmst + ln - 266.4168) % 360) * D2R, dec = -29.0078 * D2R, phi = la * D2R;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt: alt * R2D, az: (az * R2D + 180 + 360) % 360 };
}
const illum = d => SunCalc.getMoonIllumination(d);
const ok = d => d instanceof Date && !isNaN(d);
const fmt = d => ok(d) ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '—';
const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const DIRS_TH = ['เหนือ', 'ตะวันออกเฉียงเหนือ', 'ตะวันออก', 'ตะวันออกเฉียงใต้', 'ใต้', 'ตะวันตกเฉียงใต้', 'ตะวันตก', 'ตะวันตกเฉียงเหนือ'];
const dir = az => DIRS[Math.round(az / 22.5) % 16];
const dirTh = az => DIRS_TH[Math.round(az / 45) % 8];
const thDate = (d, o = { weekday: 'short', day: 'numeric', month: 'short' }) => d.toLocaleDateString('th-TH', o);

function phaseName(p) {
  const age = p * 29.53;
  let n;
  if (p < 0.03 || p > 0.97) n = 'จันทร์ดับ';
  else if (p < 0.22) n = 'เสี้ยวข้างขึ้น';
  else if (p < 0.28) n = 'ครึ่งดวงข้างขึ้น';
  else if (p < 0.47) n = 'ค่อนดวงข้างขึ้น';
  else if (p < 0.53) n = 'จันทร์เต็มดวง';
  else if (p < 0.72) n = 'ค่อนดวงข้างแรม';
  else if (p < 0.78) n = 'ครึ่งดวงข้างแรม';
  else n = 'เสี้ยวข้างแรม';
  const kham = age < 14.765 ? `ข้างขึ้น ${Math.max(1, Math.ceil(age))} ค่ำ` : `ข้างแรม ${Math.max(1, Math.ceil(age - 14.765))} ค่ำ`;
  return { n, kham, age };
}
function lightPhase(alt) {
  if (alt > 6) return 'กลางวัน';
  if (alt > -4) return 'Golden hour';
  if (alt > -6) return 'Blue hour';
  if (alt > -12) return 'สนธยาเดินเรือ';
  if (alt > -18) return 'สนธยาดาราศาสตร์';
  return 'ฟ้ามืดสนิท';
}

/* ---------- map ---------- */
const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([S.lat, S.lng], 12);
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
const pin = L.marker([S.lat, S.lng], { draggable: true, icon: L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map);
const rays = L.layerGroup().addTo(map);
pin.on('dragend', () => { const p = pin.getLatLng(); moveTo(p.lat, p.lng, null); });
map.on('click', e => moveTo(e.latlng.lat, e.latlng.lng, null));
map.on('zoomend moveend resize', drawRays);

function moveTo(lat, lng, name, pan) {
  S.lat = +lat; S.lng = ((+lng + 540) % 360) - 180; S.name = name || `${S.lat.toFixed(4)}, ${S.lng.toFixed(4)}`;
  store.set('lat', S.lat); store.set('lng', S.lng); store.set('name', S.name);
  pin.setLatLng([S.lat, S.lng]); if (pan) map.setView([S.lat, S.lng], Math.max(map.getZoom(), 12));
  locDirty = true; refresh();
}
function ray(az, color, weight, dashed) {
  const c = map.latLngToContainerPoint([S.lat, S.lng]), sz = map.getSize();
  const len = Math.min(sz.x, sz.y) * 0.46;
  const e = map.containerPointToLatLng([c.x + Math.sin(az * D2R) * len, c.y - Math.cos(az * D2R) * len]);
  L.polyline([[S.lat, S.lng], e], { color, weight, opacity: 0.95, dashArray: dashed ? '6 7' : null, interactive: false, lineCap: 'round' }).addTo(rays);
}
function drawRays() {
  rays.clearLayers();
  const d = curDate(), noon = dayAt(12), t = SunCalc.getTimes(noon, S.lat, S.lng), mt = SunCalc.getMoonTimes(dayAt(0), S.lat, S.lng);
  const css = getComputedStyle(document.documentElement), c = v => css.getPropertyValue(v).trim();
  if (ok(t.sunrise)) ray(sunPos(t.sunrise).az, c('--rise'), 3);
  if (ok(t.sunset)) ray(sunPos(t.sunset).az, c('--set'), 3);
  if (ok(mt.rise)) ray(moonPos(mt.rise).az, c('--moon'), 2, true);
  if (ok(mt.set)) ray(moonPos(mt.set).az, c('--moon'), 2, true);
  const s = sunPos(d), m = moonPos(d), g = corePos(d);
  ray(g.az, c('--mw'), 5, g.alt < 0);
  ray(m.az, c('--moon'), 6, m.alt < 0);
  ray(s.az, c('--sun'), 7, s.alt < 0);
}

/* ---------- planner panel ---------- */
function stat(k, color, v, s) { return `<div class="stat"><div class="k">${color ? `<i style="background:${color}"></i>` : ''}${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`; }
function renderPlan() {
  const d = curDate(), s = sunPos(d), m = moonPos(d), g = corePos(d), il = illum(d);
  $('dateIn').value = `${S.y}-${String(S.mo + 1).padStart(2, '0')}-${String(S.d).padStart(2, '0')}`;
  $('timeIn').value = S.min; $('timeOut').textContent = fmt(d);
  const shadow = s.alt > 0.5 ? (1 / Math.tan(s.alt * D2R)) : null;
  $('nowGrid').innerHTML =
    stat('ดวงอาทิตย์', 'var(--sun)', `${s.alt.toFixed(1)}°`, `ทิศ ${s.az.toFixed(0)}° ${dir(s.az)}`) +
    stat('ดวงจันทร์', 'var(--moon)', `${m.alt.toFixed(1)}°`, `ทิศ ${m.az.toFixed(0)}° ${dir(m.az)} · ${(il.fraction * 100).toFixed(0)}%`) +
    stat('ทางช้างเผือก', 'var(--mw)', `${g.alt.toFixed(1)}°`, `ทิศ ${g.az.toFixed(0)}° ${dir(g.az)}`) +
    stat('สภาพแสง', '', `<span class="txt">${lightPhase(s.alt)}</span>`, thDate(d)) +
    stat('เงาวัตถุสูง 1 ม.', '', shadow ? (shadow > 50 ? '>50 ม.' : shadow.toFixed(2) + ' ม.') : '—', shadow ? `ชี้ไปทิศ ${((s.az + 180) % 360).toFixed(0)}°` : 'ไม่มีเงา (กลางคืน)') +
    stat('ข้างขึ้นข้างแรม', '', `<span class="txt">${phaseName(il.phase).n}</span>`, phaseName(il.phase).kham);
  $('locLabel').textContent = S.name;
  drawRays();
}
function renderPlaces() {
  $('placeChips').innerHTML = places.map((p, i) => `<button data-i="${i}">${esc(p.name)}<span class="x" data-del="${i}">✕</span></button>`).join('');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- times view ---------- */
function renderTimes() {
  const noon = dayAt(12), t = SunCalc.getTimes(noon, S.lat, S.lng), mt = SunCalc.getMoonTimes(dayAt(0), S.lat, S.lng);
  $('timesTitle').textContent = 'เวลาสำคัญ · ' + thDate(noon, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const az = (d, f) => ok(d) ? `${f(d).az.toFixed(0)}° ${dir(f(d).az)}` : '';
  const rng = (a, b) => `${fmt(a)}–${fmt(b)}`;
  const len = ok(t.sunrise) && ok(t.sunset) ? (t.sunset - t.sunrise) / 60000 : null;
  const rows = [
    ['sec', 'ดวงอาทิตย์'],
    ['ฟ้าเริ่มสาง (สนธยาดาราศาสตร์)', fmt(t.nightEnd), ''],
    ['สนธยาเดินเรือ (เช้า)', fmt(t.nauticalDawn), ''],
    ['Blue hour เช้า', rng(t.dawn, t.blueEnd), ''],
    ['Golden hour เช้า', rng(t.blueEnd, t.goldenHourEnd), ''],
    ['ดวงอาทิตย์ขึ้น', fmt(t.sunrise), az(t.sunrise, sunPos)],
    ['เที่ยงสุริยะ', fmt(t.solarNoon), `สูง ${sunPos(t.solarNoon).alt.toFixed(1)}°`],
    ['Golden hour เย็น', rng(t.goldenHour, t.blueStart), ''],
    ['ดวงอาทิตย์ตก', fmt(t.sunset), az(t.sunset, sunPos)],
    ['Blue hour เย็น', rng(t.blueStart, t.dusk), ''],
    ['ฟ้ามืดสนิท', fmt(t.night), ''],
    ['ความยาวกลางวัน', len ? `${Math.floor(len / 60)} ชม. ${Math.round(len % 60)} น.` : '—', ''],
    ['sec', 'ดวงจันทร์'],
    ['ดวงจันทร์ขึ้น', mt.alwaysUp ? 'อยู่เหนือฟ้าทั้งวัน' : fmt(mt.rise), az(mt.rise, moonPos)],
    ['ดวงจันทร์ตก', mt.alwaysDown ? 'อยู่ใต้ฟ้าทั้งวัน' : fmt(mt.set), az(mt.set, moonPos)]
  ];
  $('timesTbl').innerHTML = rows.map(r => r[0] === 'sec' ? `<tr class="sec"><td colspan="3">${r[1]}</td></tr>` : `<tr><td>${r[0]}</td><td class="t">${r[1]}</td><td class="a">${r[2]}</td></tr>`).join('');
  // moon card
  const il = illum(curDate()), pn = phaseName(il.phase);
  const nf = nextPhase(curDate(), 0.5), nn = nextPhase(curDate(), 0);
  $('moonInfo').innerHTML = `<div class="ph">${pn.n}</div><div>${pn.kham} (โดยประมาณ) · สว่าง ${(il.fraction * 100).toFixed(0)}%</div>
    <div class="sub" style="margin:4px 0 0">เต็มดวงครั้งถัดไป ${nf ? thDate(nf) + ' ' + fmt(nf) : '—'}<br>จันทร์ดับครั้งถัดไป ${nn ? thDate(nn) + ' ' + fmt(nn) : '—'}</div>`;
  drawMoon($('moonCv'), il);
  drawSky();
}
function nextPhase(from, target) {
  // หาค่าความสว่างสูงสุด (เต็มดวง) หรือต่ำสุด (จันทร์ดับ) ครั้งถัดไป ทีละ 1 ชม.
  const f = t => illum(new Date(t)).fraction, t0 = from.getTime();
  let a = f(t0), b = f(t0 + 3600000);
  for (let i = 2; i <= 32 * 24; i++) {
    const t = t0 + i * 3600000, c = f(t);
    if (target === 0.5 ? (b >= a && b > c && b > 0.9) : (b <= a && b < c && b < 0.1)) return new Date(t - 3600000);
    a = b; b = c;
  }
  return null;
}
function drawMoon(cv, il) {
  const x = cv.getContext('2d'), r = 54, c = 60;
  x.clearRect(0, 0, 120, 120);
  x.fillStyle = '#26324f'; x.beginPath(); x.arc(c, c, r, 0, 7); x.fill();
  const waxing = il.phase < 0.5, k = Math.cos(il.phase * 2 * Math.PI); // 1 ดับ, −1 เต็ม
  x.fillStyle = '#f4f1e3';
  x.beginPath(); x.arc(c, c, r, -Math.PI / 2, Math.PI / 2, !waxing); x.fill(); // ครึ่งสว่าง
  x.fillStyle = k > 0 ? '#26324f' : '#f4f1e3';
  x.beginPath(); x.ellipse(c, c, Math.abs(k) * r, r, 0, 0, 7); x.fill();
}
function fitCanvas(cv) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H); return { x, W, H };
}
function drawSky() {
  const cv = $('skyCv'); if (!cv.clientWidth) return;
  const { x, W, H } = fitCanvas(cv), cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 26;
  const P = (alt, az) => { const r = (90 - alt) / 90 * R; return [cx + r * Math.sin(az * D2R), cy - r * Math.cos(az * D2R)]; };
  x.strokeStyle = '#2f4578'; x.lineWidth = 1; x.fillStyle = '#0e1a33';
  x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill(); x.stroke();
  [30, 60].forEach(a => { x.beginPath(); x.arc(cx, cy, (90 - a) / 90 * R, 0, 7); x.stroke(); });
  for (let a = 0; a < 360; a += 45) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(...P(0, a)); x.stroke(); }
  x.fillStyle = '#9fb0d6'; x.font = '600 13px Sarabun, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  [['น. (N)', 0], ['ออ. (E)', 90], ['ต. (S)', 180], ['ตก. (W)', 270]].forEach(([l, a]) => { const r = R + 14; x.fillText(l, cx + r * Math.sin(a * D2R), cy - r * Math.cos(a * D2R)); });
  x.font = '11px Sarabun, sans-serif'; x.fillText('30°', cx + 4, cy - (60 / 90) * R + 8); x.fillText('60°', cx + 4, cy - (30 / 90) * R + 8);
  const path = (dt, color, w, hours) => {
    x.strokeStyle = color; x.lineWidth = w; x.beginPath(); let on = false;
    for (let m = 0; m <= 1440; m += 4) {
      const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, m), p = sunPos(d);
      if (p.alt > 0) { const q = P(p.alt, p.az); on ? x.lineTo(...q) : x.moveTo(...q); on = true; } else on = false;
    }
    x.stroke();
    if (hours) { x.fillStyle = color; for (let h = 0; h < 24; h++) { const p = sunPos(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), h)); if (p.alt > 3) { const q = P(p.alt, p.az); x.beginPath(); x.arc(q[0], q[1], 3, 0, 7); x.fill(); x.fillText(String(h), q[0], q[1] - 10); } } }
  };
  path(new Date(S.y, 5, 21), '#ff7a59', 2); path(new Date(S.y, 2, 20), '#9be15d', 2); path(new Date(S.y, 11, 21), '#5ab0ff', 2);
  path(dayAt(0), '#ffd23f', 3.5, true);
  const s = sunPos(curDate()); if (s.alt > 0) { const q = P(s.alt, s.az); x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(q[0], q[1], 8, 0, 7); x.fill(); }
}

/* ---------- Milky Way view ---------- */
function drawNight() {
  const cv = $('nightCv'); if (!cv.clientWidth) return;
  const { x, W, H } = fitCanvas(cv), L0 = 34, T = 10, Bm = 26, w = W - L0 - 8, h = H - T - Bm;
  const t0 = dayAt(17).getTime(), span = 14 * 3600000, amin = -20, amax = 90;
  const X = t => L0 + (t - t0) / span * w, Y = a => T + (amax - a) / (amax - amin) * h;
  $('nightTitle').textContent = `มุมเงยตลอดคืน · ${thDate(dayAt(0))} → ${thDate(dayAt(0, 0, 1))}`;
  // dark shading
  x.fillStyle = '#22355c';
  let start = null;
  for (let i = 0; i <= 168; i++) { const t = t0 + i * 300000, dark = sunPos(new Date(t)).alt < -18; if (dark && start === null) start = t; if ((!dark || i === 168) && start !== null) { x.fillRect(X(start), T, X(t) - X(start), h); start = null; } }
  x.strokeStyle = '#2f4578'; x.fillStyle = '#9fb0d6'; x.font = '11px Sarabun, sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle';
  [0, 30, 60, 90].forEach(a => { x.lineWidth = a === 0 ? 1.5 : 1; x.beginPath(); x.moveTo(L0, Y(a)); x.lineTo(L0 + w, Y(a)); x.stroke(); x.fillText(a + '°', L0 - 4, Y(a)); });
  x.textAlign = 'center'; x.textBaseline = 'top';
  const step = W < 420 ? 4 : 2;
  for (let k = 0; k <= 14; k += step) { const t = t0 + k * 3600000; x.fillText(fmt(new Date(t)), X(t), T + h + 6); }
  const line = (f, color, wd) => { x.strokeStyle = color; x.lineWidth = wd; x.beginPath(); for (let i = 0; i <= 168; i++) { const t = t0 + i * 300000, a = Math.max(amin, f(new Date(t)).alt); i ? x.lineTo(X(t), Y(a)) : x.moveTo(X(t), Y(a)); } x.stroke(); };
  line(sunPos, '#ffd23f', 2.5); line(moonPos, '#bfe0ff', 2.5); line(corePos, '#c38bff', 3);
  const ct = curDate().getTime(); if (ct > t0 && ct < t0 + span) { x.strokeStyle = '#ffb84d'; x.lineWidth = 1.5; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(X(ct), T); x.lineTo(X(ct), T + h); x.stroke(); x.setLineDash([]); }
}
let mwCache = { key: '', html: '' };
function renderMW() {
  drawNight();
  const today = new Date(), key = `${S.lat.toFixed(2)},${S.lng.toFixed(2)},${today.toDateString()}`;
  if (mwCache.key === key) { $('mwList').innerHTML = mwCache.html; return; }
  const out = [];
  for (let n = 0; n < 90; n++) {
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n, 17).getTime();
    let first = null, last = null, mins = 0, best = null, bestAlt = -99, ill = 0;
    for (let i = 0; i <= 84; i++) {
      const d = new Date(base + i * 600000), s = sunPos(d); if (s.alt >= -18) continue;
      const g = corePos(d); if (g.alt <= 10) continue;
      const m = moonPos(d), f = illum(d).fraction; if (m.alt > 0 && f > 0.15) continue;
      if (!first) first = d; last = d; mins += 10; if (g.alt > bestAlt) { bestAlt = g.alt; best = d; ill = f; }
    }
    if (mins >= 30) out.push({ day: new Date(base), first, last: new Date(last.getTime() + 600000), mins, best, bestAlt, ill });
  }
  const html = out.length ? out.map(o => `<div class="mw-row" data-t="${o.best.getTime()}">
      <div class="d">${thDate(o.day)}<small>${o.day.getFullYear() + 543}</small></div>
      <div><div class="w">${fmt(o.first)}–${fmt(o.last)} · ${(o.mins / 60).toFixed(1)} ชม. · สูงสุด ${o.bestAlt.toFixed(0)}° (${fmt(o.best)})</div><div class="bar"><span style="width:${Math.min(100, o.mins / 480 * 100)}%"></span></div></div>
      <div class="m">จันทร์ ${(o.ill * 100).toFixed(0)}%</div></div>`).join('')
    : '<div class="empty">ช่วง 90 วันนี้ใจกลางทางช้างเผือกไม่ขึ้นในช่วงฟ้ามืด (ปกติในไทยจะเห็นช่วง ก.พ.–ต.ค.) ลองเลื่อนวันที่ในหน้าวางแผนไปช่วงนั้น</div>';
  mwCache = { key, html }; $('mwList').innerHTML = html;
}

/* ---------- calculators ---------- */
const CAMS = {
  xt4: { crop: 1.53, pitch: 3.76, w: 23.5, h: 15.6 }, apsc24: { crop: 1.5, pitch: 3.9, w: 23.5, h: 15.6 },
  ff24: { crop: 1, pitch: 5.95, w: 36, h: 24 }, ff45: { crop: 1, pitch: 4.35, w: 36, h: 24 }, mft: { crop: 2, pitch: 3.3, w: 17.3, h: 13 }
};
const v = id => parseFloat($(id).value) || 0;
const ln = (k, val) => `<div class="ln"><span>${k}</span><b>${val}</b></div>`;
const mfmt = mm => mm === Infinity ? '∞' : (mm / 1000 < 10 ? (mm / 1000).toFixed(2) : (mm / 1000).toFixed(1)) + ' ม.';
function calc() {
  const cam = CAMS[$('camSel').value]; store.set('cam', $('camSel').value);
  $('camInfo').textContent = `เซนเซอร์ ${cam.w}×${cam.h} มม. · ครอป ${cam.crop}× · ขนาดพิกเซล ${cam.pitch} µm`;
  // spot stars
  const f = v('sFocal'), N = v('sAp');
  if (f > 0 && N > 0) {
    const npf = (35 * N + 30 * cam.pitch) / f, r500 = 500 / (f * cam.crop);
    $('sOut').innerHTML = `<div class="big">${npf.toFixed(1)} วินาที</div>${ln('กฎ NPF (แม่นกว่า)', npf.toFixed(1) + ' s')}${ln('กฎ 500 (แบบเดิม)', r500.toFixed(1) + ' s')}${ln('ทางยาวโฟกัสเทียบ Full frame', (f * cam.crop).toFixed(0) + ' mm')}<p>ถ้าเปิดนานเกินค่านี้ ดาวจะเริ่มยืดเป็นเส้น · เริ่มลองที่ ISO 3200–6400 แล้วดูฮิสโตแกรม</p>`;
  }
  // DoF
  const fd = v('dFocal'), Nd = v('dAp'), s = v('dDist') * 1000, coc = 0.03 / cam.crop;
  if (fd > 0 && Nd > 0) {
    const Hm = fd * fd / (Nd * coc) + fd;
    const near = s > 0 ? s * (Hm - fd) / (Hm + s - 2 * fd) : 0, far = s > 0 && s < Hm ? s * (Hm - fd) / (Hm - s) : Infinity;
    $('dOut').innerHTML = `<div class="big">ไฮเปอร์โฟกัส ${mfmt(Hm)}</div>${ln('ชัดใกล้สุด', mfmt(near))}${ln('ชัดไกลสุด', mfmt(far))}${ln('ระยะชัดรวม', far === Infinity ? '∞' : mfmt(far - near))}${ln('ใกล้สุดเมื่อโฟกัสที่ไฮเปอร์โฟกัส', mfmt(Hm / 2))}<p>วงกลมความพร่ามัว (CoC) ${coc.toFixed(3)} มม.</p>`;
  }
  // FoV + moon
  const ff = v('fFocal'), D = v('fDist');
  if (ff > 0) {
    const fov = s2 => 2 * Math.atan(s2 / (2 * ff)) * R2D, moonMm = ff * Math.tan(0.52 * D2R);
    $('fOut').innerHTML = `<div class="big">${fov(cam.w).toFixed(1)}° × ${fov(cam.h).toFixed(1)}°</div>${ln('มุมทแยง', fov(Math.hypot(cam.w, cam.h)).toFixed(1) + '°')}${ln('ดวงจันทร์กว้างบนเซนเซอร์', moonMm.toFixed(2) + ' มม. (' + (moonMm / cam.w * 100).toFixed(1) + '% ของภาพ)')}${D > 0 ? ln(`วัตถุที่ระยะ ${D} ม. ต้องสูง`, (D * Math.tan(0.52 * D2R)).toFixed(1) + ' ม.') : ''}<p>บรรทัดสุดท้าย = ขนาดวัตถุที่จะดูเท่ากับดวงจันทร์ในภาพ ใช้วางแผนภาพจันทร์ดวงโตหลังสถานที่</p>`;
  }
  // timelapse
  const dur = v('tDur'), clip = v('tClip'), fps = v('tFps'), mb = v('tMb');
  if (dur > 0 && clip > 0 && fps > 0) {
    const frames = Math.ceil(clip * fps), iv = dur * 60 / frames;
    $('tOut').innerHTML = `<div class="big">ถ่ายทุก ${iv.toFixed(1)} วินาที</div>${ln('จำนวนภาพ', frames + ' ภาพ')}${ln('พื้นที่การ์ดโดยประมาณ', (frames * mb / 1024).toFixed(1) + ' GB')}<p>ความไวชัตเตอร์ควรสั้นกว่าช่วงห่างอย่างน้อย 1–2 วินาที</p>`;
  }
}

/* ---------- AR ---------- */
const AR = { on: false, o: null, f: null, u: null, r: null, paths: null, key: '', show: store.get('arShow', { sky: true, lines: true, paths: true }) };
function arPaths() {
  const key = `${S.y}-${S.mo}-${S.d},${S.lat.toFixed(3)},${S.lng.toFixed(3)}`; if (AR.key === key) return; AR.key = key;
  const mk = (fn, from, to) => { const a = []; for (let m = from; m <= to; m += 10) { const d = dayAt(0, m), p = fn(d); a.push({ ...p, h: m % 60 === 0 ? d.getHours() : null }); } return a; };
  AR.paths = { sun: mk(sunPos, 0, 1440), moon: mk(moonPos, 0, 1440), core: mk(corePos, 17 * 60, 31 * 60) };
}
const vec = (alt, az) => [Math.cos(alt * D2R) * Math.sin(az * D2R), Math.cos(alt * D2R) * Math.cos(az * D2R), Math.sin(alt * D2R)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a, b, k) => { if (!a) return b; const r = a.map((x, i) => x + (b[i] - x) * k), n = Math.hypot(...r); return r.map(x => x / n); };
function onOri(e) {
  let a = e.alpha; if (e.webkitCompassHeading != null) a = 360 - e.webkitCompassHeading;
  if (a == null || e.beta == null) return;
  AR.o = { a, b: e.beta, g: e.gamma, abs: e.absolute || e.webkitCompassHeading != null };
}
function arFrame() {
  if (!AR.on) return; requestAnimationFrame(arFrame);
  const cv = $('arCv'), { x, W, H } = fitCanvas(cv);
  if (!AR.o) { $('arHud').textContent = 'ยังไม่ได้รับข้อมูลเข็มทิศ — มือถือนี้อาจไม่มีเซนเซอร์ หรือยังไม่ได้อนุญาต'; return; }
  const cal = v('arCal'), a = (AR.o.a - cal) * D2R, b = AR.o.b * D2R, g = AR.o.g * D2R;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
  const r = [ca * cg - sa * sb * sg, sa * cg + ca * sb * sg, -cb * sg];
  const u = [-sa * cb, ca * cb, sb];
  const f = [-(ca * sg + sa * sb * cg), -(sa * sg - ca * sb * cg), -(cb * cg)];
  AR.f = lerp(AR.f, f, 0.25); AR.u = lerp(AR.u, u, 0.25); AR.r = lerp(AR.r, r, 0.25);
  const th = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * D2R;
  const right = AR.r.map((q, i) => Math.cos(th) * q - Math.sin(th) * AR.u[i]);
  const up = AR.r.map((q, i) => Math.sin(th) * q + Math.cos(th) * AR.u[i]);
  const fov = v('arFov') * D2R, fp = (W / 2) / Math.tan(fov / 2);
  const proj = (alt, az) => { const t = vec(alt, az), z = dot(t, AR.f); if (z < 0.05) return null; return [W / 2 + dot(t, right) / z * fp, H / 2 - dot(t, up) / z * fp]; };
  const poly = (pts, color, w, dash) => { x.strokeStyle = color; x.lineWidth = w; x.setLineDash(dash || []); x.beginPath(); let on = false; pts.forEach(p => { const q = proj(p.alt, p.az); if (q && Math.abs(q[0]) < W * 3 && Math.abs(q[1]) < H * 3) { on ? x.lineTo(...q) : x.moveTo(...q); on = true; } else on = false; }); x.stroke(); x.setLineDash([]); };
  const d = curDate();
  if ((AR.show.sky || AR.show.lines) && Sky.ready) Sky.render(x, { W, H, f: AR.f, r: right, u: up, fp, proj: 'gno' }, { mode: 'ar', date: d, lat: S.lat, lng: S.lng, show: { sky: AR.show.sky, lines: AR.show.lines, names: AR.show.sky }, fast: true });
  // horizon + compass
  const hz = []; for (let z = 0; z <= 360; z += 2) hz.push({ alt: 0, az: z }); poly(hz, '#ffffffaa', 2);
  x.font = '600 14px Sarabun, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'bottom';
  for (let z = 0; z < 360; z += 15) { const q = proj(0, z); if (!q) continue; x.fillStyle = '#fff'; x.fillRect(q[0] - 1, q[1] - (z % 45 ? 6 : 12), 2, z % 45 ? 6 : 12); if (z % 45 === 0) x.fillText(DIRS[z / 22.5] + ' ' + z + '°', q[0], q[1] - 14); }
  arPaths();
  const P = AR.paths, labels = (pts, color) => { x.fillStyle = color; x.font = '600 13px Sarabun, sans-serif'; pts.forEach(p => { if (p.h == null || p.alt < -2) return; const q = proj(p.alt, p.az); if (q) { x.beginPath(); x.arc(q[0], q[1], 3.5, 0, 7); x.fill(); x.fillText(String(p.h).padStart(2, '0') + ':00', q[0], q[1] - 6); } }); };
  if (AR.show.paths) {
    poly(P.sun.filter(p => p.alt > -8), '#ffd23f', 3); labels(P.sun, '#ffd23f');
    poly(P.moon.filter(p => p.alt > -8), '#bfe0ff', 2.5, [8, 6]); labels(P.moon, '#bfe0ff');
    poly(P.core.filter(p => p.alt > -8), '#c38bff', 3); labels(P.core, '#c38bff');
  }
  const dotAt = (p, color, rad, txt) => { const q = proj(p.alt, p.az); if (!q) return; x.fillStyle = color; if (rad) { x.beginPath(); x.arc(q[0], q[1], rad, 0, 7); x.fill(); } x.fillStyle = '#fff'; x.fillText(txt, q[0], q[1] - Math.max(rad, 12) - 4); };
  dotAt(sunPos(d), '#ffd23f', 14, 'ดวงอาทิตย์ ' + fmt(d)); dotAt(moonPos(d), '#bfe0ff', AR.show.sky ? 0 : 11, 'ดวงจันทร์');
  dotAt(corePos(d), '#c38bff', AR.show.sky ? 0 : 9, 'ใจกลางทางช้างเผือก');
  // center reticle + HUD
  x.strokeStyle = '#ffb84d'; x.lineWidth = 2; x.beginPath(); x.arc(W / 2, H / 2, 10, 0, 7); x.stroke();
  const head = (Math.atan2(AR.f[0], AR.f[1]) * R2D + 360) % 360, elev = Math.asin(Math.max(-1, Math.min(1, AR.f[2]))) * R2D;
  $('arHud').textContent = `กล้องหันไป ${head.toFixed(0)}° (${dirTh(head)}) · เงย ${elev.toFixed(0)}° · ${thDate(d)} ${fmt(d)}${AR.o.abs ? '' : ' · ⚠ เข็มทิศอาจไม่อ้างอิงทิศเหนือจริง'}`;
}
async function arStart() {
  if (AR.on) { arStop(); return; }
  if (!window.isSecureContext) { $('arHud').textContent = 'AR ต้องเปิดผ่าน https:// เท่านั้น'; return; }
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission();
  } catch (e) {}
  if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOri);
  else window.addEventListener('deviceorientation', onOri);
  try {
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    $('arVideo').srcObject = st;
  } catch (e) { $('arHud').textContent = 'เปิดกล้องไม่ได้ — ตรวจสิทธิ์กล้องของเบราว์เซอร์ (ยังแสดงเส้นทางบนพื้นดำได้)'; }
  AR.on = true; $('arStart').textContent = 'ปิดกล้อง AR'; arFrame();
}
function arStop() {
  AR.on = false; $('arStart').textContent = 'เปิดกล้อง AR';
  const st = $('arVideo').srcObject; if (st) st.getTracks().forEach(t => t.stop()); $('arVideo').srcObject = null;
  window.removeEventListener('deviceorientationabsolute', onOri); window.removeEventListener('deviceorientation', onOri);
}

/* ---------- จำลองฟ้า ---------- */
const SIM = { az: store.get('simAz', 180), alt: 25, fov: store.get('simFov', 100), show: store.get('simShow', { lines: true, names: true, ground: true, paths: false, frame: false }), lens: 16, portrait: false, playing: false, dirty: true, loop: false, msg: '' };
const cl = (x, a, b) => Math.max(a, Math.min(b, x));
function simDraw() {
  const cv = $('simCv'); if (!cv.clientWidth) return;
  const { x, W, H } = fitCanvas(cv), d = curDate();
  $('simTime').textContent = fmt(d); $('simT').value = S.min;
  if (!Sky.ready) { x.fillStyle = '#03050c'; x.fillRect(0, 0, W, H); return; }
  const cam = Sky.camera(W, H, SIM.az, SIM.alt, SIM.fov, 'stereo');
  const r = Sky.render(x, cam, { mode: 'sim', date: d, lat: S.lat, lng: S.lng, show: SIM.show, fast: SIM.playing || SIM.drag });
  if (SIM.show.paths) { arPaths(); const P = AR.paths; Sky.drawPath(x, cam, P.sun, '#ffd23f', 2.5, null, true); Sky.drawPath(x, cam, P.moon, '#bfe0ff', 2, [7, 6], true); Sky.drawPath(x, cam, P.core, '#c38bff', 2.5, null, true); }
  Sky.drawCompass(x, cam, SIM.show.ground);
  let fr = '';
  if (SIM.show.frame) {
    const cm = CAMS[$('camSel').value] || CAMS.xt4, res = Sky.drawFrame(x, cam, cm.w, cm.h, SIM.lens, SIM.portrait);
    fr = res ? `มุมรับภาพ ${res[0].toFixed(0)}°×${res[1].toFixed(0)}°` : 'กรอบใหญ่เกินจอ ซูมออกก่อน';
  }
  $('simFr').textContent = fr;
  const vis = r.lim < 0 ? 'ยังมองไม่เห็นดาว' : `เห็นดาวสว่างถึงแมกนิจูด ~${Math.max(0, r.lim).toFixed(1)}`;
  $('simInfo').innerHTML = `<b>${thDate(d)} ${fmt(d)}</b> · ${lightPhase(r.sunAlt)} · ${vis}<br>หันไป ${((SIM.az % 360) + 360) % 360 | 0}° (${dirTh(((SIM.az % 360) + 360) % 360)}) · เงย ${SIM.alt.toFixed(0)}° · มุมมอง ${SIM.fov.toFixed(0)}°${SIM.msg ? ' · ' + SIM.msg : ''}`;
}
function simLoop() {
  if (view !== 'v-sim') { SIM.loop = false; return; }
  SIM.loop = true; requestAnimationFrame(simLoop);
  if (SIM.playing) { S.min += 2; if (S.min >= 1440) { S.min -= 1440; setDate(new Date(S.y, S.mo, S.d + 1, 0, S.min)); } SIM.dirty = true; }
  if (SIM.dirty) { SIM.dirty = false; simDraw(); }
}
const simKick = () => { SIM.dirty = true; if (!SIM.loop && view === 'v-sim') simLoop(); };
{
  const cv = $('simCv'), pts = new Map(); let pinch = 0;
  cv.addEventListener('pointerdown', e => { SIM.drag = true; cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { const k = SIM.fov / cv.clientWidth; SIM.az -= (e.clientX - prev[0]) * k; SIM.alt = cl(SIM.alt + (e.clientY - prev[1]) * k, -20, 90); }
    else if (pts.size === 2) { const [a, b] = [...pts.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) SIM.fov = cl(SIM.fov * pinch / dd, 3, 160); pinch = dd; }
    SIM.msg = ''; simKick();
  });
  const up = e => { pts.delete(e.pointerId); pinch = 0; if (!pts.size) { SIM.drag = false; simKick(); } store.set('simAz', SIM.az); store.set('simFov', SIM.fov); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); SIM.fov = cl(SIM.fov * (1 + e.deltaY * 0.001), 3, 160); simKick(); }, { passive: false });
}
document.querySelectorAll('#simChips button[data-k]').forEach(b => { b.classList.toggle('on', !!SIM.show[b.dataset.k]); });
$('frameRow').hidden = !SIM.show.frame;
$('simChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.k) { const k = b.dataset.k; SIM.show[k] = !SIM.show[k]; b.classList.toggle('on', SIM.show[k]); store.set('simShow', SIM.show); if (k === 'frame') $('frameRow').hidden = !SIM.show.frame; }
  if (b.dataset.go) {
    const d = curDate(), g = b.dataset.go, p = g === 'sun' ? sunPos(d) : g === 'moon' ? moonPos(d) : g === 'core' ? corePos(d) : { az: g === 'north' ? 0 : 180, alt: 20 };
    SIM.az = p.az; SIM.alt = cl(p.alt, 10, 85);
    SIM.msg = p.alt < 0 ? `<span style="color:#ff9a8a">ตอนนี้อยู่ใต้ขอบฟ้า ${(-p.alt).toFixed(0)}°</span>` : '';
  }
  simKick();
});
$('simT').addEventListener('input', e => { S.min = +e.target.value; simKick(); });
$('simPlay').onclick = () => { SIM.playing = !SIM.playing; if (!SIM.playing) SIM.dirty = true; $('simPlay').textContent = SIM.playing ? '❚❚' : '▶'; simKick(); };
$('simPrev').onclick = () => { setDate(new Date(S.y, S.mo, S.d - 1, 0, S.min)); simKick(); };
$('simNext').onclick = () => { setDate(new Date(S.y, S.mo, S.d + 1, 0, S.min)); simKick(); };
$('simLens').onchange = e => { SIM.lens = +e.target.value; simKick(); };
$('simOrient').onclick = () => { SIM.portrait = !SIM.portrait; $('simOrient').textContent = SIM.portrait ? 'แนวตั้ง' : 'แนวนอน'; simKick(); };
document.querySelectorAll('#arChips button').forEach(b => b.classList.toggle('on', !!AR.show[b.dataset.a]));
$('arChips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.a; AR.show[k] = !AR.show[k]; b.classList.toggle('on', AR.show[k]); store.set('arShow', AR.show); });
Sky.load().then(simKick).catch(() => { $('simInfo').textContent = 'โหลดข้อมูลดาวไม่สำเร็จ'; });

/* ---------- modal ---------- */
function ask(title, fields) {
  return new Promise(res => {
    $('mTitle').textContent = title;
    $('mBody').innerHTML = fields.map(f => `<label>${f.label}<input type="${f.type || 'text'}" id="mf_${f.id}" value="${esc(f.value || '')}" ${f.type === 'number' ? 'step="any" inputmode="decimal"' : ''}></label>`).join('');
    $('modal').hidden = false; const first = $('mf_' + fields[0].id); setTimeout(() => first.focus(), 50);
    const done = okk => { $('modal').hidden = true; $('mOk').onclick = $('mCancel').onclick = null; res(okk ? Object.fromEntries(fields.map(f => [f.id, $('mf_' + f.id).value])) : null); };
    $('mOk').onclick = () => done(true); $('mCancel').onclick = () => done(false);
  });
}

/* ---------- wiring ---------- */
let view = 'v-plan', locDirty = true;
function refresh() {
  renderPlan();
  if (view === 'v-times') renderTimes();
  if (view === 'v-mw') renderMW();
  if (view === 'v-sim') simKick();
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  view = b.dataset.v;
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('active', x.id === view));
  if (view !== 'v-ar' && AR.on) arStop();
  if (view === 'v-plan') setTimeout(() => map.invalidateSize(), 50);
  refresh();
}));
$('timeIn').addEventListener('input', e => { S.min = +e.target.value; renderPlan(); });
$('dateIn').addEventListener('change', e => { const [y, m, d] = e.target.value.split('-').map(Number); if (y) { S.y = y; S.mo = m - 1; S.d = d; refresh(); } });
$('dPrev').onclick = () => { setDate(new Date(S.y, S.mo, S.d - 1, 0, S.min)); refresh(); };
$('dNext').onclick = () => { setDate(new Date(S.y, S.mo, S.d + 1, 0, S.min)); refresh(); };
$('nowBtn').onclick = () => { setDate(new Date()); refresh(); };
$('redBtn').onclick = () => { document.body.classList.toggle('red'); store.set('red', document.body.classList.contains('red')); };
if (store.get('red', false)) document.body.classList.add('red');
$('gpsBtn').onclick = () => {
  if (!navigator.geolocation) return;
  $('locLabel').textContent = 'กำลังหาตำแหน่ง…';
  navigator.geolocation.getCurrentPosition(p => moveTo(p.coords.latitude, p.coords.longitude, 'ตำแหน่งของฉัน', true),
    () => { $('locLabel').textContent = 'หาตำแหน่งไม่ได้ — ตรวจสิทธิ์ตำแหน่ง'; }, { enableHighAccuracy: true, timeout: 15000 });
};
$('saveBtn').onclick = async () => {
  const r = await ask('บันทึกจุดถ่ายภาพ', [{ id: 'name', label: 'ชื่อสถานที่', value: '' }]);
  if (r && r.name.trim()) { places.push({ name: r.name.trim(), lat: S.lat, lng: S.lng }); store.set('places', places); S.name = r.name.trim(); store.set('name', S.name); renderPlaces(); renderPlan(); }
};
$('coordBtn').onclick = async () => {
  const r = await ask('ไปที่พิกัด', [{ id: 'lat', label: 'ละติจูด (เช่น 18.7883)', value: S.lat.toFixed(5), type: 'number' }, { id: 'lng', label: 'ลองจิจูด (เช่น 98.9853)', value: S.lng.toFixed(5), type: 'number' }]);
  if (r && isFinite(+r.lat) && isFinite(+r.lng) && Math.abs(+r.lat) <= 90) moveTo(+r.lat, +r.lng, null, true);
};
$('placeChips').addEventListener('click', e => {
  const del = e.target.dataset.del;
  if (del != null) { places.splice(+del, 1); store.set('places', places); renderPlaces(); return; }
  const b = e.target.closest('button'); if (!b) return; const p = places[+b.dataset.i]; moveTo(p.lat, p.lng, p.name, true);
});
$('mwList').addEventListener('click', e => {
  const row = e.target.closest('.mw-row'); if (!row) return;
  setDate(new Date(+row.dataset.t)); document.querySelector('.tabs button[data-v="v-plan"]').click();
});
['camSel', 'sFocal', 'sAp', 'dFocal', 'dAp', 'dDist', 'fFocal', 'fDist', 'tDur', 'tClip', 'tFps', 'tMb'].forEach(id => $(id).addEventListener('input', calc));
$('camSel').value = store.get('cam', 'xt4');
$('arStart').onclick = arStart;
$('arFov').oninput = e => $('arFovOut').textContent = e.target.value + '°';
$('arCal').oninput = e => $('arCalOut').textContent = e.target.value + '°';
window.addEventListener('resize', () => { if (view === 'v-times') drawSky(); if (view === 'v-mw') drawNight(); if (view === 'v-sim') simKick(); });

renderPlaces(); calc(); refresh();
if (!store.get('lat', null) && navigator.geolocation) $('gpsBtn').click();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
