// Global state variables for Page 1 charts
let chartSpeed = null;
let chartRpm = null;
let chartGear = null;
let chartSteering = null;
let chartThrottleBrake = null;

// Global state variables for Page 2 charts
let diagChartThrottleBrake = null; // Stacked Top Sub-pane (Throttle & Brake)
let diagChartSteering = null;      // Stacked Bottom Sub-pane (Steering Angle)
let chartFL = null;
let chartFR = null;
let chartRL = null;
let chartRR = null;

// Global state variables for Page 4 charts
let chartCoolantOil = null;
let chartIntakeEcu = null;

// Global state variables for Page 3 IMU charts
let chartImuAccel = null;
let chartImuGyro = null;
let gpsImuCursorDragging = false;

// Zoom, Slicing & Scroll configurations
let globalData = [];
let currentStartSec = 0;
let currentEndSec = 30;
let totalDurationSec = 0;

// User specified boundary limits (Drag will be restricted inside this limit)
let limitStartSec = 0;
let limitEndSec = 0;

// Active downsampled dataset reference for easy cursor lookup
let activeSampledData = [];
let currentCursorIndex = 0;

// 화면용 다운샘플 인덱스 (전체 globalData 기준 위치) 및 그 시각값.
// 노이즈 필터는 100Hz 원본 전체에 먼저 적용된 뒤 이 인덱스로 추출됩니다.
let sampleIndices = [];
let sampleTimes = [];

// DOM Elements
const statusBadge = document.getElementById('file-status');
const statusText = document.getElementById('status-text');

// Cursor Realtime Value DOMs (Page 1)
const cursorSpeed = document.getElementById('cursor-speed');
const cursorSpeedRl = document.getElementById('cursor-speed-rl');
const cursorSpeedRr = document.getElementById('cursor-speed-rr');
const cursorRpm = document.getElementById('cursor-rpm');
const cursorGear = document.getElementById('cursor-gear');
const cursorSteering = document.getElementById('cursor-steering');
const cursorThrottle = document.getElementById('cursor-throttle');
const cursorBrake = document.getElementById('cursor-brake');

// Cursor Realtime Value DOMs (Page 2)
const diagCursorThrottle = document.getElementById('diag-cursor-throttle');
const diagCursorBrake = document.getElementById('diag-cursor-brake');
const diagCursorSteering = document.getElementById('diag-cursor-steering');
const cursorSusFl = document.getElementById('cursor-sus-fl');
const cursorSusFr = document.getElementById('cursor-sus-fr');
const cursorSusRl = document.getElementById('cursor-sus-rl');
const cursorSusRr = document.getElementById('cursor-sus-rr');

// Interactive Steering Wheel Graphic Widget DOM
const steeringWheelGraphic = document.getElementById('steering-wheel-graphic');
const gpsSteeringWheelGraphic = document.getElementById('gps-steering-wheel-graphic');
const gpsCursorSteering = document.getElementById('gps-cursor-steering');

// Diag Summary DOMs
const statMaxRpm = document.getElementById('stat-max-rpm');
const statMaxSpeed = document.getElementById('stat-max-speed');
const statMinBatt = document.getElementById('stat-min-batt');
const statDuration = document.getElementById('stat-duration');
const adcAlertBadge = document.getElementById('adc-alert-badge'); // (Safely handled in case of missing DOM)

// Zoom & Scroll Input DOMs
const inputStart = document.getElementById('input-start-time');
const inputEnd = document.getElementById('input-end-time');
const btnApply = document.getElementById('btn-apply-zoom');
const btnReset = document.getElementById('btn-reset-zoom');
const scrollBar = document.getElementById('timeline-scroll-bar');
const currentTimeVal = document.getElementById('current-time-val'); // 실시간 시점 시간 표시 DOM
const lblScrollType = document.getElementById('lbl-scroll-type');

// Tabs DOMs
const tabGeneral = document.getElementById('tab-general');
const tabDiagnostics = document.getElementById('tab-diagnostics');
const tabGps = document.getElementById('tab-gps');
const pageGeneral = document.getElementById('page-general');
const pageDiagnostics = document.getElementById('page-diagnostics');
const pageGps = document.getElementById('page-gps');
const tabTemperature = document.getElementById('tab-temperature');
const pageTemperature = document.getElementById('page-temperature');
const tabRealtime = document.getElementById('tab-realtime');
const pageRealtime = document.getElementById('page-realtime');
const timelineNavigator = document.querySelector('.timeline-navigator');

// Temperature DOMs (Page 4)
const tempCursorCoolant = document.getElementById('temp-cursor-coolant');
const tempCursorOil = document.getElementById('temp-cursor-oil');
const tempCursorIat = document.getElementById('temp-cursor-iat');
const tempCursorEcu = document.getElementById('temp-cursor-ecu');
const tempMaxCoolant = document.getElementById('temp-max-coolant');
const tempMaxOil = document.getElementById('temp-max-oil');
const tempMaxIat = document.getElementById('temp-max-iat');
const tempMaxEcu = document.getElementById('temp-max-ecu');

// GPS DOMs
const cursorGpsCoords = document.getElementById('cursor-gps-coords');
const gpsCursorSpeed = document.getElementById('gps-cursor-speed');
const gpsCursorWheelSpeed = document.getElementById('gps-cursor-wheel-speed');
const gpsSpeedDelta = document.getElementById('gps-speed-delta');
const gpsCursorSats = document.getElementById('gps-cursor-sats');
const gpsCursorQual = document.getElementById('gps-cursor-qual');
const gpsCursorTime = document.getElementById('gps-cursor-time');
const imuAccelX = document.getElementById('imu-accel-x');
const imuAccelY = document.getElementById('imu-accel-y');
const imuRoll = document.getElementById('imu-roll');
const imuPitch = document.getElementById('imu-pitch');
const imuYaw = document.getElementById('imu-yaw');
const imuBattery = document.getElementById('imu-battery');
const imuAge = document.getElementById('imu-age');
const imuGDot = document.getElementById('imu-g-dot');
const gpsPlayToggle = document.getElementById('gps-play-toggle');
const gpsPlayRate = document.getElementById('gps-play-rate');
const gpsPlayTime = document.getElementById('gps-play-time');
const gpsImuLpf = document.getElementById('gps-imu-lpf');

// Theme Switcher DOM
const btnThemeToggle = document.getElementById('btn-theme-toggle');

// Modal Elements (보관함 제거 - 직접 업로드 방식)
const csvUploadInput = document.getElementById('csv-upload-input');
const loadedFileBadge = document.getElementById('loaded-file-badge');

// Helper to decode Hex safely
function parseHexOrInt(val) {
  if (val === undefined || val === null || val === '') return 0;
  const str = String(val).trim();
  if (str.startsWith('0x') || str.startsWith('0X')) {
    return parseInt(str, 16) || 0;
  }
  const parsedHex = parseInt(str, 16);
  if (!isNaN(parsedHex) && /[a-fA-F]/.test(str)) {
    return parsedHex;
  }
  return parseInt(str, 10) || parsedHex || 0;
}

// Telemetry_072 and later snapshots store one complete 8-byte CAN frame per
// column (can600_data ... can607_data), instead of one can_id/can_d0 ... row.
function decodePackedCanFrame(value) {
  if (value === undefined || value === null || value === '') {
    return new Array(8).fill(0);
  }

  let hex = String(value).trim().replace(/^0x/i, '').replace(/[^0-9a-f]/gi, '');
  if (!hex) return new Array(8).fill(0);
  hex = hex.padStart(16, '0').slice(-16);

  const bytes = [];
  for (let i = 0; i < 16; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16) || 0);
  }
  return bytes;
}

function packedCanFrameHasData(bytes) {
  return bytes.some(byte => byte !== 0);
}

// Keep the chart code compatible with both the legacy adc/wheel column names
// and the descriptive Telemetry_072 column names.
function normalizeTelemetryRow(row) {
  const mappings = {
    // Datalogger board connector / MCU scan order. ADC2 and ADC3 are unused:
    // ADC1=PC0 front brake, ADC4=PC3 FR, ADC5=PC4 steering, ADC6=PC5 FL.
    adc1_raw: 'front_brake_pressure_raw',
    adc4_raw: 'fr_potentiometer_raw',
    adc5_raw: 'steering_angle_raw',
    adc6_raw: 'fl_potentiometer_raw',
    wheel3_speed_centi_kmh: 'rr_wheel_speed_centi_kmh',
    wheel4_speed_centi_kmh: 'rl_wheel_speed_centi_kmh'
  };

  Object.entries(mappings).forEach(([legacyName, newName]) => {
    if ((row[legacyName] === undefined || row[legacyName] === null || row[legacyName] === '') &&
        row[newName] !== undefined) {
      row[legacyName] = row[newName];
    }
  });

  // Canonical names used by the new dashboard. Descriptive 072 columns take
  // priority, while legacy ADC logs remain supported as a fallback.
  row.front_brake_raw = row.front_brake_pressure_raw ?? row.adc1_raw;
  row.suspension_fl_raw = row.fl_potentiometer_raw ?? row.adc6_raw;
  row.suspension_fr_raw = row.fr_potentiometer_raw ?? row.adc4_raw;
  row.suspension_rl_raw = row.rl_potentiometer_raw;
  row.suspension_rr_raw = row.rr_potentiometer_raw;
  row.rear_brake_raw = row.rear_brake_pressure_raw;
  row.steering_raw = row.steering_angle_raw ?? row.adc5_raw;

  return row;
}

// Calibration functions for sensors
function getDecodedTps(rowTpsRaw) {
  return (rowTpsRaw || 0) * 0.5; // data[2] * 5U -> tps_x10 -> tps = data[2] * 0.5 (0~100%)
}

// Calibrated Brake Normalization
function getCalibratedBrake(rawValue) {
  const val = rawValue || 0;
  const percent = ((val - 390) / (1682 - 390)) * 100;
  return Math.max(0, Math.min(100, percent));
}

// Calibrated Steering
// 영점/배율/반전은 steering.js의 steeringCal에서 조정합니다 (핸들 그래픽 클릭).
// 기본값 {zeroRaw:998, degPerLsb:0.1, invert:false}는 기존 하드코딩 식과 동일:
//   (raw - 2048) * 0.1 + 105 = 0.1*raw - 99.8 = (raw - 998) * 0.1
function getCalibratedSteering(rawValue) {
  const cal = (typeof steeringCal !== 'undefined') ? steeringCal : { zeroRaw: 998, degPerLsb: 0.1, invert: false };
  const rawVal = (rawValue === undefined || rawValue === null || isNaN(rawValue)) ? cal.zeroRaw : rawValue;
  const deg = (rawVal - cal.zeroRaw) * cal.degPerLsb;
  return cal.invert ? -deg : deg;
}

// GPS Map Global Variables
let gpsMap = null;
let gpsRouteLine = null;
let gpsCursorMarker = null;
let gpsGraphicLayer = null;
let gpsSatelliteLayer = null;
let currentGpsLayerMode = 'graphic'; // 'graphic' | 'satellite'

// GPS + IMU synchronized playback state.
let gpsPlaybackActive = false;
let gpsPlaybackFrame = null;
let gpsPlaybackLastTimestamp = null;
let gpsPlaybackCursorSec = 0;

// NMEA coordinate converter helper
function convertNmeaToDecimal(val, isLongitude = false) {
  if (val === undefined || val === null) return null;
  const strVal = val.toString().trim();
  if (strVal === "" || isNaN(strVal)) return null;
  
  const num = parseFloat(strVal);
  if (num === 0) return null;

  // New logs may already contain signed decimal-degree coordinates.
  const decimalLimit = isLongitude ? 180 : 90;
  if (Math.abs(num) <= decimalLimit) return num;
  
  const limit = isLongitude ? 3 : 2;
  if (strVal.length < limit + 2) return null;
  
  const degreesStr = strVal.substring(0, limit);
  const minutesStr = strVal.substring(limit);
  
  const degrees = parseFloat(degreesStr);
  const minutes = parseFloat(minutesStr);
  
  if (isNaN(degrees) || isNaN(minutes)) return null;
  return degrees + (minutes / 60.0);
}

