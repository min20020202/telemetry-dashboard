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
let page4Charts = [];
let page4PlaybackActive = false;
let page4PlaybackFrame = 0;
let page4PlaybackLastStamp = 0;
let page4PlaybackElapsed = NaN;
let page4PointerDragging = null;
let page4RangeStart = 0;
let page4RangeEnd = 0;
let page4ViewStart = 0;
let page4ViewEnd = 0;

// 그래프와 수치의 조향 부호는 유지하고, 시각적인 핸들만 반대 방향으로 회전합니다.
const steeringWheelDisplayAngle = steeringAngle => -(Number(steeringAngle) || 0);
let page4CursorTime = 0;
let page4SelectedLapIndex = -1;
let page4AxisMode = 'distance';
const page4LapDistanceCache = new Map();
const page4SeriesCache = new Map();
const page4SessionStore = [];
let page4SessionSerial = 0;
let page4ActiveSessionId = null;
let page4PrimarySourceKey = null;
let page4SelectedSessionLaps = [];
const PAGE4_LAP_COLORS = ['#06b6d4', '#ec4899'];
const page4HiddenSeries = new Set();
let gpsAxisMode = 'time';

// Global state variables for Page 3 IMU charts
let chartImuAccel = null;
let chartImuGyro = null;
let gpsImuCursorDragging = false;

// Zoom, Slicing & Scroll configurations
let globalData = [];
let primaryDashboardFile = null;
let primaryDashboardSnapshot = null;
let currentStartSec = 0;
let currentEndSec = 30;
let totalDurationSec = 0;

// User specified boundary limits (Drag will be restricted inside this limit)
let limitStartSec = 0;
let limitEndSec = 0;

// Active downsampled dataset reference for easy cursor lookup
let activeSampledData = [];
let currentCursorIndex = 0;
let preciseCursorTimeSec = 0;
let numericCursorGlobalIndex = 0;

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
const tabComparison = document.getElementById('tab-comparison');
const pageComparison = document.getElementById('page-comparison');
const tabCooling = document.getElementById('tab-cooling');
const pageCooling = document.getElementById('page-cooling');
const tabRealtime = document.getElementById('tab-realtime');
const pageRealtime = document.getElementById('page-realtime');
const tabHelp = document.getElementById('tab-help');
const pageHelp = document.getElementById('page-help');
const timelineNavigator = document.querySelector('.timeline-navigator');
const tabNavigation = document.querySelector('.tab-navigation');
const tabNavPrev = document.getElementById('tab-nav-prev');
const tabNavNext = document.getElementById('tab-nav-next');

// Temperature DOMs (Page 5)
const tempCursorCoolant = document.getElementById('temp-cursor-coolant');
const tempCursorOil = document.getElementById('temp-cursor-oil');
const tempCursorIat = document.getElementById('temp-cursor-iat');
const tempCursorEcu = document.getElementById('temp-cursor-ecu');
const tempMaxCoolant = document.getElementById('temp-max-coolant');
const tempMaxOil = document.getElementById('temp-max-oil');
const tempMaxIat = document.getElementById('temp-max-iat');
const tempMaxEcu = document.getElementById('temp-max-ecu');

function applyTemperatureSeriesToggleState(chart, chartKey) {
  if (!chart) return;
  document.querySelectorAll(`[data-temperature-chart="${chartKey}"]`).forEach(button => {
    const datasetIndex = Number(button.dataset.dataset);
    chart.setDatasetVisibility(datasetIndex, button.classList.contains('active'));
  });
  chart.update('none');
}

document.querySelectorAll('[data-temperature-chart]').forEach(button => {
  button.addEventListener('click', () => {
    const chart = button.dataset.temperatureChart === 'coolant' ? chartCoolantOil : chartIntakeEcu;
    if (!chart) return;
    const datasetIndex = Number(button.dataset.dataset);
    const visible = chart.isDatasetVisible(datasetIndex);
    chart.setDatasetVisibility(datasetIndex, !visible);
    button.classList.toggle('active', !visible);
    button.setAttribute('aria-pressed', String(!visible));
    chart.update('none');
  });
});
const p4LapSelect = document.getElementById('p4-lap-select');
const p4SectorStart = document.getElementById('p4-sector-start');
const p4SectorEnd = document.getElementById('p4-sector-end');
const p4SectorStatus = document.getElementById('p4-sector-status');
const p4TrackMap = document.getElementById('p4-track-map');
const p4TrackTime = document.getElementById('p4-track-time');
const p4GDot = document.getElementById('p4-g-dot');
const p4GTrace = document.getElementById('p4-g-trace');
const p4PlayToggle = document.getElementById('p4-play-toggle');
const p4PlayRate = document.getElementById('p4-play-rate');
const p4PlayTimeline = document.getElementById('p4-play-timeline');
const p4PlayTime = document.getElementById('p4-play-time');
const p4SteeringWheel = document.getElementById('p4-steering-wheel');
const p4AxisModeControl = document.getElementById('p4-axis-mode');
const p4SessionDrawerToggle = document.getElementById('p4-session-drawer-toggle');
const p4SessionDrawer = document.getElementById('p4-session-drawer');
const p4SessionDrawerClose = document.getElementById('p4-session-drawer-close');
const p4SessionDrawerShade = document.getElementById('p4-session-drawer-shade');
const p4SessionFiles = document.getElementById('p4-session-files');
const p4SessionList = document.getElementById('p4-session-list');

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
const gpsLapSetLine = document.getElementById('gps-lap-set-line');
const gpsLapClear = document.getElementById('gps-lap-clear');
const gpsCheckpointAdd = document.getElementById('gps-checkpoint-add');
const gpsCheckpointClear = document.getElementById('gps-checkpoint-clear');
const gpsSharedSettingsCopy = document.getElementById('gps-shared-settings-copy');
const gpsCheckpointCount = document.getElementById('gps-checkpoint-count');
const gpsSectorCard = document.getElementById('gps-sector-card');
const gpsSectorTable = document.getElementById('gps-sector-table');
const gpsSectorToggle = document.getElementById('gps-sector-toggle');
const gpsSectorOverlay = document.getElementById('gps-sector-overlay');
const gpsSectorOverlayTable = document.getElementById('gps-sector-overlay-table');
const gpsSectorOverlayClose = document.getElementById('gps-sector-overlay-close');
const gpsHandlingToggle = document.getElementById('gps-handling-toggle');
const gpsHandlingCard = document.getElementById('gps-handling-card');
const gpsHandlingEvents = document.getElementById('gps-handling-events');
const gpsHandlingCalibration = document.getElementById('gps-handling-calibration');
const gpsUndersteerCount = document.getElementById('gps-understeer-count');
const gpsOversteerCount = document.getElementById('gps-oversteer-count');
const gpsLapMinTime = document.getElementById('gps-lap-min-time');
const gpsLapToolbarStatus = document.getElementById('gps-lap-toolbar-status');
const gpsLapFixSummary = document.getElementById('gps-lap-fix-summary');
const gpsLapCount = document.getElementById('gps-lap-count');
const gpsLapBestTime = document.getElementById('gps-lap-best-time');
const gpsLapAverageDistance = document.getElementById('gps-lap-average-distance');
const gpsLapList = document.getElementById('gps-lap-list');
const gpsImuLpfFrequency = document.getElementById('gps-imu-lpf-frequency');
const gpsMapFullscreen = document.getElementById('gps-map-fullscreen');
const gpsLapMapLegend = document.getElementById('gps-lap-map-legend');
const gpsFullscreenPlayToggle = document.getElementById('gps-fullscreen-play-toggle');
const gpsFullscreenPlayRate = document.getElementById('gps-fullscreen-play-rate');
const gpsFullscreenTimeline = document.getElementById('gps-fullscreen-timeline');
const gpsFullscreenPlayTime = document.getElementById('gps-fullscreen-play-time');
const gpsFullscreenLapTimes = document.getElementById('gps-fullscreen-lap-times');
const gpsFullscreenSpeedValue = document.getElementById('gps-fullscreen-speed-value');
const gpsFullscreenDetailToggle = document.getElementById('gps-fullscreen-detail-toggle');
const gpsFullscreenDetail = document.getElementById('gps-fullscreen-detail');
const gpsGoProFile = document.getElementById('gps-gopro-file');
const gpsGoProOpen = document.querySelector('.gps-gopro-open');
const gpsGoProPanel = document.getElementById('gps-gopro-panel');
const gpsGoProVideo = document.getElementById('gps-gopro-video');
const gpsGoProCompareVideo = document.getElementById('gps-gopro-compare-video');
const gpsGoProPrimaryAudio = document.getElementById('gps-gopro-primary-audio');
const gpsGoProCompareAudio = document.getElementById('gps-gopro-compare-audio');
const gpsGoProPrimaryLabel = document.getElementById('gps-gopro-primary-label');
const gpsGoProCompareLabel = document.getElementById('gps-gopro-compare-label');
const gpsGoProPrimarySpeed = document.getElementById('gps-gopro-primary-speed');
const gpsGoProCompareSpeed = document.getElementById('gps-gopro-compare-speed');
const gpsGoProStatus = document.getElementById('gps-gopro-status');
const gpsGoProClose = document.getElementById('gps-gopro-close');
const gpsYouTubeOpen = document.getElementById('gps-youtube-open');
const gpsYouTubeDialog = document.getElementById('gps-youtube-dialog');
const gpsYouTubeForm = document.getElementById('gps-youtube-form');
const gpsYouTubeUrl = document.getElementById('gps-youtube-url');
const gpsYouTubeUrlClear = document.getElementById('gps-youtube-url-clear');
const gpsYouTubeCancel = document.getElementById('gps-youtube-cancel');
const gpsYouTubeCancelBottom = document.getElementById('gps-youtube-cancel-bottom');
const helpVideoTitleFile = document.getElementById('help-video-title-file');
const helpVideoTitleStatus = document.getElementById('help-video-title-status');
const helpVideoTitleOutput = document.getElementById('help-video-title-output');
const helpVideoDescriptionOutput = document.getElementById('help-video-description-output');
const helpVideoTitleCopy = document.getElementById('help-video-title-copy');
const helpVideoDescriptionCopy = document.getElementById('help-video-description-copy');
const helpDistanceMethodDialog = document.getElementById('help-distance-method-dialog');
const helpDistanceMethodClose = document.getElementById('help-distance-method-close');
const gpsDetailSpeedValue = document.getElementById('gps-detail-speed-value');
const gpsDetailRpmValue = document.getElementById('gps-detail-rpm-value');
const gpsDetailGearValue = document.getElementById('gps-detail-gear-value');
const gpsDetailSteeringValue = document.getElementById('gps-detail-steering-value');
const gpsDetailPedalValue = document.getElementById('gps-detail-pedal-value');
const gpsAxisModeControl = document.getElementById('gps-axis-mode');
const gpsDistancePosition = document.getElementById('gps-distance-position');

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
  if (row?.__nssurPrepared) return row;
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
// The shared team calibration is defined in steering.js.
function getCalibratedSteering(rawValue) {
  const cal = (typeof steeringCal !== 'undefined') ? steeringCal : { zeroRaw: 1298, degPerLsb: 0.1, invert: true };
  const rawVal = (rawValue === undefined || rawValue === null || isNaN(rawValue)) ? cal.zeroRaw : rawValue;
  const deg = (rawVal - cal.zeroRaw) * 0.1;
  return cal.invert ? -deg : deg;
}

// GPS Map Global Variables
let gpsMap = null;
let gpsRouteLine = null;
let gpsCursorMarker = null;
let gpsGraphicLayer = null;
let gpsSatelliteLayer = null;
let currentGpsLayerMode = 'graphic'; // 'graphic' | 'satellite'
let gpsFinishLine = null;
let gpsFinishEndpointLayer = null;
let gpsLapCrossingLayer = null;
let gpsLapRouteLayer = null;
let gpsHandlingLayer = null;
let gpsDistanceReferenceLayer = null;
let gpsFinishPoints = [];
let gpsFinishPreviewLine = null;
let gpsFinishMarkers = [];
let gpsCheckpointLayer = null;
let gpsCheckpointDraftLayer = null;
let gpsCheckpointPreviewLine = null;
let gpsCheckpointSelectionActive = false;
let gpsCheckpointDraft = [];
let gpsCheckpoints = [];
let gpsLapPoints = [];
let gpsLapSelectionActive = false;
let gpsLapResults = [];
let gpsLapRouteLines = [];
let gpsSelectedLapIndex = -1;
let gpsSelectedLapIndices = [];
let gpsCompareMarkers = [];
let gpsHandlingEventsData = [];
let gpsHandlingVisible = false;
let gpsHandlingAnalysisReady = false;
let gpsHandlingSteeringRatio = 12;
let gpsDetailCharts = [];
let gpsDetailSourceData = null;
const GPS_LAP_COLORS = ['#00e5ff', '#ff3d9a', '#76ff03', '#ffca28', '#7c4dff', '#ff6d00', '#00e676', '#40c4ff'];
const GPS_FIXED_LINES_STORAGE_KEY = 'nssur_gps_fixed_lines_v2';
const GPS_FIXED_LINES_INITIAL_PASSWORD = '0000';
const GPS_SHARED_FIXED_LINES = Object.freeze({
  finish: [
    { lat: 35.291942389489876, lon: 126.57411262393 },
    { lat: 35.29196320033377, lon: 126.57417699694636 }
  ],
  checkpoints: [
    [{ lat: 35.29176369915784, lon: 126.57420314848424 }, { lat: 35.29178779597713, lon: 126.57426550984384 }],
    [{ lat: 35.291442900713896, lon: 126.57435536384584 }, { lat: 35.29139142091733, lon: 126.57436206936838 }],
    [{ lat: 35.29234105359834, lon: 126.57494544982912 }, { lat: 35.29237610326498, lon: 126.57501652836801 }],
    [{ lat: 35.292635689385946, lon: 126.57453909516336 }, { lat: 35.29268607309353, lon: 126.57462224364284 }],
    [{ lat: 35.29287617620656, lon: 126.57432317733766 }, { lat: 35.29291998799785, lon: 126.57438755035402 }],
    [{ lat: 35.29288822445155, lon: 126.57405629754068 }, { lat: 35.29292436917566, lon: 126.57414615154268 }],
    [{ lat: 35.292641782720516, lon: 126.5743701159954 }, { lat: 35.29267464166134, lon: 126.57442241907123 }],
    [{ lat: 35.292592494284264, lon: 126.57426014542581 }, { lat: 35.29254977761526, lon: 126.57423198223115 }],
    [{ lat: 35.29238438722259, lon: 126.5743835270405 }, { lat: 35.29231866909194, lon: 126.57438620924952 }],
    [{ lat: 35.29225087268119, lon: 126.5745793282986 }, { lat: 35.292241014948736, lon: 126.5746369957924 }],
    [{ lat: 35.29200552431656, lon: 126.5746919810772 }, { lat: 35.29200552431656, lon: 126.57474026083949 }],
    [{ lat: 35.292100815957234, lon: 126.57481268048288 }, { lat: 35.292132579812524, lon: 126.57484620809556 }],
    [{ lat: 35.2922136323523, lon: 126.57487973570824 }, { lat: 35.2922421102524, lon: 126.57490387558938 }],
    [{ lat: 35.292076661493276, lon: 126.5750299394131 }, { lat: 35.292094734038564, lon: 126.57506212592128 }],
    [{ lat: 35.291852601798055, lon: 126.57498702406886 }, { lat: 35.29182302845159, lon: 126.57503798604013 }],
    [{ lat: 35.29169597246974, lon: 126.57464101910593 }, { lat: 35.29170035371381, lon: 126.57471612095834 }],
    [{ lat: 35.29167297093446, lon: 126.57443046569826 }, { lat: 35.29167187562312, lon: 126.57450422644615 }],
    [{ lat: 35.291994991833526, lon: 126.5742762386799 }, { lat: 35.291979657534064, lon: 126.57436341047288 }]
  ]
});
const CSV_GPS_UTC_OFFSET_SEC = 9 * 3600; // Logger gps_time is stored as Korea Standard Time (UTC+9).

// GPS + IMU synchronized playback state.
let gpsPlaybackActive = false;
let gpsPlaybackFrame = null;
let gpsPlaybackLastTimestamp = null;
let gpsPlaybackCursorSec = 0;
let gpsGoProObjectUrl = '';
let gpsGoProTelemetryStartSec = NaN;
let gpsGoProMatched = false;
let gpsGoProCompareLapIndex = -1;
let gpsGoProSourceType = '';
let gpsYouTubeApiPromise = null;
let gpsYouTubePrimaryPlayer = null;
let gpsYouTubeComparePlayer = null;
let gpsYouTubeVideoId = '';
let gpsGoProAudioSlot = '';
const gpsYouTubeLastSeekAt = new WeakMap();

function getVisibleYouTubePlayers() {
  const players = [gpsYouTubePrimaryPlayer];
  if (getGoProLapPair()) players.push(gpsYouTubeComparePlayer);
  return players.filter(Boolean);
}

function isYouTubeBuffering() {
  if (gpsGoProSourceType !== 'youtube') return false;
  const bufferingState = window.YT?.PlayerState?.BUFFERING;
  return getVisibleYouTubePlayers().some(player => player.getPlayerState?.() === bufferingState);
}

function isGoProPlaybackWaiting() {
  if (!gpsGoProMatched || !gpsPlaybackActive) return false;
  const pair = getGoProLapPair();
  const relativeTime = pair ? Number(scrollBar?.value) || 0 : NaN;
  if (gpsGoProSourceType === 'youtube') {
    const playingState = window.YT?.PlayerState?.PLAYING;
    const players = pair
      ? [
          relativeTime < gpsLapResults[pair.primaryIndex].duration ? gpsYouTubePrimaryPlayer : null,
          relativeTime < gpsLapResults[pair.compareIndex].duration ? gpsYouTubeComparePlayer : null
        ].filter(Boolean)
      : [gpsYouTubePrimaryPlayer].filter(Boolean);
    return players.some(player => player.getPlayerState?.() !== playingState);
  }
  const videos = pair
    ? [
        relativeTime < gpsLapResults[pair.primaryIndex].duration ? gpsGoProVideo : null,
        relativeTime < gpsLapResults[pair.compareIndex].duration ? gpsGoProCompareVideo : null
      ].filter(Boolean)
    : [gpsGoProVideo].filter(Boolean);
  return videos.some(video => video.paused || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA);
}

function refreshYouTubeBufferingState() {
  const buffering = isYouTubeBuffering();
  gpsGoProPanel?.classList.toggle('youtube-buffering', buffering);
}

async function readMp4AtomHeader(file, offset) {
  if (offset + 8 > file.size) return null;
  const bytes = new Uint8Array(await file.slice(offset, Math.min(file.size, offset + 16)).arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let size = view.getUint32(0);
  const type = String.fromCharCode(...bytes.slice(4, 8));
  let headerSize = 8;
  if (size === 1 && bytes.length >= 16) {
    size = Number(view.getBigUint64(8));
    headerSize = 16;
  } else if (size === 0) size = file.size - offset;
  if (!Number.isFinite(size) || size < headerSize) return null;
  return { offset, size, type, headerSize };
}

async function extractMp4CreationDate(file) {
  let offset = 0;
  for (let count = 0; offset < file.size && count < 10000; count += 1) {
    const atom = await readMp4AtomHeader(file, offset);
    if (!atom) break;
    if (atom.type === 'moov') {
      const buffer = await file.slice(atom.offset, atom.offset + atom.size).arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const view = new DataView(buffer);
      let child = atom.headerSize;
      while (child + 12 <= bytes.length) {
        let size = view.getUint32(child);
        const type = String.fromCharCode(...bytes.slice(child + 4, child + 8));
        let headerSize = 8;
        if (size === 1 && child + 16 <= bytes.length) {
          size = Number(view.getBigUint64(child + 8));
          headerSize = 16;
        }
        if (!Number.isFinite(size) || size < headerSize || child + size > bytes.length) break;
        if (type === 'mvhd') {
          const version = view.getUint8(child + headerSize);
          const creation = version === 1
            ? Number(view.getBigUint64(child + headerSize + 4))
            : view.getUint32(child + headerSize + 4);
          if (creation > 2082844800) return new Date((creation - 2082844800) * 1000);
        }
        child += size;
      }
      break;
    }
    offset += atom.size;
  }
  return null;
}

function extractYouTubeVideoId(value) {
  const raw = String(value || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (url.pathname === '/watch') return url.searchParams.get('v') || '';
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || '';
    }
  } catch (_) {
    return '';
  }
  return '';
}

function parseYouTubeKstStartDate(title) {
  const match = String(title || '').match(/(?:^|[^0-9])(\d{4})[-_.](\d{2})[-_.](\d{2})[_\s-]+(\d{2})[-:.](\d{2})[-:.](\d{2})(?:[.,](\d{1,3}))?[_\s-]*KST(?:[^A-Z]|$)/i);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisText = '0'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millis = Number(millisText.padEnd(3, '0'));
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, second, millis));
}

function parseYouTubeDescriptionKstStartDate(description) {
  const match = String(description || '').match(/(?:^|\n)\s*NSSUR_START_KST\s*=\s*(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?\s*(?:\n|$)/i);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisText = '0'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millis = Number(millisText.padEnd(3, '0'));
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, second, millis));
}

async function fetchYouTubeMetadata(videoId) {
  const response = await fetch(`/api/youtube-metadata?id=${encodeURIComponent(videoId)}`, {
    headers: { Accept: 'application/json' }
  });
  let payload = {};
  try { payload = await response.json(); } catch (_) { /* 서버의 텍스트 오류 응답 */ }
  if (!response.ok) {
    throw new Error(payload.error || `YouTube 설명을 조회하지 못했습니다. (${response.status})`);
  }
  return payload;
}

function getKstDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function makeYouTubeUploadMetadata(file, creationDate) {
  const { year, month, day, hour, minute, second } = getKstDateParts(creationDate);
  const sourceName = String(file?.name || 'GOPRO').replace(/\.mp4$/i, '');
  const safeName = sourceName.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'GOPRO';
  const startText = `${year}-${month}-${day} ${hour}:${minute}:${second}.000`;
  return {
    title: `NS26F_${year}-${month}-${day}_${hour}-${minute}-${second}_KST_${safeName}`.slice(0, 100),
    description: `NSSUR_START_KST=${startText}\n원본 파일: ${file.name}`,
    startText
  };
}

async function copyHelpVideoText(value, button, defaultLabel) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    button.textContent = '복사 완료';
    window.setTimeout(() => { button.textContent = defaultLabel; }, 1400);
  } catch (_) {
    const field = button.closest('div')?.querySelector('input, textarea');
    field?.select();
    document.execCommand('copy');
    button.textContent = '복사 완료';
    window.setTimeout(() => { button.textContent = defaultLabel; }, 1400);
  }
}

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (gpsYouTubeApiPromise) return gpsYouTubeApiPromise;
  gpsYouTubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') previousReady();
      resolve(window.YT);
    };
    let script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('error', () => reject(new Error('YouTube 플레이어를 불러오지 못했습니다. 인터넷 연결을 확인하세요.')), { once: true });
    window.setTimeout(() => {
      if (!window.YT?.Player) reject(new Error('YouTube 플레이어 연결 시간이 초과되었습니다.'));
    }, 15000);
  });
  return gpsYouTubeApiPromise;
}

function ensureYouTubeMount(id, slotSelector) {
  let mount = document.getElementById(id);
  if (mount) return mount;
  const slot = document.querySelector(slotSelector);
  if (!slot) return null;
  mount = document.createElement('div');
  mount.id = id;
  mount.className = 'gps-youtube-player';
  slot.appendChild(mount);
  return mount;
}

function createYouTubePlayer(mount, videoId) {
  return new Promise((resolve, reject) => {
    if (!mount || !window.YT?.Player) {
      reject(new Error('YouTube 플레이어 영역을 준비하지 못했습니다.'));
      return;
    }
    let settled = false;
    const player = new window.YT.Player(mount, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        playsinline: 1,
        rel: 0
      },
      events: {
        onReady: event => {
          event.target.getIframe?.().classList.add('gps-youtube-player');
          event.target.mute();
          settled = true;
          resolve(event.target);
        },
        onStateChange: event => {
          if (event.data === window.YT?.PlayerState?.PLAYING &&
              (!gpsPlaybackActive || gpsGoProSourceType !== 'youtube')) {
            event.target.pauseVideo?.();
          }
          requestAnimationFrame(refreshYouTubeBufferingState);
        },
        onError: event => {
          if (!settled) reject(new Error(`YouTube 영상을 재생할 수 없습니다. 오류 코드 ${event.data}`));
        }
      }
    });
  });
}

async function waitForYouTubeMetadata(player) {
  for (let count = 0; count < 40; count += 1) {
    const duration = Number(player?.getDuration?.());
    const title = String(player?.getVideoData?.()?.title || '').trim();
    if (duration > 0 && title) return { duration, title };
    await new Promise(resolve => window.setTimeout(resolve, 125));
  }
  return {
    duration: Number(player?.getDuration?.()),
    title: String(player?.getVideoData?.()?.title || '').trim()
  };
}

function destroyYouTubePlayers() {
  [gpsYouTubePrimaryPlayer, gpsYouTubeComparePlayer].forEach(player => {
    try { player?.destroy?.(); } catch (_) { /* 이미 제거된 플레이어 */ }
  });
  gpsYouTubePrimaryPlayer = null;
  gpsYouTubeComparePlayer = null;
  gpsYouTubeVideoId = '';
  gpsGoProPanel?.classList.remove('youtube-buffering');
  ['gps-youtube-player', 'gps-youtube-compare-player'].forEach(id => {
    const element = document.getElementById(id);
    if (element?.tagName === 'IFRAME') element.remove();
  });
  ensureYouTubeMount('gps-youtube-player', '.gps-gopro-primary-slot');
  ensureYouTubeMount('gps-youtube-compare-player', '.gps-gopro-compare-slot');
}

function getCsvGpsClockRange() {
  let first = null;
  let last = null;
  let previousClock = NaN;
  let dayOffset = 0;
  for (const row of globalData) {
    const rawClock = parseGpsClockSeconds(row.gps_time);
    if (!Number.isFinite(rawClock)) continue;
    if (Number.isFinite(previousClock) && rawClock + dayOffset < previousClock - 43200) dayOffset += 86400;
    const clock = rawClock + dayOffset;
    const point = { clock, telemetry: Number(row.time_sec) };
    if (!Number.isFinite(point.telemetry)) continue;
    if (!first) first = point;
    last = point;
    previousClock = clock;
  }
  return first && last ? { first, last } : null;
}

function matchGoProToCsv(creationDate, duration) {
  const range = getCsvGpsClockRange();
  if (!range || !Number.isFinite(duration)) return null;
  const rawStartUtc = creationDate.getUTCHours() * 3600 + creationDate.getUTCMinutes() * 60 + creationDate.getUTCSeconds() + creationDate.getUTCMilliseconds() / 1000;
  const rawStart = rawStartUtc + CSV_GPS_UTC_OFFSET_SEC;
  let best = null;
  for (let day = -1; day <= 1; day += 1) {
    const videoStart = rawStart + day * 86400;
    const overlap = Math.min(range.last.clock, videoStart + duration) - Math.max(range.first.clock, videoStart);
    if (!best || overlap > best.overlap) best = { videoStart, overlap, range };
  }
  if (!best || best.overlap <= 0) return best ? { ...best, matched: false } : null;
  return {
    matched: true,
    telemetryStart: best.range.first.telemetry + (best.videoStart - best.range.first.clock),
    overlap: best.overlap,
    videoStartClock: best.videoStart
  };
}

function syncOneGoProVideo(video, targetTime, force, rate, holdAtFinish = false) {
  const videoTime = targetTime - gpsGoProTelemetryStartSec;
  if (gpsGoProSourceType === 'youtube') {
    const player = video === gpsGoProCompareVideo ? gpsYouTubeComparePlayer : gpsYouTubePrimaryPlayer;
    const duration = Number(player?.getDuration?.());
    if (!player || !Number.isFinite(duration) || duration <= 0) return;
    if (videoTime < 0 || videoTime > duration) {
      player.pauseVideo?.();
      return;
    }
    const currentTime = Number(player.getCurrentTime?.());
    const drift = currentTime - videoTime;
    const now = performance.now();
    const lastSeekAt = gpsYouTubeLastSeekAt.get(player) || 0;
    const needsDriftCorrection = Math.abs(drift) > 0.75 && now - lastSeekAt > 750;
    if (force || !gpsPlaybackActive || !Number.isFinite(currentTime) || needsDriftCorrection) {
      player.seekTo?.(videoTime, true);
      gpsYouTubeLastSeekAt.set(player, now);
    }
    player.setPlaybackRate?.(rate);
    const state = player.getPlayerState?.();
    if (holdAtFinish) {
      if (force || !Number.isFinite(currentTime) || Math.abs(drift) > 0.08) player.seekTo?.(videoTime, true);
      player.pauseVideo?.();
    } else {
      const canStart = [
        window.YT?.PlayerState?.UNSTARTED,
        window.YT?.PlayerState?.ENDED,
        window.YT?.PlayerState?.PAUSED,
        window.YT?.PlayerState?.CUED
      ].includes(state);
      if (gpsPlaybackActive && canStart) player.playVideo?.();
      if (!gpsPlaybackActive) player.pauseVideo?.();
    }
    return;
  }
  if (!video || !Number.isFinite(video.duration)) return;
  if (videoTime < 0 || videoTime > video.duration) {
    video.pause();
    return;
  }
  const drift = video.currentTime - videoTime;
  if (force || !gpsPlaybackActive || Math.abs(drift) > 1.0 || (holdAtFinish && Math.abs(drift) > 0.03)) {
    video.currentTime = videoTime;
  }
  video.playbackRate = rate;
  if (holdAtFinish) video.pause();
  else {
    if (gpsPlaybackActive && video.paused) video.play().catch(() => {});
    if (!gpsPlaybackActive && !video.paused) video.pause();
  }
}

function getGoProLapPair() {
  if (gpsSelectedLapIndices.length < 2) return null;
  const primaryIndex = gpsSelectedLapIndices.reduce((best, index) =>
    gpsLapResults[index].duration < gpsLapResults[best].duration ? index : best);
  const compareIndex = gpsSelectedLapIndices.includes(gpsGoProCompareLapIndex) && gpsGoProCompareLapIndex !== primaryIndex
    ? gpsGoProCompareLapIndex
    : gpsSelectedLapIndices.find(index => index !== primaryIndex);
  return { primaryIndex, compareIndex };
}

function updateGoProComparisonLayout() {
  const pair = getGoProLapPair();
  gpsGoProPanel?.classList.toggle('comparing', Boolean(pair));
  if (!pair) {
    if (gpsGoProAudioSlot === 'compare') gpsGoProAudioSlot = 'primary';
    if (gpsGoProPrimaryLabel) gpsGoProPrimaryLabel.textContent = '';
    if (gpsGoProSourceType === 'youtube') gpsYouTubeComparePlayer?.pauseVideo?.();
    else gpsGoProCompareVideo?.pause();
    applyGoProAudioSelection();
    return;
  }
  const primary = gpsLapResults[pair.primaryIndex];
  const compare = gpsLapResults[pair.compareIndex];
  if (gpsGoProPrimaryLabel) {
    gpsGoProPrimaryLabel.textContent = `기준 · LAP ${primary.number} · ${formatLapTime(primary.duration)}`;
    gpsGoProPrimaryLabel.parentElement?.style.setProperty('--lap-color', GPS_LAP_COLORS[pair.primaryIndex % GPS_LAP_COLORS.length]);
  }
  if (gpsGoProCompareLabel) {
    gpsGoProCompareLabel.textContent = `비교 · LAP ${compare.number} · +${(compare.duration - primary.duration).toFixed(3)}초`;
    gpsGoProCompareLabel.parentElement?.style.setProperty('--lap-color', GPS_LAP_COLORS[pair.compareIndex % GPS_LAP_COLORS.length]);
  }
  applyGoProAudioSelection();
}

function gpsSpeedAtTelemetryTime(targetTime) {
  const index = globalData.length ? findGlobalIndexAtTime(targetTime) : -1;
  return index >= 0 ? Number(globalData[index].gps_speed_kmh) || 0 : 0;
}

function setGoProSlotSpeed(element, speed) {
  if (element?.firstChild) element.firstChild.nodeValue = `${speed.toFixed(1)} `;
}

