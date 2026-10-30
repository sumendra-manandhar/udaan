import { describe, expect, it } from 'vitest';
import { FlightParseError, parseBlackboxCsv, parseGpx } from './flightParse';
import { checkAirportRings, distanceM, tilesForBounds } from './geo';
import { BUNDLED_AIRPORTS } from './airports';

const gpx = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>
<trkpt lat="27.7150" lon="85.5200"><ele>2100</ele><time>2026-10-30T00:30:00Z</time></trkpt>
<trkpt lat="27.7160" lon="85.5210"><ele>2150</ele><time>2026-10-30T00:30:10Z</time></trkpt>
<trkpt lat="27.7170" lon="85.5230"><ele>2120</ele><time>2026-10-30T00:30:30Z</time></trkpt>
</trkseg></trk></gpx>`;

describe('flight parsing', () => {
  it('reads GPX tracks', () => {
    const f = parseGpx(gpx);
    expect(f.track).toHaveLength(3);
    expect(f.duration_s).toBe(30);
    expect(f.max_alt_m).toBe(50);
    expect(f.distance_m).toBeGreaterThan(200);
    expect(f.flown_at).toBe('2026-10-30T00:30:00.000Z');
  });

  it('reads Blackbox Explorer CSV with scaled GPS and throttle', () => {
    const csv = [
      'loopIteration,time (us),rcCommand[3],vbatLatest (V),GPS_coord[0],GPS_coord[1],GPS_altitude',
      '0,1000000,1000,16.8,277150000,855200000,2100',
      '1,2000000,1500,16.5,277160000,855210000,2120',
      '2,3000000,2000,16.1,277170000,855230000,2110',
    ].join('\n');
    const f = parseBlackboxCsv(csv);
    expect(f.track[0][1]).toBeCloseTo(27.715, 4);
    expect(f.duration_s).toBe(2);
    expect(f.series.throttle).toEqual([0, 50, 100]);
    expect(f.series.vbat).toEqual([16.8, 16.5, 16.1]);
  });

  it('explains when there is no GPS', () => {
    expect(() => parseBlackboxCsv('time,gyro\n1,2\n2,3\n')).toThrow(FlightParseError);
  });
});

describe('geo', () => {
  it('flags points inside the Tribhuvan ring', () => {
    expect(checkAirportRings(27.70, 85.35, BUNDLED_AIRPORTS).inside?.icao).toBe('VNKT');
    expect(checkAirportRings(27.715, 85.52, BUNDLED_AIRPORTS).inside).toBeNull();
  });

  it('measures distance', () => {
    expect(distanceM(27.7, 85.3, 27.7, 85.3)).toBe(0);
    expect(Math.round(distanceM(27.7, 85.3, 27.8, 85.3) / 100)).toBe(111);
  });

  it('lists tiles for a box', () => {
    expect(tilesForBounds(85.2, 27.6, 85.5, 27.8, 0)).toEqual([[0, 0, 0]]);
    expect(tilesForBounds(85.2, 27.6, 85.5, 27.8, 12).length).toBeGreaterThan(4);
  });
});
