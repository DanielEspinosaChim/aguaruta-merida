import { useEffect, useRef } from 'react';
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FloodReport, Position, RouteResult, SegmentRiskCollection } from '../api/types';
import type { Theme } from '../lib/theme';
import { LEVEL_LABELS, levelColorExpression } from '../lib/replay';
import { formatBbox } from '../lib/validation';

const MERIDA: Position = [-89.62, 20.97];

const carto = (variant: string) => ({
  type: 'raster' as const,
  tiles: ['a', 'b', 'c'].map((s) => `https://${s}.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`),
  tileSize: 256,
  attribution: '© OpenStreetMap · © CARTO',
});

/** Mapa base claro y oscuro (CARTO Positron / Dark Matter); se alterna por visibilidad sin recargar. */
const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: { light: carto('light_all'), dark: carto('dark_all') },
  layers: [
    { id: 'base-light', type: 'raster', source: 'light' },
    { id: 'base-dark', type: 'raster', source: 'dark', layout: { visibility: 'none' } },
  ],
};

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export interface MapViewProps {
  segments: SegmentRiskCollection | null;
  reports: FloodReport[];
  route: RouteResult | null;
  picks: { origin?: Position; destination?: Position; report?: Position };
  onBboxChange: (bbox: string) => void;
  onMapClick: (p: Position) => void;
  theme?: Theme;
}

export function MapView({ segments, reports, route, picks, onBboxChange, onMapClick, theme = 'light' }: MapViewProps) {
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loaded = useRef(false);
  const handlers = useRef({ onBboxChange, onMapClick });
  handlers.current = { onBboxChange, onMapClick };
  const latest = useRef({ segments, reports, route, picks });
  latest.current = { segments, reports, route, picks };

  useEffect(() => {
    if (!container.current) return;
    const styleUrl = import.meta.env.VITE_MAP_STYLE_URL as string | undefined;
    const map = new maplibregl.Map({
      container: container.current,
      style: styleUrl || BASE_STYLE,
      attributionControl: { compact: true },
      center: MERIDA,
      zoom: 13,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    const emitBbox = () => {
      const b = map.getBounds();
      handlers.current.onBboxChange(formatBbox(b.getWest(), b.getSouth(), b.getEast(), b.getNorth()));
    };

    map.on('load', () => {
      map.addSource('segments', { type: 'geojson', data: EMPTY });
      const zoomWidth = (base: number) =>
        ['interpolate', ['linear'], ['zoom'], 12, base * 0.5, 15, base, 18, base * 2.2] as maplibregl.ExpressionSpecification;
      map.addLayer({
        id: 'segments-casing',
        type: 'line',
        source: 'segments',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': casingColor(), 'line-width': zoomWidth(8) },
      });
      map.addLayer({
        id: 'segments',
        type: 'line',
        source: 'segments',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': levelColorExpression as unknown as maplibregl.ExpressionSpecification,
          'line-width': ['match', ['get', 'level'], 'high', zoomWidth(6), 'medium', zoomWidth(4.5), zoomWidth(3)] as maplibregl.ExpressionSpecification,
        },
      });
      map.addSource('route-baseline', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'route-baseline',
        type: 'line',
        source: 'route-baseline',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#8a8f98', 'line-width': 5, 'line-dasharray': [1, 2] },
      });
      map.addSource('route-safer', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'route-safer-casing',
        type: 'line',
        source: 'route-safer',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': casingColor(), 'line-width': 13 },
      });
      map.addLayer({
        id: 'route-safer',
        type: 'line',
        source: 'route-safer',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2563ff', 'line-width': 8 },
      });
      map.addSource('reports', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'reports',
        type: 'circle',
        source: 'reports',
        paint: {
          'circle-radius': 7,
          'circle-color': '#00b3ff',
          'circle-stroke-color': casingColor(),
          'circle-stroke-width': 3,
        },
      });
      map.addSource('picks', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'picks',
        type: 'circle',
        source: 'picks',
        paint: {
          'circle-radius': 8,
          'circle-color': ['match', ['get', 'kind'], 'origin', '#16a34a', 'destination', '#7c3aed', '#f97316'],
          'circle-stroke-color': '#111827',
          'circle-stroke-width': 2,
        },
      });
      loaded.current = true;
      applyTheme();
      sync();
      emitBbox();
    });

    map.on('moveend', emitBbox);
    map.on('click', (e) => handlers.current.onMapClick([e.lngLat.lng, e.lngLat.lat]));
    map.on('click', 'segments', (e) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setText(
          `${p.name ?? p.segmentId} · riesgo estimado ${(LEVEL_LABELS[p.level as keyof typeof LEVEL_LABELS] ?? p.level).toLowerCase()} (${Number(p.score).toFixed(2)}) · lluvia 1h ${p.rainfall1hMm} mm · reportes 60 min: ${p.reportCount60m}`,
        )
        .addTo(map);
    });

    return () => {
      loaded.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function sync() {
    const map = mapRef.current;
    if (!map || !loaded.current) return;
    const { segments, reports, route, picks } = latest.current;
    const set = (id: string, data: GeoJSON.FeatureCollection) =>
      (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);

    set('segments', (segments as unknown as GeoJSON.FeatureCollection) ?? EMPTY);
    set('reports', {
      type: 'FeatureCollection',
      features: reports.map((r) => ({ type: 'Feature', geometry: r.location, properties: { waterLevel: r.waterLevel } })),
    });
    set(
      'route-baseline',
      route ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: route.baseline.geometry, properties: {} }] } : EMPTY,
    );
    set(
      'route-safer',
      route ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: route.safer.geometry, properties: {} }] } : EMPTY,
    );
    set('picks', {
      type: 'FeatureCollection',
      features: (Object.entries(picks) as [string, Position | undefined][])
        .filter((e): e is [string, Position] => !!e[1])
        .map(([kind, coordinates]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties: { kind } })),
    });
  }

  function casingColor() {
    return themeRef.current === 'dark' ? '#0b0d12' : '#ffffff';
  }

  function applyTheme() {
    const map = mapRef.current;
    if (!map || !loaded.current) return;
    const dark = themeRef.current === 'dark';
    if (map.getLayer('base-light')) {
      map.setLayoutProperty('base-light', 'visibility', dark ? 'none' : 'visible');
      map.setLayoutProperty('base-dark', 'visibility', dark ? 'visible' : 'none');
    }
    for (const id of ['segments-casing', 'route-safer-casing']) map.setPaintProperty(id, 'line-color', casingColor());
    map.setPaintProperty('reports', 'circle-stroke-color', casingColor());
  }

  useEffect(sync, [segments, reports, route, picks]);
  useEffect(applyTheme, [theme]);

  return <div ref={container} className="map" data-testid="map" />;
}
