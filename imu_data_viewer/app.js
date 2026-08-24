"use strict";

const $ = (id) => document.getElementById(id);
const AXIS_COLORS = ["#45d7ff", "#ff9f43", "#43e6a0"];
const FILTER_COLORS = ["#35f2ff", "#ffc166", "#60f7ae"];
let dataset = null;
let filtered = null;
let viewStart = 0;
let viewEnd = 0;
let cursorIndex = 0;
let playing = false;
let playbackFrame = 0;
let playbackLastTime = 0;
let gpsMap = null;
let gpsTrack = null;
let gpsMarker = null;
let gpsHasFitted = false;

const charts = [
  { canvas: $("accelChart"), keys: ["ax", "ay", "az"], labels: ["X", "Y", "Z"] },
  { canvas: $("gyroChart"), keys: ["gx", "gy", "gz"], labels: ["X", "Y", "Z"] },
  { canvas: $("magnitudeChart"), keys: ["mag"], labels: ["Vector"] },
];

$("fileInput").addEventListener("change", (event) => loadFile(event.target.files[0]));
$("dropZone").addEventListener("dragover", (event) => { event.preventDefault(); $("dropZone").classList.add("drag"); });
$("dropZone").addEventListener("dragleave", () => $("dropZone").classList.remove("drag"));
$("dropZone").addEventListener("drop", (event) => {
  event.preventDefault();
  $("dropZone").classList.remove("drag");
  loadFile(event.dataTransfer.files[0]);
});

for (const id of ["showRaw", "showFiltered"]) $(id).addEventListener("change", render);
$("filterMode").addEventListener("change", () => { if (dataset) { buildFiltered(); render(); } });
$("applyRange").addEventListener("click", () => {
  if (!dataset) return;
  viewStart = Math.max(dataset.start, Number($("startTime").value));
  viewEnd = Math.min(dataset.end, Number($("endTime").value));
  if (viewEnd <= viewStart) viewEnd = Math.min(dataset.end, viewStart + 1);
  render();
});
$("resetRange").addEventListener("click", () => { if (dataset) setRange(dataset.start, dataset.end); });
$("timeCursor").addEventListener("input", () => { cursorIndex = Number($("timeCursor").value); drawDynamics(); });
$("gUseFiltered").addEventListener("change", drawDynamics);
$("playButton").addEventListener("click", togglePlayback);
window.addEventListener("resize", debounce(render, 100));

