import { useEffect, useRef } from 'react';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FloodReport, Position, RouteResult, SegmentRiskCollection } from '../api/types';
import { LEVEL_COLORS, LEVEL_LABELS } from '../lib/replay';
import type { Theme } from '../lib/theme';
import { formatBbox } from '../lib/validation';

const MERIDA: Position = [-89.648, 20.982];
const BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Paletas del mapa base: papel/tinta, no el gris por defecto. */
const PALETTE: Record<Theme, Record<string, string>> = {
  light: {
    background: '#ece8df',
    water: '#bcd4dc',
    green: '#dfe3d2',
    landuse: '#e6e1d6',
    building: '#d9d3c6',
    road: '#fbfaf6',
    roadCasing: '#d6d0c3',
    label: '#7a7468',
    halo: '#ece8df',
    extrusion: '#e3ddd0',
    casing: '#ece8df',
  },
  dark: {
    background: '#070707',
    water: '#0b1820',
    green: '#0d110d',
    landuse: '#0b0b0b',
    building: '#141414',
    road: '#1d1d1d',
    roadCasing: '#121212',
    label: '#5f5f5f',
    halo: '#070707',
    extrusion: '#171717',
    casing: '#070707',
  },
};

/** Grosor por nivel que crece con el zoom pero se topa al ancho real de una calle (no "tubos"). */
const width = (low: number, high: number) =>
  [
    'interpolate',
    ['linear'],
    ['zoom'],
    12,
    ['match', ['get', 'level'], 'high', high * 0.4, 'medium', low * 0.4, low * 0.3],
    15,
    ['match', ['get', 'level'], 'high', high, 'medium', low, low * 0.8],
    18,
    ['match', ['get', 'level'], 'high', high * 1.25, 'medium', low * 1.25, low],
  ] as maplibregl.ExpressionSpecification;

const color = [
  'match',
  ['get', 'level'],
  'high',
  LEVEL_COLORS.high,
  'medium',
  LEVEL_COLORS.medium,
  LEVEL_COLORS.low,
] as maplibregl.ExpressionSpecification;

export interface MapViewProps {
  segments: SegmentRiskCollection | null;
  reports: FloodReport[];
  route: RouteResult | null;
  picks: { origin?: Position; destination?: Position; report?: Position };
  onBboxChange: (bbox: string) => void;
  onMapClick: (p: Position) => void;
  theme?: Theme;
  /** false mientras corre la intro; al pasar a true la cámara vuela a Mérida. */
  revealed?: boolean;
}