function applyGoProAudioSelection() {
  const primaryEnabled = gpsGoProAudioSlot === 'primary';
  const compareEnabled = gpsGoProAudioSlot === 'compare' && Boolean(getGoProLapPair());
  if (gpsGoProVideo) gpsGoProVideo.muted = !primaryEnabled;
  if (gpsGoProCompareVideo) gpsGoProCompareVideo.muted = !compareEnabled;
  if (primaryEnabled) gpsYouTubePrimaryPlayer?.unMute?.();
  else gpsYouTubePrimaryPlayer?.mute?.();
  if (compareEnabled) gpsYouTubeComparePlayer?.unMute?.();
  else gpsYouTubeComparePlayer?.mute?.();
  gpsGoProPrimaryAudio?.setAttribute('aria-pressed', String(primaryEnabled));
  gpsGoProCompareAudio?.setAttribute('aria-pressed', String(compareEnabled));
  gpsGoProPrimaryAudio?.setAttribute('aria-label', primaryEnabled ? '기준 영상 소리 끄기' : '기준 영상 소리 켜기');
  gpsGoProCompareAudio?.setAttribute('aria-label', compareEnabled ? '비교 영상 소리 끄기' : '비교 영상 소리 켜기');
}

function toggleGoProAudio(slot) {
  gpsGoProAudioSlot = gpsGoProAudioSlot === slot ? '' : slot;
  applyGoProAudioSelection();
}

function syncGoProVideo(targetTime, force = false) {
  if (!gpsGoProMatched || !gpsGoProVideo) return;
  const rate = Number(gpsPlayRate?.value) || 1;
  const pair = getGoProLapPair();
  if (pair) {
    const timelineLap = gpsLapResults[gpsSelectedLapIndices[0]];
    const relativeTime = Math.max(0, targetTime - timelineLap.startTime);
    const primary = gpsLapResults[pair.primaryIndex];
    const compare = gpsLapResults[pair.compareIndex];
    const primaryTime = primary.startTime + Math.min(relativeTime, primary.duration);
    const compareTime = compare.startTime + Math.min(relativeTime, compare.duration);
    const primaryArrived = relativeTime >= primary.duration;
    const compareArrived = relativeTime >= compare.duration;
    syncOneGoProVideo(gpsGoProVideo, primaryTime, force, rate, primaryArrived);
    syncOneGoProVideo(gpsGoProCompareVideo, compareTime, force, rate, compareArrived);
    gpsGoProPanel?.classList.toggle('primary-arrived', primaryArrived);
    gpsGoProPanel?.classList.toggle('compare-arrived', compareArrived);
    setGoProSlotSpeed(gpsGoProPrimarySpeed, gpsSpeedAtTelemetryTime(primaryTime));
    setGoProSlotSpeed(gpsGoProCompareSpeed, gpsSpeedAtTelemetryTime(compareTime));
  } else {
    gpsGoProPanel?.classList.remove('primary-arrived', 'compare-arrived');
    syncOneGoProVideo(gpsGoProVideo, targetTime, force, rate);
    if (gpsGoProSourceType === 'youtube') gpsYouTubeComparePlayer?.pauseVideo?.();
    else gpsGoProCompareVideo?.pause();
  }
}

function getGoProTargetTelemetryTime(cursorTime) {
  if (gpsSelectedLapIndices.length > 1) {
    const primaryLap = gpsLapResults[gpsSelectedLapIndices[0]];
    if (primaryLap) return primaryLap.startTime + Math.min(cursorTime, primaryLap.duration);
  }
  return cursorTime;
}

function closeGoProVideo() {
  if (gpsGoProSourceType === 'youtube') {
    gpsYouTubePrimaryPlayer?.pauseVideo?.();
    gpsYouTubeComparePlayer?.pauseVideo?.();
  } else {
    gpsGoProVideo?.pause();
    gpsGoProCompareVideo?.pause();
  }
  if (gpsGoProVideo) gpsGoProVideo.removeAttribute('src');
  if (gpsGoProCompareVideo) gpsGoProCompareVideo.removeAttribute('src');
  if (gpsGoProObjectUrl) URL.revokeObjectURL(gpsGoProObjectUrl);
  destroyYouTubePlayers();
  gpsGoProObjectUrl = '';
  gpsGoProAudioSlot = '';
  applyGoProAudioSelection();
  gpsGoProSourceType = '';
  gpsGoProMatched = false;
  gpsGoProCompareLapIndex = -1;
  gpsGoProTelemetryStartSec = NaN;
  const stage = gpsGoProPanel?.closest('.gps-map-stage');
  stage?.classList.remove('gps-video-loaded');
  if (gpsGoProPanel) {
    gpsGoProPanel.hidden = true;
    gpsGoProPanel.classList.remove('youtube-source', 'youtube-buffering', 'primary-arrived', 'compare-arrived');
  }
  if (gpsGoProFile) gpsGoProFile.value = '';
  setTimeout(() => {
    gpsMap?.invalidateSize();
    refitGpsMapToCurrentLapView();
  }, 80);
}

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

function formatLapTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--.---';
  const totalMs = Math.round(seconds * 1000);
  const minutes = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${minutes}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function formatKoreanDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds - minutes * 60;
  return `${minutes}분 ${remaining.toFixed(1).padStart(4, '0')}초`;
}

function parseGpsClockSeconds(value) {
  if (value === undefined || value === null) return NaN;
  const text = String(value).trim();
  if (!text || text === '00:00:00.00') return NaN;
  const colon = text.match(/^(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (colon) return Number(colon[1]) * 3600 + Number(colon[2]) * 60 + Number(colon[3]);
  const compact = text.match(/^(\d{2})(\d{2})(\d{2}(?:\.\d+)?)$/);
  if (compact) return Number(compact[1]) * 3600 + Number(compact[2]) * 60 + Number(compact[3]);
  return NaN;
}

function formatGpsClock(seconds) {
  if (!Number.isFinite(seconds)) return '--:--:--.--';
  const daySeconds = ((seconds % 86400) + 86400) % 86400;
  const hours = Math.floor(daySeconds / 3600);
  const minutes = Math.floor((daySeconds % 3600) / 60);
  const secs = daySeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
}

function gpsClockAtTelemetryTime(targetTime, nearbyIndex = -1) {
  if (!globalData.length || !Number.isFinite(targetTime)) return NaN;
  let index = nearbyIndex >= 0 ? nearbyIndex : findGlobalIndexAtTime(targetTime);
  index = Math.max(0, Math.min(globalData.length - 1, index));
  for (let distance = 0; distance < globalData.length; distance += 1) {
    for (const candidateIndex of distance ? [index - distance, index + distance] : [index]) {
      if (candidateIndex < 0 || candidateIndex >= globalData.length) continue;
      const row = globalData[candidateIndex];
      const clock = parseGpsClockSeconds(row.gps_time);
      if (Number.isFinite(clock) && Number.isFinite(row.time_sec)) {
        return clock + (targetTime - row.time_sec);
      }
    }
  }
  return NaN;
}

function setGpsLapStatus(text, className = '') {
  if (!gpsLapToolbarStatus) return;
  gpsLapToolbarStatus.textContent = text;
  gpsLapToolbarStatus.className = className;
}

function latLonToLocalMeters(point, origin) {
  const rad = Math.PI / 180;
  return {
    x: (point.lon - origin.lon) * 111320 * Math.cos(origin.lat * rad),
    y: (point.lat - origin.lat) * 110540
  };
}

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
}

function distanceMeters(a, b) {
  const origin = { lat: (a.lat + b.lat) * 0.5, lon: (a.lon + b.lon) * 0.5 };
  const pa = latLonToLocalMeters(a, origin);
  const pb = latLonToLocalMeters(b, origin);
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
}

function formatGpsLapDistance(distance) {
  return Number.isFinite(distance) ? `${distance.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m` : '--.- m';
}

function calculateGpsLapDistance(lap) {
  const points = [
    { lat: lap.startLat, lon: lap.startLon, time: lap.startTime },
    ...gpsLapPoints.filter(point => point.time > lap.startTime && point.time < lap.endTime),
    { lat: lap.endLat, lon: lap.endLon, time: lap.endTime }
  ];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const elapsed = current.time - previous.time;
    const segment = distanceMeters(previous, current);
    if (!(elapsed > 0) || !Number.isFinite(segment)) continue;
    // GPS 점프와 장시간 수신 공백은 거리 합계에서 제외합니다.
    if (elapsed > 3 || segment / elapsed > 120) continue;
    total += segment;
  }
  return total > 0 ? total : NaN;
}

function buildGpsLapPoints(data) {
  const points = [];
  let lastFixCounter = null;
  let lastFallbackKey = null;
  let previousGpsClock = null;
  let gpsDayOffset = 0;

  data.forEach(row => {
    const lat = convertNmeaToDecimal(row.gps_lat, false);
    const lon = convertNmeaToDecimal(row.gps_lon, true);
    const time = Number(row.time_sec);
    const quality = Number.parseInt(row.gps_qual, 10);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(time) || quality <= 0) return;

    const fixCounter = Number.parseInt(row.gps_fix_update_count, 10);
    if (Number.isFinite(fixCounter) && fixCounter > 0) {
      if (fixCounter === lastFixCounter) return;
      lastFixCounter = fixCounter;
    } else {
      const fallbackKey = `${row.gps_time || ''}|${lat.toFixed(8)}|${lon.toFixed(8)}`;
      if (fallbackKey === lastFallbackKey) return;
      lastFallbackKey = fallbackKey;
    }

    const rawGpsClock = parseGpsClockSeconds(row.gps_time);
    if (Number.isFinite(rawGpsClock) && previousGpsClock !== null && rawGpsClock < previousGpsClock - 43200) {
      gpsDayOffset += 86400;
    }
    if (Number.isFinite(rawGpsClock)) previousGpsClock = rawGpsClock;

    points.push({
      lat,
      lon,
      time,
      gpsTime: Number.isFinite(rawGpsClock) ? rawGpsClock + gpsDayOffset : NaN,
      speed: Number(row.gps_speed_kmh) || 0,
      quality,
      sats: Number.parseInt(row.gps_sat, 10) || 0
    });
  });

  return points;
}

function drawGpsFinishLine() {
  if (!gpsMap) return;
  if (gpsFinishLine) gpsMap.removeLayer(gpsFinishLine);
  if (gpsFinishEndpointLayer) gpsFinishEndpointLayer.clearLayers();
  gpsFinishMarkers = [];
  if (gpsFinishPoints.length !== 2) return;

  const latLngs = gpsFinishPoints.map(point => [point.lat, point.lon]);
  gpsFinishLine = L.polyline(latLngs, {
    color: '#eab308',
    weight: 5,
    opacity: 0.95,
    interactive: false
  }).addTo(gpsMap);
}

function drawGpsFinishFirstPoint() {
  if (!gpsMap || gpsFinishPoints.length !== 1) return;
  if (gpsFinishEndpointLayer) gpsFinishEndpointLayer.clearLayers();
  const first = gpsFinishPoints[0];
  L.marker([first.lat, first.lon], {
    interactive: false,
    icon: L.divIcon({ className: 'gps-finish-marker', html: '<div class="gps-finish-line-icon"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })
  }).addTo(gpsFinishEndpointLayer);
  if (gpsFinishPreviewLine) gpsMap.removeLayer(gpsFinishPreviewLine);
  gpsFinishPreviewLine = L.polyline([[first.lat, first.lon], [first.lat, first.lon]], {
    color: '#eab308',
    weight: 4,
    opacity: 0.8,
    dashArray: '7 6',
    interactive: false
  }).addTo(gpsMap);
}

function updateGpsFinishPreview(event) {
  if (!gpsLapSelectionActive || gpsFinishPoints.length !== 1 || !gpsFinishPreviewLine) return;
  const first = gpsFinishPoints[0];
  gpsFinishPreviewLine.setLatLngs([[first.lat, first.lon], [event.latlng.lat, event.latlng.lng]]);
}

function findGpsLineCrossings(linePoints, minimumSpeed = 1) {
  if (!Array.isArray(linePoints) || linePoints.length !== 2) return [];
  const origin = {
    lat: (linePoints[0].lat + linePoints[1].lat) * 0.5,
    lon: (linePoints[0].lon + linePoints[1].lon) * 0.5
  };
  const a = latLonToLocalMeters(linePoints[0], origin);
  const b = latLonToLocalMeters(linePoints[1], origin);
  const line = { x: b.x - a.x, y: b.y - a.y };
  const lineLengthSq = line.x * line.x + line.y * line.y;
  if (lineLengthSq < 4) return [];
  const crossings = [];
  for (let index = 1; index < gpsLapPoints.length; index += 1) {
    const previous = gpsLapPoints[index - 1];
    const current = gpsLapPoints[index];
    const elapsed = current.time - previous.time;
    if (!(elapsed > 0 && elapsed <= 2)) continue;
    const p = latLonToLocalMeters(previous, origin);
    const q = latLonToLocalMeters(current, origin);
    const sidePrevious = cross2(line, { x: p.x - a.x, y: p.y - a.y });
    const sideCurrent = cross2(line, { x: q.x - a.x, y: q.y - a.y });
    if (sidePrevious === 0 || sideCurrent === 0 || sidePrevious * sideCurrent >= 0) continue;
    const fraction = sidePrevious / (sidePrevious - sideCurrent);
    const intersection = { x: p.x + (q.x - p.x) * fraction, y: p.y + (q.y - p.y) * fraction };
    const lineRatio = ((intersection.x - a.x) * line.x + (intersection.y - a.y) * line.y) / lineLengthSq;
    if (fraction < 0 || fraction > 1 || lineRatio < 0 || lineRatio > 1) continue;
    const speed = previous.speed + (current.speed - previous.speed) * fraction;
    if (speed < minimumSpeed) continue;
    crossings.push({
      time: previous.time + elapsed * fraction,
      speed,
      lat: previous.lat + (current.lat - previous.lat) * fraction,
      lon: previous.lon + (current.lon - previous.lon) * fraction
    });
  }
  return crossings;
}

function saveGpsFixedLines() {
  if (gpsFinishPoints.length !== 2) return;
  try {
    localStorage.setItem(GPS_FIXED_LINES_STORAGE_KEY, JSON.stringify({
      finish: gpsFinishPoints,
      checkpoints: gpsCheckpoints,
      savedAt: new Date().toISOString()
    }));
  } catch (error) { /* local storage may be unavailable */ }
}

function removeSavedGpsFixedLines() {
  try { localStorage.removeItem(GPS_FIXED_LINES_STORAGE_KEY); } catch (error) { /* ignore */ }
}

function verifyGpsFixedLinesPassword(actionLabel = '고정선을 변경') {
  const entered = window.prompt(`${actionLabel}하려면 4자리 비밀번호를 입력하십시오.`, '');
  if (entered === null) return false;
  if (!/^\d{4}$/.test(entered)) {
    setGpsLapStatus('비밀번호는 숫자 4자리로 입력하십시오.', 'warn');
    return false;
  }
  if (entered !== GPS_FIXED_LINES_INITIAL_PASSWORD) {
    setGpsLapStatus('비밀번호가 올바르지 않습니다.', 'warn');
    return false;
  }
  return true;
}

function restoreGpsFixedLines() {
  if (gpsLapPoints.length < 2) return false;
  let saved = null;
  try {
    const raw = localStorage.getItem(GPS_FIXED_LINES_STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (e) {}
  if (!saved || !Array.isArray(saved.finish) || saved.finish.length !== 2) {
    saved = GPS_SHARED_FIXED_LINES;
  }
  if (!saved || !Array.isArray(saved.finish) || saved.finish.length !== 2) return false;
  const middle = {
    lat: (saved.finish[0].lat + saved.finish[1].lat) * 0.5,
    lon: (saved.finish[0].lon + saved.finish[1].lon) * 0.5
  };
  const nearest = gpsLapPoints.reduce((best, point) => Math.min(best, distanceMeters(middle, point)), Infinity);
  if (nearest > 500) {
    setGpsLapStatus('저장된 고정선은 다른 트랙 좌표라 적용하지 않았습니다.', 'warn');
    return false;
  }
  gpsFinishPoints = saved.finish.map(point => ({ lat: Number(point.lat), lon: Number(point.lon) }));
  if (Array.isArray(saved.checkpoints)) {
    gpsCheckpoints = saved.checkpoints.filter(line => Array.isArray(line) && line.length === 2);
  }
  drawGpsFinishLine();
  drawGpsCheckpoints();
  if (gpsLapClear) gpsLapClear.disabled = false;
  calculateGpsLaps();
  updateGpsVideoControlAvailability();
  setGpsLapStatus(`고정 피니시라인과 체크포인트 ${gpsCheckpoints.length}개를 불러왔습니다.`, 'ok');
  return true;
}

function drawGpsCheckpoints() {
  gpsCheckpointLayer?.clearLayers();
  gpsCheckpoints.forEach((checkpoint, index) => {
    const color = '#06b6d4';
    const points = checkpoint.map(point => [Number(point.lat ?? point[0]), Number(point.lon ?? point.lng ?? point[1])]);
    L.polyline(points, {
      color,
      weight: 3,
      opacity: 0.72,
      interactive: false
    }).addTo(gpsCheckpointLayer);
    const middle = {
      lat: (points[0][0] + points[1][0]) * 0.5,
      lon: (points[0][1] + points[1][1]) * 0.5
    };
    L.marker([middle.lat, middle.lon], {
      interactive: false,
      icon: L.divIcon({ className: '', html: `<div class="gps-checkpoint-label">CP${index + 1}</div>`, iconSize: [36, 18], iconAnchor: [18, 9] })
    }).addTo(gpsCheckpointLayer);
  });
  if (gpsCheckpointCount) gpsCheckpointCount.textContent = `${gpsCheckpoints.length} CP`;
  if (gpsCheckpointClear) gpsCheckpointClear.disabled = gpsFinishPoints.length !== 2 && !gpsCheckpoints.length;
  if (gpsSharedSettingsCopy) gpsSharedSettingsCopy.disabled = gpsFinishPoints.length !== 2;
  if (gpsCheckpointAdd) gpsCheckpointAdd.disabled = !gpsLapResults.length;
  if (gpsSectorToggle) gpsSectorToggle.disabled = !gpsCheckpoints.length;
}

function clearGpsCheckpoints(removeSaved = false) {
  gpsCheckpointSelectionActive = false;
  gpsCheckpointDraft = [];
  gpsCheckpoints = [];
  if (gpsCheckpointPreviewLine && gpsMap) gpsMap.removeLayer(gpsCheckpointPreviewLine);
  gpsCheckpointPreviewLine = null;
  gpsCheckpointLayer?.clearLayers();
  gpsCheckpointDraftLayer?.clearLayers();
  gpsCheckpointAdd?.classList.remove('active');
  if (gpsCheckpointAdd) gpsCheckpointAdd.disabled = true;
  if (gpsCheckpointClear) gpsCheckpointClear.disabled = true;
  if (gpsSharedSettingsCopy) gpsSharedSettingsCopy.disabled = true;
  if (gpsSectorToggle) gpsSectorToggle.disabled = true;
  if (gpsCheckpointCount) gpsCheckpointCount.textContent = '0 CP';
  if (gpsSectorCard) gpsSectorCard.hidden = true;
  if (gpsSectorTable) gpsSectorTable.innerHTML = '';
  if (gpsSectorOverlayTable) gpsSectorOverlayTable.innerHTML = '';
  if (gpsSectorOverlay) gpsSectorOverlay.hidden = true;
  if (removeSaved) removeSavedGpsFixedLines();
}

function beginGpsCheckpointSelection() {
  if (gpsFinishPoints.length !== 2 || !gpsLapResults.length) {
    setGpsLapStatus('먼저 피니시 라인을 설정해 랩을 계산하십시오.', 'warn');
    return;
  }
  setGpsPlayback(false);
  gpsLapSelectionActive = false;
  gpsCheckpointSelectionActive = true;
  gpsCheckpointDraft = [];
  gpsCheckpointDraftLayer?.clearLayers();
  gpsCheckpointAdd?.classList.add('active');
  gpsMap?.getContainer().classList.add('gps-lap-selecting');
  setGpsLapStatus(`CP${gpsCheckpoints.length + 1}의 첫 번째 끝점을 클릭하십시오.`, 'warn');
}

function cancelGpsCheckpointSelection() {
  if (!gpsCheckpointSelectionActive) return false;
  gpsCheckpointSelectionActive = false;
  gpsCheckpointDraft = [];
  if (gpsCheckpointPreviewLine && gpsMap) gpsMap.removeLayer(gpsCheckpointPreviewLine);
  gpsCheckpointPreviewLine = null;
  gpsCheckpointDraftLayer?.clearLayers();
  gpsCheckpointAdd?.classList.remove('active');
  gpsMap?.getContainer().classList.remove('gps-lap-selecting');
  setGpsLapStatus('체크포인트 설정을 취소했습니다.');
  return true;
}

function handleGpsCheckpointMapClick(event) {
  if (!gpsCheckpointSelectionActive) return;
  gpsCheckpointDraft.push({ lat: event.latlng.lat, lon: event.latlng.lng });
  if (gpsCheckpointDraft.length === 1) {
    const first = gpsCheckpointDraft[0];
    L.circleMarker([first.lat, first.lon], { radius: 5, color: '#fff', weight: 2, fillColor: '#06b6d4', fillOpacity: 1, interactive: false }).addTo(gpsCheckpointDraftLayer);
    gpsCheckpointPreviewLine = L.polyline([[first.lat, first.lon], [first.lat, first.lon]], { color: '#06b6d4', weight: 3, dashArray: '6 5', interactive: false }).addTo(gpsMap);
    setGpsLapStatus(`CP${gpsCheckpoints.length + 1}의 반대쪽 끝점을 클릭하십시오. Esc로 취소할 수 있습니다.`, 'warn');
    return;
  }
  gpsCheckpoints.push(gpsCheckpointDraft.slice(0, 2));
  gpsCheckpointSelectionActive = false;
  gpsCheckpointDraft = [];
  if (gpsCheckpointPreviewLine && gpsMap) gpsMap.removeLayer(gpsCheckpointPreviewLine);
  gpsCheckpointPreviewLine = null;
  gpsCheckpointDraftLayer?.clearLayers();
  gpsCheckpointAdd?.classList.remove('active');
  gpsMap?.getContainer().classList.remove('gps-lap-selecting');
  drawGpsCheckpoints();
  saveGpsFixedLines();
  renderGpsSectorComparison();
  refreshPage4Selectors();
  setGpsLapStatus(`CP${gpsCheckpoints.length} 저장 완료 · 다음 체크포인트는 주행 순서대로 추가하십시오.`, 'ok');
}

function updateGpsCheckpointPreview(event) {
  if (!gpsCheckpointSelectionActive || gpsCheckpointDraft.length !== 1 || !gpsCheckpointPreviewLine) return;
  const first = gpsCheckpointDraft[0];
  gpsCheckpointPreviewLine.setLatLngs([[first.lat, first.lon], [event.latlng.lat, event.latlng.lng]]);
}

function updateGpsCursorScale() {
  if (!gpsMap) return;
  const zoom = gpsMap.getZoom();
  const scale = Math.max(0.72, Math.min(1.18, 0.72 + (zoom - 7) * 0.031));
  const marker = gpsCursorMarker?.getElement()?.querySelector('.gps-position-cursor');
  if (marker) marker.style.setProperty('--gps-cursor-scale', scale.toFixed(3));
  gpsCompareMarkers.forEach(compareMarker => {
    compareMarker.getElement()?.querySelector('.gps-position-cursor')?.style.setProperty('--gps-cursor-scale', scale.toFixed(3));
  });
}

function updateGpsCursorLapColor(targetTime) {
  const marker = gpsCursorMarker?.getElement()?.querySelector('.gps-position-cursor');
  const selectedSingleLap = gpsSelectedLapIndices.length === 1 ? gpsSelectedLapIndices[0] : -1;
  const lapIndex = selectedSingleLap >= 0
    ? selectedSingleLap
    : gpsLapResults.findIndex(lap => targetTime >= lap.startTime && targetTime <= lap.endTime);
  const color = lapIndex >= 0 ? GPS_LAP_COLORS[lapIndex % GPS_LAP_COLORS.length] : '#00bfe8';
  if (marker) marker.style.setProperty('--gps-cursor-color', color);
  if (gpsFullscreenLapTimes) {
    gpsFullscreenLapTimes.querySelectorAll('[data-lap-time-row]').forEach(row => {
      row.classList.toggle('active', Number(row.dataset.lapTimeRow) === lapIndex);
    });
    const live = gpsFullscreenLapTimes.querySelector('[data-lap-live]');
    if (live) {
      if (lapIndex >= 0) {
        const lap = gpsLapResults[lapIndex];
        const elapsed = Math.max(0, Math.min(lap.duration, targetTime - lap.startTime));
        live.textContent = `LAP ${lap.number} · ${formatLapTime(elapsed)}`;
        live.style.color = color;
      } else {
        live.textContent = '완성된 랩 구간 밖';
        live.style.color = '';
      }
    }
  }
}

function renderFullscreenLapTimes(laps, best) {
  if (!gpsFullscreenLapTimes) return;
  const bestIndex = laps.findIndex(lap => Math.abs(lap.duration - best) < 0.0005);
  const bestLabel = `BEST ${formatLapTime(best)}`;
  gpsFullscreenLapTimes.hidden = !laps.length;
  gpsFullscreenLapTimes.innerHTML = laps.length ? `
    <div class="gps-fs-lap-head"><span>Lap Times</span><strong>${bestLabel}</strong></div>
    <div class="gps-fs-lap-live" data-lap-live>완성된 랩 구간 밖</div>
    <button type="button" class="gps-fs-lap-all${gpsSelectedLapIndices.length === 0 ? ' selected' : ''}" data-lap-panel-view="all">전체 랩 보기</button>
    <div class="gps-fs-lap-list">${laps.map((lap, index) => `
      <button type="button" class="${index === bestIndex ? 'best ' : ''}${gpsSelectedLapIndices.includes(index) ? 'selected' : ''}" data-lap-time-row="${index}" data-lap-panel-view="${index}" style="--lap-color:${GPS_LAP_COLORS[index % GPS_LAP_COLORS.length]}">
        <span><i></i>LAP ${lap.number}${index === bestIndex ? '<b class="gps-best-star">★</b>' : ''}</span><strong>${formatLapTime(lap.duration)}<small>${formatGpsLapDistance(lap.distanceMeters)}</small></strong>
      </button>`).join('')}</div>` : '';
  updateGoProComparisonLayout();
}

function refreshGpsFullscreenOverlays() {
  if (gpsLapResults.length) {
    const best = Math.min(...gpsLapResults.map(lap => lap.duration));
    renderFullscreenLapTimes(gpsLapResults, best);
  } else if (gpsFullscreenLapTimes) {
    gpsFullscreenLapTimes.hidden = true;
  }
  updateGpsCursorLapColor(Number(scrollBar?.value));
  const targetTime = Number(scrollBar?.value) || 0;
  const rowIndex = globalData.length ? findGlobalIndexAtTime(targetTime) : -1;
  const row = rowIndex >= 0 ? globalData[rowIndex] : null;
  if (row && gpsFullscreenSpeedValue) {
    gpsFullscreenSpeedValue.textContent = (Number(row.gps_speed_kmh) || 0).toFixed(1);
  }
  if (gpsFullscreenPlayTime) {
    gpsFullscreenPlayTime.textContent = `${formatGpsClock(gpsClockAtTelemetryTime(targetTime, rowIndex))} KST`;
  }
}

function drawGpsLapRoutes(laps) {
  if (gpsLapRouteLayer) gpsLapRouteLayer.clearLayers();
  gpsLapRouteLines = [];
  gpsSelectedLapIndex = -1;
  gpsSelectedLapIndices = [];
  if (gpsRouteLine) gpsRouteLine.setStyle({ opacity: laps.length ? 0.22 : 0.8, weight: laps.length ? 3 : 5 });
  if (gpsLapMapLegend) {
    gpsLapMapLegend.hidden = !laps.length;
    gpsLapMapLegend.innerHTML = laps.length
      ? `<button type="button" class="active" data-lap-view="all">전체</button>` + laps.map((lap, index) =>
          `<button type="button" data-lap-view="${index}"><i style="--lap-color:${GPS_LAP_COLORS[index % GPS_LAP_COLORS.length]}"></i>LAP ${lap.number}</button>`
        ).join('')
      : '';
  }
  if (!gpsLapRouteLayer || !laps.length) return;

  laps.forEach((lap, index) => {
    const coords = [[lap.startLat, lap.startLon]];
    gpsLapPoints.forEach(point => {
      if (point.time > lap.startTime && point.time < lap.endTime) coords.push([point.lat, point.lon]);
    });
    coords.push([lap.endLat, lap.endLon]);
    if (coords.length < 2) return;
    const line = L.polyline(coords, {
      color: GPS_LAP_COLORS[index % GPS_LAP_COLORS.length],
      weight: 6,
      opacity: 0.92,
      interactive: false
    });
    gpsLapRouteLines[index] = line;
    line.addTo(gpsLapRouteLayer);
  });
  if (gpsCursorMarker) gpsCursorMarker.setZIndexOffset(10000);
}

function median(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return NaN;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) * 0.5;
}

function gpsPositionAtTelemetryTime(time) {
  if (!gpsLapPoints.length) return null;
  let low = 0, high = gpsLapPoints.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (gpsLapPoints[middle].time < time) low = middle + 1;
    else high = middle;
  }
  const next = gpsLapPoints[low];
  const previous = gpsLapPoints[Math.max(0, low - 1)];
  if (!next || !previous || next.time - previous.time > 2) return next || previous || null;
  const ratio = Math.max(0, Math.min(1, (time - previous.time) / Math.max(0.001, next.time - previous.time)));
  return { lat: previous.lat + (next.lat - previous.lat) * ratio, lon: previous.lon + (next.lon - previous.lon) * ratio };
}

function analyzeGpsHandlingBalance() {
  gpsHandlingEventsData = [];
  gpsHandlingAnalysisReady = false;
  gpsHandlingLayer?.clearLayers();
  if (!gpsLapResults.length || !globalData.length) {
    if (gpsHandlingCard) gpsHandlingCard.hidden = true;
    if (gpsHandlingToggle) gpsHandlingToggle.disabled = true;
    return;
  }

  // 차량 제원이 없어도 작동하도록 정상 코너의 조향/Yaw 관계에서 유효 조향비를 자동 추정합니다.
  const wheelbaseM = 1.60;
  const candidates = [];
  let signSum = 0;
  for (let index = 0; index < globalData.length; index += 5) {
    const row = globalData[index];
    const time = Number(row.time_sec);
    if (!gpsLapResults.some(lap => time >= lap.startTime && time <= lap.endTime)) continue;
    const speed = Number(row.gps_speed_kmh) / 3.6;
    const steering = channelValueAt('steering', index) ?? getCalibratedSteering(row.steering_raw);
    const yaw = Number(row.imu_gyro_z_dps);
    const lateral = Number(row.imu_accel_y_g);
    if (speed < 7 || Math.abs(steering) < 8 || Math.abs(yaw) < 3 || Math.abs(lateral) < 0.12) continue;
    signSum += Math.sign(steering * yaw);
    const roadAngleDeg = Math.abs(Math.atan((yaw * Math.PI / 180) * wheelbaseM / speed) * 180 / Math.PI);
    const ratio = Math.abs(steering) / Math.max(0.15, roadAngleDeg);
    if (ratio >= 3 && ratio <= 35) candidates.push(ratio);
  }
  const yawSign = signSum < 0 ? -1 : 1;
  const steeringRatio = Math.max(4, Math.min(30, median(candidates) || 12));
  const samples = [];
  let smoothYaw = 0;
  let smoothLat = 0;
  globalData.forEach((row, index) => {
    const time = Number(row.time_sec);
    if (!gpsLapResults.some(lap => time >= lap.startTime && time <= lap.endTime)) return;
    const speedKmh = Number(row.gps_speed_kmh) || 0;
    const speed = speedKmh / 3.6;
    const steering = channelValueAt('steering', index) ?? getCalibratedSteering(row.steering_raw);
    const measuredYaw = (Number(row.imu_gyro_z_dps) || 0) * yawSign;
    const lateral = Number(row.imu_accel_y_g) || 0;
    smoothYaw += 0.08 * (measuredYaw - smoothYaw);
    smoothLat += 0.08 * (lateral - smoothLat);
    if (index % 2) return;
    const roadAngle = (steering / steeringRatio) * Math.PI / 180;
    const expectedYaw = speed > 0 ? (speed / wheelbaseM) * Math.tan(roadAngle) * 180 / Math.PI : 0;
    const cornering = speedKmh >= 20 && Math.abs(steering) >= 8 && Math.abs(smoothLat) >= 0.14 && Math.abs(expectedYaw) >= 3;
    const response = cornering ? Math.abs(smoothYaw) / Math.max(3, Math.abs(expectedYaw)) : 1;
    const counterSteer = cornering && Math.sign(steering) !== Math.sign(smoothYaw) && Math.abs(smoothYaw) > 7;
    let type = 'neutral';
    let severity = 0;
    if (cornering && response < 0.72) { type = 'under'; severity = (0.72 - response) / 0.42; }
    if (cornering && (response > 1.32 || counterSteer)) { type = 'over'; severity = counterSteer ? Math.max(0.75, (response - 1) / 0.8) : (response - 1.32) / 0.68; }
    samples.push({ time, type, severity: Math.max(0, Math.min(1, severity)), speedKmh, steering, yaw: smoothYaw, lateral: smoothLat, throttle: Number(row.decoded_tps) || 0, brake: getCalibratedBrake(row.front_brake_raw) });
  });

  let active = null;
  const finishEvent = event => {
    if (!event || event.endTime - event.startTime < 0.22) return;
    event.duration = event.endTime - event.startTime;
    event.confidence = Math.round(Math.min(98, 55 + event.duration * 22 + event.maxSeverity * 25));
    gpsHandlingEventsData.push(event);
  };
  samples.forEach(sample => {
    if (sample.type === 'neutral') { finishEvent(active); active = null; return; }
    if (!active || active.type !== sample.type || sample.time - active.endTime > 0.12) {
      finishEvent(active);
      active = { type: sample.type, startTime: sample.time, endTime: sample.time, maxSeverity: sample.severity, peak: sample };
    } else {
      active.endTime = sample.time;
      if (sample.severity > active.maxSeverity) { active.maxSeverity = sample.severity; active.peak = sample; }
    }
  });
  finishEvent(active);
  gpsHandlingEventsData.forEach(event => {
    event.lapIndex = gpsLapResults.findIndex(lap => event.peak.time >= lap.startTime && event.peak.time <= lap.endTime);
    event.position = gpsPositionAtTelemetryTime(event.peak.time);
  });
  gpsHandlingAnalysisReady = true;
  renderGpsHandlingAnalysis(steeringRatio);
}

function renderGpsHandlingAnalysis(steeringRatio) {
  gpsHandlingSteeringRatio = Number.isFinite(steeringRatio) ? steeringRatio : gpsHandlingSteeringRatio;
  const visibleEvents = gpsHandlingEventsData.filter(event => event.lapIndex >= 0 &&
    (!gpsSelectedLapIndices.length || gpsSelectedLapIndices.includes(event.lapIndex)));
  const under = visibleEvents.filter(event => event.type === 'under');
  const over = visibleEvents.filter(event => event.type === 'over');
  if (gpsUndersteerCount) gpsUndersteerCount.textContent = String(under.length);
  if (gpsOversteerCount) gpsOversteerCount.textContent = String(over.length);
  if (gpsHandlingCalibration) gpsHandlingCalibration.textContent = `자동 조향비 ${gpsHandlingSteeringRatio.toFixed(1)}:1`;
  if (gpsHandlingCard) gpsHandlingCard.hidden = !gpsHandlingVisible;
  if (gpsHandlingToggle) gpsHandlingToggle.disabled = false;
  gpsHandlingToggle?.classList.toggle('active', gpsHandlingVisible);
  gpsHandlingToggle?.setAttribute('aria-pressed', String(gpsHandlingVisible));
  const ordered = [...visibleEvents].sort((a, b) => b.maxSeverity - a.maxSeverity).slice(0, 20);
  if (gpsHandlingEvents) gpsHandlingEvents.innerHTML = ordered.length ? ordered.map(event => {
    const lap = event.lapIndex >= 0 ? `LAP ${gpsLapResults[event.lapIndex].number}` : '랩 외';
    const label = event.type === 'under' ? '언더스티어' : '오버스티어';
    const phase = event.peak.brake >= 5 ? '제동 중' : event.peak.throttle >= 35 ? '가속 중' : '코너 중간';
    return `<button type="button" class="${event.type}" data-handling-time="${event.peak.time.toFixed(3)}"><b>${label}</b><span>${lap} · ${event.peak.speedKmh.toFixed(1)} km/h</span><small>${phase} · ${event.duration.toFixed(2)}초 · 추정 점수 ${event.confidence}%</small></button>`;
  }).join('') : '<div class="gps-handling-empty">조건을 충족한 오버/언더스티어 구간이 없습니다.</div>';
  drawGpsHandlingEvents();
}

function drawGpsHandlingEvents() {
  gpsHandlingLayer?.clearLayers();
  if (!gpsHandlingVisible || !gpsHandlingLayer) return;
  gpsHandlingEventsData.filter(event => event.lapIndex >= 0 &&
    (!gpsSelectedLapIndices.length || gpsSelectedLapIndices.includes(event.lapIndex))).forEach(event => {
    const coords = gpsLapPoints.filter(point => point.time >= event.startTime && point.time <= event.endTime).map(point => [point.lat, point.lon]);
    if (event.position && coords.length < 2) {
      L.circleMarker([event.position.lat, event.position.lon], { radius: 7, color: '#fff', weight: 2, fillColor: event.type === 'under' ? '#2563eb' : '#ef4444', fillOpacity: 0.92, interactive: false }).addTo(gpsHandlingLayer);
      return;
    }
    L.polyline(coords, { color: event.type === 'under' ? '#2563eb' : '#ef4444', weight: 9, opacity: 0.88, interactive: false }).addTo(gpsHandlingLayer);
  });
}

function page4ReferencePoints() {
  const source = window.NSSUR_TRACK_REFERENCE;
  if (!source || !Array.isArray(source.points) || source.points.length < 2) return [];
  return source.points;
}

function buildPage4DistanceMap(lap, gpsPoints, cacheKey) {
  if (page4LapDistanceCache.has(cacheKey)) return page4LapDistanceCache.get(cacheKey);
  const reference = page4ReferencePoints();
  if (!lap || reference.length < 2) return [];
  const originLat = reference[0][0] * Math.PI / 180;
  const metersPerLat = 111320;
  const metersPerLon = 111320 * Math.cos(originLat);
  const ref = reference.map(point => ({
    x: (point[1] - reference[0][1]) * metersPerLon,
    y: (point[0] - reference[0][0]) * metersPerLat,
    d: Number(point[2]) || 0
  }));
  const fixes = (gpsPoints || []).filter(point => point.time >= lap.startTime - 0.5 && point.time <= lap.endTime + 0.5);
  const map = [{ time: lap.startTime, distance: 0 }];
  let previousSegment = 0;
  let previousDistance = 0;
  fixes.forEach((point, pointIndex) => {
    const px = (point.lon - reference[0][1]) * metersPerLon;
    const py = (point.lat - reference[0][0]) * metersPerLat;
    const start = pointIndex < 2 ? 0 : Math.max(0, previousSegment - 5);
    const end = pointIndex < 2 ? Math.min(ref.length - 2, 35) : Math.min(ref.length - 2, previousSegment + 35);
    let best = null;
    for (let index = start; index <= end; index += 1) {
      const a = ref[index], b = ref[index + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const length2 = dx * dx + dy * dy;
      const ratio = length2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / length2)) : 0;
      const qx = a.x + dx * ratio, qy = a.y + dy * ratio;
      const error2 = (px - qx) ** 2 + (py - qy) ** 2;
      if (!best || error2 < best.error2) best = { segment: index, ratio, error2, distance: a.d + (b.d - a.d) * ratio };
    }
    if (!best) return;
    previousSegment = Math.max(previousSegment, best.segment);
    previousDistance = Math.max(previousDistance, Math.min(Number(window.NSSUR_TRACK_REFERENCE.totalDistanceMeters) || ref.at(-1).d, best.distance));
    map.push({ time: point.time, distance: previousDistance });
  });
  const total = Number(window.NSSUR_TRACK_REFERENCE.totalDistanceMeters) || ref.at(-1).d;
  map.push({ time: lap.endTime, distance: total });
  map.sort((a, b) => a.time - b.time);
  page4LapDistanceCache.set(cacheKey, map);
  return map;
}

function buildPage4LapDistanceMap(lapIndex = page4SelectedLapIndex) {
  return buildPage4DistanceMap(gpsLapResults[lapIndex], gpsLapPoints, `active:${lapIndex}`);
}

function buildPage4ItemDistanceMap(item) {
  return buildPage4DistanceMap(item?.lap, item?.session?.gpsPoints, `session:${item?.session?.id}:${item?.selection?.lapIndex}`);
}

function interpolatePage4DistanceMap(map, value, inputKey, outputKey) {
  if (!map.length) return Number(value) || 0;
  const target = Number(value) || 0;
  let low = 0, high = map.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (map[middle][inputKey] < target) low = middle + 1; else high = middle;
  }
  const right = map[low];
  const left = map[Math.max(0, low - 1)];
  if (!left || left === right || right[inputKey] === left[inputKey]) return right[outputKey];
  const ratio = Math.max(0, Math.min(1, (target - left[inputKey]) / (right[inputKey] - left[inputKey])));
  return left[outputKey] + (right[outputKey] - left[outputKey]) * ratio;
}