// Leaflet Map Initialization
// 지도 확대 한도를 크게 늘려서(줌 22까지) 일반 도로 폭 안에서도 GPS 포인트가
// 어느 위치(차선/갓길 등)에 찍혔는지 구분할 수 있도록 합니다. 타일 자체의
// 최대 해상도(maxNativeZoom)를 넘어가면 Leaflet이 남은 배율만큼 타일을
// 확대(오버줌)해서 보여줍니다 — 화질은 약간 흐려지지만 위치 판독에는 충분합니다.
const GPS_MAP_MAX_ZOOM = 22;

function initGpsMap() {
  if (gpsMap) return;
  gpsMap = L.map('gps-map', {
    zoomControl: false,
    maxZoom: GPS_MAP_MAX_ZOOM
  }).setView([36.5, 127.8], 7);

  L.control.zoom({ position: 'bottomright' }).addTo(gpsMap);

  // 그래픽(다크 벡터 스타일) 지도 레이어 — 기존 기본 지도
  gpsGraphicLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CartoDB',
    maxZoom: GPS_MAP_MAX_ZOOM,
    maxNativeZoom: 20
  });

  // 국내 위성 지도 레이어 (국토교통부 공간정보 오픈플랫폼 VWorld).
  // 인증키는 운영 Vercel 도메인으로 제한되어 있어 다른 사이트에서는 사용할 수 없습니다.
  gpsSatelliteLayer = L.tileLayer('https://api.vworld.kr/req/wmts/1.0.0/FA347C96-2846-3D64-8855-29ED001264B6/Satellite/{z}/{y}/{x}.jpeg', {
    attribution: '영상지도 &copy; 국토교통부 VWorld',
    maxZoom: GPS_MAP_MAX_ZOOM,
    maxNativeZoom: 19
  });

  // 마지막으로 선택한 지도 모드 기억 (브라우저별 로컬 저장)
  const savedMode = (() => {
    try { return localStorage.getItem('nssur_gps_map_mode'); } catch (err) { return null; }
  })();
  currentGpsLayerMode = savedMode === 'satellite' ? 'satellite' : 'graphic';
  (currentGpsLayerMode === 'satellite' ? gpsSatelliteLayer : gpsGraphicLayer).addTo(gpsMap);

  // 위성 ↔ 그래픽 지도 전환 커스텀 컨트롤 버튼
  // 우측 상단은 조향각 위젯이 쓰므로 지도 전환 버튼은 좌측 상단에 둡니다.
  const MapModeToggleControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      const container = L.DomUtil.create('div', 'map-mode-toggle');
      const button = L.DomUtil.create('a', 'map-mode-toggle-btn', container);
      button.href = '#';
      button.title = '위성 지도 / 그래픽 지도 전환';

      const refreshLabel = () => {
        button.innerHTML = currentGpsLayerMode === 'satellite' ? '🗺️ 그래픽 지도' : '🛰️ 위성 지도';
      };
      refreshLabel();

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(button, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        if (currentGpsLayerMode === 'graphic') {
          gpsMap.removeLayer(gpsGraphicLayer);
          gpsSatelliteLayer.addTo(gpsMap);
          currentGpsLayerMode = 'satellite';
        } else {
          gpsMap.removeLayer(gpsSatelliteLayer);
          gpsGraphicLayer.addTo(gpsMap);
          currentGpsLayerMode = 'graphic';
        }
        try { localStorage.setItem('nssur_gps_map_mode', currentGpsLayerMode); } catch (err) { /* ignore */ }
        refreshLabel();
      });

      return container;
    }
  });
  new MapModeToggleControl().addTo(gpsMap);

  gpsRouteLine = L.polyline([], {
    color: '#f97316',
    weight: 5,
    opacity: 0.8,
    interactive: true
  }).addTo(gpsMap);
}

// Theme Toggle Event Listener
btnThemeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  updateChartsTheme();
});

// Real-time theme updates inside ChartJS instances without destroying them
function updateChartsTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)';
  const tickColor = isDark ? '#8c96a8' : '#64748b';

  const targetCharts = [
    chartSpeed, chartRpm, chartGear, chartSteering, chartThrottleBrake,
    diagChartThrottleBrake, diagChartSteering, chartFL, chartFR, chartRL, chartRR,
    chartCoolantOil, chartIntakeEcu, chartImuAccel, chartImuGyro
  ];
  targetCharts.forEach(chart => {
    if (!chart) return;

    // 다크모드일 때 눈 피로를 낮춰주는 차분한 파스텔톤으로 선 색상 변경
    updateDatasetColors(chart, isDark);

    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.grid.color = gridColor;
        if (chart.options.scales.x.ticks && chart.options.scales.x.ticks.display !== false) {
          chart.options.scales.x.ticks.color = tickColor;
        }
      }
      if (chart.options.scales.y) {
        if (chart === chartSteering || chart === diagChartSteering) {
          chart.options.scales.y.grid.color = (context) => (context.value === 0 ? '#ff2d55' : gridColor);
        } else {
          chart.options.scales.y.grid.color = gridColor;
        }
        chart.options.scales.y.ticks.color = tickColor;
      }
      if (chart.options.scales.ySpeed) {
        chart.options.scales.ySpeed.ticks.color = tickColor;
        chart.options.scales.ySpeed.title.color = tickColor;
      }
    }

    if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
      chart.options.plugins.legend.labels.color = tickColor;
    }

    chart.update('none');
  });

  clearAllDomCursors();
}

function updateDatasetColors(chart, isDark) {
  if (!chart) return;
  const id = chart.canvas.id;
  
  chart.data.datasets.forEach((dataset, idx) => {
    if (id === 'chart-ground-speed' || id === 'chart-vehicle-speed') {
      if (idx === 0) dataset.borderColor = isDark ? '#ffb07c' : '#f97316';
      if (idx === 1) dataset.borderColor = isDark ? '#74b9ff' : '#2563eb';
    } else if (id === 'chart-engine-rpm') {
      dataset.borderColor = isDark ? '#ff7675' : '#dc2626';
    } else if (id === 'chart-vehicle-gear') {
      dataset.borderColor = isDark ? '#74b9ff' : '#2563eb';
    } else if (id === 'chart-steering-angle') {
      dataset.borderColor = isDark ? '#fd79a8' : '#db2777';
    } else if (id === 'chart-throttle-brake' || id === 'diag-chart-throttle-brake') {
      if (idx === 0) dataset.borderColor = isDark ? '#55efc4' : '#16a34a'; // Throttle
      if (idx === 1) dataset.borderColor = isDark ? '#ff7675' : '#dc2626'; // Brake
    } else if (id === 'diag-chart-steering') {
      dataset.borderColor = isDark ? '#fd79a8' : '#db2777';
    } else if (id === 'chart-sus-fl') {
      dataset.borderColor = isDark ? '#fd79a8' : '#db2777';
    } else if (id === 'chart-sus-rl') {
      dataset.borderColor = isDark ? '#81ecec' : '#06b6d4';
    } else if (id === 'chart-sus-fr') {
      dataset.borderColor = isDark ? '#ff7675' : '#dc2626';
    } else if (id === 'chart-sus-rr') {
      dataset.borderColor = isDark ? '#74b9ff' : '#2563eb';
    } else if (id === 'chart-coolant-oil') {
      if (idx === 0) dataset.borderColor = isDark ? '#74b9ff' : '#2563eb';
      if (idx === 1) dataset.borderColor = isDark ? '#ffb07c' : '#f97316';
      if (idx === 2) dataset.borderColor = isDark ? '#81ecec' : '#06b6d4';
    } else if (id === 'chart-intake-ecu') {
      dataset.borderColor = idx === 0
        ? (isDark ? '#55efc4' : '#16a34a')
        : (isDark ? '#fd79a8' : '#db2777');
    } else if (id === 'chart-imu-accel' || id === 'chart-imu-gyro') {
      const light = ['#f97316', '#2563eb', '#16a34a'];
      const dark = ['#ffb07c', '#74b9ff', '#55efc4'];
      dataset.borderColor = (isDark ? dark : light)[idx] || dataset.borderColor;
    }
  });
}

// Tab Switching Event Bindings
tabGeneral.addEventListener('click', () => switchTab('general'));
tabDiagnostics.addEventListener('click', () => switchTab('diag'));
if (tabGps) {
  tabGps.addEventListener('click', () => switchTab('gps'));
}
if (tabTemperature) {
  tabTemperature.addEventListener('click', () => switchTab('temperature'));
}
if (tabRealtime) {
  tabRealtime.addEventListener('click', () => switchTab('realtime'));
}

// Keyboard shortcuts: number row and numeric keypad 1–4 switch pages.
document.addEventListener('keydown', (event) => {
  const target = event.target;
  const isTyping = target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;

  if (isTyping || event.ctrlKey || event.metaKey || event.altKey) return;

  const pageByKey = {
    Digit1: 'general',
    Numpad1: 'general',
    Digit2: 'diag',
    Numpad2: 'diag',
    Digit3: 'gps',
    Numpad3: 'gps',
    Digit4: 'temperature',
    Numpad4: 'temperature',
    Digit5: 'realtime',
    Numpad5: 'realtime'
  };
  const mode = pageByKey[event.code];
  if (!mode) return;

  event.preventDefault();
  switchTab(mode);
});

function switchTab(mode) {
  if (mode !== 'gps' && gpsPlaybackActive) setGpsPlayback(false);

  // Remove active from all tabs and pages
  tabGeneral.classList.remove('active');
  tabDiagnostics.classList.remove('active');
  if (tabGps) tabGps.classList.remove('active');
  if (tabTemperature) tabTemperature.classList.remove('active');
  if (tabRealtime) tabRealtime.classList.remove('active');

  pageGeneral.classList.remove('active');
  pageDiagnostics.classList.remove('active');
  if (pageGps) pageGps.classList.remove('active');
  if (pageTemperature) pageTemperature.classList.remove('active');
  if (pageRealtime) pageRealtime.classList.remove('active');

  clearAllDomCursors();

  // 실시간 페이지는 로그 재생용 타임라인이 필요 없으므로 숨깁니다.
  if (timelineNavigator) {
    timelineNavigator.style.display = (mode === 'realtime') ? 'none' : '';
  }

  if (mode === 'realtime') {
    if (tabRealtime) tabRealtime.classList.add('active');
    if (pageRealtime) pageRealtime.classList.add('active');
    setTimeout(() => {
      Object.values((typeof rtState !== 'undefined' && rtState.cards) || {}).forEach(c => {
        if (c.chart) { c.chart.resize(); c.chart.update('none'); }
      });
      if (typeof rtScheduleRender === 'function') rtScheduleRender();
    }, 50);
    return;
  }

  if (mode === 'general') {
    tabGeneral.classList.add('active');
    pageGeneral.classList.add('active');
    if (lblScrollType) {
      lblScrollType.textContent = '📊 그래프 좌우 스크롤:';
    }
    setTimeout(() => {
      [chartSpeed, chartRpm, chartGear, chartSteering, chartThrottleBrake].forEach(c => { 
        if (c) {
          c.resize();
          c.update(); // 풀 업데이트로 데이터셋 좌표 갱신 강제
        }
      });
      // 차트 리사이즈 및 갱신이 완료된 픽셀 기반 위치로 세로선과 교차점 점들 복원
      drawCssIntersectionDots(currentCursorIndex);
    }, 50);
  } else if (mode === 'diag') {
    tabDiagnostics.classList.add('active');
    pageDiagnostics.classList.add('active');
    if (lblScrollType) {
      lblScrollType.textContent = '📊 그래프 좌우 스크롤:';
    }
    setTimeout(() => {
      [diagChartThrottleBrake, diagChartSteering, chartFL, chartFR, chartRL, chartRR].forEach(c => {
        if (c) {
          c.resize();
          c.update(); // 풀 업데이트로 데이터셋 좌표 갱신 강제
        }
      });
      // 차트 리사이즈 및 갱신이 완료된 픽셀 기반 위치로 세로선과 교차점 점들 복원
      drawCssIntersectionDots(currentCursorIndex);
    }, 50);
  } else if (mode === 'gps') {
    if (tabGps) tabGps.classList.add('active');
    if (pageGps) pageGps.classList.add('active');
    if (lblScrollType) {
      lblScrollType.textContent = '📍 실시간 주행 시점 슬라이더:';
    }
    // Invalidate map and charts after their previously hidden page becomes visible.
    setTimeout(() => {
      if (gpsMap) {
        gpsMap.invalidateSize();
        // GPS 페이지 진입 시점에 즉시 현재 커서 위치로 핀 갱신
        const row = activeSampledData[currentCursorIndex];
        if (row) {
          updateNumericDisplays(row);
        }
        // 전체 주행 경로가 지도 화면에 딱 들어맞도록 줌 및 정렬 강제 갱신
        if (gpsRouteLine && gpsRouteLine.getLatLngs().length > 0) {
          gpsMap.fitBounds(gpsRouteLine.getBounds(), { padding: [30, 30] });
        }
      }
      [chartImuAccel, chartImuGyro].forEach(c => {
        if (c) { c.resize(); c.update('none'); }
      });
      drawCssIntersectionDots(currentCursorIndex);
    }, 50);
  } else if (mode === 'temperature') {
    if (tabTemperature) tabTemperature.classList.add('active');
    if (pageTemperature) pageTemperature.classList.add('active');
    if (lblScrollType) {
      lblScrollType.textContent = '🌡️ 온도 그래프 좌우 스크롤:';
    }
    setTimeout(() => {
      [chartCoolantOil, chartIntakeEcu].forEach(c => {
        if (c) {
          c.resize();
          c.update();
        }
      });
      drawCssIntersectionDots(currentCursorIndex);
    }, 50);
  }

  // 탭 전환에 맞춰 스크롤바 속성(스크러버 vs 패닝) 및 활성화 여부 즉시 갱신
  applyZoomRange(currentStartSec, currentEndSec);
}

