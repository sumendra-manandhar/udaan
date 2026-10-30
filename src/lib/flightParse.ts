import type { FlightSeries, TrackPoint } from '../db/types';
import { trackDistanceM } from './geo';

export interface ParsedFlight {
  source: 'gpx' | 'csv';
  track: TrackPoint[];
  series: FlightSeries;
  flown_at: string | null;
  duration_s: number;
  max_alt_m: number;
  distance_m: number;
}

export class FlightParseError extends Error {}

const MAX_TRACK = 2000;
const MAX_SERIES = 600;

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  out[out.length - 1] = arr[arr.length - 1];
  return out;
}

const round = (n: number, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

function finish(source: 'gpx' | 'csv', points: TrackPoint[], series: FlightSeries, startIso: string | null): ParsedFlight {
  if (points.length < 2) throw new FlightParseError('No GPS track found in this file.');
  const track = downsample(points, MAX_TRACK).map(([lng, lat, alt, t]) => [round(lng), round(lat), round(alt, 1), round(t, 2)] as TrackPoint);
  const idx = downsample(series.t.map((_, i) => i), MAX_SERIES);
  const pickSeries = (a?: number[]) => (a && a.length === series.t.length ? idx.map((i) => round(a[i], 2)) : undefined);
  const s: FlightSeries = { t: idx.map((i) => round(series.t[i], 2)) };
  for (const key of ['alt', 'throttle', 'vbat', 'speed'] as const) {
    const v = pickSeries(series[key]);
    if (v) s[key] = v;
  }
  return {
    source,
    track,
    series: s,
    flown_at: startIso,
    duration_s: Math.round(points[points.length - 1][3] - points[0][3]),
    max_alt_m: round(Math.max(...points.map((p) => p[2])) - Math.min(...points.map((p) => p[2])), 1),
    distance_m: Math.round(trackDistanceM(points)),
  };
}

/** GPX 1.1 track (most goggles, phones and GPS loggers export this). */
export function parseGpx(text: string): ParsedFlight {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new FlightParseError('This GPX file could not be read.');
  const pts = Array.from(doc.getElementsByTagName('trkpt'));
  const usable = pts.length ? pts : Array.from(doc.getElementsByTagName('rtept'));
  let t0: number | null = null;
  const points: TrackPoint[] = [];
  const series: FlightSeries = { t: [], alt: [] };
  usable.forEach((p, i) => {
    const lat = Number(p.getAttribute('lat'));
    const lng = Number(p.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const ele = Number(p.getElementsByTagName('ele')[0]?.textContent ?? 0);
    const timeText = p.getElementsByTagName('time')[0]?.textContent;
    const ms = timeText ? Date.parse(timeText) : NaN;
    if (t0 === null && Number.isFinite(ms)) t0 = ms;
    const t = Number.isFinite(ms) && t0 !== null ? (ms - t0) / 1000 : i;
    points.push([lng, lat, ele, t]);
    series.t.push(t);
    series.alt!.push(ele);
  });
  return finish('gpx', points, series, t0 !== null ? new Date(t0).toISOString() : null);
}

function splitCsvLine(line: string): string[] {
  return line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
}

function findCol(headers: string[], ...patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

/** CSV exported from Betaflight Blackbox Explorer (or similar loggers).
 * Column names vary between firmware versions, so they are matched loosely.
 * Raw .bbl files are binary: export them to CSV in Blackbox Explorer first. */
export function parseBlackboxCsv(text: string): ParsedFlight {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 3) throw new FlightParseError('This CSV has no data rows.');
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const iTime = findCol(headers, /^time \(us\)$/, /^time\b/, /^time_us/);
  const iLat = findCol(headers, /gps_coord\[0\]/, /^lat/, /latitude/);
  const iLng = findCol(headers, /gps_coord\[1\]/, /^lon/, /^lng/, /longitude/);
  const iAlt = findCol(headers, /gps_altitude/, /^alt/, /altitude/);
  const iVbat = findCol(headers, /vbatlatest/, /^vbat/, /voltage/);
  const iThr = findCol(headers, /rccommand\[3\]/, /throttle/);
  const iSpd = findCol(headers, /gps_speed/, /speed/);
  if (iLat < 0 || iLng < 0) throw new FlightParseError('No GPS columns found. Enable GPS logging, or upload a GPX file.');

  const points: TrackPoint[] = [];
  const series: FlightSeries = { t: [], alt: [], vbat: [], throttle: [], speed: [] };
  let t0: number | null = null;
  const timeInMicros = iTime >= 0 && /us/.test(headers[iTime]);
  for (let r = 1; r < lines.length; r++) {
    const c = splitCsvLine(lines[r]);
    let lat = Number(c[iLat]);
    let lng = Number(c[iLng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    // Some exports store degrees × 10^7.
    if (Math.abs(lat) > 90) lat /= 1e7;
    if (Math.abs(lng) > 180) lng /= 1e7;
    const rawT = iTime >= 0 ? Number(c[iTime]) : r;
    if (t0 === null) t0 = rawT;
    const t = timeInMicros ? (rawT - t0) / 1e6 : rawT - t0;
    const alt = iAlt >= 0 ? Number(c[iAlt]) || 0 : 0;
    points.push([lng, lat, alt, t]);
    series.t.push(t);
    series.alt!.push(alt);
    series.vbat!.push(iVbat >= 0 ? Number(c[iVbat]) || 0 : 0);
    // rcCommand[3] is 1000–2000; convert to percent.
    const thr = iThr >= 0 ? Number(c[iThr]) || 0 : 0;
    series.throttle!.push(thr > 100 ? Math.max(0, Math.min(100, (thr - 1000) / 10)) : thr);
    series.speed!.push(iSpd >= 0 ? Number(c[iSpd]) || 0 : 0);
  }
  if (iVbat < 0) delete series.vbat;
  if (iThr < 0) delete series.throttle;
  if (iSpd < 0) delete series.speed;
  return finish('csv', points, series, null);
}

export async function parseFlightFile(file: File): Promise<ParsedFlight> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.bbl') || name.endsWith('.bfl')) {
    throw new FlightParseError('Raw blackbox files are binary. Open it in Betaflight Blackbox Explorer, export CSV, and upload that.');
  }
  if (file.size > 60 * 1024 * 1024) throw new FlightParseError('That file is over 60 MB. Trim the log or export a shorter range.');
  const text = await file.text();
  if (name.endsWith('.gpx') || text.trimStart().startsWith('<')) return parseGpx(text);
  return parseBlackboxCsv(text);
}