function interpolateLapDistanceMap(value, inputKey, outputKey, lapIndex = page4SelectedLapIndex) {
  const map = buildPage4LapDistanceMap(lapIndex);
  return interpolatePage4DistanceMap(map, value, inputKey, outputKey);
}

function page4AxisValue(time) { return page4AxisMode === 'distance' ? interpolateLapDistanceMap(time, 'time', 'distance') : Number(time); }
function page4TimeFromAxis(axis) { return page4AxisMode === 'distance' ? interpolateLapDistanceMap(axis, 'distance', 'time') : Number(axis); }

function gpsAxisLapIndex(targetTime = NaN) {
  if (gpsSelectedLapIndices.length) return gpsSelectedLapIndices[0];
  const found = gpsLapResults.findIndex(lap => targetTime >= lap.startTime && targetTime <= lap.endTime);
  return found >= 0 ? found : (gpsLapResults.length ? 0 : -1);
}

function gpsDistanceAtTime(targetTime, lapIndex = gpsAxisLapIndex(targetTime)) {
  const lap = gpsLapResults[lapIndex];
  if (!lap) return NaN;
  const absoluteTime = gpsSelectedLapIndices.length > 1
    ? lap.startTime + Math.max(0, Math.min(lap.duration, Number(targetTime) || 0))
    : Number(targetTime);
  return interpolateLapDistanceMap(absoluteTime, 'time', 'distance', lapIndex);
}

function drawGpsDistanceReference() {
  gpsDistanceReferenceLayer?.clearLayers();
  if (gpsAxisMode !== 'distance' || !gpsDistanceReferenceLayer) return;
  const points = page4ReferencePoints();
  const total = Number(window.NSSUR_TRACK_REFERENCE?.totalDistanceMeters) || points.at(-1)?.[2] || 0;
  const markers = [];
  for (let distance = 0; distance <= 800; distance += 100) markers.push(distance);
  markers.push(total);
  markers.forEach(distance => {
    let pointIndex = 0;
    points.forEach((item, index) => {
      if (Math.abs(item[2] - distance) < Math.abs(points[pointIndex][2] - distance)) pointIndex = index;
    });
    const point = points[pointIndex];
    if (!point) return;
    const previous = points[Math.max(0, pointIndex - 1)];
    const next = points[Math.min(points.length - 1, pointIndex + 1)];
    const meanLat = point[0] * Math.PI / 180;
    const dx = (next[1] - previous[1]) * 111320 * Math.cos(meanLat);
    const dy = (next[0] - previous[0]) * 111320;
    const length = Math.hypot(dx, dy) || 1;
    const halfWidth = 5;
    const offsetX = -dy / length * halfWidth;
    const offsetY = dx / length * halfWidth;
    const endpointA = [point[0] + offsetY / 111320, point[1] + offsetX / (111320 * Math.cos(meanLat))];
    const endpointB = [point[0] - offsetY / 111320, point[1] - offsetX / (111320 * Math.cos(meanLat))];
    L.polyline([endpointA, endpointB], { color: '#22d3ee', weight: 3, opacity: 0.95, interactive: false }).addTo(gpsDistanceReferenceLayer);
    L.circleMarker([point[0], point[1]], { radius: 4, color: '#fff', weight: 2, fillColor: '#f97316', fillOpacity: 1, interactive: false }).addTo(gpsDistanceReferenceLayer);
    L.marker([point[0], point[1]], {
      interactive: false,
      zIndexOffset: 8000,
      icon: L.divIcon({ className: 'gps-distance-marker-wrap', html: `<span class="gps-distance-marker">${distance === total ? `${total.toFixed(1)}m` : `${distance}m`}</span>`, iconSize: [44, 18], iconAnchor: [22, 25] })
    }).addTo(gpsDistanceReferenceLayer);
  });
}

function updateGpsDistancePosition(targetTime) {
  if (!gpsDistancePosition) return;
  const distance = gpsDistanceAtTime(targetTime);
  gpsDistancePosition.hidden = gpsAxisMode !== 'distance' || !Number.isFinite(distance);
  const value = gpsDistancePosition.querySelector('strong');
  if (value && Number.isFinite(distance)) value.textContent = distance.toFixed(1);
}

const PAGE4_CHART_SPECS = [
  { id: 'p4-chart-speed', min: 0, series: [
    ['GPS', '#06b6d4', r => Number(r.gps_speed_kmh) || 0],
    ['FL', '#f97316', r => Number(r.fl_speed_kmh) || 0],
    ['RL', '#2563eb', r => Number(r.rl_speed_kmh) || 0],
    ['RR', '#16a34a', r => Number(r.rr_speed_kmh) || 0]
  ]},
  { id: 'p4-chart-rpm-tps', min: 0, series: [
    ['RPM', '#dc2626', r => Number(r.rpm) || 0, 'y'],
    ['TPS', '#16a34a', r => Number(r.decoded_tps) || 0, 'y2']
  ], second: [0, 100]},
  { id: 'p4-chart-gear', min: 0, max: 6, stepped: true, series: [['Gear', '#7c3aed', r => Number(r.gear) || 0]] },
  { id: 'p4-chart-pedals', min: 0, max: 100, series: [
    ['TPS', '#16a34a', r => Number(r.decoded_tps) || 0],
    ['Brake', '#ef4444', r => getCalibratedBrake(r.front_brake_raw)]
  ]},
  { id: 'p4-chart-steering-yaw', min: -180, max: 180, series: [
    ['Steering', '#db2777', r => getCalibratedSteering(r.steering_raw), 'y', [], 'steering'],
    ['Yaw Rate', '#22c55e', r => Number(r.imu_gyro_z_dps) || 0, 'y2', [7, 4], 'imu_gz']
  ], second: [-100, 100]},
  { id: 'p4-chart-imu', min: -2.5, max: 2.5, series: [
    ['Longitudinal G', '#f97316', r => Number(r.imu_accel_x_g) || 0, 'y', [], 'imu_ax'],
    ['Lateral G', '#2563eb', r => Number(r.imu_accel_y_g) || 0, 'y', [], 'imu_ay']
  ]},
  { id: 'p4-chart-temp', min: 0, max: 130, series: [
    ['Coolant', '#2563eb', r => Number(r.water_c) || 0],
    ['Oil', '#f97316', r => Number(r.oil_c) || 0]
  ]}
];

const PAGE4_FILTER_FIELDS = [
  ['steering_filtered_deg', row => getCalibratedSteering(row.steering_raw)],
  ['imu_filtered_ax_g', row => Number(row.imu_accel_x_g) || 0],
  ['imu_filtered_ay_g', row => Number(row.imu_accel_y_g) || 0],
  ['imu_filtered_gz_dps', row => Number(row.imu_gyro_z_dps) || 0]
];

// Page 4 always compares the same 5 Hz-filtered signals, independently of
// which CSV is currently active in the other pages.
function applyPage4FiveHzFilter(rows) {
  if (!rows?.length || typeof fltButterworth !== 'function') return;
  page4SeriesCache.clear();
  const firstTime = Number(rows[0]?.time_sec);
  const lastTime = Number(rows[rows.length - 1]?.time_sec);
  const span = lastTime - firstTime;
  const rate = span > 0 ? Math.max(1, (rows.length - 1) / span) : 100;
  PAGE4_FILTER_FIELDS.forEach(([field, getter]) => {
    // Comparison page may already have produced the same 5 Hz channel.
    if (Number.isFinite(Number(rows[0]?.[field])) && Number.isFinite(Number(rows.at(-1)?.[field]))) return;
    const raw = Float64Array.from(rows, getter);
    const filtered = fltButterworth(raw, 5, rate, 2);
    rows.forEach((row, index) => { row[field] = filtered[index]; });
  });
}

function page4SeriesValue(series, row, globalIndex) {
  const channelKey = series[5];
  const filteredField = {
    steering: 'steering_filtered_deg',
    imu_ax: 'imu_filtered_ax_g',
    imu_ay: 'imu_filtered_ay_g',
    imu_gz: 'imu_filtered_gz_dps'
  }[channelKey];
  const storedFiltered = filteredField ? Number(row?.[filteredField]) : NaN;
  if (Number.isFinite(storedFiltered)) return storedFiltered;
  if (channelKey && typeof channelValueAt === 'function' && Number.isInteger(globalIndex)) {
    const filtered = channelValueAt(channelKey, globalIndex);
    if (Number.isFinite(filtered)) return filtered;
  }
  return series[2](row);
}

function page4SelectedItems() {
  return page4SelectedSessionLaps.map((selection, selectionIndex) => {
    const session = page4SessionStore.find(item => item.id === selection.sessionId);
    const lap = session?.laps?.[selection.lapIndex];
    return session && lap ? { session, lap, selection, selectionIndex } : null;
  }).filter(Boolean);
}

function page4AlignedSeries(item, series, primaryLap, startTime, endTime) {
  const cacheKey = `${page4AxisMode}:${item.session.id}:${item.selection.lapIndex}:${primaryLap.startTime}:${series[0]}`;
  let points = page4SeriesCache.get(cacheKey);
  if (!points) {
    const rows = item.session.rows || [];
    const itemDistanceMap = buildPage4ItemDistanceMap(item);
    points = [];
    for (let index = page4RowIndexAtTime(rows, item.lap.startTime); index < rows.length; index += 1) {
      const row = rows[index];
      const time = Number(row?.time_sec);
      if (!Number.isFinite(time)) continue;
      if (time > item.lap.endTime) break;
      const x = page4AxisMode === 'distance'
        ? interpolatePage4DistanceMap(itemDistanceMap, time, 'time', 'distance')
        : primaryLap.startTime + (time - item.lap.startTime);
      const globalIndex = item.session.id === page4ActiveSessionId ? index : undefined;
      points.push({ x, y: page4SeriesValue(series, row, globalIndex) });
    }
    page4SeriesCache.set(cacheKey, points);
  }
  const visible = sliceVisiblePointSeries(points, page4AxisValue(startTime), page4AxisValue(endTime));
  // 20 seconds or less keeps every original source sample. Wider views retain
  // the first/min/max/last envelope in each horizontal bucket.
  const pointLimit = endTime - startTime <= 20 ? visible.length : 2200;
  return downsampleEnvelopePoints(visible, pointLimit);
}

function page4ChartDatasets(spec, startTime = page4ViewStart, endTime = page4ViewEnd) {
  const items = page4SelectedItems();
  const primary = items[0];
  if (!primary) return [];
  const useSeriesColors = items.length === 1;
  return items.flatMap(item => spec.series.map((series, seriesIndex) => {
    const label = `${item.session.driver} · L${item.lap.number} ${series[0]}`;
    return {
      label,
      data: page4AlignedSeries(item, series, primary.lap, startTime, endTime),
      // 한 랩만 볼 때는 한 패널 안의 신호를 고유 색상으로 구분한다.
      // 여러 랩 비교에서는 기존처럼 각 랩의 색을 모든 신호에 유지한다.
      borderColor: useSeriesColors ? series[1] : PAGE4_LAP_COLORS[item.selectionIndex],
      borderWidth: item.selectionIndex === 0 ? 1.45 : 1.3,
      borderDash: series[4]?.length ? series[4] : (seriesIndex === 0 ? [] : [7, 3 + seriesIndex]),
      pointRadius: 0,
      // Keep out-of-range peaks strictly inside this strip's plot area so a
      // signal can never cover the header or appear to enter an adjacent chart.
      clip: { left: 0, right: 0, top: 0, bottom: 0 },
      stepped: spec.stepped ? 'before' : false,
      fill: false,
      hidden: page4HiddenSeries.has(label),
      yAxisID: series[3] || 'y',
      page4SelectionIndex: item.selectionIndex,
      page4SeriesIndex: seriesIndex
    };
  }));
}

function syncPage4SeriesToggles(chart) {
  const header = chart?.canvas?.parentElement?.querySelector('header');
  if (!header) return;
  header.querySelector('.p4-series-toggles')?.remove();
  header.querySelector('.p4-series-menu-button')?.remove();
  header.querySelector('.p4-series-menu')?.remove();
  if (!chart.data.datasets.length) return;

  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'p4-series-menu-button';
  menuButton.setAttribute('aria-label', '표시할 그래프 선택');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.title = '표시할 그래프 선택';
  menuButton.innerHTML = '<span></span><span></span><span></span>';

  const toggles = document.createElement('div');
  toggles.className = 'p4-series-menu';
  toggles.hidden = true;
  chart.data.datasets.forEach((dataset, datasetIndex) => {
    const button = document.createElement('button');
    button.type = 'button';
    const visible = !page4HiddenSeries.has(dataset.label);
    chart.setDatasetVisibility(datasetIndex, visible);
    button.className = visible ? 'active' : '';
    const dashed = Array.isArray(dataset.borderDash) && dataset.borderDash.length > 0;
    button.innerHTML = `<i class="${dashed ? 'dashed' : ''}" style="--series-color:${dataset.borderColor}"></i>${escapePage4SessionHtml(dataset.label)}`;
    button.addEventListener('click', () => {
      const isVisible = chart.isDatasetVisible(datasetIndex);
      chart.setDatasetVisibility(datasetIndex, !isVisible);
      if (isVisible) page4HiddenSeries.add(dataset.label); else page4HiddenSeries.delete(dataset.label);
      button.classList.toggle('active', !isVisible);
      chart.update('none');
      drawCssIntersectionDots(currentCursorIndex, page4Charts, page4CursorTime);
    });
    toggles.appendChild(button);
  });
  menuButton.addEventListener('click', event => {
    event.stopPropagation();
    document.querySelectorAll('.p4-series-menu:not([hidden])').forEach(openMenu => {
      if (openMenu !== toggles) openMenu.hidden = true;
    });
    toggles.hidden = !toggles.hidden;
    menuButton.setAttribute('aria-expanded', String(!toggles.hidden));
  });
  toggles.addEventListener('click', event => event.stopPropagation());
  header.append(menuButton, toggles);
}

document.addEventListener('click', () => {
  document.querySelectorAll('.p4-series-menu:not([hidden])').forEach(menu => {
    menu.hidden = true;
    menu.parentElement?.querySelector('.p4-series-menu-button')?.setAttribute('aria-expanded', 'false');
  });
});

function buildPage4WorkspaceCharts(S, makeCommonOptions) {
  page4Charts.forEach(chart => chart?.destroy());
  page4Charts = PAGE4_CHART_SPECS.map((spec, chartIndex) => {
    const canvas = document.getElementById(spec.id);
    if (!canvas) return null;
    const options = makeCommonOptions(spec.min, spec.max);
    options.plugins.legend = { display: false };
    options.scales.x.ticks.display = chartIndex === PAGE4_CHART_SPECS.length - 1;
    options.scales.y.ticks.maxTicksLimit = chartIndex === 2 ? 3 : (chartIndex === 6 ? 4 : 6);
    options.scales.y.ticks.font = { family: 'JetBrains Mono', size: 8 };
    options.scales.y.ticks.padding = 2;
    options.scales.y.afterFit = axis => { axis.width = 40; };
    if (chartIndex === 1) options.scales.y.ticks.callback = value => value === 0 ? '0' : `${Number(value) / 1000}k`;
    if (spec.second) {
      options.scales.y2 = { position: 'right', min: spec.second[0], max: spec.second[1], display: true, grid: { display: false }, ticks: { color: '#64748b', padding: 2, maxTicksLimit: 5, font: { family: 'JetBrains Mono', size: 8 } }, afterFit(axis) { axis.width = 34; } };
    } else {
      // Reserve the same space as a right-side axis so every chart has an
      // identical plot width and the synchronized cursor stays vertical.
      options.layout.padding.right = 34;
    }
    const chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { datasets: page4ChartDatasets(spec, page4RangeStart, page4RangeEnd) },
      options
    });
    const scrub = event => {
      const area = chart.chartArea;
      const xScale = chart.scales?.x;
      if (!area || !xScale) return;
      const rect = canvas.getBoundingClientRect();
      const rawX = event.clientX - rect.left;
      const x = Math.max(area.left, Math.min(area.right, rawX));
      const previousTime = page4CursorTime;
      const targetTime = page4TimeFromAxis(xScale.getValueForPixel(x));
      setPage4Playback(false);
      keepPage4CursorInView(targetTime, rawX >= area.right ? 1 : (rawX <= area.left ? -1 : Math.sign(targetTime - previousTime)));
      updatePage4PlaybackCursor(targetTime);
    };
    let edgePanFrame = 0;
    let edgePanDirection = 0;
    let edgePanStrength = 0;
    let edgePanLastStamp = 0;
    const stopEdgePan = () => {
      edgePanDirection = 0;
      edgePanStrength = 0;
      edgePanLastStamp = 0;
      if (edgePanFrame) cancelAnimationFrame(edgePanFrame);
      edgePanFrame = 0;
    };
    const edgePanTick = stamp => {
      if (page4PointerDragging !== canvas || !edgePanDirection) { stopEdgePan(); return; }
      if (edgePanLastStamp) {
        const elapsed = Math.min(0.05, (stamp - edgePanLastStamp) / 1000);
        const axisStart = page4AxisValue(page4ViewStart), axisEnd = page4AxisValue(page4ViewEnd);
        const speed = (axisEnd - axisStart) * (0.18 + edgePanStrength * 0.82);
        const targetAxis = page4AxisValue(page4CursorTime) + edgePanDirection * speed * elapsed;
        const targetTime = Math.max(page4RangeStart, Math.min(page4RangeEnd, page4TimeFromAxis(targetAxis)));
        keepPage4CursorInView(targetTime, edgePanDirection);
        updatePage4PlaybackCursor(targetTime);
        if (targetTime === page4RangeStart || targetTime === page4RangeEnd) { stopEdgePan(); return; }
      }
      edgePanLastStamp = stamp;
      edgePanFrame = requestAnimationFrame(edgePanTick);
    };
    const updateEdgePan = event => {
      const area = chart.chartArea;
      if (!area || page4PointerDragging !== canvas) { stopEdgePan(); return; }
      const rect = canvas.getBoundingClientRect();
      const rawX = event.clientX - rect.left;
      const overflow = rawX < area.left ? rawX - area.left : (rawX > area.right ? rawX - area.right : 0);
      if (!overflow) { stopEdgePan(); return; }
      edgePanDirection = Math.sign(overflow);
      edgePanStrength = Math.min(1, Math.abs(overflow) / Math.max(1, area.right - area.left));
      if (!edgePanFrame) edgePanFrame = requestAnimationFrame(edgePanTick);
    };
    const previousScrub = canvas._page4ScrubHandlers;
    if (previousScrub) {
      previousScrub.stopEdgePan?.();
      canvas.removeEventListener('pointerdown', previousScrub.down);
      canvas.removeEventListener('pointermove', previousScrub.move);
      canvas.removeEventListener('pointerup', previousScrub.stop);
      canvas.removeEventListener('pointercancel', previousScrub.stop);
    }
    const down = event => {
      page4PointerDragging = canvas;
      canvas.setPointerCapture?.(event.pointerId);
      scrub(event);
      updateEdgePan(event);
    };
    const move = event => {
      if (page4PointerDragging !== canvas) return;
      scrub(event);
      updateEdgePan(event);
    };
    const stopScrub = event => {
      if (page4PointerDragging === canvas) page4PointerDragging = null;
      stopEdgePan();
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', stopScrub);
    canvas.addEventListener('pointercancel', stopScrub);
    canvas._page4ScrubHandlers = { down, move, stop: stopScrub, stopEdgePan };
    syncPage4SeriesToggles(chart);
    return chart;
  }).filter(Boolean);
  refreshPage4Selectors();
}

let cachedPage4LapIndex = -1;
let cachedPage4BoundariesList = [];

function invalidatePage4BoundariesCache() {
  cachedPage4LapIndex = -1;
  cachedPage4BoundariesList = [];
}

function page4LapBoundaries(lapIndex) {
  if (lapIndex === cachedPage4LapIndex && cachedPage4BoundariesList.length > 0) {
    return cachedPage4BoundariesList;
  }
  const lap = gpsLapResults[lapIndex];
  if (!lap) return [];
  const boundaries = [{ label: 'START', time: lap.startTime }];
  gpsCheckpoints.forEach((checkpoint, index) => {
    const crossings = findGpsLineCrossings(checkpoint, 0.1);
    const crossing = crossings.find(item => item.time > lap.startTime + 0.02 && item.time < lap.endTime - 0.02);
    if (crossing) boundaries.push({ label: `CP${index + 1}`, time: crossing.time });
  });
  boundaries.sort((a, b) => a.time - b.time);
  boundaries.push({ label: 'FINISH', time: lap.endTime });
  cachedPage4LapIndex = lapIndex;
  cachedPage4BoundariesList = boundaries;
  return boundaries;
}

function refreshPage4Selectors() {
  invalidatePage4BoundariesCache();
  page4LapDistanceCache.clear();
  page4SeriesCache.clear();
  if (!p4LapSelect) return;
  const previous = Number(p4LapSelect.value);
  p4LapSelect.innerHTML = gpsLapResults.length
    ? gpsLapResults.map((lap, index) => `<option value="${index}">LAP ${lap.number} · ${formatLapTime(lap.duration)}</option>`).join('')
    : '<option value="">GPS 페이지에서 피니시라인을 설정하세요</option>';
  page4SelectedLapIndex = gpsLapResults.length ? (Number.isInteger(previous) && gpsLapResults[previous] ? previous : 0) : -1;
  if (page4SelectedLapIndex >= 0) p4LapSelect.value = String(page4SelectedLapIndex);
  refreshPage4SectorOptions();
}

function escapePage4SessionHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function setPage4SessionDrawer(open) {
  const workspace = document.getElementById('page-temperature');
  workspace?.classList.toggle('p4-session-drawer-open', open);
  p4SessionDrawer?.setAttribute('aria-hidden', String(!open));
  p4SessionDrawerToggle?.setAttribute('aria-expanded', String(open));
  if (p4SessionDrawerShade) p4SessionDrawerShade.hidden = !open;
}

function page4BestLapIndex(session) {
  if (!session?.laps?.length) return -1;
  return session.laps.reduce((best, lap, index, laps) => lap.duration < laps[best].duration ? index : best, 0);
}

function syncPage4SelectionToComparison() {
  const selections = page4SelectedSessionLaps.map(selection => {
    const session = page4SessionStore.find(item => item.id === selection.sessionId);
    return session ? { sourceKey: session.sourceKey, lapIndex: selection.lapIndex } : null;
  }).filter(Boolean);
  window.setComparisonSelectionFromPage4?.(selections);
}

function renderPage4SessionDrawer() {
  if (!p4SessionList) return;
  if (!page4SessionStore.length) {
    p4SessionList.innerHTML = '<p>아직 추가된 세션이 없습니다.</p>';
    return;
  }
  p4SessionList.innerHTML = page4SessionStore.map(session => `
    <section class="p4-session-card ${page4SelectedSessionLaps.some(item => item.sessionId === session.id) ? 'active' : ''}" data-p4-session="${session.id}">
      <div class="p4-session-card-head">
        <input type="text" value="${escapePage4SessionHtml(session.driver)}" data-p4-session-driver="${session.id}" aria-label="드라이버 이름">
        <button class="p4-session-card-remove" type="button" data-p4-session-remove="${session.id}" aria-label="${escapePage4SessionHtml(session.driver)} 세션 제거" title="이 세션 제거">×</button>
      </div>
      <small title="${escapePage4SessionHtml(session.fileName)}">${escapePage4SessionHtml(session.fileName)} · ${session.laps.length}개 완성 랩</small>
      <div class="p4-session-laps">${session.laps.map((lap, lapIndex) => {
        const selectedIndex = page4SelectedSessionLaps.findIndex(item => item.sessionId === session.id && item.lapIndex === lapIndex);
        const selected = selectedIndex >= 0;
        return `<button type="button" class="p4-session-lap ${selected ? 'active' : ''}" style="--lap-color:${selected ? PAGE4_LAP_COLORS[selectedIndex] : '#f97316'}" data-p4-session-lap="${session.id}:${lapIndex}"><i></i>L${lap.number} ${formatLapTime(lap.duration)}</button>`;
      }).join('')}</div>
    </section>
  `).join('');
}