async function loadFile(file) {
  if (!file) return;
  showLoading(`0 / ${(file.size / 1048576).toFixed(1)} MB`);
  try {
    const text = await file.text();
    await nextFrame();
    dataset = parseCSV(text);
    dataset.name = file.name;
    buildFiltered();
    updateSummary();
    setRange(dataset.start, dataset.end);
  } catch (error) {
    alert(`CSV를 읽을 수 없습니다.\n${error.message}`);
    console.error(error);
  } finally {
    hideLoading();
  }
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV 데이터가 비어 있습니다.");
  const header = lines[0].split(",");
  const col = Object.fromEntries(header.map((name, index) => [name.trim(), index]));
  const required = ["timestamp_us", "imu_sample_timestamp_us", "imu_accel_x_milli_g", "imu_accel_y_milli_g", "imu_accel_z_milli_g", "imu_gyro_x_deci_dps", "imu_gyro_y_deci_dps", "imu_gyro_z_deci_dps"];
  for (const key of required) if (col[key] == null) throw new Error(`필수 열이 없습니다: ${key}`);

  const data = { t: [], imuT: [], ax: [], ay: [], az: [], gx: [], gy: [], gz: [], battery: [], gpsLat: [], gpsLon: [], gpsSpeed: [], gpsSat: [], gpsQual: [], gpsTime: [], intervals: new Map(), errors: 0 };
  let previousImuTimestamp = -1;
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(",");
    const imuTimestamp = Number(fields[col.imu_sample_timestamp_us]);
    if (!imuTimestamp || imuTimestamp === previousImuTimestamp) continue;
    if (previousImuTimestamp > 0) {
      const delta = imuTimestamp - previousImuTimestamp;
      data.intervals.set(delta, (data.intervals.get(delta) || 0) + 1);
    }
    previousImuTimestamp = imuTimestamp;
    data.t.push(Number(fields[col.timestamp_us]));
    data.imuT.push(imuTimestamp);
    data.ax.push(Number(fields[col.imu_accel_x_milli_g]) / 1000);
    data.ay.push(Number(fields[col.imu_accel_y_milli_g]) / 1000);
    data.az.push(Number(fields[col.imu_accel_z_milli_g]) / 1000);
    data.gx.push(Number(fields[col.imu_gyro_x_deci_dps]) / 10);
    data.gy.push(Number(fields[col.imu_gyro_y_deci_dps]) / 10);
    data.gz.push(Number(fields[col.imu_gyro_z_deci_dps]) / 10);
    if (col.imu_battery_pct != null) data.battery.push(Number(fields[col.imu_battery_pct]));
    const quality = col.gps_qual != null ? Number(fields[col.gps_qual]) || 0 : 0;
    data.gpsQual.push(quality);
    data.gpsLat.push(quality > 0 ? nmeaToDecimal(fields[col.gps_lat], false) : NaN);
    data.gpsLon.push(quality > 0 ? nmeaToDecimal(fields[col.gps_lon], true) : NaN);
    data.gpsSpeed.push(col.gps_speed_kmh != null ? Number(fields[col.gps_speed_kmh]) || 0 : 0);
    data.gpsSat.push(col.gps_sat != null ? Number(fields[col.gps_sat]) || 0 : 0);
    data.gpsTime.push(col.gps_time != null ? fields[col.gps_time] : "00:00:00.00");
  }
  const last = lines.at(-1).split(",");
  for (const key of ["imu_checksum_error_count", "imu_uart_error_count", "imu_uart_parity_error_count", "imu_uart_noise_error_count", "imu_uart_framing_error_count", "imu_uart_overrun_error_count", "imu_uart_dma_error_count"]) {
    if (col[key] != null) data.errors += Number(last[col[key]]) || 0;
  }
  data.start = data.t[0];
  data.end = data.t.at(-1);
  data.mag = data.ax.map((x, i) => Math.hypot(x, data.ay[i], data.az[i]));
  if (!data.t.length) throw new Error("유효한 IMU 샘플을 찾지 못했습니다.");
  return data;
}

function nmeaToDecimal(value, longitude) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw === 0) return NaN;
  const degrees = Math.floor(raw / 100);
  const minutes = raw - degrees * 100;
  const result = degrees + minutes / 60;
  if ((longitude && (degrees < 100 || degrees > 180)) || (!longitude && degrees > 90)) return NaN;
  return result;
}

function buildFiltered() {
  const mode = $("filterMode").value;
  filtered = { t: dataset.t, imuT: dataset.imuT };
  for (const key of ["ax", "ay", "az", "gx", "gy", "gz"]) filtered[key] = applyFilter(dataset[key], mode);
  filtered.mag = filtered.ax.map((x, i) => Math.hypot(x, filtered.ay[i], filtered.az[i]));
}

function applyFilter(values, mode) {
  if (mode === "median3") return median3(values);
  if (mode === "ma5") return movingAverage(values, 5);
  if (mode === "butter10") return zeroPhaseButterworth(values, 10);
  if (mode === "median_butter5") return zeroPhaseButterworth(median3(values), 5);
  return zeroPhaseButterworth(values, 5);
}

function median3(values) {
  return values.map((value, i) => {
    const trio = [values[Math.max(0, i - 1)], value, values[Math.min(values.length - 1, i + 1)]];
    trio.sort((a, b) => a - b);
    return trio[1];
  });
}

function movingAverage(values, width) {
  const half = Math.floor(width / 2);
  const output = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    for (let j = -half; j <= half; j++) sum += values[Math.max(0, Math.min(values.length - 1, i + j))];
    output[i] = sum / width;
  }
  return output;
}

function zeroPhaseButterworth(values, cutoffHz) {
  const sampleRate = 50;
  const k = Math.tan(Math.PI * cutoffHz / sampleRate);
  const norm = 1 / (1 + Math.SQRT2 * k + k * k);
  const c = { b0: k * k * norm, b1: 2 * k * k * norm, b2: k * k * norm, a1: 2 * (k * k - 1) * norm, a2: (1 - Math.SQRT2 * k + k * k) * norm };
  const pass = (input) => {
    const output = new Array(input.length);
    let x1 = input[0], x2 = input[0], y1 = input[0], y2 = input[0];
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      output[i] = y;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
    }
    return output;
  };
  return pass(pass(values).reverse()).reverse();
}

