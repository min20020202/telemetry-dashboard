(() => {
  'use strict';

  const COLORS = ['#06b6d4', '#ff3d9a', '#76ff03', '#ffca28'];
  const state = { sessions: [], selected: new Set(), cache: new Map(), charts: {}, serial: 0 };
  const $ = id => document.getElementById(id);
  const ui = {
    files: $('comparison-files'), clear: $('comparison-clear'), status: $('comparison-status'),
    count: $('comparison-count'), sessions: $('comparison-sessions'), summary: $('comparison-summary'),
    sector: $('comparison-sector-table'), map: $('comparison-track-map')
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const formatLap = seconds => {
    const value = Number(seconds) || 0;
    return `${Math.floor(value / 60)}:${(value % 60).toFixed(3).padStart(6, '0')}`;
  };
  const selectionKey = (sessionId, lapIndex) => `${sessionId}:${lapIndex}`;
  const reference = () => window.NSSUR_TRACK_REFERENCE?.points || [];
  const totalDistance = () => Number(window.NSSUR_TRACK_REFERENCE?.totalDistanceMeters) || Number(reference().at(-1)?.[2]) || 0;

  function setStatus(message, error = false) {
    if (!ui.status) return;
    ui.status.textContent = message;
    ui.status.classList.toggle('error', error);
  }

  function importOne(file) {
    return new Promise((resolve, reject) => {
      handleFile(file, {
        skipUpload: true,
        onComplete: snapshot => {
          const laps = (snapshot.laps || []).map(lap => ({ ...lap }));
          if (!laps.length) {
            reject(new Error(`${file.name}: 고정 피니시라인을 통과한 완성 랩이 없습니다.`));
            return;
          }
          const id = ++state.serial;
          state.sessions.push({
            id,
            fileName: file.name,
            driver: file.name.replace(/\.csv$/i, ''),
            rows: snapshot.rows,
            gpsPoints: (snapshot.gpsPoints || []).map(point => ({ ...point })),
            laps,
            checkpoints: (snapshot.checkpoints || []).map(line => line.map(point => ({ ...point })))
          });
          resolve();
        },
        onError: reject
      });
    });
  }

  async function importFiles(files) {
    if (!files.length) return;
    switchTab('comparison');
    let failures = [];
    const initialSessionCount = state.sessions.length;
    for (let index = 0; index < files.length; index += 1) {
      setStatus(`${index + 1} / ${files.length} · ${files[index].name} 분석 중…`);
      try { await importOne(files[index]); }
      catch (error) { failures.push(error.message); }
    }
    if (files.length === 1 && state.sessions.length === initialSessionCount + 1 && state.selected.size === 0) {
      const session = state.sessions.at(-1);
      session.laps.map((lap, lapIndex) => ({ lap, lapIndex })).sort((a, b) => a.lap.duration - b.lap.duration).slice(0, 2)
        .forEach(item => state.selected.add(selectionKey(session.id, item.lapIndex)));
    }
    renderSessions();
    if (state.selected.size >= 2) render();
    else setStatus(failures.length ? failures.join(' / ') : `${files.length}개 CSV 추가 완료 · 같은 파일 안에서도 비교할 랩을 선택할 수 있습니다.`, failures.length > 0);
  }

  function renderSessions() {
    if (!ui.sessions) return;
    ui.sessions.innerHTML = state.sessions.length ? state.sessions.map(session => `
      <section class="comparison-session" data-session="${session.id}">
        <input type="text" value="${escapeHtml(session.driver)}" aria-label="드라이버 이름" data-driver="${session.id}">
        <small title="${escapeHtml(session.fileName)}">${escapeHtml(session.fileName)} · ${session.laps.length}개 완성 랩</small>
        <div class="comparison-session-actions"><button type="button" data-session-pick="fast" data-session-id="${session.id}">빠른 4랩</button><button type="button" data-session-pick="spread" data-session-id="${session.id}">베스트·워스트</button><button type="button" data-session-pick="clear" data-session-id="${session.id}">해제</button></div>
        <div class="comparison-laps">${session.laps.map((lap, lapIndex) => {
          const key = selectionKey(session.id, lapIndex);
          return `<label class="comparison-lap-choice"><input type="checkbox" data-lap-key="${key}" ${state.selected.has(key) ? 'checked' : ''}><span>L${lap.number} ${formatLap(lap.duration)}</span></label>`;
        }).join('')}</div>
      </section>`).join('') : '<p class="comparison-empty">아직 추가된 세션이 없습니다.</p>';
    updateCount();
  }

  function selectedLaps() {
    const result = [];
    state.selected.forEach(key => {
      const [sessionId, lapIndex] = key.split(':').map(Number);
      const session = state.sessions.find(item => item.id === sessionId);
      const lap = session?.laps[lapIndex];
      if (session && lap) result.push({ key, session, lap, lapIndex });
    });
    return result;
  }

  function referenceMeters() {
    const points = reference();
    if (points.length < 2) return [];
    const lat0 = points[0][0] * Math.PI / 180;
    const mLat = 111320, mLon = mLat * Math.cos(lat0);
    return points.map(point => ({ x: (point[1] - points[0][1]) * mLon, y: (point[0] - points[0][0]) * mLat, d: Number(point[2]) || 0 }));
  }

  function projectPoint(lat, lon, startSegment = 0, windowSize = Infinity) {
    const points = reference(), ref = referenceMeters();
    if (ref.length < 2) return null;
    const lat0 = points[0][0] * Math.PI / 180, mLat = 111320, mLon = mLat * Math.cos(lat0);
    const px = (lon - points[0][1]) * mLon, py = (lat - points[0][0]) * mLat;
    const start = Math.max(0, startSegment - (Number.isFinite(windowSize) ? windowSize : startSegment));
    const end = Math.min(ref.length - 2, Number.isFinite(windowSize) ? startSegment + windowSize : ref.length - 2);
    let best = null;
    for (let i = start; i <= end; i += 1) {
      const a = ref[i], b = ref[i + 1], dx = b.x - a.x, dy = b.y - a.y;
      const ratio = dx * dx + dy * dy ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy))) : 0;
      const qx = a.x + dx * ratio, qy = a.y + dy * ratio, error2 = (px - qx) ** 2 + (py - qy) ** 2;
      if (!best || error2 < best.error2) best = { segment: i, error2, distance: a.d + (b.d - a.d) * ratio };
    }
    return best;
  }

  function buildDistanceMap(item) {
    const fixes = item.session.gpsPoints.filter(point => point.time >= item.lap.startTime - .05 && point.time <= item.lap.endTime + .05);
    const map = [{ time: item.lap.startTime, distance: 0 }];
    let segment = 0, distance = 0;
    fixes.forEach((point, index) => {
      const hit = projectPoint(point.lat, point.lon, segment, index < 2 ? 35 : 35);
      if (!hit) return;
      segment = Math.max(segment, hit.segment);
      distance = Math.max(distance, Math.min(totalDistance(), hit.distance));
      map.push({ time: point.time, distance });
    });
    map.push({ time: item.lap.endTime, distance: totalDistance() });
    return map.sort((a, b) => a.distance - b.distance || a.time - b.time);
  }

  function interpolate(map, target, input, output) {
    let low = 0, high = map.length - 1;
    while (low < high) { const middle = (low + high) >> 1; if (map[middle][input] < target) low = middle + 1; else high = middle; }
    const right = map[low], left = map[Math.max(0, low - 1)];
    const width = right[input] - left[input];
    const ratio = width ? (target - left[input]) / width : 0;
    return left[output] + (right[output] - left[output]) * Math.max(0, Math.min(1, ratio));
  }

  function rowAt(rows, time) {
    let low = 0, high = rows.length - 1;
    while (low < high) { const middle = (low + high) >> 1; if ((Number(rows[middle].time_sec) || 0) < time) low = middle + 1; else high = middle; }
    const right = rows[low], left = rows[Math.max(0, low - 1)];
    return Math.abs((Number(left.time_sec) || 0) - time) <= Math.abs((Number(right.time_sec) || 0) - time) ? left : right;
  }

  function sampleLap(item) {
    if (state.cache.has(item.key)) return state.cache.get(item.key);
    const map = buildDistanceMap(item), samples = [];
    for (let distance = 0; distance <= totalDistance(); distance += 1) {
      const time = interpolate(map, distance, 'distance', 'time');
      const row = rowAt(item.session.rows, time);
      samples.push({
        x: distance, elapsed: time - item.lap.startTime,
        speed: Number(row.gps_speed_kmh) || Number(row.fl_speed_kmh) || 0,
        tps: Number(row.decoded_tps) || 0,
        brake: getCalibratedBrake(row.front_brake_raw),
        steering: getCalibratedSteering(row.steering_raw),
        yaw: Number(row.imu_gyro_z_dps) || 0
      });
    }
    state.cache.set(item.key, samples);
    return samples;
  }

  function chartOptions(yTitle) {
    return {
      responsive: true, maintainAspectRatio: false, animation: false, normalized: true, parsing: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, labels: { boxWidth: 10, boxHeight: 2, font: { size: 9 } } }, tooltip: { enabled: true } },
      scales: {
        x: { type: 'linear', min: 0, max: totalDistance(), title: { display: true, text: '공통 중심선 거리 [m]', font: { size: 9 } }, ticks: { maxTicksLimit: 9, font: { size: 9 } } },
        y: { title: { display: true, text: yTitle, font: { size: 9 } }, ticks: { maxTicksLimit: 6, font: { size: 9 } } }
      }
    };
  }

  function rebuildChart(name, canvasId, datasets, title, extra = {}) {
    state.charts[name]?.destroy();
    const canvas = $(canvasId);
    if (!canvas) return;
    const options = chartOptions(title);
    Object.assign(options.scales.y, extra);
    state.charts[name] = new Chart(canvas, { type: 'line', data: { datasets }, options });
  }

  function line(label, color, samples, key, dashed = false) {
    return { label, data: samples.map(point => ({ x: point.x, y: point[key] })), borderColor: color, backgroundColor: color, borderWidth: 1.6, borderDash: dashed ? [5, 3] : [], pointRadius: 0, fill: false };
  }

  function renderCharts(items) {
    const sampled = items.map((item, index) => ({ item, color: COLORS[index], data: sampleLap(item), label: `${item.session.driver} · L${item.lap.number}` }));
    rebuildChart('speed', 'comparison-speed-chart', sampled.map(s => line(s.label, s.color, s.data, 'speed')), 'km/h', { min: 0 });
    rebuildChart('pedal', 'comparison-pedal-chart', sampled.flatMap(s => [line(`${s.label} TPS`, s.color, s.data, 'tps'), line(`${s.label} Brake`, s.color, s.data, 'brake', true)]), '%', { min: 0, max: 100 });
    rebuildChart('steering', 'comparison-steering-chart', sampled.flatMap(s => [line(`${s.label} Steering`, s.color, s.data, 'steering'), line(`${s.label} Yaw`, s.color, s.data, 'yaw', true)]), '° / °/s');
    const baseline = sampled[0]?.data || [];
    rebuildChart('delta', 'comparison-delta-chart', sampled.map(s => ({
      label: s.label, data: s.data.map((point, index) => ({ x: point.x, y: point.elapsed - (baseline[index]?.elapsed || 0) })),
      borderColor: s.color, backgroundColor: s.color, borderWidth: 1.8, pointRadius: 0, fill: false
    })), 'Δ time [s]');
  }

  function renderSummary(items) {
    if (!ui.summary) return;
    if (items.length < 2) { ui.summary.innerHTML = '<p class="comparison-empty">두 개 이상의 랩을 선택하면 차이를 계산합니다.</p>'; return; }
    const baseline = items[0], fastest = [...items].sort((a, b) => a.lap.duration - b.lap.duration)[0];
    ui.summary.innerHTML = items.map((item, index) => {
      const delta = item.lap.duration - baseline.lap.duration;
      const maxSpeed = Math.max(...sampleLap(item).map(point => point.speed));
      return `<div class="comparison-summary-card" style="border-color:${COLORS[index]}"><b>${escapeHtml(item.session.driver)} · LAP ${item.lap.number}${item === fastest ? ' ★' : ''}</b><span>${formatLap(item.lap.duration)} · 기준 대비 ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}초 · 최고 ${maxSpeed.toFixed(1)} km/h</span></div>`;
    }).join('');
  }

  function checkpointDistances(items) {
    const source = items[0]?.session.checkpoints || [];
    return source.map(line => {
      const mid = { lat: (line[0].lat + line[1].lat) / 2, lon: (line[0].lon + line[1].lon) / 2 };
      return projectPoint(mid.lat, mid.lon)?.distance;
    }).filter(Number.isFinite).filter(distance => distance > 2 && distance < totalDistance() - 2).sort((a, b) => a - b);
  }

  function renderSectors(items) {
    if (!ui.sector) return;
    if (items.length < 2) { ui.sector.innerHTML = '<p class="comparison-empty">두 개 이상의 랩을 선택하세요.</p>'; return; }
    const bounds = [0, ...checkpointDistances(items), totalDistance()];
    const cells = items.map((item, index) => ({ item, index, data: sampleLap(item) }));
    ui.sector.innerHTML = `<table><thead><tr><th>구간</th>${cells.map(cell => `<th style="color:${COLORS[cell.index]}">${escapeHtml(cell.item.session.driver)} L${cell.item.lap.number}</th>`).join('')}</tr></thead><tbody>${bounds.slice(0, -1).map((start, sectorIndex) => {
      const end = bounds[sectorIndex + 1];
      return `<tr><td>S${sectorIndex + 1}<br><small>${start.toFixed(0)}–${end.toFixed(0)}m</small></td>${cells.map(cell => {
        const points = cell.data.filter(point => point.x >= start && point.x <= end);
        const first = points[0], last = points.at(-1);
        const duration = (last?.elapsed || 0) - (first?.elapsed || 0);
        const minSpeed = Math.min(...points.map(point => point.speed));
        const brake = points.find(point => point.brake >= 5);
        const minIndex = points.findIndex(point => point.speed === minSpeed);
        const throttle = points.slice(Math.max(0, minIndex)).find(point => point.tps >= 20);
        return `<td><b>${duration.toFixed(3)}s</b><br><small>min ${minSpeed.toFixed(1)} · B ${brake ? `${brake.x.toFixed(0)}m` : '—'} · T ${throttle ? `${throttle.x.toFixed(0)}m` : '—'} · out ${(last?.speed || 0).toFixed(1)}</small></td>`;
      }).join('')}</tr>`;
    }).join('')}</tbody></table>`;
  }

  function renderMap(items) {
    const canvas = ui.map;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const width = rect.width, height = rect.height;
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, width, height);
    const all = items.flatMap(item => item.session.gpsPoints.filter(point => point.time >= item.lap.startTime && point.time <= item.lap.endTime));
    if (!all.length) return;
    const lats = all.map(p => p.lat), lons = all.map(p => p.lon), minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const padding = 24, sx = (width - padding * 2) / Math.max(1e-9, maxLon - minLon), sy = (height - padding * 2) / Math.max(1e-9, maxLat - minLat), scale = Math.min(sx, sy);
    const xy = p => [(width - (maxLon - minLon) * scale) / 2 + (p.lon - minLon) * scale, (height - (maxLat - minLat) * scale) / 2 + (maxLat - p.lat) * scale];
    items.forEach((item, index) => {
      const points = item.session.gpsPoints.filter(point => point.time >= item.lap.startTime && point.time <= item.lap.endTime);
      ctx.beginPath(); points.forEach((point, i) => { const [x, y] = xy(point); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = COLORS[index]; ctx.lineWidth = 2.5; ctx.globalAlpha = .9; ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = COLORS[index]; ctx.font = '700 11px monospace'; ctx.fillText(`${item.session.driver} L${item.lap.number}`, 10, 17 + index * 15);
    });
  }

  function updateCount() { if (ui.count) ui.count.textContent = `${state.selected.size} / 4 선택`; }
  function render() {
    const items = selectedLaps(); updateCount(); renderSummary(items); renderCharts(items); renderSectors(items); renderMap(items);
    if (items.length) setStatus(`${items.length}개 랩을 1 m 간격 공통 중심선 거리축으로 비교 중입니다.`);
  }
  window.renderDriverComparison = render;

  ui.files?.addEventListener('change', event => { const files = [...event.target.files]; event.target.value = ''; importFiles(files); });
  ui.clear?.addEventListener('click', () => {
    state.sessions = []; state.selected.clear(); state.cache.clear();
    Object.values(state.charts).forEach(chart => chart.destroy()); state.charts = {};
    renderSessions(); render(); setStatus('CSV를 추가한 뒤 비교할 랩을 2~4개 선택하세요.');
  });
  ui.sessions?.addEventListener('input', event => {
    const session = state.sessions.find(item => item.id === Number(event.target.dataset.driver));
    if (session) { session.driver = event.target.value.trim() || session.fileName.replace(/\.csv$/i, ''); render(); }
  });
  ui.sessions?.addEventListener('change', event => {
    const key = event.target.dataset.lapKey;
    if (!key) return;
    if (event.target.checked && state.selected.size >= 4) { event.target.checked = false; setStatus('동시에 비교할 수 있는 랩은 최대 4개입니다.', true); return; }
    event.target.checked ? state.selected.add(key) : state.selected.delete(key); render();
  });
  ui.sessions?.addEventListener('click', event => {
    const button = event.target.closest('[data-session-pick]');
    if (!button) return;
    const session = state.sessions.find(item => item.id === Number(button.dataset.sessionId));
    if (!session) return;
    session.laps.forEach((_, lapIndex) => state.selected.delete(selectionKey(session.id, lapIndex)));
    const ordered = session.laps.map((lap, lapIndex) => ({ lap, lapIndex })).sort((a, b) => a.lap.duration - b.lap.duration);
    let picks = [];
    if (button.dataset.sessionPick === 'fast') picks = ordered.slice(0, 4);
    if (button.dataset.sessionPick === 'spread' && ordered.length) picks = ordered.length === 1 ? ordered : [ordered[0], ordered.at(-1)];
    picks.slice(0, Math.max(0, 4 - state.selected.size)).forEach(item => state.selected.add(selectionKey(session.id, item.lapIndex)));
    renderSessions();
    render();
  });
  window.addEventListener('resize', () => { if ($('page-comparison')?.classList.contains('active')) renderMap(selectedLaps()); });
})();