function registerPage4Session(snapshot, makeActive = true) {
  const file = snapshot?.file;
  if (!file || !snapshot?.laps?.length) return null;
  const sourceKey = `${file.name}:${file.size || 0}:${file.lastModified || 0}`;
  let session = page4SessionStore.find(item => item.sourceKey === sourceKey);
  if (!session) {
    session = { id: ++page4SessionSerial, sourceKey, fileName: file.name, driver: file.name.replace(/\.csv$/i, '') };
    page4SessionStore.push(session);
  }
  session.rows = snapshot.rows;
  applyPage4FiveHzFilter(session.rows);
  session.gpsPoints = (snapshot.gpsPoints || []).map(point => ({ ...point }));
  session.laps = (snapshot.laps || []).map(lap => ({ ...lap }));
  session.checkpoints = (snapshot.checkpoints || []).map(line => line.map(point => ({ ...point })));
  if (makeActive) {
    const bestLapIndex = page4BestLapIndex(session);
    page4ActiveSessionId = session.id;
    page4SelectedLapIndex = bestLapIndex;
    page4SelectedSessionLaps = bestLapIndex >= 0 ? [{ sessionId: session.id, lapIndex: bestLapIndex }] : [];
    refreshPage4Selectors();
    page4SelectedLapIndex = bestLapIndex;
    if (bestLapIndex >= 0 && p4LapSelect) {
      p4LapSelect.value = String(bestLapIndex);
      refreshPage4SectorOptions();
    }
  }
  renderPage4SessionDrawer();
  return session;
}

function activatePage4SessionLap(sessionId, lapIndex) {
  const session = page4SessionStore.find(item => item.id === sessionId);
  if (!session || !session.laps[lapIndex]) return;
  setPage4Playback(false);
  if (page4ActiveSessionId !== sessionId) {
    globalData = session.rows;
    if (loadedFileBadge) {
      loadedFileBadge.textContent = `📄 ${session.fileName}`;
      loadedFileBadge.style.display = 'inline-block';
    }
    initDataAndDashboard();
    gpsLapPoints = session.gpsPoints.map(point => ({ ...point }));
    gpsLapResults = session.laps.map(lap => ({ ...lap }));
    gpsCheckpoints = session.checkpoints.map(line => line.map(point => ({ ...point })));
  }
  page4ActiveSessionId = sessionId;
  page4SelectedLapIndex = lapIndex;
  page4SelectedSessionLaps = [{ sessionId, lapIndex }, ...page4SelectedSessionLaps.filter(item => item.sessionId !== sessionId || item.lapIndex !== lapIndex)].slice(0, 2);
  refreshPage4Selectors();
  page4SelectedLapIndex = lapIndex;
  if (p4LapSelect) p4LapSelect.value = String(lapIndex);
  refreshPage4SectorOptions();
  renderPage4SessionDrawer();
}

function importPage4SessionFile(file) {
  return new Promise((resolve, reject) => {
    handleFile(file, {
      skipUpload: true,
      onComplete: snapshot => {
        const session = registerPage4Session(snapshot, true);
        window.registerComparisonSession?.(snapshot, true);
        session ? resolve(session) : reject(new Error(`${file.name}: 완성 랩이 없습니다.`));
      },
      onError: reject
    });
  });
}

window.registerPage4ComparisonSession = snapshot => {
  const session = registerPage4Session(snapshot, false);
  if (!session || page4SelectedSessionLaps.some(item => item.sessionId === session.id) || page4SelectedSessionLaps.length >= 2) return session;
  const bestLapIndex = page4BestLapIndex(session);
  if (bestLapIndex >= 0) {
    page4SelectedSessionLaps.push({ sessionId: session.id, lapIndex: bestLapIndex });
    renderPage4SessionDrawer();
    applyPage4Selection();
  }
  return session;
};
window.setPage4ComparisonSelection = selections => {
  const mapped = (selections || []).map(selection => {
    const session = page4SessionStore.find(item => item.sourceKey === selection.sourceKey);
    return session?.laps?.[selection.lapIndex] ? { sessionId: session.id, lapIndex: selection.lapIndex } : null;
  }).filter(Boolean).slice(0, 2);
  if (!mapped.length) return;
  const primary = mapped[0];
  if (page4ActiveSessionId !== primary.sessionId) activatePage4SessionLap(primary.sessionId, primary.lapIndex);
  page4ActiveSessionId = primary.sessionId;
  page4SelectedLapIndex = primary.lapIndex;
  page4SelectedSessionLaps = mapped;
  if (p4LapSelect) p4LapSelect.value = String(primary.lapIndex);
  refreshPage4SectorOptions();
  renderPage4SessionDrawer();
};
window.setPrimaryPage4Session = snapshot => {
  const file = snapshot?.file;
  if (!file) return;
  const sourceKey = `${file.name}:${file.size || 0}:${file.lastModified || 0}`;
  // 헤더의 `CSV 열기`는 현재 작업의 기준 CSV를 교체하는 동작이다.
  // 페이지 4에서 별도로 추가했던 비교 세션과 선택 상태까지 모두 비워야
  // 이전 파일의 랩이 새 기준 파일 왼쪽 목록에 남지 않는다.
  setPage4Playback(false);
  page4SessionStore.splice(0, page4SessionStore.length);
  page4SelectedSessionLaps = [];
  page4ActiveSessionId = null;
  page4SelectedLapIndex = -1;
  page4LapDistanceCache.clear();
  page4SeriesCache.clear();
  invalidatePage4BoundariesCache();
  page4PrimarySourceKey = sourceKey;
  registerPage4Session(snapshot, true);
};

function refreshPage4SectorOptions() {
  if (!p4SectorStart || !p4SectorEnd) return;
  const boundaries = page4LapBoundaries(page4SelectedLapIndex);
  const options = boundaries.map((point, index) => `<option value="${index}">${point.label}</option>`).join('');
  p4SectorStart.innerHTML = options;
  p4SectorEnd.innerHTML = options;
  if (boundaries.length) p4SectorEnd.value = String(boundaries.length - 1);
  applyPage4Selection();
}

function applyPage4Selection() {
  // 비교 목록의 첫 번째 랩이 차트 정렬 기준이다. 다른 페이지에서 랩을
  // 선택한 뒤 돌아왔을 때 우측 셀렉트가 이전 값을 유지하면 범례만 바뀌고
  // 데이터는 현재 X축 밖에 놓이므로, 활성 세션의 기준 랩을 먼저 동기화한다.
  const primarySelection = page4SelectedSessionLaps[0];
  if (primarySelection && primarySelection.sessionId === page4ActiveSessionId
      && gpsLapResults[primarySelection.lapIndex]
      && page4SelectedLapIndex !== primarySelection.lapIndex) {
    page4SelectedLapIndex = primarySelection.lapIndex;
    if (p4LapSelect) p4LapSelect.value = String(page4SelectedLapIndex);
    invalidatePage4BoundariesCache();
    page4LapDistanceCache.clear();
    page4SeriesCache.clear();
  }
  const boundaries = page4LapBoundaries(page4SelectedLapIndex);
  if (!boundaries.length || !page4Charts.length) return;
  const lap = gpsLapResults[page4SelectedLapIndex];
  let startIndex = Number(p4SectorStart?.value) || 0;
  let endIndex = Number(p4SectorEnd?.value);
  if (!Number.isInteger(endIndex) || endIndex >= boundaries.length) endIndex = boundaries.length - 1;
  if (startIndex >= boundaries.length) startIndex = 0;
  if (endIndex <= startIndex) {
    endIndex = Math.min(boundaries.length - 1, startIndex + 1);
    if (endIndex <= startIndex) startIndex = Math.max(0, endIndex - 1);
    if (p4SectorStart) p4SectorStart.value = String(startIndex);
    if (p4SectorEnd) p4SectorEnd.value = String(endIndex);
  }
  if (p4SectorStart) p4SectorStart.blur();
  if (p4SectorEnd) p4SectorEnd.blur();
  if (p4LapSelect) p4LapSelect.blur();

  const rawStart = boundaries[startIndex]?.time;
  const rawEnd = boundaries[endIndex]?.time;
  const startTime = Number.isFinite(rawStart) ? rawStart : (lap ? lap.startTime : 0);
  const endTime = Number.isFinite(rawEnd) ? rawEnd : (lap ? lap.endTime : startTime + 1);

  setPage4Playback(false);
  page4RangeStart = startTime;
  page4RangeEnd = Math.max(startTime + 0.05, endTime);
  page4ViewStart = startTime;
  page4ViewEnd = page4RangeEnd;
  refreshPage4VisibleRange(startTime, page4RangeEnd, true);
  const startLabel = boundaries[startIndex]?.label || 'START';
  const endLabel = boundaries[endIndex]?.label || 'FINISH';
  const axisSpan = page4AxisValue(page4RangeEnd) - page4AxisValue(page4RangeStart);
  if (p4SectorStatus) p4SectorStatus.textContent = page4AxisMode === 'distance'
    ? `${startLabel} → ${endLabel} · ${axisSpan.toFixed(1)}m`
    : `${startLabel} → ${endLabel} · ${(page4RangeEnd - page4RangeStart).toFixed(3)}초`;
  if (p4PlayTimeline) { p4PlayTimeline.min = String(page4RangeStart); p4PlayTimeline.max = String(page4RangeEnd); p4PlayTimeline.step = '0.01'; }
  updatePage4PlaybackCursor(page4RangeStart);
  drawPage4GTrace();
}

function page4RowIndexAtTime(rows, targetTime) {
  if (!rows?.length) return -1;
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (Number(rows[mid]?.time_sec) < targetTime) lo = mid + 1; else hi = mid;
  }
  if (lo <= 0) return 0;
  if (lo >= rows.length) return rows.length - 1;
  return Math.abs(Number(rows[lo]?.time_sec) - targetTime) < Math.abs(Number(rows[lo - 1]?.time_sec) - targetTime) ? lo : lo - 1;
}

function page4AlignedItemTime(item, primaryLap, primaryTime = page4CursorTime) {
  if (page4AxisMode === 'distance') {
    const distance = page4AxisValue(primaryTime);
    return Math.max(item.lap.startTime, Math.min(item.lap.endTime,
      interpolatePage4DistanceMap(buildPage4ItemDistanceMap(item), distance, 'distance', 'time')));
  }
  const elapsed = Math.max(0, Number(primaryTime) - primaryLap.startTime);
  return Math.max(item.lap.startTime, Math.min(item.lap.endTime, item.lap.startTime + elapsed));
}

function page4ItemRange(item, primary) {
  const primaryStart = page4RangeEnd > page4RangeStart ? page4RangeStart : primary.lap.startTime;
  const primaryEnd = page4RangeEnd > page4RangeStart ? page4RangeEnd : primary.lap.endTime;
  if (item === primary) return { start: primaryStart, end: primaryEnd, duration: Math.max(0, primaryEnd - primaryStart) };
  let start;
  let end;
  if (page4AxisMode === 'distance') {
    const distanceMap = buildPage4ItemDistanceMap(item);
    start = interpolatePage4DistanceMap(distanceMap, page4AxisValue(primaryStart), 'distance', 'time');
    end = interpolatePage4DistanceMap(distanceMap, page4AxisValue(primaryEnd), 'distance', 'time');
  } else {
    start = item.lap.startTime + (primaryStart - primary.lap.startTime);
    end = item.lap.startTime + (primaryEnd - primary.lap.startTime);
  }
  start = Math.max(item.lap.startTime, Math.min(item.lap.endTime, start));
  end = Math.max(item.lap.startTime, Math.min(item.lap.endTime, end));
  if (end < start) [start, end] = [end, start];
  return { start, end, duration: Math.max(0, end - start) };
}

function page4ItemDisplayTime(item, primary, primaryTime = page4CursorTime) {
  if (Number.isFinite(page4PlaybackElapsed) && page4SelectedItems().length > 1) {
    const range = page4ItemRange(item, primary);
    return Math.min(range.end, range.start + Math.max(0, page4PlaybackElapsed));
  }
  return page4AlignedItemTime(item, primary.lap, primaryTime);
}

function page4ItemAxisValue(item, itemTime, primary) {
  if (page4AxisMode === 'distance') {
    return interpolatePage4DistanceMap(buildPage4ItemDistanceMap(item), itemTime, 'time', 'distance');
  }
  return primary.lap.startTime + (itemTime - item.lap.startTime);
}

let page4GTraceCache = null;

function drawPage4GTrace(targetTime = page4CursorTime) {
  if (!p4GTrace) return;
  const items = page4SelectedItems();
  const primary = items[0];
  if (!primary) return;
  const rect = p4GTrace.getBoundingClientRect();
  const size = Math.max(1, Math.min(rect.width || 218, rect.height || 218));
  const pixelRatio = window.devicePixelRatio || 1;
  p4GTrace.width = Math.round(size * pixelRatio);
  p4GTrace.height = Math.round(size * pixelRatio);
  const ctx = p4GTrace.getContext('2d');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const mapGPoint = (gx, gy) => ({ x: size * (0.5 - Math.max(-2, Math.min(2, gy)) * 0.22), y: size * (0.5 - Math.max(-2, Math.min(2, gx)) * 0.22) });
  const validRange = page4RangeEnd > page4RangeStart;
  const primaryRangeStart = validRange ? page4RangeStart : primary.lap.startTime;
  const primaryRangeEnd = validRange ? page4RangeEnd : primary.lap.endTime;
  const traceRanges = items.map(item => {
    const alignedStart = page4AlignedItemTime(item, primary.lap, primaryRangeStart);
    const alignedEnd = page4AlignedItemTime(item, primary.lap, primaryRangeEnd);
    return {
      item,
      start: Math.max(item.lap.startTime, Math.min(alignedStart, alignedEnd)),
      end: Math.min(item.lap.endTime, Math.max(alignedStart, alignedEnd))
    };
  });
  const cacheKey = `${Math.round(size * pixelRatio)}:${page4AxisMode}:${traceRanges.map(({ item, start, end }) => `${item.session.id}:${item.selection.lapIndex}:${start.toFixed(3)}-${end.toFixed(3)}`).join('|')}`;
  if (!page4GTraceCache || page4GTraceCache.key !== cacheKey) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(size * pixelRatio);
    canvas.height = Math.round(size * pixelRatio);
    const traceContext = canvas.getContext('2d');
    traceContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    traceRanges.forEach(({ item, start, end }) => {
      const rows = item.session.rows || [];
      const first = page4RowIndexAtTime(rows, start);
      const last = page4RowIndexAtTime(rows, end);
      const points = [];
      let previousTime = -Infinity;
      for (let index = first; index <= last; index += 1) {
        const time = Number(rows[index]?.time_sec);
        if (!Number.isFinite(time) || time - previousTime < 0.015) continue;
        const gx = page4SeriesValue(PAGE4_CHART_SPECS[5].series[0], rows[index], item.session.id === page4ActiveSessionId ? index : undefined);
        const gy = page4SeriesValue(PAGE4_CHART_SPECS[5].series[1], rows[index], item.session.id === page4ActiveSessionId ? index : undefined);
        if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
        points.push(mapGPoint(gx, gy));
        previousTime = time;
      }
      if (!points.length) return;
      const color = items.length > 1 ? PAGE4_LAP_COLORS[item.selectionIndex] : '#f97316';
      traceContext.beginPath();
      points.forEach((point, index) => index ? traceContext.lineTo(point.x, point.y) : traceContext.moveTo(point.x, point.y));
      traceContext.strokeStyle = `${color}70`;
      traceContext.lineWidth = 1.25;
      traceContext.stroke();
      traceContext.fillStyle = `${color}55`;
      points.forEach(point => { traceContext.beginPath(); traceContext.arc(point.x, point.y, 1.05, 0, Math.PI * 2); traceContext.fill(); });
    });
    page4GTraceCache = { key: cacheKey, canvas };
  }
  ctx.drawImage(page4GTraceCache.canvas, 0, 0, size, size);
  items.forEach(item => {
    if (items.length === 1) return;
    const rows = item.session.rows || [];
    const color = PAGE4_LAP_COLORS[item.selectionIndex];
    const itemTime = page4ItemDisplayTime(item, primary, targetTime);
    const rowIndex = page4RowIndexAtTime(rows, itemTime);
    const row = rows[rowIndex];
    if (!row) return;
    const gx = page4SeriesValue(PAGE4_CHART_SPECS[5].series[0], row, item.session.id === page4ActiveSessionId ? rowIndex : undefined);
    const gy = page4SeriesValue(PAGE4_CHART_SPECS[5].series[1], row, item.session.id === page4ActiveSessionId ? rowIndex : undefined);
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) return;
    const point = mapGPoint(gx, gy);
    ctx.beginPath(); ctx.arc(point.x, point.y, 5.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  });
  if (p4GDot) p4GDot.style.display = items.length > 1 ? 'none' : '';
}

function page4GpsPositionAtTime(points, lap, targetTime) {
  const source = (points || []).filter(point => point.time >= lap.startTime - 0.5 && point.time <= lap.endTime + 0.5);
  if (!source.length) return null;
  let nextIndex = source.findIndex(point => point.time >= targetTime);
  if (nextIndex < 0) nextIndex = source.length - 1;
  const next = source[nextIndex], previous = source[Math.max(0, nextIndex - 1)];
  const span = Math.max(1e-9, next.time - previous.time);
  const ratio = Math.max(0, Math.min(1, (targetTime - previous.time) / span));
  return { lat: previous.lat + (next.lat - previous.lat) * ratio, lon: previous.lon + (next.lon - previous.lon) * ratio };
}

function refreshPage4VisibleRange(startTime, endTime, rebuildToggles = false) {
  if (!page4Charts.length || !globalData.length) return;
  page4ViewStart = Math.max(page4RangeStart, Number(startTime));
  page4ViewEnd = Math.min(page4RangeEnd, Number(endTime));
  if (!(page4ViewEnd > page4ViewStart)) return;
  PAGE4_CHART_SPECS.forEach((spec, chartIndex) => {
    const chart = page4Charts[chartIndex];
    if (!chart) return;
    chart.data.datasets = page4ChartDatasets(spec, page4ViewStart, page4ViewEnd);
    if (rebuildToggles) syncPage4SeriesToggles(chart);
    chart.options.scales.x.min = page4AxisValue(page4ViewStart);
    chart.options.scales.x.max = page4AxisValue(page4ViewEnd);
    chart.options.scales.x.ticks.callback = value => page4AxisMode === 'distance' ? `${Math.round(Number(value))}m` : Number(value).toFixed(1);
    chart.update('none');
  });
  drawPage4Cursor(page4CursorTime);
  // Chart.js recalculates every data pixel after zoom/pan. Reproject the DOM
  // cursor dots immediately as well so none retain coordinates from the
  // previous viewport.
  drawCssIntersectionDots(currentCursorIndex, page4Charts, page4CursorTime);
  syncPage4Navigator();
}

function syncPage4Navigator() {
  if (!(page4RangeEnd > page4RangeStart)) return;
  const origin = page4AxisValue(page4RangeStart), end = page4AxisValue(page4RangeEnd);
  const duration = end - origin, step = page4AxisMode === 'distance' ? 0.1 : 0.01;
  const digits = page4AxisMode === 'distance' ? 1 : 3;
  if (inputStart) { inputStart.min = '0'; inputStart.max = duration.toFixed(digits); inputStart.step = String(step); inputStart.value = Math.max(0, page4AxisValue(page4ViewStart) - origin).toFixed(digits); }
  if (inputEnd) { inputEnd.min = '0'; inputEnd.max = duration.toFixed(digits); inputEnd.step = String(step); inputEnd.value = Math.min(duration, page4AxisValue(page4ViewEnd) - origin).toFixed(digits); }
  if (scrollBar) { scrollBar.min = '0'; scrollBar.max = duration.toFixed(digits); scrollBar.step = String(step); scrollBar.value = Math.max(0, page4AxisValue(page4CursorTime) - origin).toFixed(digits); scrollBar.disabled = false; }
  if (currentTimeVal) currentTimeVal.textContent = `${Math.max(0, page4AxisValue(page4CursorTime) - origin).toFixed(digits)}${page4AxisMode === 'distance' ? 'm' : 's'}`;
  if (lblScrollType) lblScrollType.textContent = `🏁 선택 구간 ${page4AxisMode === 'distance' ? '거리' : '시간'} 커서:`;
}

function zoomPage4At(targetTime, factor) {
  const viewStart = page4AxisValue(page4ViewStart), viewEnd = page4AxisValue(page4ViewEnd);
  const rangeStart = page4AxisValue(page4RangeStart), rangeEnd = page4AxisValue(page4RangeEnd);
  const span = viewEnd - viewStart;
  const fullSpan = rangeEnd - rangeStart;
  if (!(span > 0) || !(fullSpan > 0)) return;
  const newSpan = Math.max(page4AxisMode === 'distance' ? 5 : 0.5, Math.min(fullSpan, span * factor));
  const anchor = Math.max(viewStart, Math.min(viewEnd, page4AxisValue(targetTime)));
  const ratio = span > 0 ? (anchor - viewStart) / span : 0.5;
  let start = anchor - newSpan * ratio;
  let end = start + newSpan;
  if (start < rangeStart) { start = rangeStart; end = start + newSpan; }
  if (end > rangeEnd) { end = rangeEnd; start = end - newSpan; }
  refreshPage4VisibleRange(page4TimeFromAxis(start), page4TimeFromAxis(end));
}

function keepPage4CursorInView(targetTime, direction = 0) {
  const viewStart = page4AxisValue(page4ViewStart), viewEnd = page4AxisValue(page4ViewEnd);
  const rangeStart = page4AxisValue(page4RangeStart), rangeEnd = page4AxisValue(page4RangeEnd);
  const target = page4AxisValue(targetTime);
  const span = viewEnd - viewStart;
  const fullSpan = rangeEnd - rangeStart;
  if (!(span > 0) || !(fullSpan > span + 0.001)) return;
  const margin = Math.min(span * 0.08, 0.5);
  let start = viewStart;
  let end = viewEnd;
  if (direction > 0 && target >= end - margin) {
    end = Math.min(rangeEnd, target + margin);
    start = end - span;
  } else if (direction < 0 && target <= start + margin) {
    start = Math.max(rangeStart, target - margin);
    end = start + span;
  } else {
    return;
  }
  if (start < rangeStart) { start = rangeStart; end = start + span; }
  if (end > rangeEnd) { end = rangeEnd; start = end - span; }
  refreshPage4VisibleRange(page4TimeFromAxis(start), page4TimeFromAxis(end));
}

// 재생 중에는 확대 배율을 유지한 채 표시 구간만 앞으로 넘깁니다. 비교 랩이
// 여러 개면 같은 경과시간에서 가장 앞선 커서까지 화면 안에 남도록 합니다.
function followPage4PlaybackCursors(targetTime) {
  const boundaries = page4LapBoundaries(page4SelectedLapIndex);
  const selectedStart = Number(p4SectorStart?.value) || 0;
  const selectedEnd = Number(p4SectorEnd?.value);
  // 체크포인트 구간 비교에서는 모든 랩이 같은 X축 구간을 공유해야 하므로
  // 재생 커서가 움직여도 사용자가 고른 구간을 고정합니다.
  if (boundaries.length && (selectedStart !== 0 || selectedEnd !== boundaries.length - 1)) return;
  const viewStart = page4AxisValue(page4ViewStart), viewEnd = page4AxisValue(page4ViewEnd);
  const rangeStart = page4AxisValue(page4RangeStart), rangeEnd = page4AxisValue(page4RangeEnd);
  const span = viewEnd - viewStart;
  if (!(span > 0) || !(rangeEnd - rangeStart > span + 0.001)) return;
  const items = page4SelectedItems(), primary = items[0];
  const values = primary ? items.map(item => {
    const itemTime = page4ItemDisplayTime(item, primary, targetTime);
    return page4ItemAxisValue(item, itemTime, primary);
  }).filter(Number.isFinite) : [page4AxisValue(targetTime)];
  if (!values.length) return;
  const leading = Math.max(...values), trailing = Math.min(...values);
  const margin = span * 0.12;
  if (leading < viewEnd - margin && trailing > viewStart + margin) return;
  let start = leading >= viewEnd - margin ? leading - span * 0.78 : trailing - span * 0.22;
  start = Math.max(rangeStart, Math.min(rangeEnd - span, start));
  refreshPage4VisibleRange(page4TimeFromAxis(start), page4TimeFromAxis(start + span));
}

function drawPage4Cursor(targetTime) {
  const items = page4SelectedItems();
  const primary = items[0];
  page4Charts.forEach(chart => {
    if (!chart?.chartArea || !chart.scales?.x) return;
    const holder = chart.canvas.parentElement;
    const cursorItems = primary && Number.isFinite(page4PlaybackElapsed) && items.length > 1 ? items : [primary].filter(Boolean);
    holder.querySelectorAll('.p4-cursor-line').forEach((line, index) => { if (index >= cursorItems.length) line.remove(); });
    cursorItems.forEach((item, index) => {
      let line = holder.querySelector(`.p4-cursor-line[data-selection="${index}"]`);
      if (!line) { line = document.createElement('div'); line.className = 'p4-cursor-line'; line.dataset.selection = String(index); holder.appendChild(line); }
      const itemTime = page4ItemDisplayTime(item, primary, targetTime);
      const axisValue = cursorItems.length > 1 ? page4ItemAxisValue(item, itemTime, primary) : page4AxisValue(targetTime);
      const x = chart.scales.x.getPixelForValue(axisValue);
      const color = cursorItems.length > 1 ? PAGE4_LAP_COLORS[item.selectionIndex] : '#f97316';
      line.style.background = color;
      line.style.boxShadow = `0 0 7px ${color}88`;
      line.style.display = x >= chart.chartArea.left && x <= chart.chartArea.right ? 'block' : 'none';
      line.style.left = `${x}px`;
    });
  });
}

function updatePage4PlaybackCursor(targetTime, synchronizedElapsed = NaN) {
  if (!globalData.length) return;
  const validRange = page4RangeEnd > page4RangeStart;
  const rangeStart = validRange ? page4RangeStart : 0;
  const rangeEnd = validRange ? page4RangeEnd : totalDurationSec;
  page4CursorTime = Math.max(rangeStart, Math.min(rangeEnd, Number(targetTime) || rangeStart));
  page4PlaybackElapsed = Number.isFinite(synchronizedElapsed) ? Math.max(0, synchronizedElapsed) : NaN;
  if (page4PlaybackActive) followPage4PlaybackCursors(page4CursorTime);
  preciseCursorTimeSec = page4CursorTime;
  currentCursorIndex = findSampleIndexAtTime(page4CursorTime);
  if (p4PlayTimeline) p4PlayTimeline.value = String(page4CursorTime);
  if (p4PlayTime) p4PlayTime.textContent = Number.isFinite(page4PlaybackElapsed)
    ? `${page4PlaybackElapsed.toFixed(3)} s`
    : page4AxisMode === 'distance'
    ? `${(page4AxisValue(page4CursorTime) - page4AxisValue(rangeStart)).toFixed(1)} m`
    : `${(page4CursorTime - rangeStart).toFixed(3)} s`;
  if (tabTemperature?.classList.contains('active')) syncPage4Navigator();
  const row = globalData[findGlobalIndexAtTime(page4CursorTime)];
  if (row) updateNumericDisplays(row, null, page4CursorTime);
  drawCssIntersectionDots(currentCursorIndex, page4Charts, page4CursorTime);
  drawPage4Cursor(page4CursorTime);
  drawPage4GTrace(page4CursorTime);
  drawPage4TrackMap(page4CursorTime);
}

function setPage4Playback(active) {
  cancelAnimationFrame(page4PlaybackFrame);
  page4PlaybackFrame = 0;
  const validRange = page4RangeEnd > page4RangeStart;
  const rangeStart = validRange ? page4RangeStart : 0;
  const rangeEnd = validRange ? page4RangeEnd : totalDurationSec;
  page4PlaybackActive = Boolean(active && rangeEnd > rangeStart);
  page4PlaybackLastStamp = 0;
  if (p4PlayToggle) p4PlayToggle.textContent = page4PlaybackActive ? 'Ⅱ 일시정지' : '▶ 재생';
  if (!page4PlaybackActive) return;

  const items = page4SelectedItems();
  const primary = items[0];
  const ranges = primary ? items.map(item => page4ItemRange(item, primary)) : [];
  const playbackDuration = ranges.length ? Math.max(...ranges.map(range => range.duration)) : rangeEnd - rangeStart;

  if (page4CursorTime >= rangeEnd - 0.005 || page4CursorTime < rangeStart) {
    page4PlaybackElapsed = 0;
    updatePage4PlaybackCursor(rangeStart, 0);
  } else if (!Number.isFinite(page4PlaybackElapsed)) {
    page4PlaybackElapsed = Math.max(0, page4CursorTime - rangeStart);
  }

  const tick = stamp => {
    if (!page4PlaybackActive) return;
    if (page4PlaybackLastStamp) {
      const rate = Number(p4PlayRate?.value) || 1;
      const dt = Math.min(0.1, (stamp - page4PlaybackLastStamp) / 1000) * rate;
      const nextElapsed = page4PlaybackElapsed + dt;
      const primaryDuration = ranges[0]?.duration || rangeEnd - rangeStart;
      const nextTime = rangeStart + Math.min(primaryDuration, nextElapsed);
      if (nextElapsed >= playbackDuration) {
        updatePage4PlaybackCursor(rangeEnd, playbackDuration);
        setPage4Playback(false);
        return;
      }
      updatePage4PlaybackCursor(nextTime, nextElapsed);
    }
    page4PlaybackLastStamp = stamp;
    page4PlaybackFrame = requestAnimationFrame(tick);
  };
  page4PlaybackFrame = requestAnimationFrame(tick);
}