// Clear all absolute overlay cursor dots and lines on resize/reload
function clearAllDomCursors() {
  const dots = document.querySelectorAll('.visual-cursor-dot');
  dots.forEach(d => d.style.display = 'none');
  const lines = document.querySelectorAll('.motec-cursor-line');
  lines.forEach(l => l.style.display = 'none');
}

// ==================== [헤더 CSV 열기 버튼 연결] ====================
if (csvUploadInput) {
  csvUploadInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
      csvUploadInput.value = ''; // 같은 파일 다시 열기 가능하게 초기화
    }
  });
}

// 전체 화면 드래그앤드롭 지원 및 시각 오버레이 피드백
const dragOverlay = document.getElementById('drag-drop-overlay');

window.addEventListener('dragenter', (e) => {
  if (e.dataTransfer.types.includes('Files')) {
    e.preventDefault();
    if (dragOverlay) dragOverlay.classList.add('active');
  }
});

window.addEventListener('dragleave', (e) => {
  if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
    if (dragOverlay) dragOverlay.classList.remove('active');
  }
});

window.addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes('Files')) {
    e.preventDefault();
  }
});

window.addEventListener('drop', (e) => {
  if (e.dataTransfer.types.includes('Files')) {
    e.preventDefault();
    if (dragOverlay) dragOverlay.classList.remove('active');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }
});

// ==================== [초고속 60fps 휠/핀치 줌 가로채기 및 쓰로틀링 연동] ====================
let zoomPending = false;
document.addEventListener('wheel', (e) => {
  if (!e.target.closest('.motec-chart-card')) return;
  if (globalData.length === 0 || totalDurationSec <= 0) return;

  // On chart pages the timeline slider stores the viewport start, not the
  // selected cursor time. Anchor zoom to the actual cursor so its horizontal
  // position stays fixed while the surrounding time range changes.
  const cursorRow = activeSampledData[currentCursorIndex];
  let targetTime = cursorRow ? Number(cursorRow.time_sec) : NaN;
  if (tabGps && tabGps.classList.contains('active')) {
    const gpsCursorTime = Number(scrollBar.value);
    if (Number.isFinite(gpsCursorTime)) targetTime = gpsCursorTime;
  }
  if (!Number.isFinite(targetTime) || targetTime < currentStartSec || targetTime > currentEndSec) {
    targetTime = (currentStartSec + currentEndSec) / 2;
  }

  e.preventDefault(); // 스크롤바 바운스 차단

  if (zoomPending) return;
  zoomPending = true;

  // 브라우저 60Hz 렌더링 프레임 단위로 가속화 스케일 연산 바인딩
  requestAnimationFrame(() => {
    const currentSpan = currentEndSec - currentStartSec;
    const zoomFactor = 0.08; // 8% 줌 스케일로 더 촘촘하고 차분한 미세 탐색 지원
    let newSpan = currentSpan;

    if (e.deltaY < 0) {
      newSpan = currentSpan * (1 - zoomFactor);
      if (newSpan < 2.0) newSpan = 2.0; // 줌인 최소 스팬 2초
    } else {
      newSpan = currentSpan * (1 + zoomFactor);
      if (newSpan > totalDurationSec) newSpan = totalDurationSec; // 줌아웃 최대 스팬
    }

    const ratio = currentSpan > 0 ? (targetTime - currentStartSec) / currentSpan : 0.5;
    let newStart = targetTime - (newSpan * ratio);
    let newEnd = targetTime + (newSpan * (1 - ratio));

    if (newStart < 0) {
      newStart = 0;
      newEnd = Math.min(newSpan, totalDurationSec);
    }
    if (newEnd > totalDurationSec) {
      newEnd = totalDurationSec;
      newStart = Math.max(0, totalDurationSec - newSpan);
    }

    applyZoomRange(newStart, newEnd);
    zoomPending = false;
  });
}, { passive: false });
// =======================================================================================

// Zoom & Scroll Event Bindings
btnApply.addEventListener('click', () => {
  const start = parseFloat(inputStart.value) || 0;
  const end = parseFloat(inputEnd.value) || 10;
  
  limitStartSec = Math.max(0, start);
  limitEndSec = Math.min(totalDurationSec, end);
  if (limitStartSec >= limitEndSec) {
    limitEndSec = Math.min(limitStartSec + 5, totalDurationSec);
  }

  applyZoomRange(limitStartSec, limitEndSec);
});

btnReset.addEventListener('click', () => {
  limitStartSec = 0;
  limitEndSec = totalDurationSec;
  applyZoomRange(0, totalDurationSec);
});

const handleEnterKeyZoom = (e) => {
  if (e.key === 'Enter') {
    btnApply.click();
    e.target.blur();
  }
};
inputStart.addEventListener('keydown', handleEnterKeyZoom);
inputEnd.addEventListener('keydown', handleEnterKeyZoom);

function updateColumnCursorLine(lineId, chart, index) {
  const lineEl = document.getElementById(lineId);
  if (!lineEl) return;

  if (!chart || !chart.chartArea || index === undefined || index === null) {
    lineEl.style.display = 'none';
    return;
  }

  const meta = chart.getDatasetMeta(0);
  if (!meta || meta.hidden) {
    lineEl.style.display = 'none';
    return;
  }

  const point = meta.data[index];
  if (point && !isNaN(point.x)) {
    const canvas = chart.canvas;
    const container = lineEl.parentElement;
    
    // Calculate relative left offset of canvas inside the container, accounting for parent border width
    const rectCanvas = canvas.getBoundingClientRect();
    const rectContainer = container.getBoundingClientRect();
    const borderLeft = parseFloat(window.getComputedStyle(container).borderLeftWidth) || 0;
    const relativeLeft = (rectCanvas.left - rectContainer.left) - borderLeft;

    // Center the 2px-wide cursor line on point.x (subtract 1px for half-width)
    lineEl.style.left = (relativeLeft + point.x - 1) + 'px';
    lineEl.style.display = 'block';
  } else {
    lineEl.style.display = 'none';
  }
}

// HIGH-PERFORMANCE: Places bright circles directly on the intersection points of the chart lines
function drawCssIntersectionDots(index, chartSubset = null) {
  if (globalData.length === 0 || activeSampledData.length === 0) return;

  const targetCharts = chartSubset || [
    chartSpeed, chartRpm, chartGear, chartSteering, chartThrottleBrake,
    diagChartThrottleBrake, diagChartSteering, chartFL, chartFR, chartRL, chartRR,
    chartCoolantOil, chartIntakeEcu, chartImuAccel, chartImuGyro
  ];
  
  targetCharts.forEach(chart => {
    if (!chart || !chart.chartArea) return;
    
    const canvas = chart.canvas;
    const holder = canvas.parentElement;
    
    const existingDots = holder.querySelectorAll('.visual-cursor-dot');
    existingDots.forEach(dot => dot.style.display = 'none');

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta.hidden) {
        // 호버 포인트 매핑 시 현재 X축 구간 내 인덱스 역산으로 올바르게 보정
        const point = meta.data[index];
        if (point && !isNaN(point.x) && !isNaN(point.y)) {
          let dot = holder.querySelector(`.visual-cursor-dot-ds-${datasetIndex}`);
          if (!dot) {
            dot = document.createElement('div');
            dot.className = `visual-cursor-dot visual-cursor-dot-ds-${datasetIndex}`;
            dot.style.position = 'absolute';
            dot.style.width = '10px';
            dot.style.height = '10px';
            dot.style.borderRadius = '50%';
            dot.style.border = '2px solid #ffffff';
            dot.style.pointerEvents = 'none';
            dot.style.zIndex = '12';
            dot.style.transform = 'translate(-50%, -50%)';
            holder.appendChild(dot);
          }
          const color = dataset.borderColor || '#00d2ff';
          dot.style.backgroundColor = color;
          dot.style.boxShadow = `0 0 8px ${color}, 0 0 2px #ffffff`;
          dot.style.display = 'block';
          dot.style.left = point.x + 'px';
          dot.style.top = point.y + 'px';
        }
      }
    });
  });

  // 세로 관통 커서선 위치 업데이트
  updateColumnCursorLine('cursor-line-page1-left', chartSpeed, index);
  updateColumnCursorLine('cursor-line-page1-right', chartSteering, index);
  updateColumnCursorLine('cursor-line-page2-top', diagChartThrottleBrake, index);
  updateColumnCursorLine('cursor-line-page2-bot-left', chartFL, index);
  updateColumnCursorLine('cursor-line-page2-bot-right', chartFR, index);
}

// Panning/Scrolling scrollbar event
let dragSyncPending = false;
let lastDragEvent = null;

function findSampleIndexAtTime(targetTime) {
  let lo = 0;
  let hi = activeSampledData.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (activeSampledData[mid].time_sec < targetTime) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const before = activeSampledData[lo - 1];
    const after = activeSampledData[lo];
    if (Math.abs(before.time_sec - targetTime) <= Math.abs(after.time_sec - targetTime)) return lo - 1;
  }
  return lo;
}

function findGlobalIndexAtTime(targetTime) {
  let lo = 0;
  let hi = globalData.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (globalData[mid].time_sec < targetTime) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const before = globalData[lo - 1];
    const after = globalData[lo];
    if (Math.abs(before.time_sec - targetTime) <= Math.abs(after.time_sec - targetTime)) return lo - 1;
  }
  return lo;
}

// GPS fixes are recorded less frequently than the 100 Hz telemetry rows. Move
// the map marker continuously between consecutive fixes instead of holding it
// still and jumping whenever a new fix arrives.
function getInterpolatedGpsPosition(targetTime, nearbyIndex) {
  if (!globalData.length || nearbyIndex < 0) return null;

  let floorIndex = nearbyIndex;
  while (floorIndex > 0 && globalData[floorIndex].time_sec > targetTime) floorIndex--;

  const coordsAt = index => {
    const row = globalData[index];
    const lat = convertNmeaToDecimal(row.gps_lat, false);
    const lon = convertNmeaToDecimal(row.gps_lon, true);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  };

  let previousIndex = floorIndex;
  let previous = coordsAt(previousIndex);
  while (!previous && previousIndex > 0) previous = coordsAt(--previousIndex);
  if (!previous) return null;

  // Repeated rows carry the last fix forward. Use the first row of that fix as
  // the interpolation start so progress remains linear throughout the interval.
  while (previousIndex > 0) {
    const earlier = coordsAt(previousIndex - 1);
    if (!earlier || earlier.lat !== previous.lat || earlier.lon !== previous.lon) break;
    previousIndex--;
  }

  // Locate the first following row whose GPS fix is actually different.
  let nextIndex = Math.max(floorIndex + 1, previousIndex + 1);
  let next = null;
  while (nextIndex < globalData.length) {
    const candidate = coordsAt(nextIndex);
    if (candidate && (candidate.lat !== previous.lat || candidate.lon !== previous.lon)) {
      next = candidate;
      break;
    }
    nextIndex++;
  }
  if (!next) return previous;

  // Do not invent motion across a long GPS outage.
  const previousTime = globalData[previousIndex].time_sec;
  const nextTime = globalData[nextIndex].time_sec;
  const gap = nextTime - previousTime;
  if (!(gap > 0) || gap > 10) return previous;
  const ratio = Math.max(0, Math.min(1, (targetTime - previousTime) / gap));
  return {
    lat: previous.lat + (next.lat - previous.lat) * ratio,
    lon: previous.lon + (next.lon - previous.lon) * ratio
  };
}