function updateSummary() {
  $("fileName").textContent = dataset.name;
  $("sampleCount").textContent = dataset.t.length.toLocaleString("ko-KR");
  $("duration").textContent = `${(dataset.end - dataset.start).toFixed(2)}초`;
  const intervalText = [...dataset.intervals.entries()].sort((a, b) => a[0] - b[0]).map(([us, count]) => `${us / 1000}ms ${count.toLocaleString()}회`).join(" · ");
  $("sampleInterval").textContent = intervalText || "-";
  $("errorCount").textContent = `${dataset.errors.toLocaleString()}회`;
  const battery = dataset.battery.filter((x) => x > 0);
  $("batteryRange").textContent = battery.length ? `${Math.min(...battery)}~${Math.max(...battery)}%` : "-";
  $("timeCursor").max = Math.max(0, dataset.t.length - 1);
  $("timeCursor").value = 0;
  $("timelineStart").textContent = `${dataset.start.toFixed(2)}s`;
  $("timelineEnd").textContent = `${dataset.end.toFixed(2)}s`;
  cursorIndex = 0;
  buildGpsMap();
}

function setRange(start, end) {
  viewStart = start; viewEnd = end;
  $("startTime").value = start.toFixed(2);
  $("endTime").value = end.toFixed(2);
  $("startTime").max = dataset.end;
  $("endTime").max = dataset.end;
  render();
}

function render() {
  if (!dataset) return;
  const bounds = visibleIndices(dataset.t, viewStart, viewEnd);
  updateStats(bounds);
  for (const chart of charts) drawChart(chart, bounds);
  drawDynamics();
}

function togglePlayback() {
  if (!dataset) return;
  playing = !playing;
  $("playButton").textContent = playing ? "Ⅱ 정지" : "▶ 재생";
  if (playing) {
    if (cursorIndex >= dataset.t.length - 1) cursorIndex = 0;
    playbackLastTime = performance.now();
    playbackFrame = requestAnimationFrame(playbackStep);
  } else cancelAnimationFrame(playbackFrame);
}

function playbackStep(now) {
  if (!playing || !dataset) return;
  const speed = Number($("playbackSpeed").value);
  const elapsed = (now - playbackLastTime) / 1000 * speed;
  playbackLastTime = now;
  const targetTime = dataset.t[cursorIndex] + elapsed;
  cursorIndex = Math.min(dataset.t.length - 1, binarySearch(dataset.t, targetTime));
  $("timeCursor").value = cursorIndex;
  drawDynamics();
  if (cursorIndex >= dataset.t.length - 1) togglePlayback();
  else playbackFrame = requestAnimationFrame(playbackStep);
}

function drawDynamics() {
  if (!dataset || !filtered) return;
  cursorIndex = Math.max(0, Math.min(dataset.t.length - 1, cursorIndex));
  const source = $("gUseFiltered").checked ? filtered : dataset;
  const ax = source.ax[cursorIndex], ay = source.ay[cursorIndex], az = source.az[cursorIndex], gz = source.gz[cursorIndex];
  $("cursorTime").textContent = `${dataset.t[cursorIndex].toFixed(2)} s`;
  $("liveAx").textContent = `${signed(ax, 2)} g`;
  $("liveAy").textContent = `${signed(ay, 2)} g`;
  $("liveAxy").textContent = `${Math.hypot(ax, ay).toFixed(2)} g`;
  $("liveAz").textContent = `${signed(az, 2)} g`;
  $("liveGz").textContent = `${signed(gz, 1)} °/s`;
  drawGBall(source, cursorIndex);
  drawArcGauge($("verticalGauge"), az, 3, "#43e6a0", "-3g", "+3g");
  drawArcGauge($("yawGauge"), gz, 100, "#ff9f43", "-100", "+100");
  updateGpsPosition(ax, ay);
}