function drawPage4TrackMap(targetTime) {
  if (!p4TrackMap) return;
  const selectedItems = page4SelectedItems();
  const primaryItem = selectedItems[0];
  const lap = page4SelectedLapIndex >= 0 ? gpsLapResults[page4SelectedLapIndex] : null;
  const points = (lap && gpsLapPoints.length)
    ? gpsLapPoints.filter(point => point.time >= lap.startTime && point.time <= lap.endTime)
    : gpsLapPoints;
  if (points.length < 2) return;
  const rect = p4TrackMap.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const width = Math.max(180, rect.width || 260), height = width;
  if (p4TrackMap.width !== Math.round(width * scale) || p4TrackMap.height !== Math.round(height * scale)) {
    p4TrackMap.width = Math.round(width * scale); p4TrackMap.height = Math.round(height * scale);
  }
  const ctx = p4TrackMap.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, width, height);

  const comparisonPointSets = selectedItems.map(item => (item.session.gpsPoints || []).filter(point => point.time >= item.lap.startTime && point.time <= item.lap.endTime));
  const allMapPoints = [...points, ...comparisonPointSets.flat()];
  if (Array.isArray(gpsFinishPoints) && gpsFinishPoints.length === 2) {
    allMapPoints.push(...gpsFinishPoints);
  }
  gpsCheckpoints.forEach(cp => {
    if (Array.isArray(cp) && cp.length === 2) {
      allMapPoints.push(...cp);
    }
  });

  const getPointLon = p => (p ? Number(p.lon ?? p.lng ?? (Array.isArray(p) ? p[1] : 0)) : 0);
  const getPointLat = p => (p ? Number(p.lat ?? p.lat ?? (Array.isArray(p) ? p[0] : 0)) : 0);

  const meanLatRad = points.reduce((sum, point) => sum + getPointLat(point), 0) / points.length * Math.PI / 180;
  const lonScale = Math.max(0.1, Math.cos(meanLatRad));
  const xs = allMapPoints.map(point => getPointLon(point) * lonScale), ys = allMapPoints.map(point => getPointLat(point));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const mapScale = Math.min((width - 36) / Math.max(1e-9, maxX - minX), (height - 36) / Math.max(1e-9, maxY - minY));
  const contentWidth = (maxX - minX) * mapScale, contentHeight = (maxY - minY) * mapScale;
  const offsetX = (width - contentWidth) / 2, offsetY = (height - contentHeight) / 2;
  const project = point => ({ x: offsetX + (getPointLon(point) * lonScale - minX) * mapScale, y: height - offsetY - (getPointLat(point) - minY) * mapScale });

  const boundaries = page4LapBoundaries(page4SelectedLapIndex);
  const startIndex = Number(p4SectorStart?.value) || 0;
  let endIndex = Number(p4SectorEnd?.value);
  if (!Number.isInteger(endIndex)) endIndex = boundaries.length - 1;
  const startBound = boundaries[startIndex];
  const endBound = boundaries[endIndex];

  const activeLabels = new Set();
  if (startBound) activeLabels.add(startBound.label);
  if (endBound) activeLabels.add(endBound.label);

  // 1. Draw Base Track Path
  ctx.beginPath(); points.forEach((point, index) => { const p = project(point); index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

  // 2. Draw Active Selected Sector Track Segment (Highlighted Cyan Path)
  if (startBound && endBound && endBound.time > startBound.time) {
    const sectorPoints = points.filter(p => p.time >= startBound.time - 0.05 && p.time <= endBound.time + 0.05);
    if (sectorPoints.length > 1) {
      ctx.save();
      ctx.shadowColor = '#0284c7'; ctx.shadowBlur = 8;
      ctx.beginPath(); sectorPoints.forEach((point, index) => { const p = project(point); index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 5.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      ctx.restore();
    }
  }

  // 3. Draw Finish Line
  if (Array.isArray(gpsFinishPoints) && gpsFinishPoints.length === 2) {
    let from = project(gpsFinishPoints[0]);
    let to = project(gpsFinishPoints[1]);
    const isFinishActive = activeLabels.has('FINISH') || activeLabels.has('START');

    if (isFinishActive) {
      ctx.save();
      ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
      ctx.restore();

      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 4. Draw Checkpoints
  gpsCheckpoints.forEach((checkpoint, index) => {
    if (!Array.isArray(checkpoint) || checkpoint.length !== 2) return;
    let from = project(checkpoint[0]);
    let to = project(checkpoint[1]);
    const label = `CP${index + 1}`;
    const isCpActive = activeLabels.has(label);

    if (isCpActive) {
      ctx.save();
      ctx.shadowColor = '#06b6d4'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
      ctx.restore();

      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.65)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
    }

    // Keep the map unobstructed: show only a small sequence number beside
    // each checkpoint line instead of a full CP label or badge.
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lineLength = Math.max(1, Math.hypot(dx, dy));
    const labelOffset = Math.max(5, Math.min(8, width * 0.025));
    const labelX = (from.x + to.x) / 2 - (dy / lineLength) * labelOffset;
    const labelY = (from.y + to.y) / 2 + (dx / lineLength) * labelOffset;
    ctx.save();
    ctx.font = `800 ${Math.max(7, Math.min(10, width * 0.032))}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-mono') || 'monospace'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillStyle = isCpActive ? '#ffffff' : 'rgba(165, 243, 252, 0.9)';
    ctx.strokeText(String(index + 1), labelX, labelY);
    ctx.fillText(String(index + 1), labelX, labelY);
    ctx.restore();
  });

  let position = null;
  let trackTimeText = '0:00.000';
  if (lap && Number.isFinite(lap.startTime) && Number.isFinite(lap.endTime)) {
    const clampedTime = Math.max(lap.startTime, Math.min(lap.endTime, targetTime));
    position = getGpsLapPositionAtTime(lap, clampedTime);
    trackTimeText = formatLapTime(Math.max(0, Math.min(lap.duration, targetTime - lap.startTime)));
  } else {
    const idx = findGlobalIndexAtTime(targetTime);
    const row = idx >= 0 ? globalData[idx] : null;
    if (row && Number.isFinite(Number(row.gps_lat)) && Number.isFinite(Number(row.gps_lon))) {
      position = { lat: Number(row.gps_lat), lon: Number(row.gps_lon) };
    }
    trackTimeText = formatLapTime(Math.max(0, targetTime));
  }
  if (selectedItems.length > 1 && primaryItem) {
    selectedItems.forEach(item => {
      const itemTime = page4ItemDisplayTime(item, primaryItem, targetTime);
      const cursorPosition = page4GpsPositionAtTime(item.session.gpsPoints, item.lap, itemTime);
      if (!cursorPosition) return;
      const p = project(cursorPosition);
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fillStyle = PAGE4_LAP_COLORS[item.selectionIndex]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    });
  } else if (position) { const p = project(position); ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fillStyle = PAGE4_LAP_COLORS[0]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
  if (p4TrackTime) p4TrackTime.textContent = trackTimeText;
}

function updatePage4Widgets(row) {
  if (!row) return;
  const set = (id, text) => { const element = document.getElementById(id); if (element) element.textContent = text; };
  const speed = Number(row.gps_speed_kmh) || 0, rpm = Number(row.rpm) || 0, tps = Number(row.decoded_tps) || 0;
  const brake = getCalibratedBrake(row.front_brake_raw);
  const rowIndex = findGlobalIndexAtTime(Number(row.time_sec));
  const steering = channelValueAt('steering', rowIndex) ?? getCalibratedSteering(row.steering_raw);
  const yaw = page4SeriesValue(PAGE4_CHART_SPECS[4].series[1], row, rowIndex);
  const gx = page4SeriesValue(PAGE4_CHART_SPECS[5].series[0], row, rowIndex), gy = page4SeriesValue(PAGE4_CHART_SPECS[5].series[1], row, rowIndex);
  set('p4-speed', `GPS ${speed.toFixed(1)} · FL ${(Number(row.fl_speed_kmh) || 0).toFixed(1)} · RL ${(Number(row.rl_speed_kmh) || 0).toFixed(1)} · RR ${(Number(row.rr_speed_kmh) || 0).toFixed(1)} km/h`); set('p4-rpm-tps', `${Math.round(rpm)} rpm · ${tps.toFixed(1)}%`);
  set('p4-gear', Number(row.gear) > 0 ? String(Math.round(row.gear)) : 'N'); set('p4-pedals', `T ${tps.toFixed(1)} · B ${brake.toFixed(1)}%`);
  set('p4-steering-yaw', `${steering.toFixed(1)}° · ${yaw.toFixed(1)}°/s`); set('p4-imu', `X ${gx.toFixed(2)} · Y ${gy.toFixed(2)} g`);
  set('p4-temp', `${Math.round(Number(row.water_c) || 0)} · ${Math.round(Number(row.oil_c) || 0)} °C`); set('p4-gx', gx.toFixed(2)); set('p4-gy', gy.toFixed(2));
  if (p4GDot) {
    // Vehicle coordinates: +X is forward and +Y is left. Screen X grows to
    // the right, therefore lateral G must use the opposite screen direction.
    p4GDot.style.left = `${50 - Math.max(-2, Math.min(2, gy)) * 22}%`;
    p4GDot.style.top = `${50 - Math.max(-2, Math.min(2, gx)) * 22}%`;
  }
  set('p4-steering-value', `${steering >= 0 ? '+' : ''}${steering.toFixed(1)}°`);
  if (p4SteeringWheel) p4SteeringWheel.style.transform = `rotate(${steeringWheelDisplayAngle(steering)}deg)`;
  updatePage4ComparisonHeaders(Number(row.time_sec));
  drawPage4TrackMap(Number(row.time_sec));
}

function updatePage4ComparisonHeaders(primaryTime = page4CursorTime) {
  const items = page4SelectedItems();
  const primary = items[0];
  if (!primary) return;
  const values = items.map(item => {
    const rows = item.session.rows || [];
    const time = page4ItemDisplayTime(item, primary, primaryTime);
    const index = page4RowIndexAtTime(rows, time);
    const row = rows[index];
    if (!row) return null;
    const steering = page4SeriesValue(PAGE4_CHART_SPECS[4].series[0], row, item.session.id === page4ActiveSessionId ? index : undefined);
    const yaw = page4SeriesValue(PAGE4_CHART_SPECS[4].series[1], row, item.session.id === page4ActiveSessionId ? index : undefined);
    const gx = page4SeriesValue(PAGE4_CHART_SPECS[5].series[0], row, item.session.id === page4ActiveSessionId ? index : undefined);
    const gy = page4SeriesValue(PAGE4_CHART_SPECS[5].series[1], row, item.session.id === page4ActiveSessionId ? index : undefined);
    return {
      item, color: PAGE4_LAP_COLORS[item.selectionIndex],
      speed: `GPS ${(Number(row.gps_speed_kmh) || 0).toFixed(1)} · FL ${(Number(row.fl_speed_kmh) || 0).toFixed(1)} · RL ${(Number(row.rl_speed_kmh) || 0).toFixed(1)} · RR ${(Number(row.rr_speed_kmh) || 0).toFixed(1)} km/h`,
      rpm: `${Math.round(Number(row.rpm) || 0)} rpm · ${(Number(row.decoded_tps) || 0).toFixed(1)}%`,
      gear: Number(row.gear) > 0 ? String(Math.round(row.gear)) : 'N',
      pedals: `T ${(Number(row.decoded_tps) || 0).toFixed(1)} · B ${getCalibratedBrake(row.front_brake_raw).toFixed(1)}%`,
      steering: `${steering.toFixed(1)}° · ${yaw.toFixed(1)}°/s`,
      imu: `X ${gx.toFixed(2)} · Y ${gy.toFixed(2)} g`,
      temp: `${Math.round(Number(row.water_c) || 0)} · ${Math.round(Number(row.oil_c) || 0)} °C`
    };
  }).filter(Boolean);
  const render = (id, key) => {
    const output = document.getElementById(id);
    if (!output) return;
    output.classList.add('p4-live-values');
    output.classList.toggle('p4-multi-values', values.length > 1);
    output.innerHTML = values.map(value => `<span style="--lap-value-color:${value.color}"><i>${escapePage4SessionHtml(value.item.session.driver)} L${value.item.lap.number}</i>${value[key]}</span>`).join('');
  };
  render('p4-speed', 'speed');
  render('p4-rpm-tps', 'rpm');
  render('p4-gear', 'gear');
  render('p4-pedals', 'pedals');
  render('p4-steering-yaw', 'steering');
  render('p4-imu', 'imu');
  render('p4-temp', 'temp');
}

p4SessionDrawerToggle?.addEventListener('click', () => setPage4SessionDrawer(!document.getElementById('page-temperature')?.classList.contains('p4-session-drawer-open')));
p4SessionDrawerClose?.addEventListener('click', () => setPage4SessionDrawer(false));
p4SessionDrawerShade?.addEventListener('click', () => setPage4SessionDrawer(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.getElementById('page-temperature')?.classList.contains('p4-session-drawer-open')) setPage4SessionDrawer(false);
});
p4SessionFiles?.addEventListener('change', async event => {
  const files = [...event.target.files];
  event.target.value = '';
  for (const file of files) {
    try { await importPage4SessionFile(file); }
    catch (error) { alert(error.message || `${file.name}을 불러오지 못했습니다.`); }
  }
});
p4SessionList?.addEventListener('input', event => {
  const session = page4SessionStore.find(item => item.id === Number(event.target.dataset.p4SessionDriver));
  if (session) session.driver = event.target.value.trim() || session.fileName.replace(/\.csv$/i, '');
});
p4SessionList?.addEventListener('click', event => {
  const remove = event.target.closest('[data-p4-session-remove]');
  if (remove) {
    const sessionId = Number(remove.dataset.p4SessionRemove);
    const sessionIndex = page4SessionStore.findIndex(item => item.id === sessionId);
    const session = page4SessionStore[sessionIndex];
    if (!session || !window.confirm(`“${session.driver}” 세션(${session.fileName})을 제거하시겠습니까?`)) return;
    page4SessionStore.splice(sessionIndex, 1);
    page4SelectedSessionLaps = page4SelectedSessionLaps.filter(item => item.sessionId !== sessionId);
    if (page4ActiveSessionId === sessionId) {
      const next = page4SessionStore[Math.min(sessionIndex, page4SessionStore.length - 1)];
      page4ActiveSessionId = null;
      if (next) activatePage4SessionLap(next.id, page4BestLapIndex(next));
    }
    renderPage4SessionDrawer();
    syncPage4SelectionToComparison();
    return;
  }
  const lap = event.target.closest('[data-p4-session-lap]');
  if (!lap) return;
  const [sessionId, lapIndex] = lap.dataset.p4SessionLap.split(':').map(Number);
  const selectedIndex = page4SelectedSessionLaps.findIndex(item => item.sessionId === sessionId && item.lapIndex === lapIndex);
  if (selectedIndex >= 0) {
    if (page4SelectedSessionLaps.length === 1) return;
    page4SelectedSessionLaps.splice(selectedIndex, 1);
    if (selectedIndex === 0) activatePage4SessionLap(page4SelectedSessionLaps[0].sessionId, page4SelectedSessionLaps[0].lapIndex);
    else { renderPage4SessionDrawer(); applyPage4Selection(); }
    syncPage4SelectionToComparison();
    return;
  }
  if (page4SelectedSessionLaps.length >= 2) {
    alert('4페이지 비교는 최대 2개 랩까지 선택할 수 있습니다. 선택된 랩 하나를 먼저 해제해 주세요.');
    return;
  }
  page4SelectedSessionLaps.push({ sessionId, lapIndex });
  renderPage4SessionDrawer();
  applyPage4Selection();
  syncPage4SelectionToComparison();
});
p4LapSelect?.addEventListener('change', () => {
  page4SelectedLapIndex = Number(p4LapSelect.value);
  if (page4ActiveSessionId !== null) {
    page4SelectedSessionLaps = [{ sessionId: page4ActiveSessionId, lapIndex: page4SelectedLapIndex }, ...page4SelectedSessionLaps.filter(item => item.sessionId !== page4ActiveSessionId || item.lapIndex !== page4SelectedLapIndex)].slice(0, 2);
  }
  refreshPage4SectorOptions();
  renderPage4SessionDrawer();
  syncPage4SelectionToComparison();
});
p4SectorStart?.addEventListener('change', applyPage4Selection);
p4SectorEnd?.addEventListener('change', applyPage4Selection);
p4PlayToggle?.addEventListener('click', () => setPage4Playback(!page4PlaybackActive));
p4PlayTimeline?.addEventListener('input', () => { setPage4Playback(false); updatePage4PlaybackCursor(Number(p4PlayTimeline.value)); });
p4AxisModeControl?.addEventListener('click', event => {
  const button = event.target.closest('button[data-mode]');
  if (!button || button.dataset.mode === page4AxisMode) return;
  page4AxisMode = button.dataset.mode;
  p4AxisModeControl.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
  applyPage4Selection();
});

function syncGpsTimelineRange(minTime, maxTime, value) {
  const safeValue = Math.max(minTime, Math.min(maxTime, Number(value) || minTime));
  scrollBar.min = minTime.toFixed(2);
  scrollBar.max = maxTime.toFixed(2);
  scrollBar.step = '0.04';
  scrollBar.value = safeValue.toFixed(2);
  if (gpsFullscreenTimeline) {
    gpsFullscreenTimeline.min = scrollBar.min;
    gpsFullscreenTimeline.max = scrollBar.max;
    gpsFullscreenTimeline.step = scrollBar.step;
    gpsFullscreenTimeline.value = scrollBar.value;
    updateGpsFullscreenTimelineVisual();
  }
  updateGpsDetailChartRange(minTime, maxTime);
  return safeValue;
}

function updateGpsFullscreenTimelineVisual() {
  if (!gpsFullscreenTimeline) return;
  const min = Number(gpsFullscreenTimeline.min) || 0;
  const max = Number(gpsFullscreenTimeline.max) || 0;
  const value = Number(gpsFullscreenTimeline.value) || min;
  const ratio = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
  const width = gpsFullscreenTimeline.clientWidth;
  const progress = width > 30
    ? `${(15 + ratio * (width - 30)).toFixed(2)}px`
    : `${(ratio * 100).toFixed(4)}%`;
  gpsFullscreenTimeline.style.setProperty('--timeline-progress', progress);
}

const gpsDetailCursorPlugin = {
  id: 'gpsDetailCursor',
  afterDatasetsDraw(chart) {
    const time = chart.$gpsCursorTime;
    const xScale = chart.scales?.x;
    const area = chart.chartArea;
    if (!Number.isFinite(time) || !xScale || !area || time < xScale.min || time > xScale.max) return;
    const x = xScale.getPixelForValue(time);
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.bottom);
    ctx.stroke();
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const data = dataset.data || [];
      if (!data.length) return;
      let lo = 0, hi = data.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (Number(data[mid].x) < time) lo = mid + 1;
        else hi = mid;
      }
      const left = Math.max(0, lo - 1);
      const nearest = Math.abs(Number(data[left].x) - time) <= Math.abs(Number(data[lo].x) - time) ? data[left] : data[lo];
      const value = Number(nearest?.y);
      const yScale = chart.scales[dataset.yAxisID || 'y'];
      if (!Number.isFinite(value) || !yScale) return;
      const y = yScale.getPixelForValue(value);
      if (y < area.top || y > area.bottom) return;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = dataset.borderColor || '#2563eb';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });
    ctx.restore();
  }
};

function destroyGpsDetailCharts() {
  gpsDetailCharts.forEach(chart => chart?.destroy());
  gpsDetailCharts = [];
  gpsDetailSourceData = null;
}

function cloneGpsDetailDatasets(sourceChart, palette) {
  return (sourceChart?.data?.datasets || []).map((dataset, index) => ({
    label: dataset.label || '',
    data: dataset.data,
    borderColor: palette[index] || dataset.borderColor,
    backgroundColor: dataset.backgroundColor,
    borderWidth: Math.max(1.2, Number(dataset.borderWidth) || 1.2),
    pointRadius: 0,
    stepped: dataset.stepped,
    tension: dataset.tension || 0,
    fill: false,
    yAxisID: dataset.yAxisID
  }));
}

function ensureGpsDetailCharts() {
  if (gpsDetailCharts.length && gpsDetailSourceData === globalData) return;
  destroyGpsDetailCharts();
  const specs = [
    ['gps-detail-speed', chartSpeed, ['#f97316', '#2563eb', '#16a34a']],
    ['gps-detail-rpm', chartRpm, ['#dc2626']],
    ['gps-detail-gear', chartGear, ['#2563eb']],
    ['gps-detail-steering', chartSteering, ['#db2777']],
    ['gps-detail-throttle-brake', chartThrottleBrake, ['#16a34a', '#dc2626']]
  ];
  gpsDetailCharts = specs.map(([id, source, palette]) => {
    const canvas = document.getElementById(id);
    if (!canvas || !source) return null;
    const min = Number(scrollBar.min) || currentStartSec;
    const max = Number(scrollBar.max) || currentEndSec;
    const sourceYOptions = source.options?.scales?.y || {};
    const sourceYScale = source.scales?.y;
    return new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { datasets: cloneGpsDetailDatasets(source, palette) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        normalized: true,
        interaction: { enabled: false },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { type: 'linear', min, max, display: false, grid: { display: false } },
          y: {
            min: sourceYOptions.min ?? sourceYScale?.min,
            max: sourceYOptions.max ?? sourceYScale?.max,
            afterFit(scale) { scale.width = 48; },
            grid: { color: 'rgba(71, 85, 105, 0.14)' },
            ticks: {
              color: '#475569',
              font: { size: 8 },
              maxTicksLimit: 4,
              stepSize: sourceYOptions.ticks?.stepSize,
              callback: sourceYOptions.ticks?.callback
            }
          }
        }
      }
    });
  }).filter(Boolean);
  gpsDetailCharts.forEach(ensureGpsDetailCursorOverlay);
  gpsDetailSourceData = globalData;
}

function updateGpsDetailChartRange(minTime, maxTime) {
  if (gpsAxisMode === 'distance' && gpsSelectedLapIndices.length) {
    const total = Number(window.NSSUR_TRACK_REFERENCE?.totalDistanceMeters) || 0;
    minTime = 0;
    maxTime = total;
  }
  gpsDetailCharts.forEach(chart => {
    chart.options.scales.x.min = minTime;
    chart.options.scales.x.max = maxTime;
    chart.update('none');
  });
}

function updateGpsDetailCursors(targetTime) {
  if (!gpsFullscreenDetail?.classList.contains('open')) return;
  updateGpsDetailReadouts(targetTime);
  const axisValue = gpsAxisMode === 'distance' ? gpsDistanceAtTime(targetTime) : targetTime;
  gpsDetailCharts.forEach(chart => {
    chart.$gpsCursorTime = axisValue;
    updateGpsDetailCursorOverlay(chart, axisValue);
  });
}

function ensureGpsDetailCursorOverlay(chart) {
  const section = chart.canvas.closest('section');
  if (!section || section.querySelector('.gps-detail-cursor-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'gps-detail-cursor-overlay';
  overlay.innerHTML = '<i class="gps-detail-cursor-line"></i><div class="gps-detail-cursor-dots"></div>';
  section.appendChild(overlay);
}

function updateGpsDetailCursorOverlay(chart, targetTime) {
  const section = chart.canvas.closest('section');
  const overlay = section?.querySelector('.gps-detail-cursor-overlay');
  const xScale = chart.scales?.x;
  const area = chart.chartArea;
  if (!overlay || !xScale || !area || targetTime < xScale.min || targetTime > xScale.max) {
    if (overlay) overlay.style.display = 'none';
    return;
  }
  overlay.style.display = 'block';
  const canvasLeft = chart.canvas.offsetLeft;
  const canvasTop = chart.canvas.offsetTop;
  const x = canvasLeft + xScale.getPixelForValue(targetTime);
  const line = overlay.querySelector('.gps-detail-cursor-line');
  line.style.left = `${x}px`;
  line.style.top = `${canvasTop + area.top}px`;
  line.style.height = `${area.bottom - area.top}px`;

  const dots = overlay.querySelector('.gps-detail-cursor-dots');
  const datasets = chart.data.datasets;
  while (dots.children.length < datasets.length) dots.appendChild(document.createElement('i'));
  while (dots.children.length > datasets.length) dots.lastElementChild.remove();
  datasets.forEach((dataset, datasetIndex) => {
    const dot = dots.children[datasetIndex];
    const lineElement = chart.getDatasetMeta(datasetIndex)?.dataset;
    const interpolated = lineElement?.interpolate({ x: xScale.getPixelForValue(targetTime) }, 'x');
    const point = Array.isArray(interpolated) ? interpolated[0] : interpolated;
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
      dot.style.display = 'none';
      return;
    }
    const y = canvasTop + point.y;
    if (y < canvasTop + area.top || y > canvasTop + area.bottom) {
      dot.style.display = 'none';
      return;
    }
    const dotX = canvasLeft + point.x;
    dot.style.display = 'block';
    dot.style.transform = `translate3d(${dotX - 4}px, ${y - 4}px, 0)`;
    dot.style.background = dataset.borderColor || '#2563eb';
  });
}

function detailChannelValue(key, row, index, fallback) {
  if (typeof channelValueAt === 'function' && index >= 0) {
    const value = channelValueAt(key, index);
    if (Number.isFinite(value)) return value;
  }
  return fallback(row);
}

function updateGpsDetailReadouts(targetTime) {
  const primaryLap = gpsSelectedLapIndices.length > 1 ? gpsLapResults[gpsSelectedLapIndices[0]] : null;
  const lookupTime = primaryLap ? primaryLap.startTime + Math.min(targetTime, primaryLap.duration) : targetTime;
  const index = globalData.length ? findGlobalIndexAtTime(lookupTime) : -1;
  const row = index >= 0 ? globalData[index] : null;
  if (!row) return;
  const fl = detailChannelValue('fl_speed', row, index, r => Number(r.fl_speed_kmh) || 0);
  const rl = detailChannelValue('rl_speed', row, index, r => Number(r.rl_speed_kmh) || 0);
  const rr = detailChannelValue('rr_speed', row, index, r => Number(r.rr_speed_kmh) || 0);
  const rpm = detailChannelValue('rpm', row, index, r => Number(r.rpm) || 0);
  const gear = detailChannelValue('gear', row, index, r => Number(r.gear) || 0);
  const steering = detailChannelValue('steering', row, index, r => getCalibratedSteering(r.steering_raw));
  const throttle = detailChannelValue('throttle', row, index, r => Number(r.decoded_tps) || 0);
  const brake = detailChannelValue('brake', row, index, r => getCalibratedBrake(r.front_brake_raw));
  if (gpsDetailSpeedValue) gpsDetailSpeedValue.textContent = `FL ${fl.toFixed(1)} · RL ${rl.toFixed(1)} · RR ${rr.toFixed(1)} km/h`;
  if (gpsDetailRpmValue) gpsDetailRpmValue.textContent = `${Math.round(rpm)} rpm`;
  if (gpsDetailGearValue) gpsDetailGearValue.textContent = gear > 0 ? String(Math.round(gear)) : 'N';
  if (gpsDetailSteeringValue) gpsDetailSteeringValue.textContent = `${steering >= 0 ? '+' : ''}${steering.toFixed(1)}°`;
  if (gpsDetailPedalValue) gpsDetailPedalValue.textContent = `T ${throttle.toFixed(1)} · B ${brake.toFixed(1)} %`;
}

function refitGpsMapToCurrentLapView() {
  if (!gpsMap) return;
  const compactVideoMap = gpsMap.getContainer()?.closest('.gps-map-stage')?.classList.contains('gps-video-loaded');
  const padding = compactVideoMap ? [4, 4] : [35, 35];
  if (gpsSelectedLapIndices.length) {
    const lines = gpsSelectedLapIndices.map(index => gpsLapRouteLines[index]).filter(Boolean);
    const bounds = lines.length ? L.featureGroup(lines).getBounds() : null;
    if (bounds?.isValid()) gpsMap.fitBounds(bounds, { padding, maxZoom: 20 });
  } else {
    const lines = gpsLapRouteLines.filter(Boolean);
    const bounds = lines.length ? L.featureGroup(lines).getBounds() : gpsRouteLine?.getBounds();
    if (bounds?.isValid()) gpsMap.fitBounds(bounds, { padding: compactVideoMap ? [4, 4] : [30, 30], maxZoom: 20 });
  }
}

function clearGpsCompareMarkers() {
  gpsCompareMarkers.forEach(marker => gpsMap?.removeLayer(marker));
  gpsCompareMarkers = [];
  if (gpsCursorMarker) gpsCursorMarker.setOpacity(1);
}

function getGpsLapPositionAtTime(lap, targetTime) {
  if (targetTime <= lap.startTime) return { lat: lap.startLat, lon: lap.startLon };
  if (targetTime >= lap.endTime) return { lat: lap.endLat, lon: lap.endLon };

  let low = 0;
  let high = gpsLapPoints.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (gpsLapPoints[middle].time < targetTime) low = middle + 1;
    else high = middle;
  }

  const previous = low > 0 && gpsLapPoints[low - 1].time > lap.startTime
    ? gpsLapPoints[low - 1]
    : { lat: lap.startLat, lon: lap.startLon, time: lap.startTime };
  const next = low < gpsLapPoints.length && gpsLapPoints[low].time < lap.endTime
    ? gpsLapPoints[low]
    : { lat: lap.endLat, lon: lap.endLon, time: lap.endTime };
  const elapsed = next.time - previous.time;
  if (!(elapsed > 0) || elapsed > 10) return { lat: previous.lat, lon: previous.lon };
  const ratio = Math.max(0, Math.min(1, (targetTime - previous.time) / elapsed));
  return {
    lat: previous.lat + (next.lat - previous.lat) * ratio,
    lon: previous.lon + (next.lon - previous.lon) * ratio
  };
}

function updateGpsCompareMarkers(relativeTime) {
  if (gpsSelectedLapIndices.length < 2 || !gpsMap) return;
  if (gpsCursorMarker) gpsCursorMarker.setOpacity(0);
  while (gpsCompareMarkers.length > gpsSelectedLapIndices.length) {
    gpsMap.removeLayer(gpsCompareMarkers.pop());
  }
  gpsSelectedLapIndices.forEach((lapIndex, markerIndex) => {
    const lap = gpsLapResults[lapIndex];
    const absoluteTime = lap.startTime + Math.min(relativeTime, lap.duration);
    const position = getGpsLapPositionAtTime(lap, absoluteTime);
    if (!position) return;
    let marker = gpsCompareMarkers[markerIndex];
    if (!marker) {
      const color = GPS_LAP_COLORS[lapIndex % GPS_LAP_COLORS.length];
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="gps-position-cursor gps-compare-cursor" style="--gps-cursor-color:${color}"><b>${lap.number}</b></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8]
      });
      marker = L.marker([position.lat, position.lon], { icon, zIndexOffset: 11000 + markerIndex }).addTo(gpsMap);
      gpsCompareMarkers[markerIndex] = marker;
    } else {
      marker.setLatLng([position.lat, position.lon]);
    }
  });
  updateGpsCursorScale();
}

function rebuildGpsDetailChartsForSelection() {
  if (!gpsFullscreenDetail?.classList.contains('open')) return;
  destroyGpsDetailCharts();
  ensureGpsDetailCharts();
  if (!gpsSelectedLapIndices.length) return;
  const sources = [chartSpeed, chartRpm, chartGear, chartSteering, chartThrottleBrake];
  const comparisonIndexes = [[0], [0], [0], [0], [0, 1]];
  gpsDetailCharts.forEach((chart, chartIndex) => {
    const source = sources[chartIndex];
    const selectedDatasets = [];
    gpsSelectedLapIndices.forEach(lapIndex => {
      const lap = gpsLapResults[lapIndex];
      const color = GPS_LAP_COLORS[lapIndex % GPS_LAP_COLORS.length];
      const datasetIndexes = gpsSelectedLapIndices.length > 1
        ? comparisonIndexes[chartIndex]
        : (source.data.datasets || []).map((_, index) => index);
      datasetIndexes.forEach((datasetIndex, subIndex) => {
        const sourceDataset = source.data.datasets[datasetIndex];
        const data = (sourceDataset.data || [])
          .filter(point => point.x >= lap.startTime && point.x <= lap.endTime)
          .map(point => ({
            x: gpsAxisMode === 'distance'
              ? interpolateLapDistanceMap(point.x, 'time', 'distance', lapIndex)
              : (gpsSelectedLapIndices.length > 1 ? point.x - lap.startTime : point.x),
            y: point.y
          }));
        selectedDatasets.push({
          label: gpsSelectedLapIndices.length > 1 ? `LAP ${lap.number}${subIndex ? ' Brake' : ''}` : sourceDataset.label,
          data,
          borderColor: gpsSelectedLapIndices.length > 1 ? color : sourceDataset.borderColor,
          borderWidth: subIndex ? 1.2 : 1.8,
          borderDash: subIndex ? [5, 3] : [],
          pointRadius: 0,
          stepped: sourceDataset.stepped,
          fill: false
        });
      });
    });
    chart.data.datasets = selectedDatasets;
    chart.options.scales.x.min = gpsAxisMode === 'distance' ? 0 : (gpsSelectedLapIndices.length > 1 ? 0 : gpsLapResults[gpsSelectedLapIndices[0]].startTime);
    chart.options.scales.x.max = gpsAxisMode === 'distance'
      ? (Number(window.NSSUR_TRACK_REFERENCE?.totalDistanceMeters) || 0)
      : (gpsSelectedLapIndices.length > 1
        ? Math.max(...gpsSelectedLapIndices.map(index => gpsLapResults[index].duration))
        : gpsLapResults[gpsSelectedLapIndices[0]].endTime);
    chart.update('none');
  });
}

function closeGpsFullscreenDetail() {
  const stage = gpsFullscreenDetailToggle?.closest('.gps-map-stage');
  gpsFullscreenDetail?.classList.remove('open');
  stage?.classList.remove('gps-detail-open');
  if (gpsFullscreenDetailToggle) gpsFullscreenDetailToggle.textContent = '상세정보 ›';
}

function selectGpsLapView(index) {
  if (!gpsLapResults.length || !gpsLapRouteLayer) return;
  const validLap = Number.isInteger(index) && index >= 0 && index < gpsLapResults.length;
  const wasSelected = validLap && gpsSelectedLapIndices.includes(index);
  if (!validLap) gpsSelectedLapIndices = [];
  else if (wasSelected) gpsSelectedLapIndices = gpsSelectedLapIndices.filter(value => value !== index);
  else gpsSelectedLapIndices = [...gpsSelectedLapIndices, index].sort((a, b) => a - b);
  if (validLap && !wasSelected && gpsSelectedLapIndices.length > 1) gpsGoProCompareLapIndex = index;
  if (!gpsSelectedLapIndices.includes(gpsGoProCompareLapIndex)) gpsGoProCompareLapIndex = -1;
  gpsSelectedLapIndex = gpsSelectedLapIndices.length === 1 ? gpsSelectedLapIndices[0] : -1;
  const hasSelection = gpsSelectedLapIndices.length > 0;
  const isComparison = gpsSelectedLapIndices.length > 1;
  gpsLapRouteLayer.clearLayers();
  gpsLapRouteLines.forEach((line, lineIndex) => {
    if (!hasSelection || gpsSelectedLapIndices.includes(lineIndex)) line.addTo(gpsLapRouteLayer);
  });
  gpsLapMapLegend?.querySelectorAll('[data-lap-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.lapView === 'all' ? !hasSelection : gpsSelectedLapIndices.includes(Number(button.dataset.lapView)));
  });
  gpsFullscreenLapTimes?.querySelectorAll('[data-lap-panel-view]').forEach(button => {
    button.classList.toggle('selected', button.dataset.lapPanelView === 'all' ? !hasSelection : gpsSelectedLapIndices.includes(Number(button.dataset.lapPanelView)));
  });
  updateGoProComparisonLayout();

  setGpsPlayback(false);
  clearGpsCompareMarkers();
  rebuildGpsDetailChartsForSelection();
  if (gpsSelectedLapIndices.length === 1) {
    const selectedIndex = gpsSelectedLapIndices[0];
    const lap = gpsLapResults[selectedIndex];
    const targetTime = syncGpsTimelineRange(lap.startTime, lap.endTime, lap.startTime);
    updateGpsCursorAtTime(targetTime);
    const line = gpsLapRouteLines[selectedIndex];
    if (line?.getBounds().isValid()) gpsMap.fitBounds(line.getBounds(), { padding: [45, 45], maxZoom: 20 });
  } else if (isComparison) {
    const maxDuration = Math.max(...gpsSelectedLapIndices.map(lapIndex => gpsLapResults[lapIndex].duration));
    const targetTime = syncGpsTimelineRange(0, maxDuration, 0);
    updateGpsCursorAtTime(targetTime);
    refitGpsMapToCurrentLapView();
  } else {
    const targetTime = syncGpsTimelineRange(currentStartSec, currentEndSec, scrollBar.value);
    updateGpsCursorAtTime(targetTime);
    const visibleLines = gpsLapRouteLines.filter(Boolean);
    if (visibleLines.length) {
      const bounds = L.featureGroup(visibleLines).getBounds();
      if (bounds.isValid()) gpsMap.fitBounds(bounds, { padding: [30, 30] });
    }
  }
  if (gpsCursorMarker) gpsCursorMarker.setZIndexOffset(10000);
  if (gpsCheckpoints.length) renderGpsSectorComparison();
  if (gpsHandlingVisible && gpsHandlingAnalysisReady) renderGpsHandlingAnalysis(gpsHandlingSteeringRatio);
}

function renderGpsLapResults(crossings, laps) {
  gpsLapResults = laps;
  if (gpsCheckpointAdd) gpsCheckpointAdd.disabled = !laps.length;
  gpsSelectedLapIndex = -1;
  gpsSelectedLapIndices = [];
  gpsGoProCompareLapIndex = -1;
  clearGpsCompareMarkers();
  if (gpsLapCount) gpsLapCount.textContent = `${laps.length} LAPS`;
  const best = laps.length ? Math.min(...laps.map(lap => lap.duration)) : NaN;
  const lapDistances = laps.map(lap => lap.distanceMeters).filter(Number.isFinite);
  const averageDistance = lapDistances.length
    ? lapDistances.reduce((sum, distance) => sum + distance, 0) / lapDistances.length
    : NaN;
  renderFullscreenLapTimes(laps, best);
  refreshPage4Selectors();
  if (gpsLapBestTime) gpsLapBestTime.textContent = formatLapTime(best);
  if (gpsLapAverageDistance) gpsLapAverageDistance.textContent = formatGpsLapDistance(averageDistance);
  if (gpsLapFixSummary) {
    const timeBasis = laps.length && laps.every(lap => lap.timeBasis === 'gps') ? 'GPS 시각 기준' : '로거 경과시간 기준';
    gpsLapFixSummary.textContent = `${gpsLapPoints.length.toLocaleString()} GPS fixes · ${crossings.length}회 통과 · ${timeBasis}`;
  }

  if (gpsLapCrossingLayer) {
    gpsLapCrossingLayer.clearLayers();
    crossings.forEach((crossing, index) => {
      L.circleMarker([crossing.lat, crossing.lon], {
        radius: 4,
        color: '#fff',
        weight: 1,
        fillColor: index === 0 ? '#eab308' : '#10b981',
        fillOpacity: 1,
        interactive: false
      }).addTo(gpsLapCrossingLayer);
    });
  }
  drawGpsLapRoutes(laps);
  gpsHandlingVisible = false;
  gpsHandlingAnalysisReady = false;
  gpsHandlingEventsData = [];
  gpsHandlingLayer?.clearLayers();
  if (gpsHandlingCard) gpsHandlingCard.hidden = true;
  if (gpsHandlingToggle) {
    gpsHandlingToggle.disabled = !laps.length;
    gpsHandlingToggle.classList.remove('active');
    gpsHandlingToggle.setAttribute('aria-pressed', 'false');
  }
  updateGpsCursorLapColor(Number(scrollBar?.value));
  if (tabGps?.classList.contains('active') && activeSampledData.length) {
    syncGpsTimelineRange(currentStartSec, currentEndSec, scrollBar.value);
  }

  if (!gpsLapList) return;
  if (!laps.length) {
    gpsLapList.innerHTML = '<div class="gps-lap-empty">라인 통과가 2회 이상 검출되지 않았습니다. 라인이 트랙 전체 폭을 가로지르는지 확인하십시오.</div>';
    return;
  }

  gpsLapList.innerHTML = laps.map(lap => {
    const isBest = Math.abs(lap.duration - best) < 0.0005;
    const delta = lap.duration - best;
    return `<details class="gps-lap-row${isBest ? ' best' : ''}">
      <summary>
        <span><i class="gps-lap-color-dot" style="--lap-color:${GPS_LAP_COLORS[(lap.number - 1) % GPS_LAP_COLORS.length]}"></i>LAP ${lap.number}</span>
        <span class="lap-time">${formatLapTime(lap.duration)}<small>${formatGpsLapDistance(lap.distanceMeters)}</small></span>
        <span class="lap-delta">${isBest ? 'BEST' : `+${delta.toFixed(3)}`}</span>
      </summary>
      <div class="gps-lap-detail">
        <span>CSV 구간 <strong>${lap.startTime.toFixed(2)}s → ${lap.endTime.toFixed(2)}s</strong></span>
        <span>GPS 시각 <strong>${formatGpsClock(lap.startGpsTime)} → ${formatGpsClock(lap.endGpsTime)}</strong></span>
        <span>GPS 주행거리 <strong>${formatGpsLapDistance(lap.distanceMeters)}</strong></span>
        <div class="gps-lap-jump-buttons">
          <button type="button" data-lap-time="${lap.startTime}">시작 지점으로 이동</button>
          <button type="button" data-lap-time="${lap.endTime}">종료 지점으로 이동</button>
        </div>
      </div>
    </details>`;
  }).join('');
  if (gpsCheckpointAdd) gpsCheckpointAdd.disabled = !laps.length;
  if (gpsCheckpoints.length) renderGpsSectorComparison();
}

function getGpsSectorMetrics(startTime, endTime, exitSpeed) {
  const startIndex = Math.max(0, findGlobalIndexAtTime(startTime));
  const endIndex = Math.max(startIndex, findGlobalIndexAtTime(endTime));
  let minimumSpeed = Infinity;
  let minimumIndex = startIndex;
  let brakeTime = NaN;
  for (let index = startIndex; index <= endIndex; index += 1) {
    const row = globalData[index];
    const speed = Number(row?.gps_speed_kmh) || 0;
    if (speed < minimumSpeed) {
      minimumSpeed = speed;
      minimumIndex = index;
    }
    if (!Number.isFinite(brakeTime) && getCalibratedBrake(row?.front_brake_raw) >= 5) brakeTime = row.time_sec;
  }
  let throttleTime = NaN;
  for (let index = minimumIndex; index <= endIndex; index += 1) {
    const row = globalData[index];
    if ((Number(row?.decoded_tps) || 0) >= 20) {
      throttleTime = row.time_sec;
      break;
    }
  }
  return {
    duration: endTime - startTime,
    exitSpeed: Number(exitSpeed) || 0,
    minimumSpeed: Number.isFinite(minimumSpeed) ? minimumSpeed : 0,
    brakeOffset: Number.isFinite(brakeTime) ? brakeTime - startTime : NaN,
    throttleOffset: Number.isFinite(throttleTime) ? throttleTime - startTime : NaN
  };
}

function renderGpsSectorComparison() {
  if (!gpsSectorCard || !gpsSectorTable) return;
  if (!gpsCheckpoints.length || !gpsLapResults.length) {
    gpsSectorCard.hidden = true;
    gpsSectorTable.innerHTML = '';
    return;
  }
  const checkpointCrossings = gpsCheckpoints.map(checkpoint => findGpsLineCrossings(checkpoint, 3));
  const lapIndexes = gpsSelectedLapIndices.length
    ? gpsSelectedLapIndices
    : gpsLapResults.map((_, index) => index);
  const sectors = gpsCheckpoints.map((_, checkpointIndex) => ({ name: `S${checkpointIndex + 1} → CP${checkpointIndex + 1}`, rows: [] }));
  sectors.push({ name: `S${gpsCheckpoints.length + 1} → FINISH`, rows: [] });

  lapIndexes.forEach(lapIndex => {
    const lap = gpsLapResults[lapIndex];
    let sectorStart = lap.startTime;
    let valid = true;
    checkpointCrossings.forEach((crossings, checkpointIndex) => {
      if (!valid) return;
      const crossing = crossings.find(item => item.time > sectorStart + 0.05 && item.time < lap.endTime - 0.05);
      if (!crossing) {
        sectors[checkpointIndex].rows.push({ lapIndex, missing: true });
        valid = false;
        return;
      }
      sectors[checkpointIndex].rows.push({ lapIndex, ...getGpsSectorMetrics(sectorStart, crossing.time, crossing.speed) });
      sectorStart = crossing.time;
    });
    if (valid) {
      sectors[sectors.length - 1].rows.push({
        lapIndex,
        ...getGpsSectorMetrics(sectorStart, lap.endTime, gpsSpeedAtTelemetryTime(lap.endTime))
      });
    } else {
      sectors[sectors.length - 1].rows.push({ lapIndex, missing: true });
    }
  });

  const comparisonHtml = sectors.map(sector => {
    const validRows = sector.rows.filter(row => !row.missing);
    const bestDuration = validRows.length ? Math.min(...validRows.map(row => row.duration)) : NaN;
    const rows = sector.rows.map(row => {
      const lap = gpsLapResults[row.lapIndex];
      if (row.missing) return `<tr><td style="--lap-color:${GPS_LAP_COLORS[row.lapIndex % GPS_LAP_COLORS.length]}"><i class="gps-lap-color-dot"></i>LAP ${lap.number}</td><td colspan="5">통과 기록 없음</td></tr>`;
      const bestClass = Math.abs(row.duration - bestDuration) < 0.0005 ? ' class="best-sector"' : '';
      return `<tr${bestClass}>
        <td style="--lap-color:${GPS_LAP_COLORS[row.lapIndex % GPS_LAP_COLORS.length]}"><i class="gps-lap-color-dot"></i>LAP ${lap.number}</td>
        <td>${row.duration.toFixed(3)} s</td>
        <td>${row.exitSpeed.toFixed(1)} km/h</td>
        <td>${row.minimumSpeed.toFixed(1)} km/h</td>
        <td>${Number.isFinite(row.brakeOffset) ? `+${row.brakeOffset.toFixed(2)} s` : '—'}</td>
        <td>${Number.isFinite(row.throttleOffset) ? `+${row.throttleOffset.toFixed(2)} s` : '—'}</td>
      </tr>`;
    }).join('');
    return `<section class="gps-sector-group"><h4>${sector.name}</h4><table><thead><tr><th>LAP</th><th>구간 기록</th><th>통과 속도</th><th>최저속도</th><th>브레이크 ≥5%</th><th>가속 ≥20%</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join('');
  gpsSectorTable.innerHTML = comparisonHtml;
  if (gpsSectorOverlayTable) gpsSectorOverlayTable.innerHTML = comparisonHtml;
  gpsSectorCard.hidden = false;
}

function closeGpsSectorOverlay() {
  if (gpsSectorOverlay) gpsSectorOverlay.hidden = true;
  gpsSectorToggle?.classList.remove('active');
}

function toggleGpsSectorOverlay() {
  if (!gpsCheckpoints.length) return;
  const shouldOpen = Boolean(gpsSectorOverlay?.hidden);
  if (shouldOpen) {
    closeGpsFullscreenDetail();
    renderGpsSectorComparison();
  }
  if (gpsSectorOverlay) gpsSectorOverlay.hidden = !shouldOpen;
  gpsSectorToggle?.classList.toggle('active', shouldOpen);
}

function updateGpsVideoControlAvailability() {
  const enabled = gpsFinishPoints.length === 2;
  if (gpsGoProFile) gpsGoProFile.disabled = !enabled;
  gpsGoProOpen?.classList.toggle('disabled', !enabled);
  gpsGoProOpen?.setAttribute('aria-disabled', String(!enabled));
  gpsYouTubeOpen?.setAttribute('aria-disabled', String(!enabled));
}

function requireGpsFinishLineForVideo(event) {
  if (gpsFinishPoints.length === 2) return true;
  event?.preventDefault();
  setGpsLapStatus('영상 동기화를 사용하려면 먼저 피니시 라인을 설정하십시오.', 'warn');
  return false;
}

function crossingElapsedSeconds(previous, current) {
  if (Number.isFinite(previous.gpsTime) && Number.isFinite(current.gpsTime)) {
    const gpsElapsed = current.gpsTime - previous.gpsTime;
    if (gpsElapsed > 0 && gpsElapsed < 3600) return { duration: gpsElapsed, basis: 'gps' };
  }
  return { duration: current.time - previous.time, basis: 'logger' };
}

function calculateGpsLaps() {
  if (gpsFinishPoints.length !== 2) return;
  if (gpsLapPoints.length < 2) {
    renderGpsLapResults([], []);
    setGpsLapStatus('유효한 GPS fix가 부족합니다.', 'warn');
    return;
  }

  const origin = {
    lat: (gpsFinishPoints[0].lat + gpsFinishPoints[1].lat) * 0.5,
    lon: (gpsFinishPoints[0].lon + gpsFinishPoints[1].lon) * 0.5
  };
  const a = latLonToLocalMeters(gpsFinishPoints[0], origin);
  const b = latLonToLocalMeters(gpsFinishPoints[1], origin);
  const line = { x: b.x - a.x, y: b.y - a.y };
  const lineLengthSq = line.x * line.x + line.y * line.y;
  if (lineLengthSq < 4) {
    setGpsLapStatus('피니시 라인은 2m 이상으로 지정하십시오.', 'warn');
    return;
  }

  const candidates = [];
  for (let i = 1; i < gpsLapPoints.length; i++) {
    const prev = gpsLapPoints[i - 1];
    const curr = gpsLapPoints[i];
    const dt = curr.time - prev.time;
    if (!(dt > 0 && dt <= 2.0)) continue;
    const segmentDistance = distanceMeters(prev, curr);
    if (segmentDistance / dt > 120) continue;

    const p = latLonToLocalMeters(prev, origin);
    const q = latLonToLocalMeters(curr, origin);
    const pRel = { x: p.x - a.x, y: p.y - a.y };
    const qRel = { x: q.x - a.x, y: q.y - a.y };
    const sidePrev = cross2(line, pRel);
    const sideCurr = cross2(line, qRel);
    if (sidePrev === 0 || sideCurr === 0 || sidePrev * sideCurr >= 0) continue;

    const fraction = sidePrev / (sidePrev - sideCurr);
    if (!(fraction >= 0 && fraction <= 1)) continue;
    const intersection = {
      x: p.x + (q.x - p.x) * fraction,
      y: p.y + (q.y - p.y) * fraction
    };
    const u = ((intersection.x - a.x) * line.x + (intersection.y - a.y) * line.y) / lineLengthSq;
    if (u < 0 || u > 1) continue;

    const speed = prev.speed + (curr.speed - prev.speed) * fraction;
    if (speed < 10) continue;
    candidates.push({
      time: prev.time + dt * fraction,
      gpsTime: Number.isFinite(prev.gpsTime) && Number.isFinite(curr.gpsTime)
        ? prev.gpsTime + (curr.gpsTime - prev.gpsTime) * fraction
        : NaN,
      lat: prev.lat + (curr.lat - prev.lat) * fraction,
      lon: prev.lon + (curr.lon - prev.lon) * fraction,
      direction: sideCurr > sidePrev ? 1 : -1,
      speed
    });
  }

  if (!candidates.length) {
    renderGpsLapResults([], []);
    setGpsLapStatus('선 통과를 찾지 못했습니다. 라인을 트랙 폭 전체에 걸쳐 다시 설정하십시오.', 'warn');
    return;
  }

  // 첫 통과 방향을 정방향으로 삼고 반대 방향 통과와 근접 중복 검출을 제거합니다.
  const forwardDirection = candidates[0].direction;
  const minLapSeconds = Math.max(5, Number(gpsLapMinTime?.value) || 20);
  const crossings = [];
  candidates.forEach(candidate => {
    if (candidate.direction !== forwardDirection) return;
    const previous = crossings[crossings.length - 1];
    if (previous && crossingElapsedSeconds(previous, candidate).duration < minLapSeconds) return;
    crossings.push(candidate);
  });

  const laps = [];
  for (let i = 1; i < crossings.length; i++) {
    const elapsed = crossingElapsedSeconds(crossings[i - 1], crossings[i]);
    if (elapsed.duration < minLapSeconds) continue;
    laps.push({
      number: laps.length + 1,
      duration: elapsed.duration,
      timeBasis: elapsed.basis,
      startTime: crossings[i - 1].time,
      endTime: crossings[i].time,
      startGpsTime: crossings[i - 1].gpsTime,
      endGpsTime: crossings[i].gpsTime,
      startLat: crossings[i - 1].lat,
      startLon: crossings[i - 1].lon,
      endLat: crossings[i].lat,
      endLon: crossings[i].lon
    });
  }

  laps.forEach(lap => {
    lap.distanceMeters = calculateGpsLapDistance(lap);
  });

  renderGpsLapResults(crossings, laps);
  setGpsLapStatus(laps.length ? `${laps.length}개 랩 계산 완료 · 통과 시각 선형 보간 적용` : '첫 통과만 검출되어 완성된 랩이 없습니다.', laps.length ? 'ok' : 'warn');
}

function clearGpsLapAnalysis(removeSaved = false, clearCPs = false) {
  gpsLapSelectionActive = false;
  gpsFinishPoints = [];
  if (clearCPs) {
    clearGpsCheckpoints(removeSaved);
  }
  if (gpsGoProSourceType || gpsGoProMatched) closeGoProVideo();
  closeYouTubeDialog();
  gpsLapResults = [];
  refreshPage4Selectors();
  gpsHandlingEventsData = [];
  gpsHandlingVisible = false;
  gpsHandlingAnalysisReady = false;
  gpsHandlingLayer?.clearLayers();
  if (gpsHandlingCard) gpsHandlingCard.hidden = true;
  if (gpsHandlingToggle) {
    gpsHandlingToggle.disabled = true;
    gpsHandlingToggle.classList.remove('active');
    gpsHandlingToggle.setAttribute('aria-pressed', 'false');
  }
  gpsSelectedLapIndex = -1;
  gpsSelectedLapIndices = [];
  gpsLapRouteLines = [];
  clearGpsCompareMarkers();
  if (gpsFinishLine && gpsMap) gpsMap.removeLayer(gpsFinishLine);
  gpsFinishLine = null;
  if (gpsFinishPreviewLine && gpsMap) gpsMap.removeLayer(gpsFinishPreviewLine);
  gpsFinishPreviewLine = null;
  gpsFinishMarkers = [];
  if (gpsFinishEndpointLayer) gpsFinishEndpointLayer.clearLayers();
  if (gpsLapCrossingLayer) gpsLapCrossingLayer.clearLayers();
  if (gpsLapRouteLayer) gpsLapRouteLayer.clearLayers();
  if (gpsRouteLine) gpsRouteLine.setStyle({ opacity: 0.8, weight: 5 });
  if (gpsLapMapLegend) {
    gpsLapMapLegend.hidden = true;
    gpsLapMapLegend.innerHTML = '';
  }
  if (gpsFullscreenLapTimes) {
    gpsFullscreenLapTimes.hidden = true;
    gpsFullscreenLapTimes.innerHTML = '';
  }
  updateGpsCursorLapColor(Number(scrollBar?.value));
  if (tabGps?.classList.contains('active') && activeSampledData.length) {
    syncGpsTimelineRange(currentStartSec, currentEndSec, scrollBar.value);
  }
  if (gpsLapSetLine) gpsLapSetLine.classList.remove('active');
  if (gpsLapClear) gpsLapClear.disabled = true;
  if (gpsMap) gpsMap.getContainer().classList.remove('gps-lap-selecting');
  if (gpsLapCount) gpsLapCount.textContent = '0 LAPS';
  if (gpsLapBestTime) gpsLapBestTime.textContent = '--:--.---';
  if (gpsLapAverageDistance) gpsLapAverageDistance.textContent = '--.- m';
  if (gpsLapFixSummary) gpsLapFixSummary.textContent = '피니시 라인을 설정하지 않았습니다.';
  if (gpsLapList) gpsLapList.innerHTML = '<div class="gps-lap-empty">지도에서 피니시 라인의 양 끝을 클릭하면 자동으로 랩을 계산합니다.</div>';
  setGpsLapStatus('지도에서 라인 양 끝을 차례로 선택하십시오.');
  updateGpsVideoControlAvailability();
  if (removeSaved) removeSavedGpsFixedLines();
}

function beginGpsFinishLineSelection() {
  if (!gpsMap || gpsLapPoints.length < 2) {
    setGpsLapStatus('먼저 GPS 데이터가 포함된 CSV를 불러오십시오.', 'warn');
    return;
  }
  if (gpsFinishPoints.length === 2 && !verifyGpsFixedLinesPassword('피니시 라인을 다시 설정')) return;
  clearGpsLapAnalysis(false, false);
  gpsLapSelectionActive = true;
  gpsLapSetLine?.classList.add('active');
  gpsMap.getContainer().classList.add('gps-lap-selecting');
  setGpsLapStatus('피니시 라인의 첫 번째 끝점을 클릭하십시오.', 'warn');
}

function cancelGpsFinishLineSelection() {
  if (!gpsLapSelectionActive) return false;
  gpsLapSelectionActive = false;
  gpsFinishPoints = [];
  gpsLapSetLine?.classList.remove('active');
  gpsMap?.getContainer().classList.remove('gps-lap-selecting');
  if (gpsFinishPreviewLine && gpsMap) gpsMap.removeLayer(gpsFinishPreviewLine);
  gpsFinishPreviewLine = null;
  gpsFinishMarkers = [];
  gpsFinishEndpointLayer?.clearLayers();
  setGpsLapStatus('피니시 라인 설정을 취소했습니다. 다시 설정 버튼을 눌러 시작하십시오.');
  updateGpsVideoControlAvailability();
  return true;
}

function handleGpsLapMapClick(event) {
  if (!gpsLapSelectionActive) return;
  gpsFinishPoints.push({ lat: event.latlng.lat, lon: event.latlng.lng });
  if (gpsFinishPoints.length === 1) {
    drawGpsFinishFirstPoint();
    setGpsLapStatus('이제 피니시 라인의 반대쪽 끝점을 클릭하십시오.', 'warn');
    return;
  }

  gpsLapSelectionActive = false;
  gpsLapSetLine?.classList.remove('active');
  gpsMap.getContainer().classList.remove('gps-lap-selecting');
  if (gpsLapClear) gpsLapClear.disabled = false;
  if (gpsFinishPreviewLine) gpsMap.removeLayer(gpsFinishPreviewLine);
  gpsFinishPreviewLine = null;
  drawGpsFinishLine();
  if (gpsCheckpointClear) gpsCheckpointClear.disabled = false;
  saveGpsFixedLines();
  calculateGpsLaps();
  updateGpsVideoControlAvailability();
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
  gpsFinishEndpointLayer = L.layerGroup().addTo(gpsMap);
  gpsLapRouteLayer = L.layerGroup().addTo(gpsMap);
  gpsHandlingLayer = L.layerGroup().addTo(gpsMap);
  gpsLapCrossingLayer = L.layerGroup().addTo(gpsMap);
  gpsCheckpointLayer = L.layerGroup().addTo(gpsMap);
  gpsCheckpointDraftLayer = L.layerGroup().addTo(gpsMap);
  gpsDistanceReferenceLayer = L.layerGroup().addTo(gpsMap);
  gpsMap.on('click', handleGpsLapMapClick);
  gpsMap.on('click', handleGpsCheckpointMapClick);
  gpsMap.on('mousemove', updateGpsFinishPreview);
  gpsMap.on('mousemove', updateGpsCheckpointPreview);
  gpsMap.on('zoom', updateGpsCursorScale);
}

gpsLapSetLine?.addEventListener('click', beginGpsFinishLineSelection);
gpsLapClear?.addEventListener('click', () => clearGpsLapAnalysis(true));
gpsCheckpointAdd?.addEventListener('click', beginGpsCheckpointSelection);
gpsSectorToggle?.addEventListener('click', toggleGpsSectorOverlay);
gpsSectorOverlayClose?.addEventListener('click', closeGpsSectorOverlay);
gpsHandlingToggle?.addEventListener('click', () => {
  gpsHandlingVisible = !gpsHandlingVisible;
  gpsHandlingToggle.classList.toggle('active', gpsHandlingVisible);
  gpsHandlingToggle.setAttribute('aria-pressed', String(gpsHandlingVisible));
  if (gpsHandlingVisible && !gpsHandlingAnalysisReady) {
    analyzeGpsHandlingBalance();
    return;
  }
  if (gpsHandlingCard) gpsHandlingCard.hidden = !gpsHandlingVisible;
  if (gpsHandlingVisible) renderGpsHandlingAnalysis(gpsHandlingSteeringRatio);
  else drawGpsHandlingEvents();
});
gpsHandlingEvents?.addEventListener('click', event => {
  const button = event.target.closest('[data-handling-time]');
  if (!button) return;
  setGpsPlayback(false);
  const time = Number(button.dataset.handlingTime);
  updateGpsCursorAtTime(time);
  const handlingEvent = gpsHandlingEventsData.find(item => Math.abs(item.peak.time - time) < 0.01);
  if (handlingEvent?.position) gpsMap?.panTo([handlingEvent.position.lat, handlingEvent.position.lon]);
});
gpsCheckpointClear?.addEventListener('click', () => {
  if (!verifyGpsFixedLinesPassword('피니시라인과 체크포인트를 초기화')) return;
  if (!window.confirm(`피니시라인과 체크포인트 ${gpsCheckpoints.length}개를 모두 삭제하시겠습니까?`)) return;
  clearGpsLapAnalysis(true);
  setGpsLapStatus('피니시라인과 체크포인트를 모두 초기화했습니다.');
});
gpsSharedSettingsCopy?.addEventListener('click', async () => {
  if (gpsFinishPoints.length !== 2) return;
  const settings = JSON.stringify({
    finish: gpsFinishPoints,
    checkpoints: gpsCheckpoints,
    steering: (typeof steeringCal !== 'undefined') ? {
      zeroRaw: steeringCal.zeroRaw,
      axisLimit: steeringCal.axisLimit,
      invert: steeringCal.invert
    } : null
  });
  try {
    await navigator.clipboard.writeText(settings);
    setGpsLapStatus('공통 설정이 복사되었습니다. 채팅창에 붙여넣어 보내주십시오.', 'ok');
  } catch (error) {
    window.prompt('아래 공통 설정을 복사해 채팅창에 보내주십시오.', settings);
  }
});
gpsLapMinTime?.addEventListener('change', () => {
  const clamped = Math.max(5, Math.min(600, Number(gpsLapMinTime.value) || 20));
  gpsLapMinTime.value = String(clamped);
  if (gpsFinishPoints.length === 2) calculateGpsLaps();
});

gpsAxisModeControl?.addEventListener('click', event => {
  const button = event.target.closest('button[data-mode]');
  if (!button || button.dataset.mode === gpsAxisMode) return;
  if (button.dataset.mode === 'distance' && !gpsLapResults.length) {
    setGpsLapStatus('거리축을 사용하려면 먼저 피니시라인으로 랩을 계산하십시오.', 'warn');
    return;
  }
  if (button.dataset.mode === 'distance' && !gpsSelectedLapIndices.length) selectGpsLapView(0);
  gpsAxisMode = button.dataset.mode;
  gpsAxisModeControl.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
  const detailAxisLabel = gpsFullscreenDetail?.querySelector('.gps-detail-head span');
  if (detailAxisLabel) detailAxisLabel.textContent = gpsAxisMode === 'distance' ? '공통 중심 거리 동기화' : '현재 시점 동기화';
  drawGpsDistanceReference();
  rebuildGpsDetailChartsForSelection();
  updateGpsDetailChartRange(Number(scrollBar.min), Number(scrollBar.max));
  updateGpsCursorAtTime(Number(scrollBar.value));
});

gpsLapMapLegend?.addEventListener('click', event => {
  const button = event.target.closest('[data-lap-view]');
  if (!button) return;
  const index = button.dataset.lapView === 'all' ? -1 : Number(button.dataset.lapView);
  selectGpsLapView(index);
});

gpsFullscreenLapTimes?.addEventListener('click', event => {
  const button = event.target.closest('[data-lap-panel-view]');
  if (!button) return;
  const index = button.dataset.lapPanelView === 'all' ? -1 : Number(button.dataset.lapPanelView);
  selectGpsLapView(index);
});

gpsFullscreenDetailToggle?.addEventListener('click', () => {
  const stage = gpsFullscreenDetailToggle.closest('.gps-map-stage');
  const open = !gpsFullscreenDetail.classList.contains('open');
  if (open) closeGpsSectorOverlay();
  gpsFullscreenDetail.classList.toggle('open', open);
  stage?.classList.toggle('gps-detail-open', open);
  gpsFullscreenDetailToggle.textContent = open ? '상세정보 닫기 ›' : '상세정보 ›';
  if (open) {
    ensureGpsDetailCharts();
    if (gpsSelectedLapIndices.length || gpsAxisMode === 'distance') rebuildGpsDetailChartsForSelection();
    updateGpsDetailChartRange(Number(scrollBar.min), Number(scrollBar.max));
    updateGpsDetailCursors(Number(scrollBar.value));
  }
  setTimeout(() => {
    gpsMap?.invalidateSize();
    refitGpsMapToCurrentLapView();
    gpsDetailCharts.forEach(chart => chart.resize());
    updateGpsDetailCursors(Number(scrollBar.value));
  }, 100);
});

function setGpsAppFullscreen(active) {
  const card = gpsMapFullscreen.closest('.gps-map-card');
  if (!card) return;
  card.classList.toggle('gps-map-fullscreen-fallback', active);
  card.classList.toggle('is-gps-fullscreen', active);
  document.body.classList.toggle('gps-map-fullscreen-open', active);
  gpsMapFullscreen.textContent = active ? '✕ 전체화면 종료' : '⛶ 전체화면';
  if (active) refreshGpsFullscreenOverlays();
  else closeGpsFullscreenDetail();
  setTimeout(() => {
    gpsMap?.invalidateSize();
    refitGpsMapToCurrentLapView();
    updateGpsFullscreenTimelineVisual();
  }, 80);
}

gpsMapFullscreen?.addEventListener('click', () => {
  const card = gpsMapFullscreen.closest('.gps-map-card');
  setGpsAppFullscreen(!card?.classList.contains('gps-map-fullscreen-fallback'));
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (cancelGpsCheckpointSelection()) {
    event.preventDefault();
    return;
  }
  if (cancelGpsFinishLineSelection()) {
    event.preventDefault();
    return;
  }
  if (gpsSectorOverlay && !gpsSectorOverlay.hidden) {
    closeGpsSectorOverlay();
    event.preventDefault();
    return;
  }
  const card = gpsMapFullscreen?.closest('.gps-map-card');
  if (card?.classList.contains('gps-map-fullscreen-fallback')) setGpsAppFullscreen(false);
});

document.addEventListener('fullscreenchange', () => {
  const card = gpsMapFullscreen?.closest('.gps-map-card');
  const active = document.fullscreenElement === card;
  card?.classList.toggle('is-gps-fullscreen', active);
  if (!active) closeGpsFullscreenDetail();
  if (gpsMapFullscreen) gpsMapFullscreen.textContent = active ? '✕ 전체화면 종료' : '⛶ 전체화면';
  if (active) refreshGpsFullscreenOverlays();
  setTimeout(() => {
    gpsMap?.invalidateSize();
    refitGpsMapToCurrentLapView();
    updateGpsFullscreenTimelineVisual();
  }, 80);
});
gpsLapList?.addEventListener('click', event => {
  const summary = event.target.closest('summary');
  if (summary && gpsLapList.contains(summary)) {
    const details = summary.closest('.gps-lap-row');
    requestAnimationFrame(() => {
      if (!details || !details.open) return;
      const hiddenBelow = details.getBoundingClientRect().bottom - gpsLapList.getBoundingClientRect().bottom;
      if (hiddenBelow > 0) gpsLapList.scrollTop += hiddenBelow;
    });
  }

  const row = event.target.closest('[data-lap-time]');
  if (!row) return;
  const targetTime = Number(row.dataset.lapTime);
  if (Number.isFinite(targetTime)) {
    setGpsPlayback(false);
    gpsPlaybackCursorSec = targetTime;
    updateGpsCursorAtTime(targetTime);
  }
});

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
    chartCoolantOil, chartIntakeEcu, chartImuAccel, chartImuGyro, ...page4Charts
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
      if (idx === 0) dataset.borderColor = isDark ? '#fd79a8' : '#db2777';
      if (idx === 1) dataset.borderColor = isDark ? '#4ade80' : '#22c55e';
      if (idx === 2) dataset.borderColor = isDark ? '#74b9ff' : '#2563eb';
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
if (tabComparison) {
  tabComparison.addEventListener('click', () => switchTab('comparison'));
}
if (tabCooling) {
  tabCooling.addEventListener('click', () => switchTab('cooling'));
}
if (tabRealtime) {
  tabRealtime.addEventListener('click', () => switchTab('realtime'));
}
if (tabHelp) {
  tabHelp.addEventListener('click', () => switchTab('help'));
}

function updateTabNavArrowState() {
  if (!tabNavigation || tabNavPrev?.hidden || tabNavNext?.hidden) return;
  const maxScroll = Math.max(0, tabNavigation.scrollWidth - tabNavigation.clientWidth);
  tabNavPrev.disabled = tabNavigation.scrollLeft <= 1;
  tabNavNext.disabled = tabNavigation.scrollLeft >= maxScroll - 1;
}

function refreshTabNavArrows() {
  if (!tabNavigation || !tabNavPrev || !tabNavNext) return;
  // Measure with both arrows removed so they do not create overflow themselves.
  tabNavPrev.hidden = true;
  tabNavNext.hidden = true;
  const hasOverflow = tabNavigation.scrollWidth > tabNavigation.clientWidth + 2;
  tabNavPrev.hidden = !hasOverflow;
  tabNavNext.hidden = !hasOverflow;
  if (!hasOverflow) tabNavigation.scrollLeft = 0;
  else requestAnimationFrame(updateTabNavArrowState);
}

tabNavPrev?.addEventListener('click', () => tabNavigation?.scrollBy({ left: -260, behavior: 'smooth' }));
tabNavNext?.addEventListener('click', () => tabNavigation?.scrollBy({ left: 260, behavior: 'smooth' }));
tabNavigation?.addEventListener('scroll', updateTabNavArrowState, { passive: true });
window.addEventListener('resize', refreshTabNavArrows);
requestAnimationFrame(refreshTabNavArrows);
document.fonts?.ready?.then(refreshTabNavArrows);
document.querySelectorAll('.view-tab').forEach(button => button.addEventListener('click', () => {
  requestAnimationFrame(() => {
    button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    setTimeout(updateTabNavArrowState, 260);
  });
}));

pageHelp?.addEventListener('click', event => {
  if (event.target.closest('[data-distance-method-open]')) {
    if (typeof helpDistanceMethodDialog?.showModal === 'function') helpDistanceMethodDialog.showModal();
    else helpDistanceMethodDialog?.setAttribute('open', '');
    return;
  }
  const button = event.target.closest('[data-help-tab]');
  if (button) switchTab(button.dataset.helpTab);
});
helpDistanceMethodClose?.addEventListener('click', () => helpDistanceMethodDialog?.close());
helpDistanceMethodDialog?.addEventListener('click', event => {
  if (event.target === helpDistanceMethodDialog) helpDistanceMethodDialog.close();
});

// Keyboard shortcuts: number row and numeric keypad 1–8 switch pages.
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
    Digit5: 'comparison',
    Numpad5: 'comparison',
    Digit6: 'cooling',
    Numpad6: 'cooling',
    Digit7: 'realtime',
    Numpad7: 'realtime',
    Digit8: 'help',
    Numpad8: 'help'
  };
  const mode = pageByKey[event.code];
  if (!mode) return;

  event.preventDefault();
  switchTab(mode);
});

function switchTab(mode) {
  if (mode !== 'gps' && gpsPlaybackActive) setGpsPlayback(false);
  if (mode !== 'temperature' && page4PlaybackActive) setPage4Playback(false);
  if (mode !== 'comparison') window.stopDriverComparisonPlayback?.();

  // Remove active from all tabs and pages
  tabGeneral.classList.remove('active');
  tabDiagnostics.classList.remove('active');
  if (tabGps) tabGps.classList.remove('active');
  if (tabTemperature) tabTemperature.classList.remove('active');
  if (tabComparison) tabComparison.classList.remove('active');
  if (tabCooling) tabCooling.classList.remove('active');
  if (tabRealtime) tabRealtime.classList.remove('active');
  if (tabHelp) tabHelp.classList.remove('active');

  pageGeneral.classList.remove('active');
  pageDiagnostics.classList.remove('active');
  if (pageGps) pageGps.classList.remove('active');
  if (pageTemperature) pageTemperature.classList.remove('active');
  if (pageComparison) pageComparison.classList.remove('active');
  if (pageCooling) pageCooling.classList.remove('active');
  if (pageRealtime) pageRealtime.classList.remove('active');
  if (pageHelp) pageHelp.classList.remove('active');

  clearAllDomCursors();

  // 실시간과 도움말 페이지는 로그 재생용 타임라인이 필요 없으므로 숨깁니다.
  if (timelineNavigator) {
    timelineNavigator.style.display = (mode === 'realtime' || mode === 'help' || mode === 'comparison') ? 'none' : '';
  }

  if (mode === 'comparison') {
    tabComparison?.classList.add('active');
    pageComparison?.classList.add('active');
    setTimeout(() => window.renderDriverComparison?.(), 50);
    return;
  }

  if (mode === 'help') {
    if (tabHelp) tabHelp.classList.add('active');
    if (pageHelp) {
      pageHelp.classList.add('active');
      pageHelp.scrollTop = 0;
    }
    return;
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

  if (mode === 'cooling') {
    if (tabCooling) tabCooling.classList.add('active');
    if (pageCooling) pageCooling.classList.add('active');
    if (lblScrollType) lblScrollType.textContent = '🌡️ 온도 그래프 좌우 스크롤:';
    setTimeout(() => {
      [chartCoolantOil, chartIntakeEcu].forEach(chart => {
        if (chart) { chart.resize(); chart.update('none'); }
      });
      drawCssIntersectionDots(currentCursorIndex, [chartCoolantOil, chartIntakeEcu]);
    }, 50);
    applyZoomRange(currentStartSec, currentEndSec);
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
      lblScrollType.textContent = '🏁 선택 구간 커서:';
    }
    // 숨겨진 상태에서 세션·랩 선택이 바뀌었을 수 있으므로 페이지를
    // 표시하는 순간 데이터셋과 축 범위를 현재 선택 기준으로 다시 만든다.
    applyPage4Selection();
    setTimeout(() => {
      page4Charts.forEach(c => {
        if (c) {
          c.resize();
          c.update();
        }
      });
      drawPage4GTrace();
      drawPage4TrackMap(page4CursorTime);
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
  // 시간축 확대/축소는 실제 그래프가 그려진 canvas 위에서만 동작합니다.
  // 카드, 지도, 수치, 랩 목록의 세로 스크롤은 가로채지 않습니다.
  const chartCanvas = e.target.closest('canvas');
  const page4Chart = chartCanvas ? page4Charts.find(chart => chart?.canvas === chartCanvas) : null;
  if (page4Chart && tabTemperature?.classList.contains('active')) {
    if (!globalData.length || !(page4RangeEnd > page4RangeStart)) return;
    e.preventDefault();
    if (zoomPending) return;
    zoomPending = true;
    requestAnimationFrame(() => {
      // Page 4 always zooms around the synchronized orange cursor line, not
      // around the current mouse position. This keeps the inspected sample
      // fixed on screen while the surrounding time span changes.
      zoomPage4At(page4CursorTime, e.deltaY < 0 ? 0.92 : 1.08);
      zoomPending = false;
    });
    return;
  }
  if (!chartCanvas || !chartCanvas.closest('.canvas-holder, .canvas-holder-sub')) return;
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
  if (tabTemperature?.classList.contains('active') && page4RangeEnd > page4RangeStart) {
    const origin = page4AxisValue(page4RangeStart);
    const duration = page4AxisValue(page4RangeEnd) - origin;
    const relativeStart = Math.max(0, Math.min(duration, start));
    const relativeEnd = Math.max(relativeStart + 0.01, Math.min(duration, end));
    refreshPage4VisibleRange(page4TimeFromAxis(origin + relativeStart), page4TimeFromAxis(origin + relativeEnd));
    return;
  }
  
  limitStartSec = Math.max(0, start);
  limitEndSec = Math.min(totalDurationSec, end);
  if (limitStartSec >= limitEndSec) {
    limitEndSec = Math.min(limitStartSec + 5, totalDurationSec);
  }

  applyZoomRange(limitStartSec, limitEndSec);
});

btnReset.addEventListener('click', () => {
  if (tabTemperature?.classList.contains('active') && page4RangeEnd > page4RangeStart) {
    refreshPage4VisibleRange(page4RangeStart, page4RangeEnd);
    return;
  }
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

function updateColumnCursorLine(lineId, chart, index, targetTimeOverride = NaN) {
  const lineEl = document.getElementById(lineId);
  if (!lineEl) return;

  if (!chart || !chart.chartArea || index === undefined || index === null) {
    lineEl.style.display = 'none';
    return;
  }

  const targetTime = Number.isFinite(targetTimeOverride) ? targetTimeOverride : Number(activeSampledData[index]?.time_sec);
  const xScale = chart.scales?.x;
  if (!Number.isFinite(targetTime) || !xScale) {
    lineEl.style.display = 'none';
    return;
  }

  const pointX = xScale.getPixelForValue(targetTime);
  if (Number.isFinite(pointX)) {
    const canvas = chart.canvas;
    const container = lineEl.parentElement;
    
    // Calculate relative left offset of canvas inside the container, accounting for parent border width
    const rectCanvas = canvas.getBoundingClientRect();
    const rectContainer = container.getBoundingClientRect();
    const borderLeft = parseFloat(window.getComputedStyle(container).borderLeftWidth) || 0;
    const relativeLeft = (rectCanvas.left - rectContainer.left) - borderLeft;

    // Center the 2px-wide cursor line on point.x (subtract 1px for half-width)
    lineEl.style.left = (relativeLeft + pointX - 1) + 'px';
    lineEl.style.display = 'block';
  } else {
    lineEl.style.display = 'none';
  }
}

function nearestDatasetPointIndex(data, targetTime) {
  if (!Array.isArray(data) || !data.length || !Number.isFinite(targetTime)) return -1;
  let lo = 0;
  let hi = data.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (Number(data[mid]?.x) < targetTime) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(Number(data[lo - 1]?.x) - targetTime) <= Math.abs(Number(data[lo]?.x) - targetTime)) return lo - 1;
  return lo;
}

// HIGH-PERFORMANCE: Places bright circles directly on the intersection points of the chart lines
function drawCssIntersectionDots(index, chartSubset = null, targetTimeOverride = NaN) {
  if (globalData.length === 0 || activeSampledData.length === 0) return;

  const targetCharts = chartSubset || [
    chartSpeed, chartRpm, chartGear, chartSteering, chartThrottleBrake,
    diagChartThrottleBrake, diagChartSteering, chartFL, chartFR, chartRL, chartRR,
    chartCoolantOil, chartIntakeEcu, chartImuAccel, chartImuGyro, ...page4Charts
  ];
  
  targetCharts.forEach(chart => {
    if (!chart || !chart.chartArea) return;
    
    const canvas = chart.canvas;
    const holder = canvas.parentElement;
    
    const existingDots = holder.querySelectorAll('.visual-cursor-dot');
    existingDots.forEach(dot => dot.style.display = 'none');

    const targetTime = Number.isFinite(targetTimeOverride) ? targetTimeOverride : Number(activeSampledData[index]?.time_sec);
    const page4ChartIndex = page4Charts.indexOf(chart);
    const exactGlobalIndex = page4ChartIndex >= 0 ? findGlobalIndexAtTime(targetTime) : -1;
    const exactRow = exactGlobalIndex >= 0 ? globalData[exactGlobalIndex] : null;
    const exactX = chart.scales?.x?.getPixelForValue(page4ChartIndex >= 0 ? page4AxisValue(targetTime) : targetTime);
    const page4Items = page4ChartIndex >= 0 ? page4SelectedItems() : [];
    const page4Primary = page4Items[0];
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta.hidden) {
        const synchronizedItem = page4ChartIndex >= 0 && Number.isFinite(page4PlaybackElapsed) && page4Items.length > 1
          ? page4Items.find(item => item.selectionIndex === dataset.page4SelectionIndex)
          : null;
        const synchronizedTime = synchronizedItem ? page4ItemDisplayTime(synchronizedItem, page4Primary, targetTime) : NaN;
        const synchronizedRowIndex = synchronizedItem ? page4RowIndexAtTime(synchronizedItem.session.rows || [], synchronizedTime) : -1;
        const synchronizedRow = synchronizedRowIndex >= 0 ? synchronizedItem.session.rows[synchronizedRowIndex] : null;
        const synchronizedAxis = synchronizedItem ? page4ItemAxisValue(synchronizedItem, synchronizedTime, page4Primary) : NaN;
        // Datasets may use different visible-range resolutions. Match each dot
        // by timestamp instead of assuming every dataset shares one index.
        const targetAxis = Number.isFinite(synchronizedAxis) ? synchronizedAxis : (page4ChartIndex >= 0 ? page4AxisValue(targetTime) : targetTime);
        const pointIndex = nearestDatasetPointIndex(dataset.data, targetAxis);
        const point = meta.data[pointIndex];
        const page4SeriesIndex = Number.isInteger(dataset.page4SeriesIndex) ? dataset.page4SeriesIndex : datasetIndex;
        const page4Series = page4ChartIndex >= 0 ? PAGE4_CHART_SPECS[page4ChartIndex]?.series?.[page4SeriesIndex] : null;
        const valueRow = synchronizedRow || exactRow;
        const valueIndex = synchronizedItem?.session.id === page4ActiveSessionId ? synchronizedRowIndex : exactGlobalIndex;
        const exactValue = page4Series && valueRow ? page4SeriesValue(page4Series, valueRow, valueIndex) : NaN;
        const yScale = chart.scales?.[dataset.yAxisID || 'y'];
        const synchronizedX = Number.isFinite(synchronizedAxis) ? chart.scales?.x?.getPixelForValue(synchronizedAxis) : NaN;
        const dotX = Number.isFinite(synchronizedX) ? synchronizedX : (Number.isFinite(exactX) ? exactX : point?.x);
        const dotY = Number.isFinite(exactValue) && yScale ? yScale.getPixelForValue(exactValue) : point?.y;
        if (point && Number.isFinite(dotX) && Number.isFinite(dotY)) {
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
          dot.style.left = `${dotX}px`;
          dot.style.top = `${dotY}px`;
        }
      }
    });
  });

  // 세로 관통 커서선 위치 업데이트
  updateColumnCursorLine('cursor-line-page1-left', chartSpeed, index, targetTimeOverride);
  updateColumnCursorLine('cursor-line-page1-right', chartSteering, index, targetTimeOverride);
  updateColumnCursorLine('cursor-line-page2-top', diagChartThrottleBrake, index, targetTimeOverride);
  updateColumnCursorLine('cursor-line-page2-bot-left', chartFL, index, targetTimeOverride);
  updateColumnCursorLine('cursor-line-page2-bot-right', chartFR, index, targetTimeOverride);
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

// Read playback cursor values from the same full-resolution filtered arrays
// used to build the IMU chart. Interpolate between adjacent 100 Hz samples so
// a 60 fps cursor follows the filtered curve instead of snapping to a raw row.
function getFilteredImuRowAtTime(row, targetTime, nearbyIndex) {
  if (!gpsImuLpf || !gpsImuLpf.checked || nearbyIndex < 0 ||
      typeof channelValueAt !== 'function') return row;

  let lowerIndex = nearbyIndex;
  while (lowerIndex > 0 && globalData[lowerIndex].time_sec > targetTime) lowerIndex--;
  const upperIndex = Math.min(globalData.length - 1, lowerIndex + 1);
  const lowerTime = globalData[lowerIndex].time_sec;
  const upperTime = globalData[upperIndex].time_sec;
  const ratio = upperTime > lowerTime
    ? Math.max(0, Math.min(1, (targetTime - lowerTime) / (upperTime - lowerTime)))
    : 0;

  const displayRow = Object.create(row);
  const channels = {
    imu_accel_x_g: 'imu_ax',
    imu_accel_y_g: 'imu_ay',
    imu_gyro_x_dps: 'imu_gx',
    imu_gyro_y_dps: 'imu_gy',
    imu_gyro_z_dps: 'imu_gz'
  };
  Object.entries(channels).forEach(([rowKey, channelKey]) => {
    const lower = channelValueAt(channelKey, lowerIndex);
    const upper = channelValueAt(channelKey, upperIndex);
    if (Number.isFinite(lower) && Number.isFinite(upper)) {
      displayRow[rowKey] = lower + (upper - lower) * ratio;
    } else if (Number.isFinite(lower)) {
      displayRow[rowKey] = lower;
    }
  });
  return displayRow;
}

function updateGpsCursorAtTime(targetTime, playbackFrame = false) {
  if (!activeSampledData.length || !Number.isFinite(targetTime)) return;
  const minTime = Number(scrollBar.min) || 0;
  const maxTime = Number(scrollBar.max) || totalDurationSec;
  const clampedTime = Math.max(minTime, Math.min(maxTime, targetTime));
  updateGpsDistancePosition(clampedTime);
  if (gpsSelectedLapIndices.length > 1) {
    scrollBar.value = clampedTime.toFixed(2);
    if (gpsPlayTime) gpsPlayTime.textContent = `${clampedTime.toFixed(2)} s`;
    if (gpsFullscreenTimeline) {
      gpsFullscreenTimeline.value = clampedTime.toFixed(2);
      updateGpsFullscreenTimelineVisual();
    }
    const primaryLap = gpsLapResults[gpsSelectedLapIndices[0]];
    const primaryTime = primaryLap.startTime + Math.min(clampedTime, primaryLap.duration);
    const primaryIndex = findGlobalIndexAtTime(primaryTime);
    if (gpsFullscreenPlayTime) gpsFullscreenPlayTime.textContent = `${formatGpsClock(gpsClockAtTelemetryTime(primaryTime, primaryIndex))} KST`;
    const primaryRow = primaryIndex >= 0 ? globalData[primaryIndex] : null;
    if (primaryRow) {
      currentCursorIndex = findSampleIndexAtTime(primaryTime);
      const displayRow = getFilteredImuRowAtTime(primaryRow, primaryTime, primaryIndex);
      const gpsPosition = getInterpolatedGpsPosition(primaryTime, primaryIndex);
      updateNumericDisplays(displayRow, gpsPosition, clampedTime);
      updateGpsCompareMarkers(clampedTime);
      updateGpsDetailCursors(clampedTime);
      gpsFullscreenLapTimes?.querySelectorAll('[data-lap-time-row]').forEach(row => {
        row.classList.toggle('active', gpsSelectedLapIndices.includes(Number(row.dataset.lapTimeRow)));
      });
      const live = gpsFullscreenLapTimes?.querySelector('[data-lap-live]');
      if (live) {
        live.textContent = `${gpsSelectedLapIndices.length}개 랩 비교 · ${formatLapTime(clampedTime)}`;
        live.style.color = '#f97316';
      }
      syncGoProVideo(primaryTime, !playbackFrame);
    }
    return;
  }
  currentCursorIndex = findSampleIndexAtTime(clampedTime);
  // Numeric widgets, G meter and map use the original 100 Hz row. Charts keep
  // their 4,500-point series and only move the cursor to the nearest sample.
  const globalIndex = globalData.length ? findGlobalIndexAtTime(clampedTime) : -1;
  const row = globalIndex >= 0 ? globalData[globalIndex] : activeSampledData[currentCursorIndex];
  scrollBar.value = clampedTime.toFixed(2);
  if (gpsPlayTime) gpsPlayTime.textContent = `${clampedTime.toFixed(2)} s`;
  if (gpsFullscreenTimeline) {
    gpsFullscreenTimeline.value = clampedTime.toFixed(2);
    updateGpsFullscreenTimelineVisual();
  }
  if (gpsFullscreenPlayTime) gpsFullscreenPlayTime.textContent = `${formatGpsClock(gpsClockAtTelemetryTime(clampedTime, globalIndex))} KST`;
  if (row) {
    const displayRow = getFilteredImuRowAtTime(row, clampedTime, globalIndex);
    const gpsPosition = getInterpolatedGpsPosition(clampedTime, globalIndex);
    updateNumericDisplays(displayRow, gpsPosition, clampedTime);
    updateGpsCursorLapColor(clampedTime);
    updateGpsDetailCursors(clampedTime);
    drawExactImuCursor(clampedTime, displayRow);
    syncGoProVideo(clampedTime, !playbackFrame);
  }
}

function gpsFullPlaybackRange() {
  if (gpsSelectedLapIndices.length === 1) {
    const lap = gpsLapResults[gpsSelectedLapIndices[0]];
    if (lap) return { min: lap.startTime, max: lap.endTime };
  }
  if (gpsSelectedLapIndices.length > 1) {
    return { min: 0, max: Math.max(...gpsSelectedLapIndices.map(index => gpsLapResults[index]?.duration || 0)) };
  }
  return { min: 0, max: totalDurationSec };
}

function followGpsPlaybackCursor(targetTime, fullRange) {
  if (gpsAxisMode === 'distance') return;
  const viewMin = Number(scrollBar.min), viewMax = Number(scrollBar.max);
  const span = viewMax - viewMin, fullSpan = fullRange.max - fullRange.min;
  if (!(span > 0) || !(fullSpan > span + 0.01)) return;
  const margin = span * 0.12;
  if (targetTime > viewMin + margin && targetTime < viewMax - margin) return;
  let min = targetTime >= viewMax - margin ? targetTime - span * 0.78 : targetTime - span * 0.22;
  min = Math.max(fullRange.min, Math.min(fullRange.max - span, min));
  // GPS 페이지의 기본 그래프와 전체화면 상세 그래프가 같은 창을 보도록
  // 공통 차트 범위도 함께 이동시킨 뒤 타임라인 값을 복원합니다.
  applyZoomRange(min, min + span);
  syncGpsTimelineRange(min, min + span, targetTime);
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
  if (gpsFullscreenPlayToggle) {
    gpsFullscreenPlayToggle.textContent = gpsPlaybackActive ? '❚❚ 일시정지' : '▶ 재생';
    gpsFullscreenPlayToggle.classList.toggle('playing', gpsPlaybackActive);
  }
  if (!gpsPlaybackActive) {
    const cursorTime = Number(scrollBar?.value) || gpsPlaybackCursorSec;
    syncGoProVideo(getGoProTargetTelemetryTime(cursorTime), true);
    requestAnimationFrame(updateGpsFullscreenTimelineVisual);
    return;
  }

  let minTime = Number(scrollBar.min) || 0;
  let maxTime = Number(scrollBar.max) || totalDurationSec;
  const videoLapPair = gpsGoProMatched ? getGoProLapPair() : null;
  const selectedSingleLap = gpsSelectedLapIndices.length === 1 ? gpsLapResults[gpsSelectedLapIndices[0]] : null;
  if (videoLapPair) {
    const longerVideoLapDuration = Math.max(
      gpsLapResults[videoLapPair.primaryIndex].duration,
      gpsLapResults[videoLapPair.compareIndex].duration
    );
    const currentValue = Number(scrollBar.value) || 0;
    syncGpsTimelineRange(0, longerVideoLapDuration, Math.min(currentValue, longerVideoLapDuration));
    minTime = 0;
    maxTime = longerVideoLapDuration;
  }
  const fullPlaybackRange = gpsFullPlaybackRange();
  const playbackEndTime = fullPlaybackRange.max;
  gpsPlaybackCursorSec = Number(scrollBar.value);
  if (!Number.isFinite(gpsPlaybackCursorSec) || gpsPlaybackCursorSec >= playbackEndTime - 0.01) {
    gpsPlaybackCursorSec = fullPlaybackRange.min;
    followGpsPlaybackCursor(gpsPlaybackCursorSec, fullPlaybackRange);
    updateGpsCursorAtTime(gpsPlaybackCursorSec);
  }
  syncGoProVideo(getGoProTargetTelemetryTime(gpsPlaybackCursorSec), true);

  const playbackStep = timestamp => {
    if (!gpsPlaybackActive) return;
    if (gpsPlaybackLastTimestamp === null) {
      gpsPlaybackLastTimestamp = timestamp;
      gpsPlaybackFrame = requestAnimationFrame(playbackStep);
      return;
    }

    // 랩을 바꾼 직후 영상 탐색·디코딩이 실제 재생 상태가 될 때까지 텔레메트리도
    // 같은 위치에서 기다립니다. 준비 시간만큼 커서가 먼저 출발하는 현상을 막습니다.
    if (isGoProPlaybackWaiting()) {
      gpsPlaybackLastTimestamp = timestamp;
      syncGoProVideo(getGoProTargetTelemetryTime(gpsPlaybackCursorSec), false);
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
    if (gpsPlaybackCursorSec >= playbackEndTime) {
      gpsPlaybackCursorSec = fullPlaybackRange.min;
      followGpsPlaybackCursor(gpsPlaybackCursorSec, fullPlaybackRange);
      updateGpsCursorAtTime(gpsPlaybackCursorSec, true);
    } else {
      followGpsPlaybackCursor(gpsPlaybackCursorSec, fullPlaybackRange);
      updateGpsCursorAtTime(gpsPlaybackCursorSec, true);
    }
    gpsPlaybackFrame = requestAnimationFrame(playbackStep);
  };

  gpsPlaybackFrame = requestAnimationFrame(playbackStep);
}

if (gpsPlayToggle) {
  gpsPlayToggle.addEventListener('click', () => setGpsPlayback(!gpsPlaybackActive));
}
gpsFullscreenPlayToggle?.addEventListener('click', () => setGpsPlayback(!gpsPlaybackActive));
gpsFullscreenPlayRate?.addEventListener('change', () => {
  if (gpsPlayRate) gpsPlayRate.value = gpsFullscreenPlayRate.value;
});
gpsPlayRate?.addEventListener('change', () => {
  if (gpsFullscreenPlayRate) gpsFullscreenPlayRate.value = gpsPlayRate.value;
});
gpsFullscreenTimeline?.addEventListener('input', event => {
  const targetTime = Number(event.target.value);
  if (!Number.isFinite(targetTime)) return;
  setGpsPlayback(false);
  gpsPlaybackCursorSec = targetTime;
  updateGpsCursorAtTime(targetTime);
  updateGpsFullscreenTimelineVisual();
});
window.addEventListener('resize', updateGpsFullscreenTimelineVisual);
let page4ResponsiveRedrawFrame = 0;
window.addEventListener('resize', () => {
  if (!tabTemperature?.classList.contains('active')) return;
  cancelAnimationFrame(page4ResponsiveRedrawFrame);
  page4ResponsiveRedrawFrame = requestAnimationFrame(() => {
    drawPage4GTrace();
    drawPage4TrackMap(page4CursorTime);
  });
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gpsPlaybackActive) setGpsPlayback(false);
});

function closeYouTubeDialog() {
  if (gpsYouTubeDialog?.open) gpsYouTubeDialog.close();
}

function showYouTubeError(message) {
  gpsGoProMatched = false;
  gpsGoProSourceType = '';
  destroyYouTubePlayers();
  gpsGoProPanel?.classList.remove('youtube-source');
  gpsGoProPanel?.closest('.gps-map-stage')?.classList.remove('gps-video-loaded');
  if (gpsGoProPanel) gpsGoProPanel.hidden = false;
  if (gpsGoProStatus) {
    gpsGoProStatus.textContent = message;
    gpsGoProStatus.className = 'error';
  }
}

async function connectYouTubeVideo(rawUrl) {
  const videoId = extractYouTubeVideoId(rawUrl);
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new Error('올바른 YouTube 영상 링크를 입력하세요.');
  }
  if (!globalData.length) throw new Error('먼저 CSV를 열어주세요.');

  setGpsPlayback(false);
  closeGoProVideo();
  gpsGoProSourceType = 'youtube';
  gpsYouTubeVideoId = videoId;
  gpsGoProPanel.hidden = false;
  gpsGoProPanel.classList.add('youtube-source');
  gpsGoProStatus.textContent = 'YouTube 설명의 시작 시각과 영상 길이를 확인하는 중…';
  gpsGoProStatus.className = '';

  await loadYouTubeIframeApi();
  const primaryMount = ensureYouTubeMount('gps-youtube-player', '.gps-gopro-primary-slot');
  const compareMount = ensureYouTubeMount('gps-youtube-compare-player', '.gps-gopro-compare-slot');
  [gpsYouTubePrimaryPlayer, gpsYouTubeComparePlayer] = await Promise.all([
    createYouTubePlayer(primaryMount, videoId),
    createYouTubePlayer(compareMount, videoId)
  ]);
  const [playerMetadata, apiMetadata] = await Promise.all([
    waitForYouTubeMetadata(gpsYouTubePrimaryPlayer),
    fetchYouTubeMetadata(videoId)
  ]);
  if (!(playerMetadata.duration > 0)) throw new Error('YouTube 영상 길이를 확인하지 못했습니다. 처리가 끝난 뒤 다시 시도하세요.');

  // 새 영상은 설명의 전용 태그를 사용합니다. 기존 제목 규칙은 과거 영상 호환용입니다.
  const creationDate = parseYouTubeDescriptionKstStartDate(apiMetadata.description) ||
    parseYouTubeKstStartDate(apiMetadata.title || playerMetadata.title);
  if (!creationDate) {
    throw new Error('영상 설명에서 시작 시각을 찾지 못했습니다. 설명에 NSSUR_START_KST=2026-08-11 15:13:24.000 형식의 한 줄을 추가하세요.');
  }
  const match = matchGoProToCsv(creationDate, playerMetadata.duration);
  if (!match?.matched) {
    const videoRange = match
      ? `${formatGpsClock(match.videoStart)}~${formatGpsClock(match.videoStart + playerMetadata.duration)} KST`
      : '시간 확인 불가';
    const csvRange = match?.range
      ? `${formatGpsClock(match.range.first.clock)}~${formatGpsClock(match.range.last.clock)} KST`
      : '시간 확인 불가';
    throw new Error(`시간이 겹치지 않아 연결할 수 없습니다. 영상 ${videoRange} · CSV ${csvRange}`);
  }

  gpsGoProTelemetryStartSec = match.telemetryStart;
  gpsGoProMatched = true;
  gpsGoProAudioSlot = 'primary';
  gpsGoProPanel.closest('.gps-map-stage')?.classList.add('gps-video-loaded');
  updateGoProComparisonLayout();
  gpsGoProStatus.textContent = `YouTube · 영상 시작 ${formatGpsClock(match.videoStartClock)} KST · CSV와 ${formatKoreanDuration(match.overlap)} 겹침 · 자동 동기화 완료`;
  gpsGoProStatus.className = 'success';
  window.localStorage?.setItem('nssur-youtube-url', rawUrl);
  syncGoProVideo(Number(scrollBar.value) || 0, true);
  window.setTimeout(() => {
    gpsMap?.invalidateSize();
    refitGpsMapToCurrentLapView();
  }, 100);
}

gpsYouTubeOpen?.addEventListener('click', () => {
  if (!requireGpsFinishLineForVideo()) return;
  const savedUrl = window.localStorage?.getItem('nssur-youtube-url') || '';
  if (gpsYouTubeUrl && !gpsYouTubeUrl.value) gpsYouTubeUrl.value = savedUrl;
  if (typeof gpsYouTubeDialog?.showModal === 'function') gpsYouTubeDialog.showModal();
  else gpsYouTubeDialog?.setAttribute('open', '');
  window.setTimeout(() => gpsYouTubeUrl?.focus(), 0);
});
gpsGoProPrimaryAudio?.addEventListener('click', () => toggleGoProAudio('primary'));
gpsGoProCompareAudio?.addEventListener('click', () => toggleGoProAudio('compare'));
gpsYouTubeUrlClear?.addEventListener('click', () => {
  if (gpsYouTubeUrl) gpsYouTubeUrl.value = '';
  window.localStorage?.removeItem('nssur-youtube-url');
  gpsYouTubeUrl?.focus();
});
gpsGoProOpen?.addEventListener('click', event => requireGpsFinishLineForVideo(event));
gpsYouTubeCancel?.addEventListener('click', closeYouTubeDialog);
gpsYouTubeCancelBottom?.addEventListener('click', closeYouTubeDialog);
gpsYouTubeDialog?.addEventListener('click', event => {
  if (event.target === gpsYouTubeDialog) closeYouTubeDialog();
});
gpsYouTubeForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const rawUrl = gpsYouTubeUrl?.value.trim() || '';
  closeYouTubeDialog();
  try {
    await connectYouTubeVideo(rawUrl);
  } catch (error) {
    showYouTubeError(error.message || 'YouTube 영상을 연결하지 못했습니다.');
  }
});

helpVideoTitleFile?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  helpVideoTitleStatus.textContent = 'MP4 내부 촬영 시작 시각을 읽는 중…';
  helpVideoTitleStatus.classList.remove('success', 'error');
  helpVideoTitleOutput.value = '';
  helpVideoDescriptionOutput.value = '';
  helpVideoTitleCopy.disabled = true;
  helpVideoDescriptionCopy.disabled = true;
  try {
    const creationDate = await extractMp4CreationDate(file);
    if (!creationDate) throw new Error('MP4 내부 촬영 시작 시각을 찾지 못했습니다. GoPro 원본 MP4인지 확인하세요.');
    const metadata = makeYouTubeUploadMetadata(file, creationDate);
    helpVideoTitleOutput.value = metadata.title;
    helpVideoDescriptionOutput.value = metadata.description;
    helpVideoTitleCopy.disabled = false;
    helpVideoDescriptionCopy.disabled = false;
    helpVideoTitleStatus.textContent = `${file.name} · 영상 시작 ${metadata.startText} KST · 동기화 설명 생성 완료`;
    helpVideoTitleStatus.classList.add('success');
  } catch (error) {
    helpVideoTitleStatus.textContent = error.message || '영상 정보를 읽지 못했습니다.';
    helpVideoTitleStatus.classList.add('error');
  }
});
helpVideoTitleCopy?.addEventListener('click', () => copyHelpVideoText(helpVideoTitleOutput.value, helpVideoTitleCopy, '제목 복사'));
helpVideoDescriptionCopy?.addEventListener('click', () => copyHelpVideoText(helpVideoDescriptionOutput.value, helpVideoDescriptionCopy, '설명 복사'));