// Chart.js lines are downsampled for performance, but the playback cursor must
// use the exact playback time and the original 100 Hz IMU values.
function drawExactImuCursor(targetTime, row) {
  const specs = [
    [chartImuAccel, ['imu_accel_x_g', 'imu_accel_y_g']],
    [chartImuGyro, ['imu_gyro_x_dps', 'imu_gyro_y_dps', 'imu_gyro_z_dps']]
  ];

  specs.forEach(([chart, keys]) => {
    if (!chart || !chart.chartArea || !chart.scales.x || !chart.scales.y) return;
    const holder = chart.canvas.parentElement;
    holder.querySelectorAll('.visual-cursor-dot').forEach(dot => dot.style.display = 'none');
    const x = chart.scales.x.getPixelForValue(targetTime);

    keys.forEach((key, datasetIndex) => {
      const value = Number(row[key]);
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!Number.isFinite(value) || !Number.isFinite(x) || !meta || meta.hidden) return;
      const y = chart.scales.y.getPixelForValue(value);
      if (!Number.isFinite(y)) return;
      let dot = holder.querySelector(`.visual-cursor-dot-ds-${datasetIndex}`);
      if (!dot) {
        dot = document.createElement('div');
        dot.className = `visual-cursor-dot visual-cursor-dot-ds-${datasetIndex}`;
        Object.assign(dot.style, {
          position: 'absolute', width: '10px', height: '10px', borderRadius: '50%',
          border: '2px solid #ffffff', pointerEvents: 'none', zIndex: '12',
          transform: 'translate(-50%, -50%)'
        });
        holder.appendChild(dot);
      }
      const color = chart.data.datasets[datasetIndex].borderColor || '#00d2ff';
      dot.style.backgroundColor = color;
      dot.style.boxShadow = `0 0 8px ${color}, 0 0 2px #ffffff`;
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      dot.style.display = 'block';
    });
  });
}

function updateGpsCursorAtTime(targetTime, playbackFrame = false) {
  if (!activeSampledData.length || !Number.isFinite(targetTime)) return;
  const minTime = Number(scrollBar.min) || 0;
  const maxTime = Number(scrollBar.max) || totalDurationSec;
  const clampedTime = Math.max(minTime, Math.min(maxTime, targetTime));
  currentCursorIndex = findSampleIndexAtTime(clampedTime);
  // Numeric widgets, G meter and map use the original 100 Hz row. Charts keep
  // their 4,500-point series and only move the cursor to the nearest sample.
  const globalIndex = globalData.length ? findGlobalIndexAtTime(clampedTime) : -1;
  const row = globalIndex >= 0 ? globalData[globalIndex] : activeSampledData[currentCursorIndex];
  scrollBar.value = clampedTime.toFixed(2);
  if (gpsPlayTime) gpsPlayTime.textContent = `${clampedTime.toFixed(2)} s`;
  if (row) {
    let displayRow = row;
    if (globalIndex >= 0 && gpsImuLpf && gpsImuLpf.checked && typeof channelValueAt === 'function') {
      displayRow = Object.create(row);
      const values = {
        imu_accel_x_g: channelValueAt('imu_ax', globalIndex),
        imu_accel_y_g: channelValueAt('imu_ay', globalIndex),
        imu_gyro_x_dps: channelValueAt('imu_gx', globalIndex),
        imu_gyro_y_dps: channelValueAt('imu_gy', globalIndex),
        imu_gyro_z_dps: channelValueAt('imu_gz', globalIndex)
      };
      Object.entries(values).forEach(([key, value]) => {
        if (Number.isFinite(value)) displayRow[key] = value;
      });
    }
    const gpsPosition = getInterpolatedGpsPosition(clampedTime, globalIndex);
    updateNumericDisplays(displayRow, gpsPosition, clampedTime);
    drawExactImuCursor(clampedTime, displayRow);
  }
}

function setGpsPlayback(shouldPlay) {
  const canPlay = shouldPlay && activeSampledData.length > 0 &&
    tabGps && tabGps.classList.contains('active');
  gpsPlaybackActive = Boolean(canPlay);

  if (gpsPlaybackFrame !== null) {
    cancelAnimationFrame(gpsPlaybackFrame);
    gpsPlaybackFrame = null;
  }
  gpsPlaybackLastTimestamp = null;

  if (gpsPlayToggle) {
    gpsPlayToggle.textContent = gpsPlaybackActive ? '❚❚ 일시정지' : '▶ 재생';
    gpsPlayToggle.classList.toggle('playing', gpsPlaybackActive);
  }
  if (!gpsPlaybackActive) return;

  const minTime = Number(scrollBar.min) || 0;
  const maxTime = Number(scrollBar.max) || totalDurationSec;
  gpsPlaybackCursorSec = Number(scrollBar.value);
  if (!Number.isFinite(gpsPlaybackCursorSec) || gpsPlaybackCursorSec >= maxTime - 0.01) {
    gpsPlaybackCursorSec = minTime;
    updateGpsCursorAtTime(gpsPlaybackCursorSec);
  }

  const playbackStep = timestamp => {
    if (!gpsPlaybackActive) return;
    if (gpsPlaybackLastTimestamp === null) {
      gpsPlaybackLastTimestamp = timestamp;
      gpsPlaybackFrame = requestAnimationFrame(playbackStep);
      return;
    }

    // requestAnimationFrame을 약 60fps로 제한합니다. 120Hz 디스플레이에서도
    // 두 프레임마다 한 번만 갱신해 재생 속도와 CPU 사용량을 일정하게 유지합니다.
    const elapsedMs = timestamp - gpsPlaybackLastTimestamp;
    if (elapsedMs < 15) {
      gpsPlaybackFrame = requestAnimationFrame(playbackStep);
      return;
    }
    gpsPlaybackLastTimestamp = timestamp;

    const rate = Number(gpsPlayRate ? gpsPlayRate.value : 1) || 1;
    gpsPlaybackCursorSec += (elapsedMs / 1000) * rate;
    if (gpsPlaybackCursorSec >= maxTime) {
      updateGpsCursorAtTime(maxTime);
      setGpsPlayback(false);
      return;
    }

    updateGpsCursorAtTime(gpsPlaybackCursorSec, true);
    gpsPlaybackFrame = requestAnimationFrame(playbackStep);
  };

  gpsPlaybackFrame = requestAnimationFrame(playbackStep);
}

if (gpsPlayToggle) {
  gpsPlayToggle.addEventListener('click', () => setGpsPlayback(!gpsPlaybackActive));
}
if (gpsImuLpf) {
  gpsImuLpf.addEventListener('change', () => {
    const keys = ['imu_ax', 'imu_ay', 'imu_gx', 'imu_gy', 'imu_gz'];
    if (typeof getFilterState === 'function' && typeof recomputeChannel === 'function') {
      keys.forEach(key => {
        const state = getFilterState(key);
        state.type = gpsImuLpf.checked ? 'butter' : 'none';
        state.params = gpsImuLpf.checked ? { fc: 5, order: 2 } : {};
        recomputeChannel(key);
      });
      refreshChartsAfterFilter();
      updateGpsCursorAtTime(Number(scrollBar.value) || 0);
    }
  });
}

function getImuChartByCanvasId(canvasId) {
  if (canvasId === 'chart-imu-accel') return chartImuAccel;
  if (canvasId === 'chart-imu-gyro') return chartImuGyro;
  return null;
}

function applyImuAxisToggleState(canvasId) {
  const chart = getImuChartByCanvasId(canvasId);
  if (!chart) return;
  document.querySelectorAll(`.imu-axis-toggle[data-chart="${canvasId}"]`).forEach(button => {
    const datasetIndex = Number(button.dataset.dataset);
    const enabled = button.getAttribute('aria-pressed') !== 'false';
    if (Number.isInteger(datasetIndex)) chart.setDatasetVisibility(datasetIndex, enabled);
  });
  chart.update('none');
}

document.querySelectorAll('.imu-axis-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(enabled));
    button.classList.toggle('active', enabled);
    applyImuAxisToggleState(button.dataset.chart);
    const cursorTime = Number(scrollBar.value);
    if (Number.isFinite(cursorTime)) updateGpsCursorAtTime(cursorTime);
  });
});

if (scrollBar) {
  scrollBar.addEventListener('pointerdown', () => setGpsPlayback(false));
}

const handleTimelineScrollDrag = (e) => {
  lastDragEvent = e;
  if (dragSyncPending) return;
  dragSyncPending = true;

  requestAnimationFrame(() => {
    if (!lastDragEvent || globalData.length === 0 || activeSampledData.length === 0) {
      dragSyncPending = false;
      return;
    }
    
    // GPS 페이지 활성화 시: 시간 스크러버(Scrubber)로 동작
    if (tabGps && tabGps.classList.contains('active')) {
      const targetTime = parseFloat(lastDragEvent.target.value);
      if (!isNaN(targetTime)) updateGpsCursorAtTime(targetTime);
    } else {
      // 일반 차트 페이지 활성화 시: 뷰포트 스크롤(Panning)로 동작
      const scrollStart = parseFloat(lastDragEvent.target.value);
      if (!isNaN(scrollStart)) {
        const currentSpan = currentEndSec - currentStartSec;
        const newStart = scrollStart;
        const newEnd = scrollStart + currentSpan;
        applyZoomRange(newStart, newEnd);
      }
    }
    dragSyncPending = false;
  });
};

scrollBar.addEventListener('input', handleTimelineScrollDrag);
scrollBar.addEventListener('change', handleTimelineScrollDrag);

// 커서 위치의 채널 값을 읽습니다. 노이즈 필터가 걸려 있으면 필터 적용값을
// 반환해서 그래프와 숫자 표시가 항상 같은 값을 가리키도록 합니다.
function cursorChannelValue(key, fallback) {
  if (typeof channelValueAt === 'function' && sampleIndices.length) {
    const v = channelValueAt(key, sampleIndices[currentCursorIndex]);
    if (v !== null && Number.isFinite(v)) return v;
  }
  return fallback;
}

