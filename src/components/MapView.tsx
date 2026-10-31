import 'maplibre-gl/dist/maplibre-gl.css';
import { AttributionControl, GeolocateControl, LngLatBounds, Map as MlMap, Marker, setWorkerUrl } from 'maplibre-gl';
// MapLibre 6 runs its tile decoding in a separate worker file. Bundlers move
// the main script, so point MapLibre at the emitted worker explicitly.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Feature, FeatureCollection } from 'geojson';
import { useEffect, useRef } from 'react';
import type { Airport, Spot, TrackPoint } from '../db/types';
import { circlePolygon } from '../lib/geo';
import { MAP_STYLE_URL, MAP_STYLE_URL_LIGHT } from '../lib/offlineMaps';
import { useTheme } from '../lib/theme';

setWorkerUrl(workerUrl);

const KATHMANDU: [number, number] = [85.324, 27.7172];

export interface MapViewProps {
  className?: string;
  center?: [number, number];
  zoom?: number;
  spots?: Spot[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  airports?: Airport[];
  track?: TrackPoint[];
  cursor?: number; // index into track for the replay marker
  onMove?: (center: [number, number], bounds: [number, number, number, number], zoom: number) => void;
  interactive?: boolean;
  locate?: boolean;
}

/** The map follows the light/dark theme; switching themes rebuilds it. */
export function MapView(props: MapViewProps) {
  const { theme } = useTheme();
  return <MapViewInner key={theme} styleUrl={theme === 'light' ? MAP_STYLE_URL_LIGHT : MAP_STYLE_URL} {...props} />;
}

function MapViewInner({
  styleUrl,
  className = 'map-fill',
  center,
  zoom = 10,
  spots,
  selectedId,
  onSelect,
  airports,
  track,
  cursor,
  onMove,
  interactive = true,
  locate,
}: MapViewProps & { styleUrl: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const loaded = useRef(false);
  const markers = useRef<Marker[]>([]);
  const replay = useRef<Marker | null>(null);
  const whenReady = useRef<(() => void)[]>([]);
  const ready = (fn: () => void) => (loaded.current ? fn() : whenReady.current.push(fn));
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!el.current) return;
    const m = new MlMap({
      container: el.current,
      style: styleUrl,
      center: center ?? KATHMANDU,
      zoom,
      interactive,
      attributionControl: false,
    });
    m.addControl(new AttributionControl({ compact: true }), 'bottom-left');
    if (locate) m.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right');
    const report = () => {
      const b = m.getBounds();
      const c = m.getCenter();
      onMoveRef.current?.([c.lng, c.lat], [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], m.getZoom());
    };
    m.on('moveend', report);
    m.on('load', () => {
      loaded.current = true;
      report();
      whenReady.current.splice(0).forEach((fn) => fn());
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      loaded.current = false;
    };
    // The map is created once; later prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentre when the requested centre actually changes (by value).
  const cLng = center?.[0];
  const cLat = center?.[1];
  useEffect(() => {
    if (cLng !== undefined && cLat !== undefined && map.current && !track) map.current.jumpTo({ center: [cLng, cLat] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cLng, cLat]);

  // Airport rings.
  useEffect(() => {
    const m = map.current;
    if (!m || !airports) return;
    const apply = () => {
      const data: FeatureCollection = {
        type: 'FeatureCollection',
        features: airports.map((a) => ({
          type: 'Feature',
          properties: { name: a.name },
          geometry: { type: 'Polygon', coordinates: [circlePolygon(a.lat, a.lng, a.radius_m)] },
        })),
      };
      const src = m.getSource('rings') as { setData?: (d: FeatureCollection) => void } | undefined;
      if (src?.setData) return src.setData(data);
      m.addSource('rings', { type: 'geojson', data });
      m.addLayer({ id: 'rings-fill', type: 'fill', source: 'rings', paint: { 'fill-color': '#ff5a4e', 'fill-opacity': 0.09 } });
      m.addLayer({ id: 'rings-line', type: 'line', source: 'rings', paint: { 'line-color': '#ff5a4e', 'line-width': 1.5, 'line-dasharray': [3, 3] } });
    };
    ready(apply);
  }, [airports]);

  // Spot pins as HTML markers (keyboard-focusable buttons).
  useEffect(() => {
    const m = map.current;
    if (!m || !spots) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = spots.map((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pin ${s.id === selectedId ? 'selected' : s.status === 'approved' ? 'approved' : 'pending'}`;
      b.setAttribute('aria-label', s.name);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect?.(s.id);
      });
      return new Marker({ element: b }).setLngLat([s.lng, s.lat]).addTo(m);
    });
  }, [spots, selectedId, onSelect]);

  // Flight track.
  useEffect(() => {
    const m = map.current;
    if (!m || !track || track.length < 2) return;
    const apply = () => {
      const data: Feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: track.map((p) => [p[0], p[1]]) },
      };
      const src = m.getSource('track') as { setData?: (d: Feature) => void } | undefined;
      if (src?.setData) src.setData(data);
      else {
        m.addSource('track', { type: 'geojson', data });
        m.addLayer({ id: 'track', type: 'line', source: 'track', paint: { 'line-color': '#ff8a3d', 'line-width': 3.5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      }
      const bounds = new LngLatBounds();
      track.forEach((p) => bounds.extend([p[0], p[1]]));
      m.fitBounds(bounds, { padding: 40, duration: 0 });
    };
    ready(apply);
  }, [track]);

  // Replay marker.
  useEffect(() => {
    const m = map.current;
    if (!m || !track || cursor === undefined) return;
    const p = track[Math.min(cursor, track.length - 1)];
    if (!replay.current) {
      const dot = document.createElement('div');
      dot.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#eef0f2;border:3px solid #ff8a3d';
      replay.current = new Marker({ element: dot }).setLngLat([p[0], p[1]]).addTo(m);
    } else replay.current.setLngLat([p[0], p[1]]);
  }, [track, cursor]);

  return <div ref={el} className={className} role="region" aria-label="Map" />;
}