function buildGpsMap() {
  gpsHasFitted = false;
  if (!window.L) {
    $("gpsMap").innerHTML = '<div class="map-placeholder">인터넷 연결이 없어 지도 타일을 불러오지 못했습니다.<br>좌표와 GPS 값은 오른쪽에서 확인할 수 있습니다.</div>';
    return;
  }
  if (!gpsMap) {
    $("gpsMap").innerHTML = "";
    gpsMap = L.map("gpsMap", { preferCanvas: true, zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(gpsMap);
  }
  if (gpsTrack) gpsTrack.remove();
  if (gpsMarker) gpsMarker.remove();
  const points = [];
  let previousLat = NaN, previousLon = NaN;
  for (let i = 0; i < dataset.t.length; i++) {
    const lat = dataset.gpsLat[i], lon = dataset.gpsLon[i];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat === previousLat && lon === previousLon) continue;
    points.push([lat, lon]); previousLat = lat; previousLon = lon;
  }
  if (points.length) {
    gpsTrack = L.polyline(points, { color: "#45d7ff", weight: 3, opacity: .82 }).addTo(gpsMap);
    gpsMap.fitBounds(gpsTrack.getBounds(), { padding: [28, 28] });
    gpsHasFitted = true;
    gpsMarker = L.circleMarker(points[0], { radius: 8, color: "#fff", weight: 2, fillColor: "#45d7ff", fillOpacity: 1, className: "gps-current-marker" }).addTo(gpsMap);
  } else {
    gpsMap.setView([37.5, 127.0], 8);
  }
  setTimeout(() => gpsMap.invalidateSize(), 0);
}

function updateGpsPosition(ax, ay) {
  const lat = dataset.gpsLat[cursorIndex], lon = dataset.gpsLon[cursorIndex];
  const fixed = Number.isFinite(lat) && Number.isFinite(lon) && dataset.gpsQual[cursorIndex] > 0;
  $("mapElapsed").textContent = `${dataset.t[cursorIndex].toFixed(2)}초`;
  $("mapGpsTime").textContent = `GPS ${dataset.gpsTime[cursorIndex] || "00:00:00.00"}`;
  $("mapSpeed").textContent = `${dataset.gpsSpeed[cursorIndex].toFixed(1)} km/h`;
  $("mapSat").textContent = `${dataset.gpsSat[cursorIndex]} / ${dataset.gpsQual[cursorIndex]}`;
  $("mapImu").textContent = `X ${signed(ax, 2)} · Y ${signed(ay, 2)} g`;
  $("mapPosition").textContent = fixed ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : "FIX 없음";
  if (fixed && gpsMap && gpsMarker) {
    gpsMarker.setStyle({ opacity: 1, fillOpacity: 1 });
    gpsMarker.setLatLng([lat, lon]);
    if (!gpsHasFitted) { gpsMap.setView([lat, lon], 16); gpsHasFitted = true; }
  } else if (gpsMarker) {
    gpsMarker.setStyle({ opacity: 0, fillOpacity: 0 });
  }
}

function drawGBall(source, index) {
  const canvas = $("gBall"), dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  canvas.width = width * dpr; canvas.height = height * dpr;
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = width / 2, cy = height / 2, radius = Math.min(width, height) * .41, limit = 2;
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 1;
  for (let g = .5; g <= 2; g += .5) {
    ctx.strokeStyle = g === 2 ? "#58708d" : "#263b51";
    ctx.beginPath(); ctx.arc(cx, cy, radius * g / limit, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#6f8299"; ctx.font = "10px ui-monospace, monospace"; ctx.fillText(`${g.toFixed(1)}g`, cx + 4, cy - radius * g / limit + 12);
  }
  ctx.strokeStyle = "#58708d"; ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius); ctx.stroke();
  ctx.fillStyle = "#7e91a8"; ctx.font = "700 11px ui-sans-serif";
  ctx.textAlign = "center"; ctx.fillText("ACCEL", cx, cy - radius - 9); ctx.fillText("BRAKE", cx, cy + radius + 17);
  ctx.textAlign = "left"; ctx.fillText("LEFT", cx + radius + 7, cy + 4); ctx.textAlign = "right"; ctx.fillText("RIGHT", cx - radius - 7, cy + 4);

  const trailStart = Math.max(0, index - 100);
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2;
  for (let i = trailStart + 1; i <= index; i++) {
    const alpha = .05 + .55 * (i - trailStart) / Math.max(1, index - trailStart);
    const x1 = cx + clamp(source.ay[i - 1], -limit, limit) / limit * radius;
    const y1 = cy - clamp(source.ax[i - 1], -limit, limit) / limit * radius;
    const x2 = cx + clamp(source.ay[i], -limit, limit) / limit * radius;
    const y2 = cy - clamp(source.ax[i], -limit, limit) / limit * radius;
    ctx.strokeStyle = `rgba(69,215,255,${alpha})`; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  const px = cx + clamp(source.ay[index], -limit, limit) / limit * radius;
  const py = cy - clamp(source.ax[index], -limit, limit) / limit * radius;
  const gradient = ctx.createRadialGradient(px, py, 1, px, py, 20); gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(.25, "#45d7ff"); gradient.addColorStop(1, "rgba(69,215,255,0)");
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(px, py, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = "start";
}

function drawArcGauge(canvas, value, limit, color, minLabel, maxLabel) {
  const dpr = window.devicePixelRatio || 1, width = canvas.clientWidth, height = canvas.clientHeight;
  canvas.width = width * dpr; canvas.height = height * dpr;
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = width / 2, cy = height * .82, radius = Math.min(width * .35, height * .68), start = Math.PI * 1.15, end = Math.PI * 1.85;
  ctx.clearRect(0, 0, width, height); ctx.lineCap = "round";
  ctx.strokeStyle = "#26384d"; ctx.lineWidth = 13; ctx.beginPath(); ctx.arc(cx, cy, radius, start, end); ctx.stroke();
  const ratio = (clamp(value, -limit, limit) + limit) / (2 * limit);
  const angle = start + (end - start) * ratio;
  ctx.strokeStyle = color; ctx.lineWidth = 13; ctx.beginPath(); ctx.arc(cx, cy, radius, start, angle); ctx.stroke();
  ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * (radius - 8), cy + Math.sin(angle) * (radius - 8)); ctx.stroke();
  ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#77899f"; ctx.font = "10px ui-monospace, monospace"; ctx.fillText(minLabel, cx - radius - 7, cy + 18); ctx.fillText(maxLabel, cx + radius - 15, cy + 18);
}

function signed(value, digits) { return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function updateStats([start, end]) {
  const names = ["X축 · 종방향", "Y축 · 횡방향", "Z축 · 수직방향"];
  const keys = ["ax", "ay", "az"];
  $("statsGrid").innerHTML = keys.map((key, i) => {
    const raw = stats(dataset[key], start, end);
    const fit = stats(filtered[key], start, end);
    return `<article style="--axis-color:${AXIS_COLORS[i]}"><span>${names[i]}</span><strong>${fit.p01.toFixed(2)} ~ ${fit.p99.toFixed(2)} g</strong><small>필터 98% 범위 · 원시 ${raw.p01.toFixed(2)} ~ ${raw.p99.toFixed(2)} g<br>필터 전체 ${fit.min.toFixed(2)} ~ ${fit.max.toFixed(2)} g</small></article>`;
  }).join("");
}

function stats(values, start, end) {
  const selected = values.slice(start, end).filter(Number.isFinite).sort((a, b) => a - b);
  const pick = (q) => selected[Math.floor((selected.length - 1) * q)] || 0;
  return { min: pick(0), p01: pick(.01), p99: pick(.99), max: pick(1) };
}

function visibleIndices(times, start, end) {
  const lower = binarySearch(times, start);
  const upper = binarySearch(times, end + Number.EPSILON);
  return [lower, Math.max(lower + 1, upper)];
}

function binarySearch(values, target) {
  let lo = 0, hi = values.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (values[mid] < target) lo = mid + 1; else hi = mid; }
  return lo;
}

function drawChart(chart, bounds) {
  const canvas = chart.canvas;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, canvas.clientWidth);
  const height = canvas.clientHeight;
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) { canvas.width = width * dpr; canvas.height = height * dpr; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const pad = { l: 56, r: 14, t: 18, b: 30 };
  const plotW = width - pad.l - pad.r, plotH = height - pad.t - pad.b;
  const sources = [];
  if ($("showRaw").checked) sources.push({ data: dataset, alpha: .38, colors: AXIS_COLORS, width: .8 });
  if ($("showFiltered").checked) sources.push({ data: filtered, alpha: 1, colors: FILTER_COLORS, width: 1.5 });
  let min = Infinity, max = -Infinity;
  for (const source of sources) for (const key of chart.keys) {
    const range = extrema(source.data[key], bounds[0], bounds[1]);
    min = Math.min(min, range.min); max = Math.max(max, range.max);
  }
  if (!Number.isFinite(min)) { min = -1; max = 1; }
  if (min === max) { min -= 1; max += 1; }
  const margin = (max - min) * .08; min -= margin; max += margin;

  ctx.strokeStyle = "#203047"; ctx.fillStyle = "#7f90a7"; ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + plotH * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
    const value = max - (max - min) * i / 4;
    ctx.fillText(value.toFixed(Math.abs(max - min) < 2 ? 2 : 1), 6, y + 4);
  }
  for (let i = 0; i <= 5; i++) {
    const x = pad.l + plotW * i / 5;
    const value = viewStart + (viewEnd - viewStart) * i / 5;
    ctx.fillText(`${value.toFixed(1)}s`, Math.min(width - 48, x - 15), height - 8);
  }
  if (min < 0 && max > 0) {
    const zero = pad.t + max / (max - min) * plotH;
    ctx.strokeStyle = "#4d6078"; ctx.beginPath(); ctx.moveTo(pad.l, zero); ctx.lineTo(width - pad.r, zero); ctx.stroke();
  }

  sources.forEach((source) => chart.keys.forEach((key, axis) => {
    drawEnvelope(ctx, source.data.t, source.data[key], bounds, { x: pad.l, y: pad.t, w: plotW, h: plotH, min, max, color: source.colors[Math.min(axis, 2)], alpha: source.alpha, lineWidth: source.width });
  }));

  chart.labels.forEach((label, i) => {
    const x = pad.l + i * 54;
    ctx.globalAlpha = 1; ctx.fillStyle = FILTER_COLORS[Math.min(i, 2)]; ctx.fillRect(x, 2, 13, 2);
    ctx.fillStyle = "#a8b5c7"; ctx.fillText(label, x + 18, 7);
  });
}