// Numeric labels updates helper
function updateNumericDisplays(row, gpsPositionOverride = null, displayTimeOverride = null) {
  const displayTime = Number.isFinite(displayTimeOverride) ? displayTimeOverride : row.time_sec;
  if (currentTimeVal) {
    let timeText = displayTime.toFixed(2) + 's';
    if (row.gps_time && row.gps_time.trim() !== "" && row.gps_time !== "00:00:00.00") {
      timeText += ` (${row.gps_time})`;
    }
    currentTimeVal.textContent = timeText;
  }

  if (scrollBar && tabGps && tabGps.classList.contains('active')) {
    scrollBar.value = displayTime.toFixed(2);
    if (gpsPlayTime) gpsPlayTime.textContent = `${displayTime.toFixed(2)} s`;
  }

  // Page 1 Labels (노이즈 필터 적용값 기준)
  cursorSpeed.textContent = cursorChannelValue('fl_speed', row.fl_speed_kmh || 0).toFixed(1);
  if (cursorSpeedRl) cursorSpeedRl.textContent = cursorChannelValue('rl_speed', row.rl_speed_kmh || 0).toFixed(1);
  if (cursorSpeedRr) cursorSpeedRr.textContent = cursorChannelValue('rr_speed', row.rr_speed_kmh || 0).toFixed(1);
  cursorRpm.textContent = Math.round(cursorChannelValue('rpm', row.rpm || 0));

  const gearVal = Math.round(cursorChannelValue('gear', row.gear !== undefined ? row.gear : NaN));
  if (gearVal === 0) {
    cursorGear.textContent = 'N';
  } else {
    cursorGear.textContent = Number.isFinite(gearVal) ? gearVal : '-';
  }

  const steeringDeg = cursorChannelValue('steering', getCalibratedSteering(row.steering_raw));
  cursorSteering.textContent = (steeringDeg >= 0 ? '+' : '') + steeringDeg.toFixed(1);

  if (steeringWheelGraphic) {
    steeringWheelGraphic.style.transform = `rotate(${steeringDeg}deg)`;
  }

  const throttleVal = cursorChannelValue('throttle', row.decoded_tps || 0).toFixed(1);
  const brakeVal = cursorChannelValue('brake', getCalibratedBrake(row.front_brake_raw)).toFixed(1);

  cursorThrottle.textContent = throttleVal;
  cursorBrake.textContent = brakeVal;

  // Page 2 Labels
  diagCursorThrottle.textContent = throttleVal;
  diagCursorBrake.textContent = brakeVal;
  diagCursorSteering.textContent = (steeringDeg >= 0 ? '+' : '') + steeringDeg.toFixed(1);

  // 2페이지 핸들 그래픽 회전 연동
  const diagWheel = document.getElementById('diag-steering-wheel-graphic');
  if (diagWheel) {
    diagWheel.style.transform = `rotate(${steeringDeg}deg)`;
  }

  // 3페이지(GPS 지도) 우측 상단 조향각 위젯 연동
  if (gpsSteeringWheelGraphic) {
    gpsSteeringWheelGraphic.style.transform = `rotate(${steeringDeg}deg)`;
  }
  if (gpsCursorSteering) {
    gpsCursorSteering.textContent = (steeringDeg >= 0 ? '+' : '') + steeringDeg.toFixed(1);
  }

  const susText = (key, raw) => {
    const v = cursorChannelValue(key, raw);
    return Number.isFinite(v) ? Math.round(v) : '----';
  };
  cursorSusFl.textContent = susText('sus_fl', row.suspension_fl_raw);
  cursorSusFr.textContent = susText('sus_fr', row.suspension_fr_raw);
  cursorSusRl.textContent = susText('sus_rl', row.suspension_rl_raw);
  cursorSusRr.textContent = susText('sus_rr', row.suspension_rr_raw);

  // Page 4 temperature values
  if (tempCursorCoolant) tempCursorCoolant.textContent = Math.round(cursorChannelValue('water', row.water_c || 0));
  if (tempCursorOil) tempCursorOil.textContent = Math.round(cursorChannelValue('oil', row.oil_c || 0));
  if (tempCursorIat) tempCursorIat.textContent = Math.round(cursorChannelValue('iat', row.iat_c || 0));
  if (tempCursorEcu) tempCursorEcu.textContent = Math.round(cursorChannelValue('ecu', row.ecu_c || 0));

  // Page 3 GPS Elements update
  if (cursorGpsCoords) {
    const lat = gpsPositionOverride ? gpsPositionOverride.lat : convertNmeaToDecimal(row.gps_lat, false);
    const lon = gpsPositionOverride ? gpsPositionOverride.lon : convertNmeaToDecimal(row.gps_lon, true);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      cursorGpsCoords.textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      
      // Update cursor marker on the map
      if (gpsMap) {
        if (!gpsCursorMarker) {
          const pulseIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="gps-pulse-marker" style="background:#f97316; width:12px; height:12px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 8px rgba(0,0,0,0.5);"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          });
          gpsCursorMarker = L.marker([lat, lon], { icon: pulseIcon }).addTo(gpsMap);
        } else {
          gpsCursorMarker.setLatLng([lat, lon]);
        }
      }
    } else {
      cursorGpsCoords.textContent = '--.------, ---.------';
    }
  }

  // GPS 속도 vs FL 휠속도 비교 (휠 슬립 / 속도 보정 오차 확인용)
  const gpsSpd = parseFloat(row.gps_speed_kmh) || 0.0;
  const wheelSpd = cursorChannelValue('fl_speed', row.fl_speed_kmh || 0);
  if (gpsCursorSpeed) gpsCursorSpeed.textContent = gpsSpd.toFixed(1);
  if (gpsCursorWheelSpeed) gpsCursorWheelSpeed.textContent = wheelSpd.toFixed(1);
  if (gpsSpeedDelta) {
    const d = wheelSpd - gpsSpd;
    gpsSpeedDelta.textContent = (d >= 0 ? '+' : '') + d.toFixed(1) + ' km/h';
    // 저속에서는 GPS 속도 자체가 부정확하므로 판정에서 제외
    const meaningful = gpsSpd > 10 || wheelSpd > 10;
    gpsSpeedDelta.classList.toggle('warn', meaningful && Math.abs(d) > 5);
  }

  if (gpsCursorSats) {
    gpsCursorSats.textContent = row.gps_sat !== undefined ? row.gps_sat : '0';
  }

  if (gpsCursorQual) {
    const qual = parseInt(row.gps_qual) || 0;
    let qualText = 'No Fix';
    if (qual === 1) qualText = 'GPS Fix';
    else if (qual === 2) qualText = 'DGPS';
    else if (qual === 4) qualText = 'RTK Fixed';
    else if (qual === 5) qualText = 'RTK Float';
    gpsCursorQual.textContent = `${qual} (${qualText})`;
  }

  if (gpsCursorTime) {
    gpsCursorTime.textContent = (row.gps_time && row.gps_time.trim() !== "") ? row.gps_time : "00:00:00.00";
  }

  // GPS 페이지 IMU 현황: 지도 커서와 동일한 CSV 행을 사용해 완전히 동기화합니다.
  const ax = Number(row.imu_accel_x_g);
  const ay = Number(row.imu_accel_y_g);
  const roll = Number(row.imu_roll_deg);
  const pitch = Number(row.imu_pitch_deg);
  const yaw = Number(row.imu_yaw_deg);
  const imuValid = [ax, ay].every(Number.isFinite);

  if (imuAccelX) imuAccelX.textContent = Number.isFinite(ax) ? ax.toFixed(2) : '--.--';
  if (imuAccelY) imuAccelY.textContent = Number.isFinite(ay) ? ay.toFixed(2) : '--.--';
  if (imuRoll) imuRoll.textContent = Number.isFinite(roll) ? `${roll.toFixed(1)}°` : '--.-°';
  if (imuPitch) imuPitch.textContent = Number.isFinite(pitch) ? `${pitch.toFixed(1)}°` : '--.-°';
  if (imuYaw) imuYaw.textContent = Number.isFinite(yaw) ? `${yaw.toFixed(1)}°` : '--.-°';

  const batteryPct = Number(row.imu_battery_pct);
  if (imuBattery) imuBattery.textContent = Number.isFinite(batteryPct) ? `${Math.round(batteryPct)}%` : '--%';
  const ageMs = Number(row.imu_age_us) / 1000;
  if (imuAge) {
    imuAge.textContent = Number.isFinite(ageMs) ? `${ageMs.toFixed(0)} ms` : '-- ms';
    imuAge.classList.toggle('stale', Number.isFinite(ageMs) && ageMs > 200);
  }

  if (imuGDot) {
    const limitG = 2.0;
    const clamp = value => Math.max(-limitG, Math.min(limitG, value));
    // Vehicle axes: +X is forward (screen up), +Y is left (screen left).
    const left = imuValid ? 50 - (clamp(ay) / limitG) * 45 : 50;
    const top = imuValid ? 50 - (clamp(ax) / limitG) * 45 : 50;
    imuGDot.style.left = `${left}%`;
    imuGDot.style.top = `${top}%`;
    imuGDot.style.opacity = imuValid ? '1' : '0.25';
  }
}