gpsGoProClose?.addEventListener('click', closeGoProVideo);
gpsGoProFile?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  setGpsPlayback(false);
  closeGoProVideo();
  gpsGoProSourceType = 'local';
  gpsGoProPanel?.classList.remove('youtube-source');
  gpsGoProFile.value = '';
  if (!globalData.length) {
    gpsGoProPanel.hidden = false;
    gpsGoProStatus.textContent = '먼저 CSV를 열어주세요.';
    gpsGoProStatus.className = 'error';
    return;
  }
  gpsGoProPanel.hidden = false;
  gpsGoProStatus.textContent = 'MP4 촬영 시각을 확인하는 중…';
  gpsGoProStatus.className = '';
  try {
    const creationDate = await extractMp4CreationDate(file);
    if (!creationDate) throw new Error('MP4 내부 촬영 시각을 찾을 수 없습니다.');
    gpsGoProObjectUrl = URL.createObjectURL(file);
    gpsGoProVideo.src = gpsGoProObjectUrl;
    if (gpsGoProCompareVideo) gpsGoProCompareVideo.src = gpsGoProObjectUrl;
    await new Promise((resolve, reject) => {
      gpsGoProVideo.onloadedmetadata = resolve;
      gpsGoProVideo.onerror = () => reject(new Error('브라우저에서 이 MP4를 재생할 수 없습니다.'));
    });
    const videoDuration = gpsGoProVideo.duration;
    const match = matchGoProToCsv(creationDate, videoDuration);
    if (!match?.matched) {
      gpsGoProMatched = false;
      gpsGoProVideo.removeAttribute('src');
      gpsGoProCompareVideo?.removeAttribute('src');
      URL.revokeObjectURL(gpsGoProObjectUrl);
      gpsGoProObjectUrl = '';
      const videoRange = match
        ? `${formatGpsClock(match.videoStart)}~${formatGpsClock(match.videoStart + videoDuration)} KST`
        : '시간 확인 불가';
      const csvRange = match?.range
        ? `${formatGpsClock(match.range.first.clock)}~${formatGpsClock(match.range.last.clock)} KST`
        : '시간 확인 불가';
      gpsGoProStatus.textContent = `시간이 겹치지 않아 연결할 수 없습니다. 영상 ${videoRange} · CSV ${csvRange}`;
      gpsGoProStatus.className = 'error';
      return;
    }
    gpsGoProTelemetryStartSec = match.telemetryStart;
    gpsGoProMatched = true;
    gpsGoProAudioSlot = 'primary';
    gpsGoProPanel.closest('.gps-map-stage')?.classList.add('gps-video-loaded');
    updateGoProComparisonLayout();
    gpsGoProStatus.textContent = `영상 시작 ${formatGpsClock(match.videoStartClock)} KST · CSV와 ${formatKoreanDuration(match.overlap)} 겹침 · 자동 동기화 완료`;
    gpsGoProStatus.className = 'success';
    syncGoProVideo(Number(scrollBar.value) || 0, true);
    setTimeout(() => {
      gpsMap?.invalidateSize();
      refitGpsMapToCurrentLapView();
    }, 100);
  } catch (error) {
    gpsGoProMatched = false;
    gpsGoProStatus.textContent = error.message || 'MP4 시간 정보를 읽지 못했습니다.';
    gpsGoProStatus.className = 'error';
  }
});
function applyGpsImuLowPassFilter() {
  const keys = ['imu_ax', 'imu_ay', 'imu_gx', 'imu_gy', 'imu_gz'];
  if (!gpsImuLpf || typeof getFilterState !== 'function' ||
      typeof recomputeChannel !== 'function') return;
  const cutoffHz = Number(gpsImuLpfFrequency ? gpsImuLpfFrequency.value : 5) || 5;
  keys.forEach(key => {
    const state = getFilterState(key);
    state.type = gpsImuLpf.checked ? 'butter' : 'none';
    state.params = gpsImuLpf.checked ? { fc: cutoffHz, order: 2 } : {};
    recomputeChannel(key);
  });
  refreshChartsAfterFilter();
  if (page4Charts.length && page4SelectedLapIndex >= 0) applyPage4Selection();
  updateGpsCursorAtTime(Number(scrollBar.value) || 0);
}