function drawEnvelope(ctx, times, values, [start, end], plot) {
  const span = Math.max(.001, viewEnd - viewStart);
  const buckets = Math.max(1, Math.floor(plot.w));
  const mins = new Float64Array(buckets); mins.fill(Infinity);
  const maxs = new Float64Array(buckets); maxs.fill(-Infinity);
  for (let i = start; i < end; i++) {
    const bucket = Math.max(0, Math.min(buckets - 1, Math.floor((times[i] - viewStart) / span * buckets)));
    const value = values[i];
    if (value < mins[bucket]) mins[bucket] = value;
    if (value > maxs[bucket]) maxs[bucket] = value;
  }
  const y = (value) => plot.y + (plot.max - value) / (plot.max - plot.min) * plot.h;
  ctx.strokeStyle = plot.color; ctx.globalAlpha = plot.alpha; ctx.lineWidth = plot.lineWidth;
  ctx.beginPath();
  let active = false;
  for (let b = 0; b < buckets; b++) {
    if (!Number.isFinite(mins[b])) { active = false; continue; }
    const x = plot.x + b;
    if (!active) { ctx.moveTo(x, y(mins[b])); active = true; }
    else ctx.lineTo(x, y(mins[b]));
    if (maxs[b] !== mins[b]) ctx.lineTo(x, y(maxs[b]));
  }
  ctx.stroke(); ctx.globalAlpha = 1;
}

function extrema(values, start, end) {
  let min = Infinity, max = -Infinity;
  for (let i = start; i < end; i++) { if (values[i] < min) min = values[i]; if (values[i] > max) max = values[i]; }
  return { min, max };
}

function showLoading(text) { $("loadingText").textContent = text; $("loading").classList.remove("hidden"); }
function hideLoading() { $("loading").classList.add("hidden"); }
function nextFrame() { return new Promise((resolve) => requestAnimationFrame(resolve)); }
function debounce(fn, ms) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }; }