function handleFile(file) {
  if (!file.name.endsWith('.csv') && !file.name.endsWith('.CSV')) {
    alert('CSV 형식의 로그 파일만 업로드할 수 있습니다.');
    return;
  }

  if (loadedFileBadge) {
    loadedFileBadge.textContent = '📄 ' + file.name;
    loadedFileBadge.style.display = 'inline-block';
  }

  statusBadge.className = 'status-badge active';
  statusText.textContent = '로그 파싱 중...';

  Papa.parse(file, {
    header: true,
    // [중요] CAN 프레임 컬럼은 16진수 문자열이므로 절대 숫자로 변환하면 안 됩니다.
    // dynamicTyping:true 로 전부 변환하면 'E'가 지수 표기로 해석되어
    //   '9E01082950004002' → 9e1082950004002 → Infinity → 'Infinity' → 헥사 정리 → '000000000000000f'
    // 처럼 프레임이 통째로 망가집니다. (Telemetry_001.csv 기준 전체 CAN 프레임의
    // 3.85%인 16,096개가 이 경로로 손상됨 — RPM/기어/온도/서스펜션 값이 순간적으로 튀는 원인)
    // 16자리 전부 숫자인 프레임도 2^53을 넘으면 하위 바이트가 잘려나갑니다.
    dynamicTyping: header => !/^can\d+_data$/i.test(String(header)),
    skipEmptyLines: true,
    complete: function (results) {
      globalData = results.data;
      initDataAndDashboard();
      uploadFileToServer(file);
    },
    error: function (err) {
      statusBadge.className = 'status-badge inactive';
      statusText.textContent = '파싱 오류!';
      alert('CSV 파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    }
  });
}

function uploadFileToServer(file) {
  const formData = new FormData();
  formData.append('csvFile', file);

  fetch('/api/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => {
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  })
  .then(data => {
    console.log('서버 업로드 성공:', data);
  })
  .catch(err => {
    console.error('서버 업로드 에러:', err);
  });
}

function initDataAndDashboard() {
  if (globalData.length === 0) return;
  setGpsPlayback(false);
  statusText.textContent = '지표 연산 중...';

  globalData = globalData.map(normalizeTelemetryRow);
  const startUs = globalData[0].timestamp_us || 0;
  
  let latestRpm = 0;
  let latestTps = 0.0;
  let latestSpeedKmh = 0.0;
  let latestOilC = 0;
  let latestWaterC = 0;
  let latestGear = 0;
  let latestBatteryMv = 0;
  let latestIatC = 0;
  let latestEcuC = 0;
  let latestEmuAdc4Raw = 0;
  let latestEmuAdc5Raw = 0;
  let latestEmuAdc6Raw = 0;

  globalData.forEach(row => {
    // timestamp_us in the new CSV is already in seconds, so we don't divide by 1,000,000!
    row.time_sec = (row.timestamp_us || 0) - startUs;

    // IMU logger units → dashboard engineering units.
    row.imu_gyro_x_dps = Number(row.imu_gyro_x_deci_dps) / 10.0;
    row.imu_gyro_y_dps = Number(row.imu_gyro_y_deci_dps) / 10.0;
    row.imu_gyro_z_dps = Number(row.imu_gyro_z_deci_dps) / 10.0;
    row.imu_accel_x_g = Number(row.imu_accel_x_milli_g) / 1000.0;
    row.imu_accel_y_g = Number(row.imu_accel_y_milli_g) / 1000.0;
    row.imu_accel_z_g = Number(row.imu_accel_z_milli_g) / 1000.0;
    row.imu_roll_deg = Number(row.imu_roll_centi_deg) / 100.0;
    row.imu_pitch_deg = Number(row.imu_pitch_centi_deg) / 100.0;
    row.imu_yaw_deg = Number(row.imu_yaw_centi_deg) / 100.0;

    const hasPackedCan = row.can600_data !== undefined;

    if (hasPackedCan) {
      const can600 = decodePackedCanFrame(row.can600_data);
      const can601 = decodePackedCanFrame(row.can601_data);
      const can602 = decodePackedCanFrame(row.can602_data);
      const can604 = decodePackedCanFrame(row.can604_data);
      const can606 = decodePackedCanFrame(row.can606_data);

      if (packedCanFrameHasData(can600)) {
        latestRpm = can600[0] | (can600[1] << 8);
        latestTps = can600[2] * 0.5;
        latestIatC = can600[3] > 127 ? can600[3] - 256 : can600[3];
      }
      if (packedCanFrameHasData(can602)) {
        latestSpeedKmh = can602[0] | (can602[1] << 8);

        latestOilC = can602[3];

        let water = can602[6] | (can602[7] << 8);
        if (water > 32767) water -= 65536;
        latestWaterC = water;
      }

      if (packedCanFrameHasData(can604)) {
        latestGear = can604[0];
        latestEcuC = can604[1] > 127 ? can604[1] - 256 : can604[1];
        latestBatteryMv = (can604[2] | (can604[3] << 8)) * 27;
      }
      if (packedCanFrameHasData(can601)) {
        latestEmuAdc4Raw = can601[6] | (can601[7] << 8);
      }
      if (packedCanFrameHasData(can606)) {
        latestEmuAdc5Raw = can606[0] | (can606[1] << 8);
        latestEmuAdc6Raw = can606[2] | (can606[3] << 8);
      }
    } else {
      // Legacy logs store one CAN frame in each CSV row.
      const stdId = parseHexOrInt(row.can_id);
      const dlc = parseHexOrInt(row.can_dlc);
      const canData = [
        parseHexOrInt(row.can_d0),
        parseHexOrInt(row.can_d1),
        parseHexOrInt(row.can_d2),
        parseHexOrInt(row.can_d3),
        parseHexOrInt(row.can_d4),
        parseHexOrInt(row.can_d5),
        parseHexOrInt(row.can_d6),
        parseHexOrInt(row.can_d7)
      ];

      if (row.can_valid === 1 && dlc >= 8) {
        if (stdId === 0x600) {
          latestRpm = canData[0] | (canData[1] << 8);
          latestTps = canData[2] * 0.5;
          latestIatC = canData[3] > 127 ? canData[3] - 256 : canData[3];
        } else if (stdId === 0x601) {
          latestEmuAdc4Raw = canData[6] | (canData[7] << 8);
        } else if (stdId === 0x602) {
          latestSpeedKmh = canData[0] | (canData[1] << 8);
          
          latestOilC = canData[3];

          let water = canData[6] | (canData[7] << 8);
          if (water > 32767) water -= 65536;
          latestWaterC = water;
        } else if (stdId === 0x604) {
          latestGear = canData[0];
          latestEcuC = canData[1] > 127 ? canData[1] - 256 : canData[1];
          latestBatteryMv = (canData[2] | (canData[3] << 8)) * 27;
        } else if (stdId === 0x606) {
          latestEmuAdc5Raw = canData[0] | (canData[1] << 8);
          latestEmuAdc6Raw = canData[2] | (canData[3] << 8);
        }
      }
    }

    // Set parsed values on the row object so the rest of the application uses them naturally
    row.rpm = latestRpm;
    row.decoded_tps = latestTps;
    row.can_speed_kmh = latestSpeedKmh;
    row.oil_c = latestOilC;
    row.water_c = latestWaterC;
    row.iat_c = latestIatC;
    row.ecu_c = latestEcuC;
    row.gear = latestGear;
    row.battery_mV = latestBatteryMv;
    row.suspension_rl_raw = latestEmuAdc4Raw;
    row.suspension_rr_raw = latestEmuAdc5Raw;
    row.rear_brake_raw = latestEmuAdc6Raw;

    // Front-left wheel speed comes from EMU VSS (0x602 bytes 0..1).
    row.fl_speed_kmh = latestSpeedKmh;
    // Rear-left wheel speed comes from the dedicated datalogger wheel channel.
    row.rl_speed_kmh = (parseHexOrInt(row.rl_wheel_speed_centi_kmh ??
      row.wheel4_speed_centi_kmh) || 0) / 100.0;
    // Rear-right wheel speed comes from Wheel Speed 3 on the datalogger.
    row.rr_speed_kmh = (parseHexOrInt(row.rr_wheel_speed_centi_kmh ??
      row.wheel3_speed_centi_kmh) || 0) / 100.0;
  });

  let lastValidRow = globalData[globalData.length - 1];
  for (let i = globalData.length - 1; i >= 0; i--) {
    if (globalData[i] && globalData[i].time_sec !== undefined && !isNaN(globalData[i].time_sec)) {
      lastValidRow = globalData[i];
      break;
    }
  }
  totalDurationSec = lastValidRow.time_sec || 0.1;

  limitStartSec = 0;
  limitEndSec = totalDurationSec;

  let maxRpm = 0;
  let maxSpeed = 0.0;
  let minBattmV = 99999;
  let hasAdcAnomaly = false;
  let maxCoolantC = -Infinity;
  let maxOilC = -Infinity;
  let maxIatC = -Infinity;
  let maxEcuC = -Infinity;

  globalData.forEach(row => {
    if (row.rpm > maxRpm) maxRpm = row.rpm;
    const speed = row.fl_speed_kmh || 0;
    if (speed > maxSpeed) maxSpeed = speed;
    if (row.battery_mV && row.battery_mV > 0 && row.battery_mV < minBattmV) {
      minBattmV = row.battery_mV;
    }
    if (row.suspension_fl_raw > 3800 && row.suspension_rl_raw > 3800) {
      hasAdcAnomaly = true;
    }
    if (Number.isFinite(row.water_c)) maxCoolantC = Math.max(maxCoolantC, row.water_c);
    if (Number.isFinite(row.oil_c)) maxOilC = Math.max(maxOilC, row.oil_c);
    if (Number.isFinite(row.iat_c)) maxIatC = Math.max(maxIatC, row.iat_c);
    if (Number.isFinite(row.ecu_c)) maxEcuC = Math.max(maxEcuC, row.ecu_c);
  });

  statMaxRpm.textContent = Math.round(maxRpm).toLocaleString();
  statMaxSpeed.textContent = maxSpeed.toFixed(1) + ' km/h';
  statMinBatt.textContent = minBattmV === 99999 ? '0.00 V' : (minBattmV / 1000.0).toFixed(2) + ' V';
  statDuration.textContent = totalDurationSec.toFixed(1) + 's';
  if (tempMaxCoolant) tempMaxCoolant.textContent = Number.isFinite(maxCoolantC) ? Math.round(maxCoolantC) : '--';
  if (tempMaxOil) tempMaxOil.textContent = Number.isFinite(maxOilC) ? Math.round(maxOilC) : '--';
  if (tempMaxIat) tempMaxIat.textContent = Number.isFinite(maxIatC) ? Math.round(maxIatC) : '--';
  if (tempMaxEcu) tempMaxEcu.textContent = Number.isFinite(maxEcuC) ? Math.round(maxEcuC) : '--';
  
  if (adcAlertBadge) {
    adcAlertBadge.style.display = hasAdcAnomaly ? 'block' : 'none';
  }

  // [노이즈 필터] 100Hz 원본 전체를 채널별 배열로 만들어 둡니다.
  // 필터는 반드시 다운샘플링 "이전"의 원본에 적용해야 에일리어싱 없이 동작합니다.
  if (typeof buildRawChannels === 'function') {
    statusText.textContent = '채널 구성 중...';
    buildRawChannels(globalData);
  }

  // [성능 초고속 최적화]: 전체 원본 로그 데이터를 최대 4,500 포인트 크기로 1회 정밀 샘플링하여 꽂아둡니다.
  // 이로 인해 휠 확대 시 11개 차트 객체를 완전 파괴(destroy)하고 새로 그리지 않고, X축 범위(scale min/max)만 초고속 갱신하게 됩니다.
  sampleIndices = downsampleIndices(globalData.length, 4500);
  activeSampledData = sampleIndices.map(i => globalData[i]);
  sampleTimes = activeSampledData.map(r => r.time_sec);

  // 최초 1회 전체 차트 생성 기동
  renderMotecCharts(activeSampledData);
  currentCursorIndex = 0;
  if (activeSampledData[0]) updateNumericDisplays(activeSampledData[0]);

  // 초기 줌 레인지 적용
  applyZoomRange(0, totalDurationSec);

  // GPS 지도 초기화 및 주행 경로 그리기
  if (typeof L !== 'undefined') {
    try {
      initGpsMap();
      
      const routeCoords = [];
      globalData.forEach(row => {
        const lat = convertNmeaToDecimal(row.gps_lat, false);
        const lon = convertNmeaToDecimal(row.gps_lon, true);
        if (lat && lon) {
          routeCoords.push([lat, lon]);
        }
      });

      if (routeCoords.length > 0 && gpsRouteLine) {
        gpsRouteLine.setLatLngs(routeCoords);
        // 자동 줌 및 위치 맞춤
        gpsMap.fitBounds(gpsRouteLine.getBounds(), { padding: [20, 20] });
      } else if (gpsRouteLine) {
        gpsRouteLine.setLatLngs([]);
      }
    } catch (err) {
      console.error("GPS 지도 설정 실패:", err);
    }
  }

  statusBadge.className = 'status-badge active';
  statusText.textContent = '로그 로드 완료';
}

// [초고속 60fps 최적화 개편] 이제 더 이상 차트를 파괴/재생성하지 않고, X축 범위만 변경하여 갱신합니다!
function applyZoomRange(start, end) {
  if (globalData.length === 0 || activeSampledData.length === 0) return;

  let cleanStart = Math.max(0, start);
  let cleanEnd = Math.min(totalDurationSec, end);
  if (cleanStart >= cleanEnd) {
    cleanEnd = Math.min(cleanStart + 5, totalDurationSec);
  }

  currentStartSec = cleanStart;
  currentEndSec = cleanEnd;

  inputStart.value = cleanStart.toFixed(1);
  inputEnd.value = cleanEnd.toFixed(1);

  // GPS 페이지가 활성화된 경우: 시간 스크러버(Scrubber)로 동작하도록 스크롤바 세팅
  if (tabGps && tabGps.classList.contains('active')) {
    scrollBar.min = cleanStart.toFixed(2);
    scrollBar.max = cleanEnd.toFixed(2);
    scrollBar.step = "0.04";
    
    // 현재 커서 시점 탐색하여 설정
    const currentRow = activeSampledData[currentCursorIndex];
    let targetTime = cleanStart;
    if (currentRow && currentRow.time_sec >= cleanStart && currentRow.time_sec <= cleanEnd) {
      targetTime = currentRow.time_sec;
    }
    scrollBar.value = targetTime.toFixed(2);
    scrollBar.disabled = (cleanEnd - cleanStart <= 0.05);
  } else {
    // 차트 페이지의 경우: 차트 좌우 이동(Panning) 스크롤바로 세팅
    const visibleSpan = cleanEnd - cleanStart;
    const maxScroll = totalDurationSec - visibleSpan;

    scrollBar.min = "0";
    scrollBar.max = Math.max(0, maxScroll).toFixed(2);
    scrollBar.value = cleanStart.toFixed(2);
    scrollBar.step = (totalDurationSec / 2000).toFixed(4);
    scrollBar.disabled = maxScroll <= 0.01;
  }

  // 11개 Chart.js 인스턴스의 X축 범위만 갱신 (CPU 오버헤드 99% 해제!)
  const targetCharts = [
    chartSpeed, chartRpm, chartGear, chartSteering, chartThrottleBrake,
    diagChartThrottleBrake, diagChartSteering, chartFL, chartFR, chartRL, chartRR,
    chartCoolantOil, chartIntakeEcu, chartImuAccel, chartImuGyro
  ];

  targetCharts.forEach(c => {
    if (c && c.options.scales && c.options.scales.x) {
      c.options.scales.x.min = cleanStart;
      c.options.scales.x.max = cleanEnd;
      c.update('none'); // 애니메이션을 끄고 즉각 60fps 무지연 드로잉!
    }
  });

  if (globalData.length > 0 && activeSampledData.length > 0) {
    drawCssIntersectionDots(currentCursorIndex);
  } else {
    clearAllDomCursors();
  }
}

function filterDataByRange(start, end) {
  return globalData.filter(row => row.time_sec >= start && row.time_sec <= end);
}

function downsampleData(data, limit) {
  if (data.length <= limit) return data;
  const step = Math.floor(data.length / limit);
  const result = [];
  for (let i = 0; i < data.length; i += step) {
    result.push(data[i]);
  }
  if (result[result.length - 1] !== data[data.length - 1]) {
    result.push(data[data.length - 1]);
  }
  return result;
}

// 위 downsampleData와 동일한 규칙으로 "인덱스"만 뽑습니다.
// 필터가 적용된 100Hz 배열에서 화면용 값을 추출할 때 사용합니다.
function downsampleIndices(len, limit) {
  const idx = [];
  if (len <= 0) return idx;
  if (len <= limit) {
    for (let i = 0; i < len; i++) idx.push(i);
    return idx;
  }
  const step = Math.floor(len / limit);
  for (let i = 0; i < len; i += step) idx.push(i);
  if (idx[idx.length - 1] !== len - 1) idx.push(len - 1);
  return idx;
}

// 필터 설정이 바뀌었을 때 모든 차트의 데이터셋을 교체하고 즉시 다시 그립니다.
function refreshChartsAfterFilter() {
  if (!globalData.length || !sampleIndices.length) return;

  const pairs = [
    [chartSpeed, 'chart-ground-speed'],
    [chartRpm, 'chart-engine-rpm'],
    [chartGear, 'chart-vehicle-gear'],
    [chartSteering, 'chart-steering-angle'],
    [chartThrottleBrake, 'chart-throttle-brake'],
    [diagChartThrottleBrake, 'diag-chart-throttle-brake'],
    [diagChartSteering, 'diag-chart-steering'],
    [chartFL, 'chart-sus-fl'],
    [chartFR, 'chart-sus-fr'],
    [chartRL, 'chart-sus-rl'],
    [chartRR, 'chart-sus-rr'],
    [chartCoolantOil, 'chart-coolant-oil'],
    [chartIntakeEcu, 'chart-intake-ecu'],
    [chartImuAccel, 'chart-imu-accel'],
    [chartImuGyro, 'chart-imu-gyro']
  ];

  pairs.forEach(([chart, canvasId]) => {
    if (!chart) return;
    const keys = CHART_CHANNELS[canvasId];
    if (!keys) return;
    keys.forEach((key, i) => {
      if (chart.data.datasets[i]) {
        chart.data.datasets[i].data = channelSeries(key, sampleIndices, sampleTimes);
      }
    });
    chart.update('none');
  });

  if (typeof refreshFilterBadges === 'function') refreshFilterBadges();

  const row = activeSampledData[currentCursorIndex];
  if (row) updateNumericDisplays(row);
  drawCssIntersectionDots(currentCursorIndex);
}

let hoverSyncPending = false;
let lastActiveChart = null;
let lastChartEvent = null;

function syncHover(activeChart, chartEvent) {
  if (isKeyboardNavigating) return;
  lastActiveChart = activeChart;
  lastChartEvent = chartEvent;

  if (hoverSyncPending) return;
  hoverSyncPending = true;

  requestAnimationFrame(() => {
    if (!lastActiveChart || !lastChartEvent) {
      hoverSyncPending = false;
      return;
    }
    const points = lastActiveChart.getElementsAtEventForMode(lastChartEvent, 'index', { intersect: false }, true);
    if (points && points.length) {
      const index = points[0].index;
      currentCursorIndex = index;
      const row = activeSampledData[index];
      if (row) {
        drawCssIntersectionDots(index);
        updateNumericDisplays(row);
      }
    }
    hoverSyncPending = false;
  });
}

// On the GPS + IMU page, hovering must not move the synchronized playback
// cursor. Only an intentional press-and-drag gesture scrubs the exact time.
function bindGpsImuDragCursor(chart) {
  if (!chart || !chart.canvas) return;
  const canvas = chart.canvas;
  if (canvas._gpsImuDragHandlers) {
    const old = canvas._gpsImuDragHandlers;
    canvas.removeEventListener('pointerdown', old.down);
    canvas.removeEventListener('pointermove', old.move);
    canvas.removeEventListener('pointerup', old.up);
    canvas.removeEventListener('pointercancel', old.up);
  }

  const scrub = event => {
    const activeChart = canvas.id === 'chart-imu-accel' ? chartImuAccel : chartImuGyro;
    if (!activeChart || !tabGps || !tabGps.classList.contains('active')) return;
    const position = Chart.helpers.getRelativePosition(event, activeChart);
    const targetTime = activeChart.scales.x.getValueForPixel(position.x);
    if (Number.isFinite(targetTime)) updateGpsCursorAtTime(targetTime);
  };
  const down = event => {
    if (!tabGps || !tabGps.classList.contains('active')) return;
    setGpsPlayback(false);
    gpsImuCursorDragging = true;
    canvas.classList.add('cursor-dragging');
    canvas.setPointerCapture(event.pointerId);
    scrub(event);
  };
  const move = event => {
    if (gpsImuCursorDragging && canvas.hasPointerCapture(event.pointerId)) scrub(event);
  };
  const up = event => {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    gpsImuCursorDragging = false;
    canvas.classList.remove('cursor-dragging');
  };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas._gpsImuDragHandlers = { down, move, up };
}

// 최초 1회만 데이터셋을 세팅하여 생성하는 팩토리
function renderMotecCharts(data) {
  // Canvas is already in use 에러 방지를 위해 기존 차트 객체들을 파괴(destroy)하고 초기화
  const allCharts = [
    chartSpeed, chartRpm, chartGear, chartSteering, chartThrottleBrake,
    diagChartThrottleBrake, diagChartSteering, chartFL, chartFR, chartRL, chartRR,
    chartCoolantOil, chartIntakeEcu, chartImuAccel, chartImuGyro
  ];
  allCharts.forEach(c => {
    if (c) {
      try {
        c.destroy();
      } catch (err) {
        console.warn("기존 차트 파괴 실패:", err);
      }
    }
  });

  chartSpeed = null;
  chartRpm = null;
  chartGear = null;
  chartSteering = null;
  chartThrottleBrake = null;
  diagChartThrottleBrake = null;
  diagChartSteering = null;
  chartFL = null;
  chartFR = null;
  chartRL = null;
  chartRR = null;
  chartCoolantOil = null;
  chartIntakeEcu = null;
  chartImuAccel = null;
  chartImuGyro = null;

  const labels = data.map(r => r.time_sec);

  // 채널 키로 {x,y} 시리즈를 뽑는 헬퍼. 노이즈 필터가 적용된 값을 사용합니다.
  // (filters.js 미로딩 등 예외 상황에서는 원본 row에서 직접 계산해 폴백)
  const S = (key, fallbackFn) => {
    if (typeof channelSeries === 'function' && sampleIndices.length) {
      return channelSeries(key, sampleIndices, sampleTimes);
    }
    return data.map(r => ({ x: r.time_sec, y: fallbackFn(r) }));
  };

  const isDark = document.body.classList.contains('dark-mode');
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)';
  const tickColor = isDark ? '#8c96a8' : '#64748b';

  const getCommonOptions = (forcedMinY = null, forcedMaxY = null, yTicks = {}) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // 줌 성능 향상을 위해 일체의 애니메이션 해제
    parsing: false,   // 성능 병목 방지
    normalized: true, // 고속 인덱싱 최적화
    spanGaps: true,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 4, bottom: 4, right: 0, left: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    },
    scales: {
      x: {
        type: 'linear', // 시차 줌 물리 변환 연동을 위해 linear 타입으로 셋팅
        min: 0,
        max: totalDurationSec,
        grid: { color: gridColor },
        ticks: { color: tickColor, font: { family: 'JetBrains Mono', size: 9 } },
        afterFit(axis) { axis.paddingRight = 10; }
      },
      y: {
        min: forcedMinY,
        max: forcedMaxY,
        grid: { color: gridColor },
        ticks: { color: tickColor, font: { family: 'JetBrains Mono', size: 9 }, ...yTicks },
        afterFit(axis) { axis.width = 55; }
      }
    },
    onHover: (e, elements) => {
      if (tabGps && tabGps.classList.contains('active') &&
          (e.chart.canvas.id === 'chart-imu-accel' || e.chart.canvas.id === 'chart-imu-gyro')) {
        return;
      }
      if (elements && elements.length > 0) {
        const allCharts = {
          chartSpeed, chartRpm, chartGear, chartSteering, chartThrottleBrake,
          diagChartThrottleBrake, diagChartSteering, chartFL, chartFR, chartRL, chartRR,
          chartCoolantOil, chartIntakeEcu, chartImuAccel, chartImuGyro
        };
        for (const [key, chart] of Object.entries(allCharts)) {
          if (chart && chart.canvas === e.chart.canvas) {
            syncHover(chart, e);
            break;
          }
        }
      }
    }
  });

  // ==================== PAGE 1 CHARTS ====================

  const ctxSpeed = document.getElementById('chart-ground-speed').getContext('2d');
  chartSpeed = new Chart(ctxSpeed, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'FL Wheel Speed',
          data: S('fl_speed', r => r.fl_speed_kmh || 0),
          borderColor: '#f97316',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'RL Wheel Speed',
          data: S('rl_speed', r => r.rl_speed_kmh || 0),
          borderColor: '#2563eb',
          borderWidth: 1.4,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'RR Wheel Speed',
          data: S('rr_speed', r => r.rr_speed_kmh || 0),
          borderColor: '#16a34a',
          borderWidth: 1.4,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: getCommonOptions(0)
  });

  const ctxRpm = document.getElementById('chart-engine-rpm').getContext('2d');
  chartRpm = new Chart(ctxRpm, {
    type: 'line',
    data: {
      datasets: [{
        data: S('rpm', r => r.rpm),
        borderColor: '#dc2626',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false
      }]
    },
    options: getCommonOptions(0)
  });

  const ctxGear = document.getElementById('chart-vehicle-gear').getContext('2d');
  chartGear = new Chart(ctxGear, {
    type: 'line',
    data: {
      datasets: [{
        data: S('gear', r => r.gear),
        borderColor: '#2563eb',
        borderWidth: 1.8,
        pointRadius: 0,
        stepped: 'before',
        fill: false
      }]
    },
    options: getCommonOptions(0, 6, {
      stepSize: 1,
      callback: function(value) {
        if (value === 0) return 'N';
        return value;
      }
    })
  });

  const ctxSteering = document.getElementById('chart-steering-angle').getContext('2d');
  const optionsSteering = getCommonOptions(null);
  optionsSteering.scales.y.min = -250;
  optionsSteering.scales.y.max = 250;
  optionsSteering.scales.y.grid = {
    color: (context) => (context.value === 0 ? '#ff2d55' : gridColor),
    lineWidth: 1
  };
  chartSteering = new Chart(ctxSteering, {
    type: 'line',
    data: {
      datasets: [{
        data: S('steering', r => getCalibratedSteering(r.steering_raw)),
        borderColor: '#db2777',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false
      }]
    },
    options: optionsSteering
  });

  const ctxThrottleBrake = document.getElementById('chart-throttle-brake').getContext('2d');
  chartThrottleBrake = new Chart(ctxThrottleBrake, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Throttle',
          data: S('throttle', r => r.decoded_tps || 0),
          borderColor: '#16a34a',
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Brake',
          data: S('brake', r => getCalibratedBrake(r.front_brake_raw)),
          borderColor: '#dc2626',
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: getCommonOptions(0, 100, { stepSize: 20 })
  });

  // ==================== PAGE 2 CHARTS ====================

  const ctxDiagThrottleBrake = document.getElementById('diag-chart-throttle-brake').getContext('2d');
  diagChartThrottleBrake = new Chart(ctxDiagThrottleBrake, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Throttle',
          data: S('throttle', r => r.decoded_tps || 0),
          borderColor: '#16a34a',
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Brake',
          data: S('brake', r => getCalibratedBrake(r.front_brake_raw)),
          borderColor: '#dc2626',
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: getCommonOptions(0, 100, { stepSize: 50 })
  });

  const ctxDiagSteering = document.getElementById('diag-chart-steering').getContext('2d');
  const optionsDiagSteering = getCommonOptions(-200, 200, { stepSize: 200 });
  optionsDiagSteering.scales.y.grid = {
    color: (context) => (context.value === 0 ? '#ff2d55' : gridColor),
    lineWidth: 1
  };
  diagChartSteering = new Chart(ctxDiagSteering, {
    type: 'line',
    data: {
      datasets: [{
        data: S('steering', r => getCalibratedSteering(r.steering_raw)),
        borderColor: '#db2777',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false
      }]
    },
    options: optionsDiagSteering
  });

  const ctxSusFl = document.getElementById('chart-sus-fl').getContext('2d');
  chartFL = new Chart(ctxSusFl, {
    type: 'line',
    data: {
      datasets: [{
        data: S('sus_fl', r => r.suspension_fl_raw),
        borderColor: '#db2777',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false
      }]
    },
    options: getCommonOptions(0, 4095, { stepSize: 1000 })
  });

  const ctxSusRl = document.getElementById('chart-sus-rl').getContext('2d');
  chartRL = new Chart(ctxSusRl, {
    type: 'line',
    data: {
      datasets: [{
        data: S('sus_rl', r => r.suspension_rl_raw),
        borderColor: '#06b6d4',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false
      }]
    },
    options: getCommonOptions(0, 1023, { stepSize: 256 })
  });

  // ==================== PAGE 3 GPS + IMU CHARTS ====================
  const accelCanvas = document.getElementById('chart-imu-accel');
  if (accelCanvas) {
    chartImuAccel = new Chart(accelCanvas.getContext('2d'), {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Longitudinal G (+Forward X)',
            data: S('imu_ax', r => r.imu_accel_x_g),
            borderColor: '#f97316', borderWidth: 1.1, pointRadius: 0, fill: false
          },
          {
            label: 'Lateral G (+Left Y)',
            data: S('imu_ay', r => r.imu_accel_y_g),
            borderColor: '#2563eb', borderWidth: 1.1, pointRadius: 0, fill: false
          },
        ]
      },
      options: getCommonOptions(-2.5, 2.5, { stepSize: 1 })
    });
  }

  const gyroCanvas = document.getElementById('chart-imu-gyro');
  if (gyroCanvas) {
    chartImuGyro = new Chart(gyroCanvas.getContext('2d'), {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Roll Rate (X)',
            data: S('imu_gx', r => r.imu_gyro_x_dps),
            borderColor: '#f97316', borderWidth: 1.1, pointRadius: 0, fill: false
          },
          {
            label: 'Pitch Rate (Y)',
            data: S('imu_gy', r => r.imu_gyro_y_dps),
            borderColor: '#2563eb', borderWidth: 1.1, pointRadius: 0, fill: false
          },
          {
            label: 'Yaw Rate (Z)',
            data: S('imu_gz', r => r.imu_gyro_z_dps),
            borderColor: '#16a34a', borderWidth: 1.1, pointRadius: 0, fill: false
          }
        ]
      },
      options: getCommonOptions(-100, 100, { stepSize: 50 })
    });
  }
  applyImuAxisToggleState('chart-imu-accel');
  applyImuAxisToggleState('chart-imu-gyro');
  bindGpsImuDragCursor(chartImuAccel);
  bindGpsImuDragCursor(chartImuGyro);

  // ==================== PAGE 4 TEMPERATURE CHARTS ====================
  const temperatureOptions = getCommonOptions(0, 130, { stepSize: 10 });
  temperatureOptions.scales.y.title = {
    display: true,
    text: 'Temperature [°C]',
    color: tickColor
  };
  temperatureOptions.scales.ySpeed = {
    type: 'linear',
    position: 'right',
    min: 0,
    suggestedMax: 120,
    grid: { drawOnChartArea: false },
    ticks: { color: tickColor, font: { family: 'JetBrains Mono', size: 9 } },
    title: {
      display: true,
      text: 'FL Wheel Speed [km/h]',
      color: tickColor
    }
  };
  temperatureOptions.plugins.legend = {
    display: true,
    position: 'top',
    labels: { color: tickColor, boxWidth: 18, font: { family: 'JetBrains Mono', size: 10 } }
  };
  chartCoolantOil = new Chart(document.getElementById('chart-coolant-oil').getContext('2d'), {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Coolant',
          data: S('water', r => r.water_c),
          borderColor: '#2563eb',
          borderWidth: 1.6,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Oil',
          data: S('oil', r => r.oil_c),
          borderColor: '#f97316',
          borderWidth: 1.6,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'FL Wheel Speed',
          data: S('fl_speed', r => r.fl_speed_kmh || 0),
          yAxisID: 'ySpeed',
          borderColor: '#06b6d4',
          borderWidth: 1.4,
          borderDash: [6, 3],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: temperatureOptions
  });

  const environmentOptions = getCommonOptions(0, 130, { stepSize: 10 });
  environmentOptions.plugins.legend = {
    display: true,
    position: 'top',
    labels: { color: tickColor, boxWidth: 18, font: { family: 'JetBrains Mono', size: 10 } }
  };
  chartIntakeEcu = new Chart(document.getElementById('chart-intake-ecu').getContext('2d'), {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Intake Air',
          data: S('iat', r => r.iat_c),
          borderColor: '#16a34a',
          borderWidth: 1.6,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'ECU',
          data: S('ecu', r => r.ecu_c),
          borderColor: '#db2777',
          borderWidth: 1.6,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: environmentOptions
  });

  const ctxSusFr = document.getElementById('chart-sus-fr').getContext('2d');
  chartFR = new Chart(ctxSusFr, {
    type: 'line',
    data: {
      datasets: [{
        data: S('sus_fr', r => r.suspension_fr_raw),
        borderColor: '#dc2626',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false
      }]
    },
    options: getCommonOptions(0, 4095, { stepSize: 1000 })
  });

  const ctxSusRr = document.getElementById('chart-sus-rr').getContext('2d');
  chartRR = new Chart(ctxSusRr, {
    type: 'line',
    data: {
      datasets: [{
        data: S('sus_rr', r => r.suspension_rr_raw),
        borderColor: '#2563eb',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false
      }]
    },
    options: getCommonOptions(0, 1023, { stepSize: 256 })
  });

  // 테마 상태에 맞는 차트 선 색상(다크모드 전용 파스텔톤 포함) 즉시 동기화
  updateChartsTheme();

  // 라벨바에 현재 적용된 노이즈 필터 배지 표시
  if (typeof refreshFilterBadges === 'function') refreshFilterBadges();

  // 조향 보정값에 맞춰 조향 차트 Y축 범위 조정 및 핸들 위젯 상태 표시
  if (typeof updateSteeringAxisRange === 'function') updateSteeringAxisRange();
  if (typeof updateSteeringCalBadges === 'function') updateSteeringCalBadges();
}

