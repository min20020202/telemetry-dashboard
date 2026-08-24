#!/usr/bin/env python3
"""Build the shared NSSUR track-distance reference from a telemetry CSV."""

import csv
import json
import math
import statistics
import sys
from pathlib import Path

EARTH_RADIUS_M = 6_371_000
FINISH = (
    (35.291942389489876, 126.57411262393),
    (35.29196320033377, 126.57417699694636),
)


def nmea(value, longitude=False):
    number = float(value)
    if abs(number) <= (180 if longitude else 90):
        return number
    text = str(value).strip()
    digits = 3 if longitude else 2
    return float(text[:digits]) + float(text[digits:]) / 60


def distance(a, b):
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(value))


def interpolate(points, cumulative, target):
    lo, hi = 0, len(cumulative) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if cumulative[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    right = max(1, lo)
    left = right - 1
    span = cumulative[right] - cumulative[left]
    ratio = 0 if span <= 0 else (target - cumulative[left]) / span
    return (
        points[left][0] + (points[right][0] - points[left][0]) * ratio,
        points[left][1] + (points[right][1] - points[left][1]) * ratio,
    )


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_track_reference.py INPUT.csv OUTPUT.js")
    source, output = Path(sys.argv[1]), Path(sys.argv[2])
    fixes, last_counter = [], None
    with source.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            if int(float(row.get("gps_qual") or 0)) <= 0:
                continue
            counter = int(float(row.get("gps_fix_update_count") or 0))
            if counter and counter == last_counter:
                continue
            last_counter = counter
            fixes.append({
                "time": float(row["timestamp_us"]),
                "lat": nmea(row["gps_lat"]),
                "lon": nmea(row["gps_lon"], True),
                "speed": float(row.get("gps_speed_kmh") or 0),
            })

    origin_lat = sum(point[0] for point in FINISH) / 2
    origin_lon = sum(point[1] for point in FINISH) / 2
    lon_scale = math.cos(math.radians(origin_lat))

    def local(point):
        return (
            math.radians(point[1] - origin_lon) * EARTH_RADIUS_M * lon_scale,
            math.radians(point[0] - origin_lat) * EARTH_RADIUS_M,
        )

    a, b = local(FINISH[0]), local(FINISH[1])
    vx, vy = b[0] - a[0], b[1] - a[1]
    length_sq = vx * vx + vy * vy
    crossings = []
    for previous, current in zip(fixes, fixes[1:]):
        elapsed = current["time"] - previous["time"]
        if elapsed <= 0 or elapsed > 2 or max(previous["speed"], current["speed"]) < 1:
            continue
        p = local((previous["lat"], previous["lon"]))
        q = local((current["lat"], current["lon"]))
        side_p = vx * (p[1] - a[1]) - vy * (p[0] - a[0])
        side_q = vx * (q[1] - a[1]) - vy * (q[0] - a[0])
        if side_p == 0 or side_q == 0 or side_p * side_q >= 0:
            continue
        ratio = side_p / (side_p - side_q)
        intersection = (p[0] + (q[0] - p[0]) * ratio, p[1] + (q[1] - p[1]) * ratio)
        line_ratio = ((intersection[0] - a[0]) * vx + (intersection[1] - a[1]) * vy) / length_sq
        if not 0 <= ratio <= 1 or not 0 <= line_ratio <= 1:
            continue
        crossings.append({
            "time": previous["time"] + elapsed * ratio,
            "direction": 1 if side_q - side_p > 0 else -1,
            "lat": previous["lat"] + (current["lat"] - previous["lat"]) * ratio,
            "lon": previous["lon"] + (current["lon"] - previous["lon"]) * ratio,
        })

    direction = statistics.mode(item["direction"] for item in crossings)
    filtered = []
    for crossing in crossings:
        if crossing["direction"] != direction:
            continue
        if filtered and crossing["time"] - filtered[-1]["time"] < 20:
            continue
        filtered.append(crossing)

    laps = []
    for start, end in zip(filtered, filtered[1:]):
        points = [(start["lat"], start["lon"])]
        points.extend((fix["lat"], fix["lon"]) for fix in fixes if start["time"] < fix["time"] < end["time"])
        points.append((end["lat"], end["lon"]))
        cumulative = [0.0]
        for previous, current in zip(points, points[1:]):
            cumulative.append(cumulative[-1] + distance(previous, current))
        laps.append((points, cumulative))

    median_length = statistics.median(item[1][-1] for item in laps)
    laps = [item for item in laps if abs(item[1][-1] - median_length) <= median_length * 0.02]
    # Build the median path at roughly 1 m intervals. Projection still uses
    # continuous line segments, so callers can interpolate at 0.1 m without
    # implying 0.1 m GPS measurement accuracy.
    normalized_count = max(200, round(median_length))
    median_path = []
    for index in range(normalized_count + 1):
        ratio = index / normalized_count
        samples = [interpolate(points, cumulative, cumulative[-1] * ratio) for points, cumulative in laps]
        median_path.append((statistics.median(p[0] for p in samples), statistics.median(p[1] for p in samples)))
    closed = (
        statistics.median([filtered[0]["lat"], filtered[-1]["lat"]]),
        statistics.median([filtered[0]["lon"], filtered[-1]["lon"]]),
    )
    median_path[0] = closed
    median_path[-1] = closed

    cumulative = [0.0]
    for previous, current in zip(median_path, median_path[1:]):
        cumulative.append(cumulative[-1] + distance(previous, current))
    total = cumulative[-1]
    spacing = 1.0
    targets = [index * spacing for index in range(int(total // spacing) + 1)]
    if not math.isclose(targets[-1], total):
        targets.append(total)
    reference = []
    for target in targets:
        lat, lon = interpolate(median_path, cumulative, target)
        reference.append([round(lat, 8), round(lon, 8), round(target, 3)])

    payload = {
        "source": source.name,
        "method": "median-of-12-complete-laps",
        "spacingMeters": spacing,
        "totalDistanceMeters": round(total, 3),
        "points": reference,
    }
    output.write_text(
        "// Generated by tools/build_track_reference.py; do not edit by hand.\n"
        "window.NSSUR_TRACK_REFERENCE = Object.freeze(" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ");\n",
        encoding="utf-8",
    )
    print(f"{len(laps)} laps -> {len(reference)} points, {total:.3f} m")


if __name__ == "__main__":
    main()