if (gpsImuLpf) {
  gpsImuLpf.addEventListener('change', applyGpsImuLowPassFilter);
}
if (gpsImuLpfFrequency) {
  gpsImuLpfFrequency.addEventListener('change', () => {
    if (gpsImuLpf && gpsImuLpf.checked) applyGpsImuLowPassFilter();
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
  document.querySelectorAll('.steering-series-toggle').forEach(button => {
    button.addEventListener('click', () => {
      if (!chartSteering) return;
      const enabled = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(enabled));
      button.classList.toggle('active', enabled);
      chartSteering.setDatasetVisibility(Number(button.dataset.dataset), enabled);
      chartSteering.update('none');
    });
  });
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
    if (tabTemperature?.classList.contains('active') && page4RangeEnd > page4RangeStart) {
      const relativeAxis = parseFloat(lastDragEvent.target.value);
      if (!isNaN(relativeAxis)) {
        setPage4Playback(false);
        updatePage4PlaybackCursor(page4TimeFromAxis(page4AxisValue(page4RangeStart) + relativeAxis));
      }
    } else if (tabGps && tabGps.classList.contains('active')) {
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
  if (typeof channelValueAt === 'function' && globalData.length) {
    const v = channelValueAt(key, numericCursorGlobalIndex);
    if (v !== null && Number.isFinite(v)) return v;
  }
  return fallback;
}

// Numeric labels updates helper
function updateNumericDisplays(row, gpsPositionOverride = null, displayTimeOverride = null) {
  const displayTime = Number.isFinite(displayTimeOverride) ? displayTimeOverride : row.time_sec;
  // 그래프의 센서별 해상도와 무관하게 숫자는 커서가 가리키는 원본 100 Hz
  // CSV 행을 사용합니다. 기존 4,500점 화면 샘플 인덱스를 사용하면 확대 시
  // 선은 움직이는데 숫자가 여러 프레임 동안 멈춰 보였습니다.
  const sourceTime = Number(row?.time_sec);
  if (Number.isFinite(sourceTime) && globalData.length) {
    numericCursorGlobalIndex = findGlobalIndexAtTime(sourceTime);
  }
  if (currentTimeVal) {
    let timeText = displayTime.toFixed(2) + 's';
    if (row.gps_time && row.gps_time.trim() !== "" && row.gps_time !== "00:00:00.00") {
      timeText += ` (${row.gps_time})`;
    }
    currentTimeVal.textContent = timeText;
  }
  updatePage4Widgets(row);

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
    steeringWheelGraphic.style.transform = `rotate(${steeringWheelDisplayAngle(steeringDeg)}deg)`;
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
    diagWheel.style.transform = `rotate(${steeringWheelDisplayAngle(steeringDeg)}deg)`;
  }

  // 3페이지(GPS 지도) 우측 상단 조향각 위젯 연동
  if (gpsSteeringWheelGraphic) {
    gpsSteeringWheelGraphic.style.transform = `rotate(${steeringWheelDisplayAngle(steeringDeg)}deg)`;
  }
  if (gpsCursorSteering) {
    gpsCursorSteering.textContent = (steeringDeg >= 0 ? '+' : '') + steeringDeg.toFixed(1);
  }

  const susText = (key, wheel, raw) => {
    const v = cursorChannelValue(key, getCalibratedSuspension(wheel, raw));
    return Number.isFinite(v) ? `${v.toFixed(2)} mm` : '----';
  };
  cursorSusFl.textContent = susText('sus_fl', 'fl', row.suspension_fl_raw);
  cursorSusFr.textContent = susText('sus_fr', 'fr', row.suspension_fr_raw);
  cursorSusRl.textContent = susText('sus_rl', 'rl', row.suspension_rl_raw);
  cursorSusRr.textContent = susText('sus_rr', 'rr', row.suspension_rr_raw);

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
            html: '<div class="gps-position-cursor"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          });
          gpsCursorMarker = L.marker([lat, lon], { icon: pulseIcon, zIndexOffset: 10000 }).addTo(gpsMap);
        } else {
          gpsCursorMarker.setLatLng([lat, lon]);
        }
        gpsCursorMarker.setZIndexOffset(10000);
        gpsCursorMarker.getElement()?.classList.add('gps-cursor-top');
        updateGpsCursorScale();
        updateGpsCursorLapColor(displayTime);
      }
    } else {
      cursorGpsCoords.textContent = '--.------, ---.------';
    }
  }

  // GPS 속도 vs FL 휠속도 비교 (휠 슬립 / 속도 보정 오차 확인용)
  const gpsSpd = parseFloat(row.gps_speed_kmh) || 0.0;
  const wheelSpd = cursorChannelValue('fl_speed', row.fl_speed_kmh || 0);
  if (gpsCursorSpeed) gpsCursorSpeed.textContent = gpsSpd.toFixed(1);
  if (gpsFullscreenSpeedValue) gpsFullscreenSpeedValue.textContent = gpsSpd.toFixed(1);
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