export function MapView({
  segments,
  reports,
  route,
  picks,
  onBboxChange,
  onMapClick,
  theme = 'light',
  revealed = true,
}: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loaded = useRef(false);
  const baseLayers = useRef<maplibregl.LayerSpecification[]>([]);
  const handlers = useRef({ onBboxChange, onMapClick });
  handlers.current = { onBboxChange, onMapClick };
  const latest = useRef({ segments, reports, route, picks, theme });
  latest.current = { segments, reports, route, picks, theme };
  const routeAnim = useRef<{ start: number; coords: Position[] } | null>(null);
  const flown = useRef(false);

  useEffect(() => {
    if (!container.current) return;
    const styleUrl = (import.meta.env.VITE_MAP_STYLE_URL as string | undefined) || BASE_STYLE;
    const map = new maplibregl.Map({
      container: container.current,
      style: styleUrl,
      center: [-89.64, 20.99],
      zoom: 9.6,
      pitch: 0,
      bearing: 0,
      attributionControl: { compact: true },
      maxPitch: 70,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    const emitBbox = () => {
      const b = map.getBounds();
      handlers.current.onBboxChange(formatBbox(b.getWest(), b.getSouth(), b.getEast(), b.getNorth()));
    };

    map.on('load', () => {
      baseLayers.current = map.getStyle().layers.slice();
      const vector = Object.entries(map.getStyle().sources).find(([, s]) => s.type === 'vector')?.[0];
      const firstLabel = baseLayers.current.find((l) => l.type === 'symbol')?.id;

      if (vector) {
        map.addLayer(
          {
            id: 'buildings-3d',
            type: 'fill-extrusion',
            source: vector,
            'source-layer': 'building',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': PALETTE.light.extrusion,
              'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.6,
            },
          },
          firstLabel,
        );
      }

      map.addSource('segments', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'segments-glow',
        type: 'line',
        source: 'segments',
        filter: ['==', ['get', 'level'], 'high'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': LEVEL_COLORS.high, 'line-width': width(9, 18), 'line-blur': 7, 'line-opacity': 0.5 },
      });
      map.addLayer({
        id: 'segments-casing',
        type: 'line',
        source: 'segments',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': PALETTE.light.casing, 'line-width': width(6.5, 10) },
      });
      map.addLayer({
        id: 'segments',
        type: 'line',
        source: 'segments',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': color,
          'line-width': width(4, 7),
        },
      });

      map.addSource('route-baseline', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'route-baseline',
        type: 'line',
        source: 'route-baseline',
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': '#8c8c8c', 'line-width': 4, 'line-dasharray': [0, 2, 2] },
      });
      map.addSource('route-safer', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'route-safer-casing',
        type: 'line',
        source: 'route-safer',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': PALETTE.light.casing, 'line-width': 15 },
      });
      map.addLayer({
        id: 'route-safer',
        type: 'line',
        source: 'route-safer',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0039a6', 'line-width': 9 },
      });

      map.addSource('reports', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'reports-ripple',
        type: 'circle',
        source: 'reports',
        paint: {
          'circle-radius': 10,
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': '#00a1de',
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.8,
        },
      });
      map.addLayer({
        id: 'reports',
        type: 'circle',
        source: 'reports',
        paint: {
          'circle-radius': 7,
          'circle-color': '#00a1de',
          'circle-stroke-color': PALETTE.light.casing,
          'circle-stroke-width': 3,
        },
      });

      map.addSource('picks', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'picks',
        type: 'circle',
        source: 'picks',
        paint: {
          'circle-radius': 13,
          'circle-color': ['match', ['get', 'kind'], 'origin', '#00933c', 'destination', '#0039a6', '#ff6319'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
      map.addLayer({
        id: 'picks-label',
        type: 'symbol',
        source: 'picks',
        layout: {
          'text-field': ['match', ['get', 'kind'], 'origin', 'A', 'destination', 'B', '!'],
          'text-size': 13,
          'text-font': ['Noto Sans Bold'],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff' },
      });

      loaded.current = true;
      applyTheme();
      sync();
      emitBbox();
      if (revealedRef.current) fly();
      if (!REDUCED) requestAnimationFrame(tick);
    });

    map.on('moveend', emitBbox);
    map.on('click', (e) => handlers.current.onMapClick([e.lngLat.lng, e.lngLat.lat]));
    map.on('mouseenter', 'segments', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'segments', () => (map.getCanvas().style.cursor = ''));
    map.on('click', 'segments', (e) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const level = p.level as keyof typeof LEVEL_LABELS;
      const el = document.createElement('div');
      el.className = 'pop';
      const head = document.createElement('div');
      head.className = `pop-head lvl-${level}`;
      head.textContent = `${LEVEL_LABELS[level] ?? level} · ${Number(p.score).toFixed(2)}`;
      const name = document.createElement('strong');
      name.textContent = String(p.name ?? p.segmentId);
      const data = document.createElement('code');
      data.textContent = `agua estimada ${p.waterDepthCm ?? 0} cm · lluvia 1h ${p.rainfall1hMm} mm · 3h ${p.rainfall3hMm} mm · reportes ${p.reportCount60m}`;
      el.append(head, name, data);
      new maplibregl.Popup({ closeButton: false, offset: 12 }).setLngLat(e.lngLat).setDOMContent(el).addTo(map);
    });

    let raf = 0;
    const DASH = [
      [0, 2, 2],
      [0.5, 2, 1.5],
      [1, 2, 1],
      [1.5, 2, 0.5],
      [2, 2, 0],
      [0, 0.5, 2, 1.5],
      [0, 1, 2, 1],
      [0, 1.5, 2, 0.5],
    ];
    function tick(t: number) {
      if (!loaded.current) return;
      const pulse = (Math.sin(t / 420) + 1) / 2;
      map.setPaintProperty('segments-glow', 'line-opacity', 0.25 + pulse * 0.55);
      const r = (t % 1800) / 1800;
      map.setPaintProperty('reports-ripple', 'circle-radius', 8 + r * 26);
      map.setPaintProperty('reports-ripple', 'circle-stroke-opacity', 1 - r);
      map.setPaintProperty('route-baseline', 'line-dasharray', DASH[Math.floor(t / 70) % DASH.length]!);
      const anim = routeAnim.current;
      if (anim) {
        const k = Math.min((t - anim.start) / 1400, 1);
        const eased = 1 - Math.pow(1 - k, 3);
        const n = Math.max(2, Math.ceil(anim.coords.length * eased));
        (map.getSource('route-safer') as GeoJSONSource | undefined)?.setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: anim.coords.slice(0, n) },
          properties: {},
        });
        if (k >= 1) routeAnim.current = null;
      }
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      loaded.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;

  function fly() {
    const map = mapRef.current;
    if (!map || flown.current) return;
    flown.current = true;
    const narrow = window.innerWidth < 820;
    map.flyTo({
      center: MERIDA,
      zoom: narrow ? 11.6 : 12.4,
      pitch: 48,
      bearing: -14,
      duration: REDUCED ? 0 : 4200,
      essential: true,
      curve: 1.6,
      padding: narrow ? { top: 0, bottom: 300, left: 0, right: 0 } : { top: 0, bottom: 120, left: 440, right: 0 },
    });
  }

  function applyTheme() {
    const map = mapRef.current;
    if (!map || !loaded.current) return;
    const c = PALETTE[latest.current.theme];
    const set = (id: string, prop: string, value: unknown) => {
      try {
        map.setPaintProperty(id, prop, value);
      } catch {
        /* capa sin esa propiedad */
      }
    };
    for (const l of baseLayers.current) {
      const id = l.id;
      // Andadores, pasillos y vías de servicio no son parte de la red de autos: fuera, para no confundir.
      if (/path|pier|aeroway|railway/.test(id)) {
        map.setLayoutProperty(id, 'visibility', 'none');
        continue;
      }
      if (l.type === 'background') set(id, 'background-color', c.background);
      else if (l.type === 'fill') {
        if (id.startsWith('water')) set(id, 'fill-color', c.water);
        else if (id.startsWith('park') || id.startsWith('landcover')) set(id, 'fill-color', c.green);
        else if (id.startsWith('building')) set(id, 'fill-color', c.building);
        else set(id, 'fill-color', c.landuse);
      } else if (l.type === 'line') {
        if (id.startsWith('water')) set(id, 'line-color', c.water);
        else if (id.includes('casing')) set(id, 'line-color', c.roadCasing);
        else if (id.startsWith('boundary')) set(id, 'line-color', c.label);
        else if (id.includes('minor')) set(id, 'line-color', c.roadCasing);
        else set(id, 'line-color', c.road);
      } else if (l.type === 'symbol') {
        set(id, 'text-color', c.label);
        set(id, 'text-halo-color', c.halo);
      } else if (l.type === 'raster') {
        set(id, 'raster-opacity', 0.15);
      }
    }
    set('buildings-3d', 'fill-extrusion-color', c.extrusion);
    for (const id of ['segments-casing', 'route-safer-casing']) set(id, 'line-color', c.casing);
    set('reports', 'circle-stroke-color', c.casing);
    set('route-safer', 'line-color', latest.current.theme === 'dark' ? '#2f6bff' : '#0039a6');
  }

  function sync() {
    const map = mapRef.current;
    if (!map || !loaded.current) return;
    const { segments, reports, picks } = latest.current;
    const set = (id: string, data: GeoJSON.FeatureCollection) =>
      (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);

    set('segments', (segments as unknown as GeoJSON.FeatureCollection) ?? EMPTY);
    set('reports', {
      type: 'FeatureCollection',
      features: reports.map((r) => ({ type: 'Feature', geometry: r.location, properties: { waterLevel: r.waterLevel } })),
    });
    set('picks', {
      type: 'FeatureCollection',
      features: (Object.entries(picks) as [string, Position | undefined][])
        .filter((e): e is [string, Position] => !!e[1])
        .map(([kind, coordinates]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties: { kind } })),
    });
  }

  function syncRoute() {
    const map = mapRef.current;
    if (!map || !loaded.current) return;
    const { route } = latest.current;
    const set = (id: string, data: GeoJSON.FeatureCollection) =>
      (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
    if (!route) {
      set('route-baseline', EMPTY);
      set('route-safer', EMPTY);
      return;
    }
    set('route-baseline', {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: route.baseline.geometry, properties: {} }],
    });
    const coords = route.safer.geometry.coordinates;
    if (REDUCED) {
      set('route-safer', { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: route.safer.geometry, properties: {} }] });
    } else {
      routeAnim.current = { start: performance.now(), coords };
    }
    const b = new maplibregl.LngLatBounds();
    for (const c of [...route.baseline.geometry.coordinates, ...coords]) b.extend(c as [number, number]);
    map.fitBounds(b, { padding: { top: 100, bottom: 200, left: 520, right: 90 }, pitch: 50, duration: 1600 });
  }

  useEffect(sync, [segments, reports, picks]);
  useEffect(syncRoute, [route]);
  useEffect(applyTheme, [theme]);
  useEffect(() => {
    if (revealed && loaded.current) fly();
  }, [revealed]);

  return <div ref={container} className="map" data-testid="map" />;
}
