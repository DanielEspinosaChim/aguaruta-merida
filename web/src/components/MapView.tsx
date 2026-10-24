import { useEffect, useRef } from 'react';
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FloodReport, Position, RouteResult, SegmentRiskCollection } from '../api/types';
import { levelColorExpression } from '../lib/replay';
import { formatBbox } from '../lib/validation';

const MERIDA: Position = [-89.62, 20.97];

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© colaboradores de OpenStreetMap',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export interface MapViewProps {
  segments: SegmentRiskCollection | null;
  reports: FloodReport[];
  route: RouteResult | null;
  picks: { origin?: Position; destination?: Position; report?: Position };
  onBboxChange: (bbox: string) => void;
  onMapClick: (p: Position) => void;
}

export function MapView({ segments, reports, route, picks, onBboxChange, onMapClick }: MapViewProps) {
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
      style: styleUrl || OSM_STYLE,
      center: MERIDA,
      zoom: 13,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const emitBbox = () => {
      const b = map.getBounds();
      handlers.current.onBboxChange(formatBbox(b.getWest(), b.getSouth(), b.getEast(), b.getNorth()));
    };

    map.on('load', () => {
      map.addSource('segments', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'segments',
        type: 'line',
        source: 'segments',
        paint: {
          'line-color': levelColorExpression as unknown as maplibregl.ExpressionSpecification,
          'line-width': 5,
          'line-opacity': 0.85,
        },
      });
      map.addSource('route-baseline', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'route-baseline',
        type: 'line',
        source: 'route-baseline',
        paint: { 'line-color': '#6b7280', 'line-width': 4, 'line-dasharray': [2, 2] },
      });
      map.addSource('route-safer', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'route-safer',
        type: 'line',
        source: 'route-safer',
        paint: { 'line-color': '#1d4ed8', 'line-width': 5 },
      });
      map.addSource('reports', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'reports',
        type: 'circle',
        source: 'reports',
        paint: {
          'circle-radius': 7,
          'circle-color': '#0ea5e9',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
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
          `${p.name ?? p.segmentId} · riesgo estimado ${p.level} (${Number(p.score).toFixed(2)}) · lluvia 1h ${p.rainfall1hMm} mm · reportes 60 min: ${p.reportCount60m}`,
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

  useEffect(sync, [segments, reports, route, picks]);

  return <div ref={container} className="map" data-testid="map" />;
}