function handleFile(file, options = {}) {
  if (!file.name.endsWith('.csv') && !file.name.endsWith('.CSV')) {
    alert('CSV 형식의 로그 파일만 업로드할 수 있습니다.');
    return;
  }
  if (!options.skipUpload) primaryDashboardFile = file;

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
      if (!options.skipUpload) uploadFileToServer(file);
      const snapshot = {
        file,
        rows: globalData,
        gpsPoints: gpsLapPoints,
        laps: gpsLapResults,
        checkpoints: gpsCheckpoints
      };
      if (!options.skipUpload) primaryDashboardSnapshot = snapshot;
      if (typeof options.onComplete === 'function') {
        options.onComplete(snapshot);
      }
      if (!options.skipUpload) {
        window.setPrimaryPage4Session?.(snapshot);
        window.setPrimaryComparisonSession?.(snapshot);
      }
    },
    error: function (err) {
      statusBadge.className = 'status-badge inactive';
      statusText.textContent = '파싱 오류!';
      alert('CSV 파일을 읽는 중 오류가 발생했습니다: ' + err.message);
      if (typeof options.onError === 'function') options.onError(err);
    }
  });
}

window.restorePrimaryDashboardFile = function () {
  return new Promise(resolve => {
    if (!primaryDashboardFile) { resolve(false); return; }
    // Comparison imports temporarily reuse the dashboard parser. Restore the
    // already parsed primary session from memory instead of parsing the same CSV again.
    if (primaryDashboardSnapshot?.file === primaryDashboardFile) {
      globalData = primaryDashboardSnapshot.rows;
      initDataAndDashboard();
      gpsLapPoints = primaryDashboardSnapshot.gpsPoints;
      gpsLapResults = primaryDashboardSnapshot.laps;
      gpsCheckpoints = primaryDashboardSnapshot.checkpoints;
      if (loadedFileBadge) {
        loadedFileBadge.textContent = `📄 ${primaryDashboardFile.name}`;
        loadedFileBadge.style.display = 'inline-block';
      }
      resolve(true);
      return;
    }
    handleFile(primaryDashboardFile, {
      skipUpload: true,
      onComplete: () => resolve(true),
      onError: () => resolve(false)
    });
  });
};
window.ensurePrimaryDashboardFile = function (file) {
  if (!primaryDashboardFile && file) primaryDashboardFile = file;
};

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
  visibleChannelSeriesCache.clear();
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
    if (row.__nssurPrepared) return;
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
    // Comparison imports temporarily switch the dashboard dataset. Mark fully
    // decoded rows so restoring an already processed session does not decode
    // every CAN frame a second time.
    row.__nssurPrepared = true;
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
  if (gpsImuLpf?.checked) applyGpsImuLowPassFilter();
  currentCursorIndex = 0;
  preciseCursorTimeSec = Number(activeSampledData[0]?.time_sec) || 0;
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
      gpsLapPoints = buildGpsLapPoints(globalData);
      clearGpsLapAnalysis();
      const restoredFixedLines = restoreGpsFixedLines();
      const initialGpsRow = activeSampledData[currentCursorIndex];
      if (initialGpsRow) updateNumericDisplays(initialGpsRow);
      if (gpsLapFixSummary && gpsLapPoints.length && !restoredFixedLines) {
        gpsLapFixSummary.textContent = `${gpsLapPoints.length.toLocaleString()}개 유효 GPS fix 준비됨`;
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
  if (tabTemperature?.classList.contains('active') && page4RangeEnd > page4RangeStart) {
    syncPage4Navigator();
    return;
  }

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
    if (gpsFullscreenTimeline) {
      gpsFullscreenTimeline.min = scrollBar.min;
      gpsFullscreenTimeline.max = scrollBar.max;
      gpsFullscreenTimeline.step = scrollBar.step;
      gpsFullscreenTimeline.value = scrollBar.value;
      gpsFullscreenTimeline.disabled = scrollBar.disabled;
    }
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

  // Rebuild all visible channels at their measured source resolution.
  refreshVisibleSensorSeries(cleanStart, cleanEnd, false);

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

// Preserve the visible shape while limiting draw cost. Each horizontal
// bucket keeps its first, minimum, maximum and last sample, so short spikes
// are not discarded as they are by uniform interval sampling.
function downsampleEnvelopePoints(points, limit) {
  if (!Array.isArray(points) || points.length <= limit || limit < 6) return points || [];
  const bucketCount = Math.max(1, Math.floor((limit - 2) / 4));
  const interiorEnd = points.length - 1;
  const result = [points[0]];
  let previousIndex = 0;
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.max(1, Math.floor(1 + bucket * (interiorEnd - 1) / bucketCount));
    const end = Math.min(interiorEnd, Math.max(start + 1, Math.floor(1 + (bucket + 1) * (interiorEnd - 1) / bucketCount)));
    let minIndex = start, maxIndex = start;
    for (let index = start + 1; index < end; index += 1) {
      if (Number(points[index]?.y) < Number(points[minIndex]?.y)) minIndex = index;
      if (Number(points[index]?.y) > Number(points[maxIndex]?.y)) maxIndex = index;
    }
    [start, minIndex, maxIndex, end - 1].sort((a, b) => a - b).forEach(index => {
      if (index > previousIndex) { result.push(points[index]); previousIndex = index; }
    });
  }
  if (previousIndex !== points.length - 1) result.push(points.at(-1));
  return result;
}

// Effective sensor rates measured from 김도현1.csv using each source's own
// timestamp/counter (not by counting the logger's repeated 100 Hz rows).
const CHANNEL_SOURCE_HZ = {
  fl_speed: 100, rl_speed: 100, rr_speed: 100,
  steering: 100, brake: 100,
  sus_fl: 100, sus_fr: 100, sus_rl: 100, sus_rr: 100,
  imu_ax: 50, imu_ay: 50, imu_gx: 50, imu_gy: 50, imu_gz: 50,
  rpm: 25, gear: 25, throttle: 25,
  water: 25, oil: 25, iat: 25, ecu: 25
};
const MAX_VISIBLE_SENSOR_POINTS = 4500;
const visibleChannelSeriesCache = new Map();

function visibleSensorIndices(startTime, endTime, sourceHz, preserveAllSourceSamples = false) {
  let lo = 0;
  let hi = globalData.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (globalData[mid].time_sec < startTime) lo = mid + 1;
    else hi = mid;
  }
  const first = Math.max(0, lo - 1);
  lo = first;
  hi = globalData.length - 1;
  while (lo < hi) {
    const mid = ((lo + hi + 1) >> 1);
    if (globalData[mid].time_sec > endTime) hi = mid - 1;
    else lo = mid;
  }
  const last = Math.min(globalData.length - 1, lo + 1);
  const duration = Math.max(0.01, endTime - startTime);
  const sourceInterval = 1 / Math.max(1, sourceHz);
  const displayInterval = preserveAllSourceSamples
    ? sourceInterval
    : Math.max(sourceInterval, duration / Math.max(1, MAX_VISIBLE_SENSOR_POINTS - 1));
  const indices = [first];
  let nextTime = Number(globalData[first].time_sec) + displayInterval;
  for (let index = first + 1; index < last; index += 1) {
    const time = Number(globalData[index].time_sec);
    if (time + 1e-9 < nextTime) continue;
    indices.push(index);
    nextTime = time + displayInterval;
  }
  if (indices[indices.length - 1] !== last) indices.push(last);
  return indices;
}

function fullVisibleChannelSeries(key, sourceHz) {
  const cacheKey = `${key}:${sourceHz}`;
  if (visibleChannelSeriesCache.has(cacheKey)) return visibleChannelSeriesCache.get(cacheKey);
  const start = Number(globalData[0]?.time_sec) || 0;
  const end = Number(globalData.at(-1)?.time_sec) || start;
  const indices = visibleSensorIndices(start, end, sourceHz, true);
  const series = channelSeries(key, indices, indices.map(index => Number(globalData[index]?.time_sec) || 0));
  visibleChannelSeriesCache.set(cacheKey, series);
  return series;
}

function sliceVisiblePointSeries(source, startTime, endTime) {
  if (!source.length) return [];
  let lo = 0, hi = source.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (source[mid].x < startTime) lo = mid + 1; else hi = mid; }
  const first = Math.max(0, lo - 1);
  lo = first; hi = source.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (source[mid].x <= endTime) lo = mid + 1; else hi = mid; }
  return source.slice(first, Math.min(source.length, lo + 1));
}

// Rebuild every visible chart channel at its measured source resolution.
// Short windows retain every sensor update; long windows are capped per
// dataset so the dashboard remains responsive.
function refreshVisibleSensorSeries(startTime, endTime, updateNow = true) {
  if (!globalData.length || typeof channelSeries !== 'function') return;
  const charts = [
    chartSpeed, chartRpm, chartGear, chartSteering, chartThrottleBrake,
    diagChartThrottleBrake, diagChartSteering, chartFL, chartFR, chartRL, chartRR,
    chartCoolantOil, chartIntakeEcu, chartImuAccel, chartImuGyro
  ];
  charts.forEach(chart => {
    if (!chart) return;
    const keys = typeof CHART_CHANNELS !== 'undefined' ? CHART_CHANNELS[chart.canvas.id] : null;
    if (!keys) return;
    keys.forEach((key, datasetIndex) => {
      const hz = CHANNEL_SOURCE_HZ[key] || 100;
      if (chart.data.datasets[datasetIndex]) {
        chart.data.datasets[datasetIndex].data = downsampleEnvelopePoints(
          sliceVisiblePointSeries(fullVisibleChannelSeries(key, hz), startTime, endTime),
          MAX_VISIBLE_SENSOR_POINTS
        );
      }
    });
    if (updateNow) chart.update('none');
  });
}

// 필터 설정이 바뀌었을 때 모든 차트의 데이터셋을 교체하고 즉시 다시 그립니다.
function refreshChartsAfterFilter() {
  if (!globalData.length || !sampleIndices.length) return;
  visibleChannelSeriesCache.clear();

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
    [chartIntakeEcu, 'chart-intake-ecu']
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
  refreshVisibleSensorSeries(currentStartSec, currentEndSec);

  if (typeof refreshFilterBadges === 'function') refreshFilterBadges();

  const exactIndex = globalData.length ? findGlobalIndexAtTime(preciseCursorTimeSec) : -1;
  const row = exactIndex >= 0 ? globalData[exactIndex] : activeSampledData[currentCursorIndex];
  if (row) updateNumericDisplays(row, null, preciseCursorTimeSec);
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
    const xScale = lastActiveChart.scales?.x;
    const chartArea = lastActiveChart.chartArea;
    const eventX = Number(lastChartEvent.x);
    if (xScale && chartArea && Number.isFinite(eventX)) {
      // Convert pointer X directly to time. A shared dataset index is invalid
      // once 25/50/100 Hz channels use different point arrays.
      const clampedX = Math.max(chartArea.left, Math.min(chartArea.right, eventX));
      const targetTime = xScale.getValueForPixel(clampedX);
      if (page4Charts.includes(lastActiveChart)) {
        setPage4Playback(false);
        updatePage4PlaybackCursor(targetTime);
        hoverSyncPending = false;
        return;
      }
      preciseCursorTimeSec = targetTime;
      currentCursorIndex = findSampleIndexAtTime(targetTime);
      const globalIndex = findGlobalIndexAtTime(targetTime);
      const row = globalIndex >= 0 ? globalData[globalIndex] : activeSampledData[currentCursorIndex];
      if (row) {
        drawCssIntersectionDots(currentCursorIndex, null, targetTime);
        updateNumericDisplays(row, null, targetTime);
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
    // The dashboard draws its own timestamp-synchronised cursor dots. Disable
    // Chart.js' retained hover marker because its old dataset index can point
    // somewhere else after visible-range resampling or zooming.
    elements: { point: { radius: 0, hoverRadius: 0, hitRadius: 8 } },
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
      if (page4Charts.some(chart => chart?.canvas === e.chart.canvas)) return;
      const allCharts = {
        chartSpeed, chartRpm, chartGear, chartSteering, chartThrottleBrake,
        diagChartThrottleBrake, diagChartSteering, chartFL, chartFR, chartRL, chartRR,
        chartCoolantOil, chartIntakeEcu, chartImuAccel, chartImuGyro,
        ...Object.fromEntries(page4Charts.map((chart, index) => [`page4Chart${index}`, chart]))
      };
      for (const chart of Object.values(allCharts)) {
        if (chart && chart.canvas === e.chart.canvas) {
          syncHover(chart, e);
          break;
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
  // Keep yaw zero fixed at the vertical center. Without symmetric limits Chart.js
  // auto-fits the visible yaw samples after every timeline zoom, which makes the
  // apparent zero position drift even though the underlying values are unchanged.
  optionsSteering.scales.yYaw = { position: 'right', min: -100, max: 100, display: false, grid: { display: false } };
  optionsSteering.scales.yLat = { position: 'right', min: -2.5, max: 2.5, display: false, grid: { display: false } };
  chartSteering = new Chart(ctxSteering, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Steering Angle',
        data: S('steering', r => getCalibratedSteering(r.steering_raw)),
        borderColor: '#db2777',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false
      }, {
        label: 'Yaw Rate',
        data: S('imu_gz', r => Number(r.imu_gyro_z_dps) || 0),
        borderColor: '#22c55e',
        borderWidth: 1.3,
        borderDash: [7, 4],
        pointRadius: 0,
        fill: false,
        yAxisID: 'yYaw'
      }, {
        label: 'Lateral G',
        data: S('imu_ay', r => Number(r.imu_accel_y_g) || 0),
        borderColor: '#2563eb',
        borderWidth: 1.3,
        borderDash: [3, 4],
        pointRadius: 0,
        fill: false,
        yAxisID: 'yLat'
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
        data: S('sus_fl', r => getCalibratedSuspension('fl', r.suspension_fl_raw)),
        borderColor: '#db2777',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false
      }]
    },
    options: getCommonOptions(null, null, { stepSize: 10 })
  });

  const ctxSusRl = document.getElementById('chart-sus-rl').getContext('2d');
  chartRL = new Chart(ctxSusRl, {
    type: 'line',
    data: {
      datasets: [{
        data: S('sus_rl', r => getCalibratedSuspension('rl', r.suspension_rl_raw)),
        borderColor: '#06b6d4',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false
      }]
    },
    options: getCommonOptions(null, null, { stepSize: 10 })
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

  // ==================== PAGE 4 LAP / SECTOR WORKSPACE ====================
  buildPage4WorkspaceCharts(S, getCommonOptions);

  // ==================== PAGE 5 COOLING / TEMPERATURE ====================
  const coolantOilCanvas = document.getElementById('chart-coolant-oil');
  if (coolantOilCanvas) {
    const coolantOptions = getCommonOptions(0, 150, { stepSize: 25 });
    coolantOptions.scales.ySpeed = {
      position: 'right', min: 0, max: 120, display: true,
      grid: { drawOnChartArea: false },
      ticks: { color: tickColor, font: { family: "'JetBrains Mono', monospace", size: 10 } }
    };
    chartCoolantOil = new Chart(coolantOilCanvas.getContext('2d'), {
      type: 'line',
      data: { datasets: [
        { label: 'Coolant', data: S('water', r => r.water_c || 0), borderColor: '#2563eb', borderWidth: 1.5, pointRadius: 0, fill: false },
        { label: 'Oil', data: S('oil', r => r.oil_c || 0), borderColor: '#f97316', borderWidth: 1.5, pointRadius: 0, fill: false },
        { label: 'FL Speed', data: S('fl_speed', r => r.fl_speed_kmh || 0), borderColor: '#06b6d4', borderWidth: 1.1, borderDash: [6, 4], pointRadius: 0, fill: false, yAxisID: 'ySpeed' }
      ] },
      options: coolantOptions
    });
    applyTemperatureSeriesToggleState(chartCoolantOil, 'coolant');
  }

  const intakeEcuCanvas = document.getElementById('chart-intake-ecu');
  if (intakeEcuCanvas) {
    chartIntakeEcu = new Chart(intakeEcuCanvas.getContext('2d'), {
      type: 'line',
      data: { datasets: [
        { label: 'Intake Air', data: S('iat', r => r.iat_c || 0), borderColor: '#16a34a', borderWidth: 1.5, pointRadius: 0, fill: false },
        { label: 'ECU', data: S('ecu', r => r.ecu_c || 0), borderColor: '#db2777', borderWidth: 1.5, pointRadius: 0, fill: false }
      ] },
      options: getCommonOptions(0, 150, { stepSize: 25 })
    });
    applyTemperatureSeriesToggleState(chartIntakeEcu, 'intake');
  }

  const ctxSusFr = document.getElementById('chart-sus-fr').getContext('2d');
  chartFR = new Chart(ctxSusFr, {
    type: 'line',
    data: {
      datasets: [{
        data: S('sus_fr', r => getCalibratedSuspension('fr', r.suspension_fr_raw)),
        borderColor: '#dc2626',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false
      }]
    },
    options: getCommonOptions(null, null, { stepSize: 10 })
  });

  const ctxSusRr = document.getElementById('chart-sus-rr').getContext('2d');
  chartRR = new Chart(ctxSusRr, {
    type: 'line',
    data: {
      datasets: [{
        data: S('sus_rr', r => getCalibratedSuspension('rr', r.suspension_rr_raw)),
        borderColor: '#2563eb',
        borderWidth: 1.2,
        pointRadius: 0,
        fill: false
      }]
    },
    options: getCommonOptions(null, null, { stepSize: 10 })
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
if (typeof initSuspensionCalibration === 'function') {
  initSuspensionCalibration();
}

// 6번 탭: 실시간 무선 텔레메트리 초기화
if (typeof rtInit === 'function') {
  rtInit();
}

let arrowRepeatCount = 0;
let isKeyboardNavigating = false;
let keyboardNavTimer = null;

function moveChartCursorByKeyboard(direction, event) {
  if (event.repeat) arrowRepeatCount += 1;
  else arrowRepeatCount = 0;
  const baseSeconds = event.shiftKey ? 0.1 : 0.01;
  const multiplier = event.repeat
    ? Math.min(60, Math.floor(1 + (arrowRepeatCount * arrowRepeatCount) / 30))
    : 1;
  const targetTime = Math.max(0, Math.min(totalDurationSec, preciseCursorTimeSec + direction * baseSeconds * multiplier));
  preciseCursorTimeSec = targetTime;
  currentCursorIndex = findSampleIndexAtTime(targetTime);

  const currentSpan = currentEndSec - currentStartSec;
  if (targetTime < currentStartSec) {
    const newStart = targetTime;
    const newEnd = Math.min(totalDurationSec, newStart + currentSpan);
    applyZoomRange(Math.max(0, newEnd - currentSpan), newEnd);
  } else if (targetTime > currentEndSec) {
    const newEnd = targetTime;
    const newStart = Math.max(0, newEnd - currentSpan);
    applyZoomRange(newStart, Math.min(totalDurationSec, newStart + currentSpan));
  }

  const globalIndex = findGlobalIndexAtTime(targetTime);
  const row = globalIndex >= 0 ? globalData[globalIndex] : activeSampledData[currentCursorIndex];
  drawCssIntersectionDots(currentCursorIndex, null, targetTime);
  if (row) updateNumericDisplays(row, null, targetTime);
}

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    arrowRepeatCount = 0;
  }
});

window.addEventListener('keydown', (e) => {
  const key = e.key;

  // Spacebar pressed: toggle playback if on Page 4 or GPS tab, even if a SELECT dropdown was focused
  if (key === ' ' || key === 'Spacebar') {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      return; // Do not intercept spacebar in text input fields
    }
    e.preventDefault();
    if (document.activeElement && document.activeElement.tagName === 'SELECT') {
      document.activeElement.blur();
    }
    if (globalData.length === 0) return;
    if (tabTemperature && tabTemperature.classList.contains('active')) {
      if (!e.repeat) setPage4Playback(!page4PlaybackActive);
    } else if (tabGps && tabGps.classList.contains('active')) {
      if (!e.repeat) setGpsPlayback(!gpsPlaybackActive);
    } else {
      applyZoomRange(0, totalDurationSec);
    }
    return;
  }

  // 입력 필드 및 셀렉트에 포커스가 있을 때는 나머지 단축키를 비활성화합니다.
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT') {
    return;
  }

  if (globalData.length === 0 || activeSampledData.length === 0) return;

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
    if (tabTemperature && tabTemperature.classList.contains('active')) {
      if (!e.repeat) setPage4Playback(!page4PlaybackActive);
    } else if (tabGps && tabGps.classList.contains('active')) {
      if (!e.repeat) setGpsPlayback(!gpsPlaybackActive);
    } else {
      applyZoomRange(0, totalDurationSec);
    }
  }

  // Left/Right Arrow: 커서 미세 이동 (지속 입력 시 가속도 적용 및 뷰포트 자동 스크롤)
  else if (key === 'ArrowLeft') {
    e.preventDefault();
    if (tabTemperature?.classList.contains('active')) {
      setPage4Playback(false);
      const step = page4AxisMode === 'distance' ? (e.shiftKey ? 0.1 : 1) : (e.shiftKey ? 0.01 : 0.1);
      const targetTime = Math.max(page4RangeStart, page4TimeFromAxis(page4AxisValue(page4CursorTime) - step));
      keepPage4CursorInView(targetTime, -1);
      updatePage4PlaybackCursor(targetTime);
    } else moveChartCursorByKeyboard(-1, e);
  } else if (key === 'ArrowRight') {
    e.preventDefault();
    if (tabTemperature?.classList.contains('active')) {
      setPage4Playback(false);
      const step = page4AxisMode === 'distance' ? (e.shiftKey ? 0.1 : 1) : (e.shiftKey ? 0.01 : 0.1);
      const targetTime = Math.min(page4RangeEnd, page4TimeFromAxis(page4AxisValue(page4CursorTime) + step));
      keepPage4CursorInView(targetTime, 1);
      updatePage4PlaybackCursor(targetTime);
    } else moveChartCursorByKeyboard(1, e);
  }

  // Up/Down Arrow / I/O: 확대/축소 (현재 활성 커서 시간 기준)
  else if (key === 'ArrowUp' || key.toLowerCase() === 'i') {
    e.preventDefault();
    if (tabTemperature?.classList.contains('active')) {
      zoomPage4At(page4CursorTime, 0.85);
      return;
    }
    const currentSpan = currentEndSec - currentStartSec;
    const targetTime = Number.isFinite(preciseCursorTimeSec) ? preciseCursorTimeSec : (currentStartSec + currentEndSec) / 2;
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
    drawCssIntersectionDots(currentCursorIndex, null, targetTime);
  } else if (key === 'ArrowDown' || key.toLowerCase() === 'o') {
    e.preventDefault();
    if (tabTemperature?.classList.contains('active')) {
      zoomPage4At(page4CursorTime, 1.15);
      return;
    }
    const currentSpan = currentEndSec - currentStartSec;
    const targetTime = Number.isFinite(preciseCursorTimeSec) ? preciseCursorTimeSec : (currentStartSec + currentEndSec) / 2;
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
    drawCssIntersectionDots(currentCursorIndex, null, targetTime);
  }
});
