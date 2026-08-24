(() => {
  'use strict';

  const COLORS = ['#06b6d4', '#ff3d9a', '#76ff03', '#ffca28'];
  const state = { sessions: [], selected: new Set(), cache: new Map(), charts: {}, serial: 0, playing: false, playElapsed: 0, playRate: 1, playFrame: 0, playStamp: 0, viewMin: 0, viewMax: null, hoverDistance: null, activeSector: null, lastSector: 0, mapGeometry: null };
  const boundChartCanvases = new WeakSet();
  const $ = id => document.getElementById(id);
  const ui = {
    files: $('comparison-files'), clear: $('comparison-clear'), status: $('comparison-status'),
    count: $('comparison-count'), sessions: $('comparison-sessions'), summary: $('comparison-summary'),
    sector: $('comparison-sector-table'), map: $('comparison-track-map'),
    play: $('comparison-play-toggle'), rate: $('comparison-play-rate'), slider: $('comparison-play-slider'), playTime: $('comparison-play-time'), playDistance: $('comparison-play-distance'),
    speedValue: $('comparison-speed-value'), pedalValue: $('comparison-pedal-value'),
    steeringValue: $('comparison-steering-value'), deltaValue: $('comparison-delta-value')
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

  function addSession(snapshot, autoSelect = false) {
    const file = snapshot.file;
    const laps = (snapshot.laps || []).map(lap => ({ ...lap }));
    if (!laps.length) throw new Error(`${file.name}: 고정 피니시라인을 통과한 완성 랩이 없습니다.`);
    const sourceKey = `${file.name}:${file.size || 0}:${file.lastModified || 0}`;
    let session = state.sessions.find(item => item.sourceKey === sourceKey);
    if (!session) {
      session = {
        id: ++state.serial,
        sourceKey,
        fileName: file.name,
        driver: file.name.replace(/\.csv$/i, ''),
        rows: snapshot.rows,
        gpsPoints: (snapshot.gpsPoints || []).map(point => ({ ...point })),
        laps,
        checkpoints: (snapshot.checkpoints || []).map(line => line.map(point => ({ ...point })))
      };
      state.sessions.push(session);
    }
    if (autoSelect && state.selected.size === 0) {
      session.laps.map((lap, lapIndex) => ({ lap, lapIndex })).sort((a, b) => a.lap.duration - b.lap.duration).slice(0, 2)
        .forEach(item => state.selected.add(selectionKey(session.id, item.lapIndex)));
    }
    return session;
  }

  function importOne(file) {
    return new Promise((resolve, reject) => {
      handleFile(file, {
        skipUpload: true,
        onComplete: snapshot => {
          try { addSession(snapshot); resolve(); }
          catch (error) { reject(error); }
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
        <div class="comparison-session-actions"><button type="button" data-session-pick="fast" data-session-id="${session.id}">빠른 4랩</button><button type="button" data-session-pick="best" data-session-id="${session.id}">베스트만</button><button type="button" data-session-pick="clear" data-session-id="${session.id}">해제</button></div>
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

  function vehicleSpeed(row) {
    const gpsSpeed = Number(row.gps_speed_kmh);
    const gpsQuality = Number(row.gps_qual);
    const gpsFixAge = Number(row.gps_fix_age_us);
    const hasQuality = Number.isFinite(gpsQuality);
    const hasFixAge = Number.isFinite(gpsFixAge);
    const gpsValid = Number.isFinite(gpsSpeed) && gpsSpeed >= 0 &&
      (!hasQuality || gpsQuality > 0) && (!hasFixAge || gpsFixAge <= 1000000);
    if (gpsValid) return gpsSpeed;
    const flSpeed = Number(row.fl_speed_kmh);
    return Number.isFinite(flSpeed) && flSpeed >= 0 ? flSpeed : 0;
  }

  function sampleLap(item) {
    if (state.cache.has(item.key)) return state.cache.get(item.key);
    const map = buildDistanceMap(item), samples = [];
    for (let distance = 0; distance <= totalDistance(); distance += 1) {
      const time = interpolate(map, distance, 'distance', 'time');
      const row = rowAt(item.session.rows, time);
      samples.push({
        x: distance, elapsed: time - item.lap.startTime,
        speed: vehicleSpeed(row),
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
    const distance = totalDistance();
    return {
      responsive: true, maintainAspectRatio: false, animation: false, normalized: true, parsing: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, labels: { boxWidth: 10, boxHeight: 2, font: { size: 9 } } }, tooltip: { enabled: true } },
      scales: {
        x: { type: 'linear', min: state.viewMin, max: state.viewMax ?? distance, title: { display: true, text: '공통 중심선 거리 [m]', font: { size: 9 } }, ticks: { maxTicksLimit: 9, font: { size: 9 } } },
        y: { title: { display: true, text: yTitle, font: { size: 9 } }, ticks: { maxTicksLimit: 6, font: { size: 9 } } }
      }
    };
  }

  function setChartViewRange(min, max) {
    const distance = totalDistance();
    const width = Math.max(10, Math.min(distance, max - min));
    state.viewMin = Math.max(0, Math.min(Math.max(0, distance - width), min));
    state.viewMax = state.viewMin + width;
    Object.values(state.charts).forEach(chart => {
      chart.options.scales.x.min = state.viewMin;
      chart.options.scales.x.max = state.viewMax;
      chart.update('none');
    });
  }

  function jumpToDistance(distance) {
    const items = selectedLaps();
    if (!items.length) return;
    const target = Math.max(0, Math.min(totalDistance(), Number(distance) || 0));
    const baseline = sampleLap(items[0]);
    const elapsed = interpolate(baseline, target, 'x', 'elapsed');
    setPlaying(false);
    state.playElapsed = Math.max(0, Math.min(items[0].lap.duration, elapsed));
    state.hoverDistance = null;
    syncPlaybackUi(items);
    renderMap(items);
  }

  function previewDistance(distance) {
    const target = distance === null ? NaN : Number(distance);
    state.hoverDistance = Number.isFinite(target) ? Math.max(0, Math.min(totalDistance(), target)) : null;
    updatePlaybackValues(selectedLaps(), state.hoverDistance);
  }

  function bindChartZoom(canvas) {
    if (!canvas || boundChartCanvases.has(canvas)) return;
    boundChartCanvases.add(canvas);
    canvas.addEventListener('wheel', event => {
      const chart = Object.values(state.charts).find(candidate => candidate.canvas === canvas);
      if (!chart?.chartArea) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const anchor = chart.scales.x.getValueForPixel(event.clientX - rect.left);
      const currentMin = chart.scales.x.min, currentMax = chart.scales.x.max;
      const factor = event.deltaY > 0 ? 1.22 : .82;
      const nextWidth = Math.max(10, Math.min(totalDistance(), (currentMax - currentMin) * factor));
      const ratio = Math.max(0, Math.min(1, (anchor - currentMin) / Math.max(.001, currentMax - currentMin)));
      setChartViewRange(anchor - nextWidth * ratio, anchor + nextWidth * (1 - ratio));
    }, { passive: false });
    canvas.addEventListener('mousemove', event => {
      const chart = Object.values(state.charts).find(candidate => candidate.canvas === canvas);
      if (!chart?.chartArea) return;
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      if (px < chart.chartArea.left || px > chart.chartArea.right) return previewDistance(null);
      previewDistance(chart.scales.x.getValueForPixel(px));
    });
    canvas.addEventListener('mouseleave', () => previewDistance(null));
    canvas.addEventListener('click', event => {
      const chart = Object.values(state.charts).find(candidate => candidate.canvas === canvas);
      if (!chart?.chartArea) return;
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left, py = event.clientY - rect.top;
      if (px < chart.chartArea.left || px > chart.chartArea.right || py < chart.chartArea.top || py > chart.chartArea.bottom) return;
      jumpToDistance(chart.scales.x.getValueForPixel(px));
    });
    canvas.addEventListener('dblclick', () => { state.activeSector = null; setChartViewRange(0, totalDistance()); renderSectors(selectedLaps()); renderMap(selectedLaps()); });
  }

  function sampleAtElapsed(item, elapsed) {
    const samples = sampleLap(item);
    if (!samples.length) return null;
    const target = Math.max(0, Math.min(item.lap.duration, elapsed));
    let low = 0, high = samples.length - 1;
    while (low < high) { const middle = (low + high) >> 1; if (samples[middle].elapsed < target) low = middle + 1; else high = middle; }
    const right = samples[low], left = samples[Math.max(0, low - 1)];
    const span = right.elapsed - left.elapsed;
    const ratio = span ? Math.max(0, Math.min(1, (target - left.elapsed) / span)) : 0;
    const mixed = { x: left.x + (right.x - left.x) * ratio, elapsed: target };
    ['speed', 'tps', 'brake', 'steering', 'yaw'].forEach(key => { mixed[key] = left[key] + (right[key] - left[key]) * ratio; });
    return mixed;
  }

  function seriesValueAt(data, x) {
    if (!data?.length) return null;
    let low = 0, high = data.length - 1;
    while (low < high) { const middle = (low + high) >> 1; if (data[middle].x < x) low = middle + 1; else high = middle; }
    const right = data[low], left = data[Math.max(0, low - 1)];
    const span = right.x - left.x;
    const ratio = span ? Math.max(0, Math.min(1, (x - left.x) / span)) : 0;
    return left.y + (right.y - left.y) * ratio;
  }

  const comparisonCursorPlugin = {
    id: 'comparisonPlaybackCursor',
    afterDatasetsDraw(chart) {
      const items = selectedLaps();
      if (!items.length || !chart.chartArea) return;
      const ctx = chart.ctx, positions = items.map(item => sampleAtElapsed(item, state.playElapsed));
      ctx.save();
      positions.forEach((sample, index) => {
        if (!sample) return;
        const x = chart.scales.x.getPixelForValue(sample.x);
        if (x < chart.chartArea.left || x > chart.chartArea.right) return;
        ctx.beginPath(); ctx.moveTo(x, chart.chartArea.top); ctx.lineTo(x, chart.chartArea.bottom);
        ctx.strokeStyle = COLORS[index]; ctx.lineWidth = 1.5; ctx.globalAlpha = .78; ctx.stroke();
        chart.data.datasets.forEach(dataset => {
          if (dataset.comparisonIndex !== index) return;
          const value = seriesValueAt(dataset.data, sample.x);
          if (!Number.isFinite(value)) return;
          const y = chart.scales.y.getPixelForValue(value);
          ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fillStyle = COLORS[index]; ctx.globalAlpha = 1; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        });
      });
      ctx.restore();
    }
  };

  function rebuildChart(name, canvasId, datasets, title, extra = {}) {
    state.charts[name]?.destroy();
    const canvas = $(canvasId);
    if (!canvas) return;
    const options = chartOptions(title);
    Object.assign(options.scales.y, extra);
    state.charts[name] = new Chart(canvas, { type: 'line', data: { datasets }, options, plugins: [comparisonCursorPlugin] });
    bindChartZoom(canvas);
  }

  function line(label, color, samples, key, dashed = false, comparisonIndex = 0) {
    return { label, comparisonIndex, data: samples.map(point => ({ x: point.x, y: point[key] })), borderColor: color, backgroundColor: color, borderWidth: 1.6, borderDash: dashed ? [5, 3] : [], pointRadius: 0, fill: false };
  }

  function renderCharts(items) {
    const sampled = items.map((item, index) => ({ item, color: COLORS[index], data: sampleLap(item), label: `${item.session.driver} · L${item.lap.number}` }));
    rebuildChart('speed', 'comparison-speed-chart', sampled.map((s, i) => line(s.label, s.color, s.data, 'speed', false, i)), 'km/h', { min: 0 });
    rebuildChart('pedal', 'comparison-pedal-chart', sampled.flatMap((s, i) => [line(`${s.label} TPS`, s.color, s.data, 'tps', false, i), line(`${s.label} Brake`, s.color, s.data, 'brake', true, i)]), '%', { min: 0, max: 100 });
    rebuildChart('steering', 'comparison-steering-chart', sampled.flatMap((s, i) => [line(`${s.label} Steering`, s.color, s.data, 'steering', false, i), line(`${s.label} Yaw`, s.color, s.data, 'yaw', true, i)]), '° / °/s');
    const baseline = sampled[0]?.data || [];
    rebuildChart('delta', 'comparison-delta-chart', sampled.map(s => ({
      label: s.label, data: s.data.map((point, index) => ({ x: point.x, y: point.elapsed - (baseline[index]?.elapsed || 0) })),
      comparisonIndex: sampled.indexOf(s), borderColor: s.color, backgroundColor: s.color, borderWidth: 1.8, pointRadius: 0, fill: false
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

  function sectorBounds(items) {
    return [0, ...checkpointDistances(items), totalDistance()];
  }

  function sectorDuration(item, start, end) {
    const data = sampleLap(item);
    return interpolate(data, end, 'x', 'elapsed') - interpolate(data, start, 'x', 'elapsed');
  }

  function scrollSelectedSectorIntoView(index) {
    if (!ui.sector || !Number.isInteger(index)) return;
    requestAnimationFrame(() => {
      const row = ui.sector.querySelector(`[data-sector-row="${index}"]`);
      if (!row) return;
      const containerRect = ui.sector.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const controlsHeight = ui.sector.querySelector('.comparison-sector-controls')?.offsetHeight || 0;
      const target = ui.sector.scrollTop + rowRect.top - containerRect.top - controlsHeight - 25;
      ui.sector.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    });
  }

  function selectSector(index) {
    const items = selectedLaps(), bounds = sectorBounds(items);
    state.activeSector = Number.isInteger(index) && index >= 0 && index < bounds.length - 1 ? index : null;
    if (state.activeSector !== null) state.lastSector = state.activeSector;
    if (state.activeSector === null) setChartViewRange(0, totalDistance());
    else {
      const start = bounds[state.activeSector], end = bounds[state.activeSector + 1];
      setChartViewRange(start, end);
      jumpToDistance(start);
    }
    renderSectors(items);
    renderMap(items);
    scrollSelectedSectorIntoView(state.activeSector);
  }

  function renderSectors(items) {
    if (!ui.sector) return;
    if (items.length < 2) { ui.sector.innerHTML = '<p class="comparison-empty">두 개 이상의 랩을 선택하세요.</p>'; return; }
    const bounds = sectorBounds(items);
    const cells = items.map((item, index) => ({ item, index, data: sampleLap(item) }));
    const controls = `<div class="comparison-sector-controls"><button type="button" data-sector-toggle aria-pressed="${state.activeSector !== null}" class="comparison-sector-toggle ${state.activeSector !== null ? 'active' : ''}">구간 보기 ${state.activeSector !== null ? 'ON' : 'OFF'}</button>${bounds.slice(0, -1).map((_, index) => `<button type="button" data-sector="${index}" class="${state.activeSector === index ? 'active' : ''}">S${index + 1}</button>`).join('')}</div>`;
    ui.sector.innerHTML = `${controls}<table><thead><tr><th>구간</th>${cells.map(cell => `<th style="color:${COLORS[cell.index]}">${escapeHtml(cell.item.session.driver)} L${cell.item.lap.number}</th>`).join('')}</tr></thead><tbody>${bounds.slice(0, -1).map((start, sectorIndex) => {
      const end = bounds[sectorIndex + 1];
      const durations = cells.map(cell => sectorDuration(cell.item, start, end));
      const fastest = Math.min(...durations);
      return `<tr class="${state.activeSector === sectorIndex ? 'active' : ''}" data-sector-row="${sectorIndex}"><td><button type="button" data-sector="${sectorIndex}">S${sectorIndex + 1}</button><br><small>${start.toFixed(0)}–${end.toFixed(0)}m</small></td>${cells.map(cell => {
        const points = cell.data.filter(point => point.x >= start && point.x <= end);
        const first = points[0], last = points.at(-1);
        const duration = durations[cell.index];
        const isFastest = Number.isFinite(duration) && Math.abs(duration - fastest) < .0005;
        const minSpeed = Math.min(...points.map(point => point.speed));
        const brake = points.find(point => point.brake >= 5);
        const minIndex = points.findIndex(point => point.speed === minSpeed);
        const throttle = points.slice(Math.max(0, minIndex)).find(point => point.tps >= 20);
        const detail = `최저속도 ${minSpeed.toFixed(1)} km/h · 브레이크 ${brake ? `${brake.x.toFixed(0)}m` : '없음'} · 재가속 ${throttle ? `${throttle.x.toFixed(0)}m` : '없음'} · 탈출속도 ${(last?.speed || 0).toFixed(1)} km/h`;
        return `<td class="${isFastest ? 'sector-fastest' : ''}" title="${detail}"><b>${duration.toFixed(3)}s</b>${isFastest ? '<span class="sector-fastest-badge">★ FAST</span>' : ''}</td>`;
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
    const offsetX = (width - (maxLon - minLon) * scale) / 2, offsetY = (height - (maxLat - minLat) * scale) / 2;
    const xy = p => [offsetX + (p.lon - minLon) * scale, offsetY + (maxLat - p.lat) * scale];
    state.mapGeometry = { rect, scale, toGeo: (x, y) => ({ lon: minLon + (x - offsetX) / scale, lat: maxLat - (y - offsetY) / scale }) };
    const bounds = sectorBounds(items);
    bounds.slice(0, -1).forEach((start, sectorIndex) => {
      const end = bounds[sectorIndex + 1];
      const ranked = items.map((item, index) => ({ item, index, duration: sectorDuration(item, start, end) }))
        .sort((a, b) => b.duration - a.duration);
      ranked.forEach(({ item, index }) => {
        const data = sampleLap(item);
        const startTime = item.lap.startTime + interpolate(data, start, 'x', 'elapsed');
        const endTime = item.lap.startTime + interpolate(data, end, 'x', 'elapsed');
        const points = item.session.gpsPoints.filter(point => point.time >= startTime - .05 && point.time <= endTime + .05);
        if (points.length < 2) return;
        ctx.beginPath(); points.forEach((point, i) => { const [x, y] = xy(point); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.strokeStyle = COLORS[index];
        ctx.lineWidth = state.activeSector === sectorIndex ? 4 : 2.5;
        ctx.globalAlpha = state.activeSector === null || state.activeSector === sectorIndex ? .92 : .14;
        ctx.stroke();
      });
    });
    ctx.globalAlpha = 1;
    items.forEach((item, index) => {
      ctx.fillStyle = COLORS[index]; ctx.font = '700 11px monospace';
      ctx.fillText(`${item.session.driver} L${item.lap.number}`, 10, 17 + index * 15);
    });
    const checkpointLines = items[0]?.session.checkpoints || [];
    checkpointLines.forEach((line, index) => {
      if (!line?.[0] || !line?.[1]) return;
      const [x1, y1] = xy(line[0]), [x2, y2] = xy(line[1]);
      ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = 'rgba(255,255,255,.82)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#ffffff'; ctx.font = '800 9px monospace'; ctx.fillText(`CP${index + 1}`, (x1 + x2) / 2 + 4, (y1 + y2) / 2 - 4);
    });
    items.forEach((item, index) => {
      const point = lapPositionAtElapsed(item, state.playElapsed);
      if (!point) return;
      const [x, y] = xy(point);
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = COLORS[index]; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = COLORS[index]; ctx.globalAlpha = .55; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff'; ctx.font = '800 9px monospace'; ctx.fillText(`L${item.lap.number}`, x + 10, y - 9);
    });
  }

  function lapPositionAtElapsed(item, elapsed) {
    const points = item.session.gpsPoints.filter(point => point.time >= item.lap.startTime && point.time <= item.lap.endTime);
    if (!points.length) return null;
    const target = item.lap.startTime + Math.max(0, Math.min(item.lap.duration, elapsed));
    let low = 0, high = points.length - 1;
    while (low < high) { const middle = (low + high) >> 1; if (points[middle].time < target) low = middle + 1; else high = middle; }
    const right = points[low], left = points[Math.max(0, low - 1)];
    const width = right.time - left.time;
    const ratio = width ? Math.max(0, Math.min(1, (target - left.time) / width)) : 0;
    return { lat: left.lat + (right.lat - left.lat) * ratio, lon: left.lon + (right.lon - left.lon) * ratio };
  }

  function playbackDuration(items = selectedLaps()) { return items.length ? Math.max(...items.map(item => item.lap.duration)) : 0; }
  function playbackValueMarkup(values, emptyText) {
    return values.length ? values.map(({ index, text }) =>
      `<span class="comparison-live-item" style="color:${COLORS[index]}">${text}</span>`
    ).join('<i class="comparison-live-separator">·</i>') : emptyText;
  }
  function sampleAtDistance(item, distance) {
    const samples = sampleLap(item);
    if (!samples.length) return null;
    const target = Math.max(0, Math.min(totalDistance(), distance));
    const result = { x: target };
    ['elapsed', 'speed', 'tps', 'brake', 'steering', 'yaw'].forEach(key => {
      result[key] = interpolate(samples, target, 'x', key);
    });
    return result;
  }
  function updatePlaybackValues(items, previewAt = state.hoverDistance) {
    if (!items.length) {
      if (ui.speedValue) ui.speedValue.textContent = '-- km/h';
      if (ui.pedalValue) ui.pedalValue.textContent = '-- %';
      if (ui.steeringValue) ui.steeringValue.textContent = '--';
      if (ui.deltaValue) ui.deltaValue.textContent = '-- s';
      return;
    }
    const samples = items.map(item => Number.isFinite(previewAt) ? sampleAtDistance(item, previewAt) : sampleAtElapsed(item, state.playElapsed));
    const baseline = sampleLap(items[0]);
    if (ui.speedValue) ui.speedValue.innerHTML = playbackValueMarkup(samples.map((sample, index) => ({
      index, text: `L${items[index].lap.number} ${sample ? sample.speed.toFixed(1) : '--'} km/h`
    })), '-- km/h');
    if (ui.pedalValue) ui.pedalValue.innerHTML = playbackValueMarkup(samples.map((sample, index) => ({
      index, text: `L${items[index].lap.number} T ${sample ? sample.tps.toFixed(1) : '--'} / B ${sample ? sample.brake.toFixed(1) : '--'} %`
    })), '-- %');
    if (ui.steeringValue) ui.steeringValue.innerHTML = playbackValueMarkup(samples.map((sample, index) => ({
      index, text: `L${items[index].lap.number} ${sample ? sample.steering.toFixed(1) : '--'}° / ${sample ? sample.yaw.toFixed(1) : '--'}°/s`
    })), '--');
    if (ui.deltaValue) ui.deltaValue.innerHTML = playbackValueMarkup(samples.map((sample, index) => {
      const baselineElapsed = sample ? interpolate(baseline, sample.x, 'x', 'elapsed') : 0;
      const delta = sample ? sample.elapsed - baselineElapsed : NaN;
      return { index, text: `L${items[index].lap.number} ${Number.isFinite(delta) ? `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}` : '--'} s` };
    }), '-- s');
  }
  function syncPlaybackUi(items = selectedLaps()) {
    const duration = playbackDuration(items);
    state.playElapsed = Math.max(0, Math.min(duration, state.playElapsed));
    if (ui.slider) { ui.slider.max = String(Math.max(.01, duration)); ui.slider.value = String(state.playElapsed); ui.slider.disabled = !duration; }
    if (ui.playTime) ui.playTime.textContent = `${state.playElapsed.toFixed(2)} s`;
    if (ui.playDistance) ui.playDistance.innerHTML = items.length ? items.map((item, index) => {
      const sample = sampleAtElapsed(item, state.playElapsed);
      return `<span style="color:${COLORS[index]}">L${item.lap.number} ${(sample?.x || 0).toFixed(1)} m</span>`;
    }).join('') : '-- m';
    updatePlaybackValues(items, state.hoverDistance);
    if (ui.play) { ui.play.textContent = state.playing ? 'Ⅱ 일시정지' : '▶ 재생'; ui.play.disabled = !duration; }
    Object.values(state.charts).forEach(chart => chart.draw());
  }
  function setPlaying(active) {
    const items = selectedLaps(), duration = playbackDuration(items);
    if (!duration) active = false;
    if (active && state.playElapsed >= duration - .001) state.playElapsed = 0;
    state.playing = active;
    state.playStamp = 0;
    if (state.playFrame) cancelAnimationFrame(state.playFrame);
    state.playFrame = active ? requestAnimationFrame(playTick) : 0;
    syncPlaybackUi(items);
    renderMap(items);
  }
  function playTick(timestamp) {
    if (!state.playing) return;
    const items = selectedLaps(), duration = playbackDuration(items);
    if (state.playStamp) state.playElapsed += ((timestamp - state.playStamp) / 1000) * state.playRate;
    state.playStamp = timestamp;
    if (state.playElapsed >= duration) { state.playElapsed = duration; setPlaying(false); return; }
    syncPlaybackUi(items);
    renderMap(items);
    state.playFrame = requestAnimationFrame(playTick);
  }

  function updateCount() { if (ui.count) ui.count.textContent = `${state.selected.size} / 4 선택`; }
  function render() {
    const items = selectedLaps(); updateCount(); renderSummary(items); renderCharts(items); renderSectors(items); syncPlaybackUi(items); renderMap(items);
    if (items.length) setStatus(`${items.length}개 랩을 1 m 간격 공통 중심선 거리축으로 비교 중입니다.`);
  }
  window.renderDriverComparison = render;
  window.stopDriverComparisonPlayback = () => setPlaying(false);
  window.registerCurrentComparisonSession = snapshot => {
    try {
      const session = addSession(snapshot, true);
      renderSessions();
      render();
      setStatus(`${session.fileName}의 ${session.laps.length}개 랩을 불러왔습니다. 같은 CSV 안에서 바로 비교할 수 있습니다.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  };

  ui.files?.addEventListener('change', event => { const files = [...event.target.files]; event.target.value = ''; importFiles(files); });
  ui.clear?.addEventListener('click', () => {
    setPlaying(false);
    state.sessions = []; state.selected.clear(); state.cache.clear(); state.viewMin = 0; state.viewMax = null; state.hoverDistance = null; state.activeSector = null; state.lastSector = 0; state.mapGeometry = null;
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
    setPlaying(false); state.playElapsed = 0; state.activeSector = null;
    event.target.checked ? state.selected.add(key) : state.selected.delete(key); render();
  });
  ui.sessions?.addEventListener('click', event => {
    const button = event.target.closest('[data-session-pick]');
    if (!button) return;
    const session = state.sessions.find(item => item.id === Number(button.dataset.sessionId));
    if (!session) return;
    setPlaying(false); state.playElapsed = 0; state.activeSector = null;
    session.laps.forEach((_, lapIndex) => state.selected.delete(selectionKey(session.id, lapIndex)));
    const ordered = session.laps.map((lap, lapIndex) => ({ lap, lapIndex })).sort((a, b) => a.lap.duration - b.lap.duration);
    let picks = [];
    if (button.dataset.sessionPick === 'fast') picks = ordered.slice(0, 4);
    if (button.dataset.sessionPick === 'best' && ordered.length) picks = [ordered[0]];
    picks.slice(0, Math.max(0, 4 - state.selected.size)).forEach(item => state.selected.add(selectionKey(session.id, item.lapIndex)));
    renderSessions();
    render();
  });
  ui.play?.addEventListener('click', () => setPlaying(!state.playing));
  ui.rate?.addEventListener('change', () => { state.playRate = Number(ui.rate.value) || 1; });
  ui.slider?.addEventListener('input', () => {
    const requested = Number(ui.slider.value) || 0;
    setPlaying(false);
    state.playElapsed = requested;
    state.hoverDistance = null;
    syncPlaybackUi();
    renderMap(selectedLaps());
  });
  ui.sector?.addEventListener('click', event => {
    const toggle = event.target.closest('[data-sector-toggle]');
    if (toggle) {
      selectSector(state.activeSector === null ? state.lastSector : null);
      return;
    }
    const button = event.target.closest('[data-sector]');
    if (!button) return;
    selectSector(Number(button.dataset.sector));
  });
  ui.map?.addEventListener('click', event => {
    const geometry = state.mapGeometry;
    if (!geometry) return;
    const rect = ui.map.getBoundingClientRect();
    const point = geometry.toGeo(event.clientX - rect.left, event.clientY - rect.top);
    const hit = projectPoint(point.lat, point.lon);
    if (!hit || Math.sqrt(hit.error2) > 40) return;
    jumpToDistance(hit.distance);
  });
  document.addEventListener('keydown', event => {
    if (event.code !== 'Space' || !$('page-comparison')?.classList.contains('active')) return;
    if (event.target.matches('input, textarea, select, button') || event.target.isContentEditable) return;
    event.preventDefault(); setPlaying(!state.playing);
  });
  window.addEventListener('resize', () => { if ($('page-comparison')?.classList.contains('active')) renderMap(selectedLaps()); });
})();