// 그래프 우클릭 → 노이즈 필터 메뉴 활성화
if (typeof initFilterContextMenu === 'function') {
  initFilterContextMenu();
}

// 핸들 그래픽 클릭 → 조향 영점 보정 패널 활성화
if (typeof initSteeringCalibration === 'function') {
  initSteeringCalibration();
}

// 5번 탭: 실시간 무선 텔레메트리 초기화
if (typeof rtInit === 'function') {
  rtInit();
}

let arrowRepeatCount = 0;
let isKeyboardNavigating = false;
let keyboardNavTimer = null;

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    arrowRepeatCount = 0;
  }
});

// ==================== [키보드 단축키 지원 (Keyboard Shortcuts)] ====================
window.addEventListener('keydown', (e) => {
  // 입력 필드에 포커스가 있을 때는 단축키를 비활성화합니다.
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT') {
    return;
  }

  if (globalData.length === 0 || activeSampledData.length === 0) return;

  const key = e.key;

  // 키보드로 조작하는 순간 마우스 호버로 인한 오버라이드를 차단하고 네이티브 호버 서클을 제거합니다.
  if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown' || key === ' ' || key === 'Spacebar') {
    isKeyboardNavigating = true;
    clearTimeout(keyboardNavTimer);
    keyboardNavTimer = setTimeout(() => {
      isKeyboardNavigating = false;
    }, 800); // 키보드 입력 중단 후 800ms 동안 마우스 반응 차단

    // 모든 차트에서 기존 마우스 위치에 남아있는 네이티브 active/hover 서클 제거
    const targetCharts = [
      chartSpeed, chartRpm, chartGear, chartSteering, chartThrottleBrake,
      diagChartThrottleBrake, diagChartSteering, chartFL, chartFR, chartRL, chartRR,
      chartCoolantOil, chartIntakeEcu, chartImuAccel, chartImuGyro
    ];
    targetCharts.forEach(c => {
      if (c) {
        c.setActiveElements([]);
        c.update('none');
      }
    });
  }

  // 1, 2: 탭 전환
  if (key === '1') {
    e.preventDefault();
    switchTab('general');
  } else if (key === '2') {
    e.preventDefault();
    switchTab('diag');
  }

  // GPS + IMU page: Space toggles playback. Other pages retain the existing
  // full-view reset shortcut.
  else if (key === ' ' || key === 'Spacebar') {
    e.preventDefault();
    if (tabGps && tabGps.classList.contains('active')) {
      if (!e.repeat) setGpsPlayback(!gpsPlaybackActive);
    } else {
      applyZoomRange(0, totalDurationSec);
    }
  }

  // Left/Right Arrow: 커서 미세 이동 (지속 입력 시 가속도 적용 및 뷰포트 자동 스크롤)
  else if (key === 'ArrowLeft') {
    e.preventDefault();
    let step = 1;
    if (e.repeat) {
      arrowRepeatCount++;
      step = Math.min(60, Math.floor(1 + (arrowRepeatCount * arrowRepeatCount) / 30));
    } else {
      arrowRepeatCount = 0;
    }
    currentCursorIndex = Math.max(0, currentCursorIndex - step);
    const row = activeSampledData[currentCursorIndex];
    if (row) {
      const targetTime = row.time_sec;
      const currentSpan = currentEndSec - currentStartSec;
      if (targetTime < currentStartSec) {
        let newStart = targetTime;
        let newEnd = targetTime + currentSpan;
        if (newEnd > totalDurationSec) {
          newEnd = totalDurationSec;
          newStart = Math.max(0, totalDurationSec - currentSpan);
        }
        applyZoomRange(newStart, newEnd);
      }
      drawCssIntersectionDots(currentCursorIndex);
      updateNumericDisplays(row);
    }
  } else if (key === 'ArrowRight') {
    e.preventDefault();
    let step = 1;
    if (e.repeat) {
      arrowRepeatCount++;
      step = Math.min(60, Math.floor(1 + (arrowRepeatCount * arrowRepeatCount) / 30));
    } else {
      arrowRepeatCount = 0;
    }
    currentCursorIndex = Math.min(activeSampledData.length - 1, currentCursorIndex + step);
    const row = activeSampledData[currentCursorIndex];
    if (row) {
      const targetTime = row.time_sec;
      const currentSpan = currentEndSec - currentStartSec;
      if (targetTime > currentEndSec) {
        let newEnd = targetTime;
        let newStart = targetTime - currentSpan;
        if (newStart < 0) {
          newStart = 0;
          newEnd = Math.min(currentSpan, totalDurationSec);
        }
        applyZoomRange(newStart, newEnd);
      }
      drawCssIntersectionDots(currentCursorIndex);
      updateNumericDisplays(row);
    }
  }

  // Up/Down Arrow / I/O: 확대/축소 (현재 활성 커서 시간 기준)
  else if (key === 'ArrowUp' || key.toLowerCase() === 'i') {
    e.preventDefault();
    const currentSpan = currentEndSec - currentStartSec;
    const targetTime = activeSampledData[currentCursorIndex] ? activeSampledData[currentCursorIndex].time_sec : (currentStartSec + currentEndSec) / 2;
    const newSpan = Math.max(2.0, currentSpan * 0.85); // 15% 줌인
    const ratio = currentSpan > 0 ? (targetTime - currentStartSec) / currentSpan : 0.5;
    let newStart = targetTime - (newSpan * ratio);
    let newEnd = targetTime + (newSpan * (1 - ratio));

    if (newStart < 0) {
      newStart = 0;
      newEnd = Math.min(newSpan, totalDurationSec);
    }
    if (newEnd > totalDurationSec) {
      newEnd = totalDurationSec;
      newStart = Math.max(0, totalDurationSec - newSpan);
    }
    applyZoomRange(newStart, newEnd);
  } else if (key === 'ArrowDown' || key.toLowerCase() === 'o') {
    e.preventDefault();
    const currentSpan = currentEndSec - currentStartSec;
    const targetTime = activeSampledData[currentCursorIndex] ? activeSampledData[currentCursorIndex].time_sec : (currentStartSec + currentEndSec) / 2;
    const newSpan = Math.min(totalDurationSec, currentSpan * 1.15); // 15% 줌아웃
    const ratio = currentSpan > 0 ? (targetTime - currentStartSec) / currentSpan : 0.5;
    let newStart = targetTime - (newSpan * ratio);
    let newEnd = targetTime + (newSpan * (1 - ratio));

    if (newStart < 0) {
      newStart = 0;
      newEnd = Math.min(newSpan, totalDurationSec);
    }
    if (newEnd > totalDurationSec) {
      newEnd = totalDurationSec;
      newStart = Math.max(0, totalDurationSec - newSpan);
    }
    applyZoomRange(newStart, newEnd);
  }
});
