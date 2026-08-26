(() => {
  'use strict';

  const COLORS = ['#06b6d4', '#ff3d9a', '#76ff03', '#ffca28'];
  const state = { sessions: [], selected: new Set(), primarySourceKey: null, cache: new Map(), distanceMapCache: new Map(), sourceSeriesCache: new Map(), sectorCache: new Map(), sectorMetricsCache: new Map(), charts: {}, seriesEnabled: new Map(), serial: 0, playing: false, playElapsed: 0, playRate: 1, playFrame: 0, playStamp: 0, playRenderStamp: 0, viewMin: 0, viewMax: null, hoverDistance: null, activeSector: null, activeSectorEnd: null, lastSector: 0, mapGeometry: null };
  const boundChartCanvases = new WeakSet();
  const $ = id => document.getElementById(id);
  const ui = {
    files: $('comparison-files'), status: $('comparison-status'),
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
  const isReverseCourse = () => window.getNssurCourseDirection?.() === 'reverse';
  const directedDistance = distance => isReverseCourse() ? totalDistance() - Number(distance || 0) : Number(distance || 0);
  let referenceMetricCache = null;
  let referenceMetricSource = null;
  const COMPARISON_IMU_FIELDS = [
    ['imu_accel_x_g', 'imu_filtered_ax_g'], ['imu_accel_y_g', 'imu_filtered_ay_g'],
    ['imu_gyro_x_dps', 'imu_filtered_gx_dps'], ['imu_gyro_y_dps', 'imu_filtered_gy_dps'], ['imu_gyro_z_dps', 'imu_filtered_gz_dps']
  ];

  function applyComparisonImuFilter(session) {
    const rows = session?.rows || [];
    if (!rows.length) return;
    const enabled = $('gps-imu-lpf')?.checked !== false;
    const cutoff = 5;
    const span = Number(rows.at(-1)?.time_sec) - Number(rows[0]?.time_sec);
    const rate = span > 0 ? Math.max(1, Math.round((rows.length - 1) / span)) : 100;
    COMPARISON_IMU_FIELDS.forEach(([rawField, filteredField]) => {
      // Page 4 and Page 5 share the same 5 Hz IMU fields. Reuse a field that
      // the other page has already filtered instead of filtering the CSV twice.
      if (Number.isFinite(Number(rows[0]?.[filteredField])) && Number.isFinite(Number(rows.at(-1)?.[filteredField]))) return;
      const raw = Float64Array.from(rows, row => Number(row[rawField]) || 0);
      const values = enabled && typeof fltButterworth === 'function' ? fltButterworth(raw, cutoff, rate, 2) : raw;
      rows.forEach((row, index) => { row[filteredField] = values[index]; });
    });
  }

  function refreshComparisonImuFilters() {
    state.sessions.forEach(applyComparisonImuFilter);
    state.sourceSeriesCache.clear(); state.cache.clear();
    if (state.sessions.length) render();
  }

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
    const isNew = !session;
    if (isNew) {
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
      applyComparisonImuFilter(session);
      state.sessions.push(session);
    }
    if (autoSelect && isNew && state.selected.size < 4) {
      const best = session.laps.map((lap, lapIndex) => ({ lap, lapIndex })).sort((a, b) => a.lap.duration - b.lap.duration)[0];
      if (best) state.selected.add(selectionKey(session.id, best.lapIndex));
    }
    return session;
  }

  function importOne(file) {
    return new Promise((resolve, reject) => {
      handleFile(file, {
        skipUpload: true,
        onComplete: snapshot => {
          try {
            addSession(snapshot, true);
            window.registerPage4ComparisonSession?.(snapshot);
            resolve();
          }
          catch (error) { reject(error); }
        },
        onError: reject
      });
    });
  }

  async function importFiles(files) {
    if (!files.length) return;
    const importStartedAt = performance.now();
    switchTab('comparison');
    window.ensurePrimaryDashboardFile?.(files[0]);
    let failures = [];
    for (let index = 0; index < files.length; index += 1) {
      setStatus(`${index + 1} / ${files.length} · ${files[index].name} 분석 중…`);
      try { await importOne(files[index]); }
      catch (error) { failures.push(error.message); }
    }
    if (typeof window.restorePrimaryDashboardFile === 'function') await window.restorePrimaryDashboardFile();
    renderSessions();
    if (state.selected.size >= 1) {
      render();
      if (!failures.length) setStatus(`${files.length}개 CSV 추가 완료 · ${((performance.now() - importStartedAt) / 1000).toFixed(1)}초`);
    } else setStatus(failures.length ? failures.join(' / ') : `${files.length}개 CSV 추가 완료 · ${((performance.now() - importStartedAt) / 1000).toFixed(1)}초 · 같은 파일 안에서도 비교할 랩을 선택할 수 있습니다.`, failures.length > 0);
  }

  function renderSessions() {
    if (!ui.sessions) return;
    ui.sessions.innerHTML = state.sessions.length ? state.sessions.map(session => `
      <section class="comparison-session" data-session="${session.id}">
        <div class="comparison-session-header">
          <input type="text" value="${escapeHtml(session.driver)}" aria-label="드라이버 이름" data-driver="${session.id}">
          <button type="button" class="comparison-session-remove" data-session-remove="${session.id}" aria-label="${escapeHtml(session.driver)} 세션 제거" title="이 세션 제거">×</button>
        </div>
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

  function page4RepresentativeSelections() {
    const ordered = selectedLaps().slice().sort((a, b) => a.lap.duration - b.lap.duration);
    const picked = [];
    // 여러 세션이 선택된 경우 각 세션의 가장 빠른 선택 랩을 우선한다.
    ordered.forEach(item => {
      if (picked.length < 2 && !picked.some(pick => pick.session.id === item.session.id)) picked.push(item);
    });
    // 한 세션만 선택된 경우에는 그 세션 안에서 빠른 두 랩을 채운다.
    ordered.forEach(item => {
      if (picked.length < 2 && !picked.includes(item)) picked.push(item);
    });
    return picked.map(item => ({ sourceKey: item.session.sourceKey, lapIndex: item.lapIndex }));
  }

  function syncSelectionToPage4() {
    window.setPage4ComparisonSelection?.(page4RepresentativeSelections());
  }

  function referenceMeters() {
    const points = reference();
    if (points.length < 2) return [];
    // The track reference is immutable during a session. Rebuilding hundreds of
    // metric point objects for every single GPS fix made CSV import needlessly slow.
    if (referenceMetricCache && referenceMetricSource === points) return referenceMetricCache;
    const lat0 = points[0][0] * Math.PI / 180;
    const mLat = 111320, mLon = mLat * Math.cos(lat0);
    referenceMetricSource = points;
    referenceMetricCache = points.map(point => ({ x: (point[1] - points[0][1]) * mLon, y: (point[0] - points[0][0]) * mLat, d: Number(point[2]) || 0 }));
    return referenceMetricCache;
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
    if (state.distanceMapCache.has(item.key)) return state.distanceMapCache.get(item.key);
    const fixes = item.session.gpsPoints.filter(point => point.time >= item.lap.startTime - .05 && point.time <= item.lap.endTime + .05);
    const map = [{ time: item.lap.startTime, distance: 0 }];
    const reverse = isReverseCourse();
    let segment = reverse ? referenceMeters().length - 2 : 0, distance = 0;
    const trackLength = totalDistance();
    fixes.forEach((point, index) => {
      const hit = projectPoint(point.lat, point.lon, segment, index < 2 ? 35 : 35);
      if (!hit) return;
      segment = reverse ? Math.min(segment, hit.segment) : Math.max(segment, hit.segment);
      distance = Math.max(distance, Math.min(trackLength, directedDistance(hit.distance)));
      map.push({ time: point.time, distance });
    });
    map.push({ time: item.lap.endTime, distance: trackLength });
    map.sort((a, b) => a.distance - b.distance || a.time - b.time);
    state.distanceMapCache.set(item.key, map);
    return map;
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

  const COMPARISON_MAX_VISIBLE_POINTS = 4500;
  const COMPARISON_SOURCE_HZ = { speed: 100, tps: 100, brake: 100, steering: 100, yaw: 100 };

  function comparisonSourceValue(key, row) {
    if (key === 'speed') return vehicleSpeed(row);
    if (key === 'tps') return Number(row.decoded_tps) || 0;
    if (key === 'brake') return getCalibratedBrake(row.front_brake_raw);
    if (key === 'steering') return Number.isFinite(Number(row.steering_filtered_deg)) ? Number(row.steering_filtered_deg) : getCalibratedSteering(row.steering_raw);
    if (key === 'yaw') return Number.isFinite(Number(row.imu_filtered_gz_dps)) ? Number(row.imu_filtered_gz_dps) : (Number(row.imu_gyro_z_dps) || 0);
    return 0;
  }

  function fullComparisonSourceSeries(item, key, sourceHz) {
    const cacheKey = `${item.key}|${key}|${sourceHz}`;
    if (state.sourceSeriesCache.has(cacheKey)) return state.sourceSeriesCache.get(cacheKey);
    const map = [...buildDistanceMap(item)].sort((a, b) => a.time - b.time || a.distance - b.distance);
    const points = [];
    item.session.rows.forEach(row => {
      const time = Number(row.time_sec);
      if (!Number.isFinite(time) || time < item.lap.startTime || time > item.lap.endTime) return;
      const x = interpolate(map, time, 'time', 'distance');
      const y = comparisonSourceValue(key, row);
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    });
    points.sort((a, b) => a.x - b.x);
    state.sourceSeriesCache.set(cacheKey, points);
    return points;
  }

  function visibleComparisonSourceSeries(item, key, sourceHz) {
    const min = state.viewMin;
    const max = state.viewMax ?? totalDistance();
    const source = fullComparisonSourceSeries(item, key, sourceHz);
    if (!source.length) return [];
    // Every path must begin and end at the exact same chart coordinates.
    // Otherwise Chart.js starts each canvas dash at a different phase and
    // overlapping dashed runs can fill each other's gaps like a solid line.
    const visible = [
      { x: min, y: seriesValueAt(source, min) },
      ...source.filter(point => point.x > min + 1e-6 && point.x < max - 1e-6),
      { x: max, y: seriesValueAt(source, max) }
    ];
    if (visible.length <= COMPARISON_MAX_VISIBLE_POINTS) return visible;
    return envelopeSeries(visible, COMPARISON_MAX_VISIBLE_POINTS);
  }

  function envelopeSeries(points, limit) {
    if (points.length <= limit || limit < 6) return points;
    const bucketCount = Math.max(1, Math.floor((limit - 2) / 4));
    const interiorEnd = points.length - 1;
    const result = [points[0]];
    let previousIndex = 0;
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const start = Math.max(1, Math.floor(1 + bucket * (interiorEnd - 1) / bucketCount));
      const end = Math.min(interiorEnd, Math.max(start + 1, Math.floor(1 + (bucket + 1) * (interiorEnd - 1) / bucketCount)));
      let minIndex = start, maxIndex = start;
      for (let index = start + 1; index < end; index += 1) {
        if (points[index].y < points[minIndex].y) minIndex = index;
        if (points[index].y > points[maxIndex].y) maxIndex = index;
      }
      [start, minIndex, maxIndex, end - 1].sort((a, b) => a - b).forEach(index => {
        if (index > previousIndex) { result.push(points[index]); previousIndex = index; }
      });
    }
    if (previousIndex !== points.length - 1) result.push(points.at(-1));
    return result;
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
        steering: Number.isFinite(Number(row.steering_filtered_deg)) ? Number(row.steering_filtered_deg) : getCalibratedSteering(row.steering_raw),
        yaw: Number.isFinite(Number(row.imu_filtered_gz_dps)) ? Number(row.imu_filtered_gz_dps) : (Number(row.imu_gyro_z_dps) || 0)
      });
    }
    state.cache.set(item.key, samples);
    return samples;
  }

  function chartOptions(yTitle) {
    const distance = totalDistance();
    return {
      responsive: true, maintainAspectRatio: false, animation: false, normalized: false, parsing: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: { type: 'linear', min: state.viewMin, max: state.viewMax ?? distance, title: { display: false }, ticks: { display: true, autoSkip: true, maxTicksLimit: 7, padding: 1, font: { size: 8 } } },
        y: { title: { display: false, text: yTitle }, ticks: { maxTicksLimit: 6, padding: 2, font: { size: 8 } } }
      }
    };
  }

  function setChartViewRange(min, max) {
    const distance = totalDistance();
    const width = Math.max(2, Math.min(distance, max - min));
    state.viewMin = Math.max(0, Math.min(Math.max(0, distance - width), min));
    state.viewMax = state.viewMin + width;
    Object.values(state.charts).forEach(chart => {
      chart.options.scales.x.min = state.viewMin;
      chart.options.scales.x.max = state.viewMax;
      chart.data.datasets.forEach(dataset => {
        if (!dataset.comparisonItem || !dataset.comparisonKey) return;
        dataset.data = visibleComparisonSourceSeries(dataset.comparisonItem, dataset.comparisonKey, dataset.comparisonSourceHz);
      });
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
    if (state.activeSector === null) {
      state.playElapsed = Math.max(0, Math.min(items[0].lap.duration, elapsed));
    } else {
      const timing = sectorRangeTiming(items[0], state.activeSector, state.activeSectorEnd, items);
      const sectorStartElapsed = timing ? timing.start.time - items[0].lap.startTime : 0;
      state.playElapsed = Math.max(0, Math.min(timing?.duration || 0, elapsed - sectorStartElapsed));
    }
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
    let dragStartPx = null;
    let suppressClick = false;
    let zoomFrame = 0;
    let pendingZoom = null;
    const chartAndPoint = event => {
      const chart = Object.values(state.charts).find(candidate => candidate.canvas === canvas);
      if (!chart?.chartArea) return null;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      const inside = x >= chart.chartArea.left && x <= chart.chartArea.right && y >= chart.chartArea.top && y <= chart.chartArea.bottom;
      return { chart, x, y, inside };
    };
    canvas.addEventListener('wheel', event => {
      const hit = chartAndPoint(event);
      if (!hit?.inside) return;
      event.preventDefault();
      const { chart, x } = hit;
      const anchor = chart.scales.x.getValueForPixel(x);
      pendingZoom = { anchor, zoomOut: event.deltaY > 0 };
      if (zoomFrame) return;
      zoomFrame = requestAnimationFrame(() => {
        zoomFrame = 0;
        if (!pendingZoom) return;
        const request = pendingZoom;
        pendingZoom = null;
        const activeChart = Object.values(state.charts).find(candidate => candidate.canvas === canvas);
        if (!activeChart) return;
        const currentMin = activeChart.scales.x.min, currentMax = activeChart.scales.x.max;
        // Page 4 and the main charts use a restrained zoom step. Keep the
        // comparison page at the same pace instead of its previous 22% jump.
        const factor = request.zoomOut ? 1.08 : .92;
        const nextWidth = Math.max(2, Math.min(totalDistance(), (currentMax - currentMin) * factor));
        const ratio = Math.max(0, Math.min(1, (request.anchor - currentMin) / Math.max(.001, currentMax - currentMin)));
        setChartViewRange(request.anchor - nextWidth * ratio, request.anchor + nextWidth * (1 - ratio));
      });
    }, { passive: false });
    canvas.addEventListener('pointerdown', event => {
      const hit = chartAndPoint(event);
      if (event.button !== 0 || !hit?.inside) return;
      dragStartPx = hit.x;
      suppressClick = false;
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (dragStartPx === null) return;
      const hit = chartAndPoint(event);
      if (!hit) return;
      suppressClick = Math.abs(hit.x - dragStartPx) >= 7;
      canvas.style.cursor = suppressClick ? 'col-resize' : 'crosshair';
    });
    const finishDrag = event => {
      if (dragStartPx === null) return;
      const hit = chartAndPoint(event);
      const startPx = dragStartPx;
      dragStartPx = null;
      canvas.style.cursor = 'crosshair';
      if (!hit || Math.abs(hit.x - startPx) < 7) return;
      const leftPx = Math.max(hit.chart.chartArea.left, Math.min(startPx, hit.x));
      const rightPx = Math.min(hit.chart.chartArea.right, Math.max(startPx, hit.x));
      if (rightPx - leftPx < 7) return;
      setChartViewRange(hit.chart.scales.x.getValueForPixel(leftPx), hit.chart.scales.x.getValueForPixel(rightPx));
    };
    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', () => { dragStartPx = null; suppressClick = false; canvas.style.cursor = 'crosshair'; });
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
      if (suppressClick) { suppressClick = false; return; }
      const chart = Object.values(state.charts).find(candidate => candidate.canvas === canvas);
      if (!chart?.chartArea) return;
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left, py = event.clientY - rect.top;
      if (px < chart.chartArea.left || px > chart.chartArea.right || py < chart.chartArea.top || py > chart.chartArea.bottom) return;
      jumpToDistance(chart.scales.x.getValueForPixel(px));
    });
    canvas.addEventListener('dblclick', () => { state.activeSector = null; state.activeSectorEnd = null; setChartViewRange(0, totalDistance()); renderSectors(selectedLaps()); renderMap(selectedLaps()); });
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

  function cursorElapsedForItem(item, items = selectedLaps()) {
    if (state.activeSector === null) return state.playElapsed;
    const timing = sectorRangeTiming(item, state.activeSector, state.activeSectorEnd, items);
    return timing ? timing.start.time - item.lap.startTime + Math.min(state.playElapsed, timing.duration) : 0;
  }

  function cursorSampleForItem(item, items = selectedLaps()) {
    const sample = sampleAtElapsed(item, cursorElapsedForItem(item, items));
    if (sample && state.activeSector !== null) {
      const bounds = sectorBounds(items);
      const timing = sectorRangeTiming(item, state.activeSector, state.activeSectorEnd, items);
      if (state.playElapsed <= .001) sample.x = bounds[state.activeSector];
      else if (timing && state.playElapsed >= timing.duration - .001) sample.x = bounds[(state.activeSectorEnd ?? state.activeSector) + 1];
    }
    return sample;
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
      const ctx = chart.ctx, positions = items.map(item => cursorSampleForItem(item, items));
      ctx.save();
      positions.forEach((sample, index) => {
        if (!sample) return;
        const x = chart.scales.x.getPixelForValue(sample.x);
        if (x < chart.chartArea.left || x > chart.chartArea.right) return;
        ctx.beginPath(); ctx.moveTo(x, chart.chartArea.top); ctx.lineTo(x, chart.chartArea.bottom);
        ctx.strokeStyle = COLORS[index]; ctx.lineWidth = 1.5; ctx.globalAlpha = .78; ctx.stroke();
        chart.data.datasets.forEach((dataset, datasetIndex) => {
          if (!chart.isDatasetVisible(datasetIndex)) return;
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
    datasets.forEach((dataset, index) => {
      dataset.comparisonSeriesId ||= `${name}|${index}|${dataset.label}`;
      if (!state.seriesEnabled.has(dataset.comparisonSeriesId)) state.seriesEnabled.set(dataset.comparisonSeriesId, true);
      dataset.hidden = state.seriesEnabled.get(dataset.comparisonSeriesId) === false;
    });
    state.charts[name] = new Chart(canvas, { type: 'line', data: { datasets }, options, plugins: [comparisonCursorPlugin] });
    state.charts[name].$comparisonName = name;
    renderSeriesToggleButtons(name);
    bindChartZoom(canvas);
  }

  function renderSeriesToggleButtons(name) {
    const container = $(`comparison-${name}-toggles`);
    const chart = state.charts[name];
    if (!container || !chart) return;
    container.innerHTML = chart.data.datasets.map((dataset, index) => {
      const active = chart.isDatasetVisible(index);
      const dashed = Array.isArray(dataset.borderDash) && dataset.borderDash.length > 0;
      return `<button type="button" data-comparison-series-chart="${name}" data-comparison-series-index="${index}" class="${active ? 'active' : ''}" aria-pressed="${active}" style="--series-color:${dataset.borderColor}"><i class="${dashed ? 'dashed' : ''}"></i>${escapeHtml(dataset.label)}</button>`;
    }).join('');
  }

  function sourceLine(label, color, item, key, dashed = false, comparisonIndex = 0) {
    const sourceHz = COMPARISON_SOURCE_HZ[key] || 100;
    return {
      label, comparisonIndex, comparisonItem: item, comparisonKey: key, comparisonSourceHz: sourceHz,
      comparisonSeriesId: `${item.key}|${key}`,
      data: visibleComparisonSourceSeries(item, key, sourceHz),
      borderColor: color, backgroundColor: color, borderWidth: dashed ? 2 : 1.7,
      borderDash: dashed ? [12, 8] : [], borderDashOffset: 0, pointRadius: 0, spanGaps: true, fill: false
    };
  }

  function renderCharts(items) {
    const sampled = items.map((item, index) => ({ item, color: COLORS[index], data: sampleLap(item), label: `${item.session.driver} · L${item.lap.number}` }));
    const singleLap = sampled.length === 1;
    rebuildChart('speed', 'comparison-speed-chart', sampled.map((s, i) => sourceLine(s.label, s.color, s.item, 'speed', false, i)), 'km/h', { min: 0 });
    rebuildChart('pedal', 'comparison-pedal-chart', sampled.flatMap((s, i) => [
      sourceLine(`${s.label} TPS`, singleLap ? '#16a34a' : s.color, s.item, 'tps', false, i),
      sourceLine(`${s.label} Brake`, singleLap ? '#ef4444' : s.color, s.item, 'brake', true, i)
    ]), '%', { min: 0, max: 100 });
    rebuildChart('steering', 'comparison-steering-chart', sampled.flatMap((s, i) => [
      sourceLine(`${s.label} Steering`, singleLap ? '#db2777' : s.color, s.item, 'steering', false, i),
      sourceLine(`${s.label} Yaw`, singleLap ? '#22c55e' : s.color, s.item, 'yaw', true, i)
    ]), '° / °/s');
    const baseline = sampled[0]?.data || [];
    rebuildChart('delta', 'comparison-delta-chart', sampled.map(s => ({
      label: s.label, data: s.data.map((point, index) => ({ x: point.x, y: point.elapsed - (baseline[index]?.elapsed || 0) })),
      comparisonIndex: sampled.indexOf(s), comparisonSeriesId: `${s.item.key}|delta`, borderColor: s.color, backgroundColor: s.color, borderWidth: 1.8, pointRadius: 0, fill: false
    })), 'Δ time [s]');
  }

  function renderSummary(items) {
    if (!ui.summary) return;
    if (items.length < 2) { ui.summary.innerHTML = '<p class="comparison-empty">두 개 이상의 랩을 선택하면 차이를 계산합니다.</p>'; return; }
    const baseline = items[0], fastest = [...items].sort((a, b) => a.lap.duration - b.lap.duration)[0];
    ui.summary.innerHTML = items.map((item, index) => {
      const delta = item.lap.duration - baseline.lap.duration;
      const maxSpeed = Math.max(...sampleLap(item).map(point => point.speed));
      const comparisonText = item === baseline ? '기준' : `기준 대비 ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}초`;
      return `<div class="comparison-summary-card" style="border-color:${COLORS[index]}"><b>${escapeHtml(item.session.driver)} · LAP ${item.lap.number}${item === fastest ? ' ★' : ''}</b><span>${formatLap(item.lap.duration)} · ${comparisonText} · 최고 ${maxSpeed.toFixed(1)} km/h</span></div>`;
    }).join('');
  }

  function checkpointReferenceDistance(line) {
    const points = reference();
    if (!line?.[0] || !line?.[1] || points.length < 2) return NaN;
    const origin = line[0];
    const lat0 = origin.lat * Math.PI / 180, mLat = 111320, mLon = mLat * Math.cos(lat0);
    const local = point => ({
      x: (Number(point.lon ?? point[1]) - origin.lon) * mLon,
      y: (Number(point.lat ?? point[0]) - origin.lat) * mLat
    });
    const a = local(line[0]), b = local(line[1]), rx = b.x - a.x, ry = b.y - a.y;
    for (let index = 1; index < points.length; index += 1) {
      const p = local(points[index - 1]), q = local(points[index]);
      const sx = q.x - p.x, sy = q.y - p.y, denominator = sx * ry - sy * rx;
      if (Math.abs(denominator) < 1e-9) continue;
      const dx = a.x - p.x, dy = a.y - p.y;
      const referenceRatio = (dx * ry - dy * rx) / denominator;
      const lineRatio = (dx * sy - dy * sx) / denominator;
      if (referenceRatio < 0 || referenceRatio > 1 || lineRatio < 0 || lineRatio > 1) continue;
      const startDistance = Number(points[index - 1][2]) || 0;
      const endDistance = Number(points[index][2]) || startDistance;
      return directedDistance(startDistance + (endDistance - startDistance) * referenceRatio);
    }
    const mid = { lat: (line[0].lat + line[1].lat) / 2, lon: (line[0].lon + line[1].lon) / 2 };
    const projected = projectPoint(mid.lat, mid.lon)?.distance;
    return Number.isFinite(projected) ? directedDistance(projected) : NaN;
  }

  function checkpointDistances(items) {
    const source = items[0]?.session.checkpoints || [];
    return source.map(checkpointReferenceDistance)
      .filter(Number.isFinite).filter(distance => distance > 2 && distance < totalDistance() - 2).sort((a, b) => a - b);
  }

  window.addEventListener('nssur-course-direction-change', () => {
    state.distanceMapCache.clear();
    state.sourceSeriesCache.clear();
    state.sectorCache.clear();
    state.sectorMetricsCache.clear();
    state.cache.clear();
    state.viewMin = 0;
    state.viewMax = null;
    if (state.sessions.length) render();
  });

  function sectorBounds(items) {
    return [0, ...checkpointDistances(items), totalDistance()];
  }

  function orderedCheckpointLines(items) {
    const source = items[0]?.session.checkpoints || [];
    return source.map((line, sourceIndex) => {
      if (!line?.[0] || !line?.[1]) return null;
      const distance = checkpointReferenceDistance(line);
      return Number.isFinite(distance) && distance > 2 && distance < totalDistance() - 2
        ? { line, sourceIndex, distance }
        : null;
    }).filter(Boolean).sort((a, b) => a.distance - b.distance);
  }

  function interpolateGpsPoint(left, right, ratio, time) {
    return {
      time,
      lat: left.lat + (right.lat - left.lat) * ratio,
      lon: left.lon + (right.lon - left.lon) * ratio
    };
  }

  function findLapLineCrossing(item, line, afterTime) {
    const fixes = item.session.gpsPoints
      .filter(point => point.time >= item.lap.startTime - .05 && point.time <= item.lap.endTime + .05)
      .sort((a, b) => a.time - b.time);
    if (fixes.length < 2) return null;
    const origin = line[0];
    const lat0 = origin.lat * Math.PI / 180, mLat = 111320, mLon = mLat * Math.cos(lat0);
    const local = point => ({ x: (point.lon - origin.lon) * mLon, y: (point.lat - origin.lat) * mLat });
    const a = local(line[0]), b = local(line[1]);
    const rx = b.x - a.x, ry = b.y - a.y;
    for (let index = 1; index < fixes.length; index += 1) {
      const previous = fixes[index - 1], current = fixes[index];
      if (current.time <= afterTime + .001) continue;
      const p = local(previous), q = local(current), sx = q.x - p.x, sy = q.y - p.y;
      const denominator = sx * ry - sy * rx;
      if (Math.abs(denominator) < 1e-9) continue;
      const dx = a.x - p.x, dy = a.y - p.y;
      const travelRatio = (dx * ry - dy * rx) / denominator;
      const lineRatio = (dx * sy - dy * sx) / denominator;
      if (travelRatio < 0 || travelRatio > 1 || lineRatio < 0 || lineRatio > 1) continue;
      const time = previous.time + (current.time - previous.time) * travelRatio;
      if (time <= afterTime + .001 || time >= item.lap.endTime - .001) continue;
      return interpolateGpsPoint(previous, current, travelRatio, time);
    }
    return null;
  }

  function lapPointAtTime(item, time) {
    const points = item.session.gpsPoints
      // GPS fixes are about 0.2 s apart. Include the fixes surrounding each
      // boundary so every cursor starts at the interpolated line crossing,
      // not at a different first post-crossing sample.
      .filter(point => point.time >= item.lap.startTime - .5 && point.time <= item.lap.endTime + .5)
      .sort((a, b) => a.time - b.time);
    if (!points.length) return null;
    let low = 0, high = points.length - 1;
    while (low < high) { const middle = (low + high) >> 1; if (points[middle].time < time) low = middle + 1; else high = middle; }
    const right = points[low], left = points[Math.max(0, low - 1)];
    const span = right.time - left.time;
    const ratio = span ? Math.max(0, Math.min(1, (time - left.time) / span)) : 0;
    return interpolateGpsPoint(left, right, ratio, time);
  }

  function lapSectorBoundaries(item, items) {
    const definitions = orderedCheckpointLines(items);
    const signature = definitions.map(({ line }) => line.map(point => `${Number(point.lat).toFixed(7)},${Number(point.lon).toFixed(7)}`).join(':')).join('|');
    const cacheKey = `${item.key}|${signature}`;
    if (state.sectorCache.has(cacheKey)) return state.sectorCache.get(cacheKey);
    const start = lapPointAtTime(item, item.lap.startTime);
    const finish = lapPointAtTime(item, item.lap.endTime);
    if (!start || !finish) return [];
    const boundaries = [start];
    let afterTime = item.lap.startTime;
    for (const definition of definitions) {
      const crossing = findLapLineCrossing(item, definition.line, afterTime);
      if (!crossing) {
        state.sectorCache.set(cacheKey, []);
        return [];
      }
      boundaries.push(crossing);
      afterTime = crossing.time;
    }
    boundaries.push(finish);
    state.sectorCache.set(cacheKey, boundaries);
    return boundaries;
  }

  function sectorTiming(item, sectorIndex, items) {
    const boundaries = lapSectorBoundaries(item, items);
    const start = boundaries[sectorIndex], end = boundaries[sectorIndex + 1];
    return start && end ? { start, end, duration: end.time - start.time } : null;
  }

  function sectorDuration(item, sectorIndex, items) {
    return sectorTiming(item, sectorIndex, items)?.duration ?? NaN;
  }

  function gpsDistanceMeters(left, right) {
    const meanLat = (left.lat + right.lat) * Math.PI / 360;
    const dy = (right.lat - left.lat) * 111320;
    const dx = (right.lon - left.lon) * 111320 * Math.cos(meanLat);
    return Math.hypot(dx, dy);
  }

  function sectorPathMetrics(item, sectorIndex, items, commonStart, commonEnd) {
    const timing = sectorTiming(item, sectorIndex, items);
    if (!timing) return null;
    const cacheKey = `${item.key}|path|${sectorIndex}|${timing.start.time.toFixed(4)}|${timing.end.time.toFixed(4)}`;
    if (state.sectorMetricsCache.has(cacheKey)) return state.sectorMetricsCache.get(cacheKey);
    const interior = item.session.gpsPoints
      .filter(point => point.time > timing.start.time && point.time < timing.end.time)
      .sort((a, b) => a.time - b.time);
    const points = [timing.start, ...interior, timing.end];
    let actualDistance = 0;
    for (let index = 1; index < points.length; index += 1) actualDistance += gpsDistanceMeters(points[index - 1], points[index]);
    const deviations = points.map(point => projectPoint(point.lat, point.lon)).filter(Boolean).map(hit => Math.sqrt(hit.error2));
    const commonDistance = Math.max(0, commonEnd - commonStart);
    const metrics = {
      actualDistance,
      commonDistance,
      extraDistance: actualDistance - commonDistance,
      averageSpeed: timing.duration > 0 ? actualDistance / timing.duration * 3.6 : NaN,
      meanDeviation: deviations.length ? deviations.reduce((sum, value) => sum + value, 0) / deviations.length : NaN,
      maxDeviation: deviations.length ? Math.max(...deviations) : NaN
    };
    state.sectorMetricsCache.set(cacheKey, metrics);
    return metrics;
  }

  function sectorRangeTiming(item, startIndex, endIndex, items) {
    if (!Number.isInteger(startIndex)) return null;
    const boundaries = lapSectorBoundaries(item, items);
    const end = Number.isInteger(endIndex) ? endIndex : startIndex;
    const startPoint = boundaries[startIndex], endPoint = boundaries[end + 1];
    return startPoint && endPoint ? { start: startPoint, end: endPoint, duration: endPoint.time - startPoint.time } : null;
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

  function updateSectorStickyOffset() {
    const controlsElement = ui.sector?.querySelector('.comparison-sector-controls');
    ui.sector?.style.setProperty('--sector-controls-height', `${controlsElement?.offsetHeight || 0}px`);
  }

  function selectSectorRange(startIndex, endIndex = startIndex) {
    const items = selectedLaps(), bounds = sectorBounds(items);
    const maximum = bounds.length - 2;
    const valid = Number.isInteger(startIndex) && startIndex >= 0 && startIndex <= maximum;
    state.activeSector = valid ? Math.min(startIndex, endIndex) : null;
    state.activeSectorEnd = valid ? Math.max(startIndex, Math.min(maximum, endIndex)) : null;
    if (state.activeSector !== null) state.lastSector = state.activeSector;
    if (state.activeSector === null) setChartViewRange(0, totalDistance());
    else {
      const start = bounds[state.activeSector], end = bounds[state.activeSectorEnd + 1];
      setChartViewRange(start, end);
      setPlaying(false);
      state.playElapsed = 0;
      state.hoverDistance = null;
    }
    syncPlaybackUi(items);
    renderSectors(items);
    renderMap(items);
    scrollSelectedSectorIntoView(state.activeSector);
  }

  function pedalEventSummary(points, key, threshold) {
    if (!points.length) return { events: [], activeTime: 0, average: 0, maximum: 0 };
    let weighted = 0, totalTime = 0, activeTime = 0, run = null;
    const rawRuns = [];
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1], current = points[index];
      const dt = Math.max(0, current.elapsed - previous.elapsed);
      const previousValue = Number(previous[key]) || 0, currentValue = Number(current[key]) || 0;
      weighted += (previousValue + currentValue) * .5 * dt;
      totalTime += dt;
      if (previousValue >= threshold || currentValue >= threshold) {
        activeTime += dt;
        if (!run) run = { start: previous.x, startTime: previous.elapsed, end: current.x, endTime: current.elapsed, maximum: Math.max(previousValue, currentValue) };
        else { run.end = current.x; run.endTime = current.elapsed; run.maximum = Math.max(run.maximum, previousValue, currentValue); }
      } else if (run) { rawRuns.push(run); run = null; }
    }
    if (run) rawRuns.push(run);
    // 임계값 아래로 아주 잠깐 떨어진 구간은 페달을 새로 밟은 것이 아니라
    // 한 번의 연속 조작으로 본다. 그 뒤 0.12초 미만 단발성 튐을 제외한다.
    const mergedRuns = [];
    rawRuns.forEach(event => {
      const previous = mergedRuns.at(-1);
      if (previous && (event.startTime - previous.endTime <= .2 || event.start - previous.end <= 3)) {
        previous.end = event.end;
        previous.endTime = event.endTime;
        previous.maximum = Math.max(previous.maximum, event.maximum);
      } else mergedRuns.push({ ...event });
    });
    const events = mergedRuns.filter(event => event.endTime - event.startTime >= .12);
    return {
      events,
      activeTime: events.reduce((sum, event) => sum + event.endTime - event.startTime, 0),
      average: totalTime > 0 ? weighted / totalTime : Number(points[0]?.[key]) || 0,
      maximum: Math.max(...points.map(point => Number(point[key]) || 0)),
      dose: weighted / 100
    };
  }

  function coastDuration(points) {
    let duration = 0;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1], current = points[index];
      if ((Number(previous.tps) || 0) < 5 && (Number(current.tps) || 0) < 5 && (Number(previous.brake) || 0) < 5 && (Number(current.brake) || 0) < 5) {
        duration += Math.max(0, current.elapsed - previous.elapsed);
      }
    }
    return duration;
  }

  function sectorLapAnalysis(cell, sectorIndex, items, start, end, duration) {
    const points = cell.data.filter(point => point.x >= start && point.x <= end);
    const speeds = points.map(point => point.speed);
    return {
      duration,
      points,
      minSpeed: speeds.length ? Math.min(...speeds) : NaN,
      exitSpeed: Number(points.at(-1)?.speed) || 0,
      metrics: sectorPathMetrics(cell.item, sectorIndex, items, start, end),
      brake: pedalEventSummary(points, 'brake', 5),
      throttle: pedalEventSummary(points, 'tps', 20),
      fullThrottle: pedalEventSummary(points, 'tps', 90),
      coastTime: coastDuration(points)
    };
  }

  function signed(value, digits = 1, suffix = '') {
    return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${suffix}`;
  }

  function eventStartComparison(referenceEvents, comparisonEvents) {
    if (!referenceEvents.length && !comparisonEvents.length) return '두 랩 모두 조작 없음';
    const remainingReference = referenceEvents.map((event, index) => ({ event, index }));
    const results = [];
    comparisonEvents.forEach(comparisonEvent => {
      let bestIndex = -1, bestGap = Infinity;
      remainingReference.forEach((candidate, index) => {
        const gap = Math.abs(comparisonEvent.start - candidate.event.start);
        if (gap < bestGap) { bestGap = gap; bestIndex = index; }
      });
      if (bestIndex >= 0 && bestGap <= 20) {
        const referenceEvent = remainingReference.splice(bestIndex, 1)[0].event;
        const difference = comparisonEvent.start - referenceEvent.start;
        const timing = Math.abs(difference) < .5 ? '같은 위치' : `${Math.abs(difference).toFixed(0)}m ${difference < 0 ? '먼저' : '늦게'}`;
        results.push(`${referenceEvent.start.toFixed(0)}m → ${comparisonEvent.start.toFixed(0)}m (${timing})`);
      } else results.push(`비교 랩에서만 ${comparisonEvent.start.toFixed(0)}m`);
    });
    remainingReference.forEach(({ event }) => results.push(`기준 랩에서만 ${event.start.toFixed(0)}m`));
    return results.join(' · ');
  }

  function sectorComparisonMarkup(referenceAnalysis, analysis, referenceLabel = '기준 랩', comparisonLabel = '비교 랩') {
    if (!referenceAnalysis || !analysis?.metrics || !referenceAnalysis.metrics || !Number.isFinite(referenceAnalysis.duration) || !Number.isFinite(analysis.duration)) return '';
    const timeDelta = analysis.duration - referenceAnalysis.duration;
    const distanceDelta = analysis.metrics.actualDistance - referenceAnalysis.metrics.actualDistance;
    const speedDelta = analysis.metrics.averageSpeed - referenceAnalysis.metrics.averageSpeed;
    return `<span class="sector-direct-comparison">
      <small class="comparison-caption">${escapeHtml(referenceLabel)} 대비 ${escapeHtml(comparisonLabel)}</small>
      <span class="comparison-key-deltas">
        <em class="${timeDelta < 0 ? 'gain' : timeDelta > 0 ? 'loss' : ''}">기록 ${signed(timeDelta, 3, 's')}</em>
        <em class="${distanceDelta < 0 ? 'gain' : distanceDelta > 0 ? 'loss' : ''}">거리 ${signed(distanceDelta, 2, 'm')}</em>
        <em class="${speedDelta > 0 ? 'gain' : speedDelta < 0 ? 'loss' : ''}">평균속도 ${signed(speedDelta, 1)}</em>
      </span>
      <small class="comparison-pedal-delta brake">브레이크 시간 ${signed(analysis.brake.activeTime - referenceAnalysis.brake.activeTime, 2, 's')} · 제동량 ${signed(analysis.brake.dose - referenceAnalysis.brake.dose, 2)} · MAX ${signed(analysis.brake.maximum - referenceAnalysis.brake.maximum, 0, '%')}</small>
      <small class="comparison-pedal-delta throttle">평균 TPS ${signed(analysis.throttle.average - referenceAnalysis.throttle.average, 0, '%')} · 풀가속 ${signed(analysis.fullThrottle.activeTime - referenceAnalysis.fullThrottle.activeTime, 2, 's')} · 코스팅 ${signed(analysis.coastTime - referenceAnalysis.coastTime, 2, 's')}</small>
    </span>`;
  }

  function sectorAnalysisCard(cell, analysis, color) {
    const metrics = analysis.metrics;
    return `<section class="sector-detail-lap" style="--lap-color:${color}">
      <h3><i></i><span>${escapeHtml(cell.item.session.driver)}&nbsp;L${cell.item.lap.number}</span><strong>${analysis.duration.toFixed(3)}s</strong></h3>
      <dl>
        <div><dt>실제 주행거리</dt><dd>${metrics?.actualDistance.toFixed(2) ?? '—'}m <small>중심선 대비 ${metrics ? signed(metrics.extraDistance, 2, 'm') : '—'}</small></dd></div>
        <div><dt>속도</dt><dd>평균 ${metrics?.averageSpeed.toFixed(1) ?? '—'} · 최저 ${analysis.minSpeed.toFixed(1)} · 탈출 ${analysis.exitSpeed.toFixed(1)} km/h</dd></div>
        <div><dt>브레이크</dt><dd>사용 ${analysis.brake.activeTime.toFixed(2)}s · 제동량 ${analysis.brake.dose.toFixed(2)} · MAX ${analysis.brake.maximum.toFixed(0)}%</dd></div>
        <div><dt>가속</dt><dd>평균 ${analysis.throttle.average.toFixed(0)}% · 풀가속 ${analysis.fullThrottle.activeTime.toFixed(2)}s · 입력량 ${analysis.throttle.dose.toFixed(2)}</dd></div>
        <div><dt>코스팅</dt><dd>${analysis.coastTime.toFixed(2)}s <small>TPS·브레이크 모두 5% 미만</small></dd></div>
        <div><dt>중심선 이탈</dt><dd>평균 ${metrics?.meanDeviation.toFixed(1) ?? '—'}m · 최대 ${metrics?.maxDeviation.toFixed(1) ?? '—'}m</dd></div>
      </dl>
    </section>`;
  }

  function drawSectorPedalTimeline(dialog, cells, analyses, start, end) {
    const canvas = dialog.querySelector('.sector-pedal-timeline');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    const width = Math.max(320, rect.width), height = 164;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const left = 86, right = 12, plotWidth = width - left - right;
    const x = distance => left + (distance - start) / Math.max(1e-6, end - start) * plotWidth;
    analyses.forEach((analysis, index) => {
      const top = 12 + index * 75, color = COLORS[cells[index === 0 ? 0 : cells.length - 1].index];
      ctx.fillStyle = color; ctx.font = '800 10px monospace';
      const cell = cells[index === 0 ? 0 : cells.length - 1];
      ctx.fillText(`${cell.item.session.driver} L${cell.item.lap.number}`, 7, top + 29);
      [['tps', '#16a34a', top + 29], ['brake', '#ef4444', top + 61]].forEach(([key, lineColor, baseline]) => {
        ctx.beginPath(); ctx.moveTo(x(start), baseline);
        analysis.points.forEach(point => ctx.lineTo(x(point.x), baseline - Math.max(0, Math.min(100, Number(point[key]) || 0)) * .24));
        ctx.lineTo(x(end), baseline); ctx.closePath(); ctx.fillStyle = `${lineColor}26`; ctx.fill();
        ctx.beginPath(); analysis.points.forEach((point, pointIndex) => { const px = x(point.x), py = baseline - Math.max(0, Math.min(100, Number(point[key]) || 0)) * .24; pointIndex ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.strokeStyle = lineColor; ctx.lineWidth = 1.6; ctx.stroke();
      });
      ctx.strokeStyle = 'rgba(148,163,184,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, top + 68); ctx.lineTo(width - right, top + 68); ctx.stroke();
    });
    ctx.fillStyle = '#64748b'; ctx.font = '700 8px monospace'; ctx.fillText(`${start.toFixed(0)}m`, left, height - 3); ctx.textAlign = 'right'; ctx.fillText(`${end.toFixed(0)}m`, width - right, height - 3); ctx.textAlign = 'left';
  }

  function openSectorDetail(sectorIndex, comparisonIndex) {
    const items = selectedLaps(), bounds = sectorBounds(items);
    if (!items[0] || !items[comparisonIndex] || !Number.isInteger(sectorIndex)) return;
    const start = bounds[sectorIndex], end = bounds[sectorIndex + 1];
    const cells = items.map((item, index) => ({ item, index, data: sampleLap(item) }));
    const referenceAnalysis = sectorLapAnalysis(cells[0], sectorIndex, items, start, end, sectorDuration(items[0], sectorIndex, items));
    const comparisonAnalysis = sectorLapAnalysis(cells[comparisonIndex], sectorIndex, items, start, end, sectorDuration(items[comparisonIndex], sectorIndex, items));
    let dialog = document.getElementById('comparison-sector-detail-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'comparison-sector-detail-dialog';
      dialog.className = 'comparison-sector-detail-dialog';
      document.body.appendChild(dialog);
      dialog.addEventListener('click', event => {
        if (event.target === dialog || event.target.closest('[data-sector-detail-close]')) dialog.close();
      });
    }
    const referenceLabel = `${cells[0].item.session.driver} L${cells[0].item.lap.number}`;
    const comparisonLabel = `${cells[comparisonIndex].item.session.driver} L${cells[comparisonIndex].item.lap.number}`;
    dialog.innerHTML = `<div class="sector-detail-shell">
      <header><div><span>CHECKPOINT ANALYSIS</span><h2>S${sectorIndex + 1} 상세 비교</h2><p>${start.toFixed(0)}–${end.toFixed(0)}m · 첫 번째 선택 랩 기준</p></div><button type="button" data-sector-detail-close aria-label="닫기">×</button></header>
      <div class="sector-detail-body">
        <div class="sector-detail-summary">${sectorComparisonMarkup(referenceAnalysis, comparisonAnalysis, referenceLabel, comparisonLabel)}</div>
        <div class="sector-detail-laps">${sectorAnalysisCard(cells[0], referenceAnalysis, COLORS[0])}${sectorAnalysisCard(cells[comparisonIndex], comparisonAnalysis, COLORS[comparisonIndex])}</div>
        <section class="sector-event-comparison"><h3>거리별 페달 입력 비교</h3><div class="sector-timeline-legend"><span class="tps">TPS</span><span class="brake">브레이크</span></div><canvas class="sector-pedal-timeline"></canvas><small>두 랩을 같은 공통 중심선 거리축에 정렬했습니다. 선의 높이가 해당 위치의 페달 입력률입니다.</small></section>
      </div>
    </div>`;
    dialog.showModal();
    requestAnimationFrame(() => drawSectorPedalTimeline(dialog, [cells[0], cells[comparisonIndex]], [referenceAnalysis, comparisonAnalysis], start, end));
  }

  function renderSectors(items) {
    if (!ui.sector) return;
    if (items.length < 2) { ui.sector.innerHTML = '<p class="comparison-empty">두 개 이상의 랩을 선택하세요.</p>'; return; }
    const bounds = sectorBounds(items);
    const cells = items.map((item, index) => ({ item, index, data: sampleLap(item) }));
    const isActive = index => state.activeSector !== null && index >= state.activeSector && index <= state.activeSectorEnd;
    const options = bounds.slice(0, -1).map((_, index) => `<option value="${index}" ${index === state.activeSector ? 'selected' : ''}>S${index + 1}</option>`).join('');
    const endOptions = bounds.slice(0, -1).map((_, index) => `<option value="${index}" ${index === state.activeSectorEnd ? 'selected' : ''}>S${index + 1}</option>`).join('');
    const rangeSummary = state.activeSector === null ? '' : `<div class="comparison-sector-selection-summary"><b>S${state.activeSector + 1}${state.activeSectorEnd > state.activeSector ? `–S${state.activeSectorEnd + 1}` : ''} 소요시간</b>${cells.map(cell => {
      const timing = sectorRangeTiming(cell.item, state.activeSector, state.activeSectorEnd, items);
      return `<span style="--session-color:${COLORS[cell.index]}">${escapeHtml(cell.item.session.driver)}&nbsp;L${cell.item.lap.number} <strong>${timing ? `${timing.duration.toFixed(3)}s` : '통과 기록 없음'}</strong></span>`;
    }).join('')}</div>`;
    const controls = `<div class="comparison-sector-controls"><div class="comparison-sector-buttons">${bounds.slice(0, -1).map((_, index) => `<button type="button" data-sector="${index}" aria-pressed="${isActive(index)}" class="${isActive(index) ? 'active' : ''}">S${index + 1}</button>`).join('')}</div><div class="comparison-sector-range"><span>다중 구간</span><label>시작 <select data-sector-range-start>${options}</select></label><i>→</i><label>종료 <select data-sector-range-end>${endOptions}</select></label><button type="button" data-sector-range-reset>초기화</button></div>${rangeSummary}</div>`;
    ui.sector.innerHTML = `${controls}<table><thead><tr><th>구간</th>${cells.map(cell => `<th style="color:${COLORS[cell.index]}">${escapeHtml(cell.item.session.driver)}&nbsp;L${cell.item.lap.number}</th>`).join('')}</tr></thead><tbody>${bounds.slice(0, -1).map((start, sectorIndex) => {
      const end = bounds[sectorIndex + 1];
      const durations = cells.map(cell => sectorDuration(cell.item, sectorIndex, items));
      const validDurations = durations.filter(Number.isFinite);
      const fastest = validDurations.length ? Math.min(...validDurations) : NaN;
      const referenceDuration = durations[0];
      return `<tr class="${isActive(sectorIndex) ? 'active' : ''}" data-sector-row="${sectorIndex}"><td><button type="button" data-sector="${sectorIndex}">S${sectorIndex + 1}</button><br><small>${start.toFixed(0)}–${end.toFixed(0)}m</small></td>${cells.map(cell => {
        const duration = durations[cell.index];
        const isFastest = Number.isFinite(duration) && Math.abs(duration - fastest) < .0005;
        const compactComparison = cell.index > 0
          ? `<small class="sector-time-delta ${duration < referenceDuration ? 'faster' : duration > referenceDuration ? 'slower' : 'equal'}">기준 대비 ${signed(duration - referenceDuration, 3, 's')}</small><button type="button" class="sector-detail-button" data-sector-detail="${sectorIndex}" data-sector-detail-lap="${cell.index}">상세 비교</button>`
          : '<span class="sector-reference-label">● 기준 랩</span>';
        return Number.isFinite(duration)
          ? `<td class="${isFastest ? 'sector-fastest' : ''}"><span class="sector-time-row"><b>${duration.toFixed(3)}s</b>${isFastest ? '<span class="sector-fastest-badge">★ FAST</span>' : ''}</span>${compactComparison}</td>`
          : '<td title="해당 체크포인트의 실제 교차점을 찾지 못했습니다."><b>통과 기록 없음</b></td>';
      }).join('')}</tr>`;
    }).join('')}</tbody></table>`;
    requestAnimationFrame(updateSectorStickyOffset);
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
      const ranked = items.map((item, index) => ({ item, index, timing: sectorTiming(item, sectorIndex, items) }))
        .sort((a, b) => (b.timing?.duration ?? -Infinity) - (a.timing?.duration ?? -Infinity));
      ranked.forEach(({ item, index, timing }) => {
        if (!timing) return;
        const interior = item.session.gpsPoints.filter(point => point.time > timing.start.time && point.time < timing.end.time);
        const points = [timing.start, ...interior, timing.end];
        if (points.length < 2) return;
        ctx.beginPath(); points.forEach((point, i) => { const [x, y] = xy(point); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.strokeStyle = COLORS[index];
        const inActiveRange = state.activeSector !== null && sectorIndex >= state.activeSector && sectorIndex <= state.activeSectorEnd;
        ctx.lineWidth = inActiveRange ? 4 : 2.5;
        ctx.globalAlpha = state.activeSector === null || inActiveRange ? .92 : .14;
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
      const point = lapPositionAtElapsed(item, cursorElapsedForItem(item, items));
      if (!point) return;
      const [x, y] = xy(point);
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = COLORS[index]; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = COLORS[index]; ctx.globalAlpha = .55; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff'; ctx.font = '800 9px monospace'; ctx.fillText(`L${item.lap.number}`, x + 10, y - 9);
    });
  }

  function lapPositionAtElapsed(item, elapsed) {
    const target = item.lap.startTime + Math.max(0, Math.min(item.lap.duration, elapsed));
    return lapPointAtTime(item, target);
  }

  function playbackDuration(items = selectedLaps()) {
    if (!items.length) return 0;
    if (state.activeSector === null) return Math.max(...items.map(item => item.lap.duration));
    const durations = items.map(item => sectorRangeTiming(item, state.activeSector, state.activeSectorEnd, items)?.duration).filter(Number.isFinite);
    return durations.length ? Math.max(...durations) : 0;
  }
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
    const samples = items.map(item => Number.isFinite(previewAt) ? sampleAtDistance(item, previewAt) : sampleAtElapsed(item, cursorElapsedForItem(item, items)));
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
    if (ui.slider) {
      ui.slider.max = String(Math.max(.01, duration));
      ui.slider.value = String(state.playElapsed);
      ui.slider.disabled = !duration;
      const progress = duration ? Math.max(0, Math.min(100, state.playElapsed / duration * 100)) : 0;
      ui.slider.style.setProperty('--comparison-play-progress', `${progress}%`);
    }
    if (ui.playTime) ui.playTime.textContent = state.activeSector === null
      ? `${state.playElapsed.toFixed(2)} s`
      : `구간 ${state.playElapsed.toFixed(2)} / ${duration.toFixed(2)} s`;
    if (ui.playDistance) ui.playDistance.innerHTML = items.length ? items.map((item, index) => {
      const sample = cursorSampleForItem(item, items);
      return `<span style="color:${COLORS[index]}">L${item.lap.number} ${(sample?.x || 0).toFixed(1)} m</span>`;
    }).join('') : '-- m';
    updatePlaybackValues(items, state.hoverDistance);
    if (ui.play) { ui.play.textContent = state.playing ? 'Ⅱ 일시정지' : '▶ 재생'; ui.play.disabled = !duration; }
    Object.values(state.charts).forEach(chart => chart.draw());
  }
  function followPlaybackCursors(items) {
    // 체크포인트/다중 구간을 골랐을 때는 랩 간 직접 비교가 목적이므로
    // 선택한 공통 거리 구간을 재생 중에도 고정합니다.
    if (state.activeSector !== null) return;
    const distance = totalDistance();
    const min = state.viewMin, max = state.viewMax ?? distance, span = max - min;
    if (!(span > 0) || !(distance > span + .01) || !items.length) return;
    const positions = items.map(item => cursorSampleForItem(item, items)?.x).filter(Number.isFinite);
    if (!positions.length) return;
    const leading = Math.max(...positions), trailing = Math.min(...positions), margin = span * .12;
    if (leading < max - margin && trailing > min + margin) return;
    let nextMin = leading >= max - margin ? leading - span * .78 : trailing - span * .22;
    nextMin = Math.max(0, Math.min(distance - span, nextMin));
    setChartViewRange(nextMin, nextMin + span);
  }
  function setPlaying(active) {
    const items = selectedLaps(), duration = playbackDuration(items);
    if (!duration) active = false;
    if (active && state.playElapsed >= duration - .001) state.playElapsed = 0;
    state.playing = active;
    state.playStamp = 0;
    state.playRenderStamp = 0;
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
    if (!state.playRenderStamp || timestamp - state.playRenderStamp >= 15) {
      state.playRenderStamp = timestamp;
      followPlaybackCursors(items);
      syncPlaybackUi(items);
      renderMap(items);
    }
    state.playFrame = requestAnimationFrame(playTick);
  }

  function updateCount() { if (ui.count) ui.count.textContent = `${state.selected.size} / 4 선택`; }
  function render() {
    const items = selectedLaps(); updateCount(); renderSummary(items); renderCharts(items); renderSectors(items); syncPlaybackUi(items); renderMap(items);
    if (items.length) setStatus(`${items.length}개 랩을 1 m 간격 공통 중심선 거리축으로 비교 중입니다.`);
  }
  window.renderDriverComparison = render;
  window.stopDriverComparisonPlayback = () => setPlaying(false);
  window.registerComparisonSession = (snapshot, autoSelect = true) => {
    try {
      const session = addSession(snapshot, autoSelect);
      renderSessions();
      render();
      syncSelectionToPage4();
      setStatus(`${session.fileName}의 ${session.laps.length}개 랩을 불러왔습니다. 같은 CSV 안에서 바로 비교할 수 있습니다.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  };
  window.setPrimaryComparisonSession = snapshot => {
    try {
      const file = snapshot?.file;
      if (!file) return;
      const sourceKey = `${file.name}:${file.size || 0}:${file.lastModified || 0}`;
      // 헤더의 `CSV 열기`는 기준 CSV 교체다. 비교 CSV 추가 버튼으로
      // 누적한 세션까지 초기화해 새 파일만 왼쪽 목록의 기본 상태로 만든다.
      setPlaying(false);
      state.sessions = [];
      state.selected.clear();
      state.cache.clear();
      state.distanceMapCache.clear();
      state.sourceSeriesCache.clear();
      state.sectorCache.clear();
      state.sectorMetricsCache.clear();
      state.playElapsed = 0;
      state.viewMin = 0;
      state.viewMax = null;
      state.hoverDistance = null;
      state.activeSector = null;
      state.activeSectorEnd = null;
      state.mapGeometry = null;
      state.primarySourceKey = sourceKey;
      const session = addSession(snapshot, true);
      renderSessions();
      render();
      syncSelectionToPage4();
      setStatus(`${session.fileName}을 기준 세션으로 불러왔습니다. 비교 CSV를 추가할 수 있습니다.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  };
  window.setComparisonSelectionFromPage4 = selections => {
    const next = new Set();
    (selections || []).slice(0, 2).forEach(selection => {
      const session = state.sessions.find(item => item.sourceKey === selection.sourceKey);
      if (session?.laps?.[selection.lapIndex]) next.add(selectionKey(session.id, selection.lapIndex));
    });
    state.selected = next;
    setPlaying(false);
    state.playElapsed = 0;
    state.activeSector = null;
    state.activeSectorEnd = null;
    renderSessions();
    render();
  };

  ui.files?.addEventListener('change', event => { const files = [...event.target.files]; event.target.value = ''; importFiles(files); });
  ui.sessions?.addEventListener('input', event => {
    const session = state.sessions.find(item => item.id === Number(event.target.dataset.driver));
    if (session) { session.driver = event.target.value.trim() || session.fileName.replace(/\.csv$/i, ''); render(); }
  });
  ui.sessions?.addEventListener('change', event => {
    const key = event.target.dataset.lapKey;
    if (!key) return;
    if (event.target.checked && state.selected.size >= 4) { event.target.checked = false; setStatus('동시에 비교할 수 있는 랩은 최대 4개입니다.', true); return; }
    setPlaying(false); state.playElapsed = 0; state.activeSector = null; state.activeSectorEnd = null;
    event.target.checked ? state.selected.add(key) : state.selected.delete(key); render(); syncSelectionToPage4();
  });
  ui.sessions?.addEventListener('click', event => {
    const removeButton = event.target.closest('[data-session-remove]');
    if (removeButton) {
      const sessionId = Number(removeButton.dataset.sessionRemove);
      const session = state.sessions.find(item => item.id === sessionId);
      if (!session || !window.confirm(`“${session.driver}” 세션(${session.fileName})을 제거하시겠습니까?`)) return;
      setPlaying(false);
      state.sessions = state.sessions.filter(item => item.id !== sessionId);
      [...state.selected].forEach(key => { if (key.startsWith(`${sessionId}:`)) state.selected.delete(key); });
      state.cache.clear(); state.distanceMapCache.clear(); state.sourceSeriesCache.clear(); state.sectorCache.clear(); state.sectorMetricsCache.clear(); state.seriesEnabled.clear();
      state.playElapsed = 0; state.viewMin = 0; state.viewMax = null; state.hoverDistance = null; state.activeSector = null; state.activeSectorEnd = null; state.lastSector = 0; state.mapGeometry = null;
      renderSessions(); render(); syncSelectionToPage4();
      setStatus(`${session.fileName} 세션을 제거했습니다.`);
      return;
    }
    const button = event.target.closest('[data-session-pick]');
    if (!button) return;
    const session = state.sessions.find(item => item.id === Number(button.dataset.sessionId));
    if (!session) return;
    setPlaying(false); state.playElapsed = 0; state.activeSector = null; state.activeSectorEnd = null;
    session.laps.forEach((_, lapIndex) => state.selected.delete(selectionKey(session.id, lapIndex)));
    const ordered = session.laps.map((lap, lapIndex) => ({ lap, lapIndex })).sort((a, b) => a.lap.duration - b.lap.duration);
    let picks = [];
    if (button.dataset.sessionPick === 'fast') picks = ordered.slice(0, 4);
    if (button.dataset.sessionPick === 'best' && ordered.length) picks = [ordered[0]];
    picks.slice(0, Math.max(0, 4 - state.selected.size)).forEach(item => state.selected.add(selectionKey(session.id, item.lapIndex)));
    renderSessions();
    render();
    syncSelectionToPage4();
  });
  ui.play?.addEventListener('click', () => setPlaying(!state.playing));
  ui.rate?.addEventListener('change', () => { state.playRate = Number(ui.rate.value) || 1; });
  $('page-comparison')?.addEventListener('click', event => {
    const button = event.target.closest('[data-comparison-series-chart]');
    if (!button) return;
    const name = button.dataset.comparisonSeriesChart;
    const index = Number(button.dataset.comparisonSeriesIndex);
    const chart = state.charts[name];
    const dataset = chart?.data.datasets[index];
    if (!chart || !dataset) return;
    const enabled = !chart.isDatasetVisible(index);
    chart.setDatasetVisibility(index, enabled);
    state.seriesEnabled.set(dataset.comparisonSeriesId, enabled);
    chart.update('none');
    renderSeriesToggleButtons(name);
  });
  ui.slider?.addEventListener('input', () => {
    const duration = playbackDuration();
    const rawRequested = Number(ui.slider.value) || 0;
    const requested = duration - rawRequested <= .015 ? duration : rawRequested;
    setPlaying(false);
    state.playElapsed = requested;
    state.hoverDistance = null;
    syncPlaybackUi();
    renderMap(selectedLaps());
  });
  ui.sector?.addEventListener('click', event => {
    const detailButton = event.target.closest('[data-sector-detail]');
    if (detailButton) {
      event.stopPropagation();
      openSectorDetail(Number(detailButton.dataset.sectorDetail), Number(detailButton.dataset.sectorDetailLap));
      return;
    }
    const reset = event.target.closest('[data-sector-range-reset]');
    if (reset) {
      selectSectorRange(null);
      return;
    }
    const button = event.target.closest('[data-sector]');
    const row = event.target.closest('[data-sector-row]');
    if (!button && !row) return;
    const index = Number(button?.dataset.sector ?? row?.dataset.sectorRow);
    selectSectorRange(state.activeSector === index && state.activeSectorEnd === index ? null : index);
  });
  ui.sector?.addEventListener('change', event => {
    if (!event.target.matches('[data-sector-range-start],[data-sector-range-end]')) return;
    const start = Number(ui.sector.querySelector('[data-sector-range-start]')?.value);
    const end = Number(ui.sector.querySelector('[data-sector-range-end]')?.value);
    if (event.target.matches('[data-sector-range-start]') && end < start) {
      ui.sector.querySelector('[data-sector-range-end]').value = String(start);
      selectSectorRange(start, start);
    } else if (event.target.matches('[data-sector-range-end]') && start > end) {
      ui.sector.querySelector('[data-sector-range-start]').value = String(end);
      selectSectorRange(end, end);
    } else {
      selectSectorRange(start, end);
    }
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
  $('gps-imu-lpf')?.addEventListener('change', refreshComparisonImuFilters);
  document.addEventListener('keydown', event => {
    if (event.code !== 'Space' || !$('page-comparison')?.classList.contains('active')) return;
    if (event.target.matches('input, textarea, select, button') || event.target.isContentEditable) return;
    event.preventDefault(); setPlaying(!state.playing);
  });
  window.addEventListener('resize', () => {
    if (!$('page-comparison')?.classList.contains('active')) return;
    updateSectorStickyOffset();
    renderMap(selectedLaps());
  });
})();
