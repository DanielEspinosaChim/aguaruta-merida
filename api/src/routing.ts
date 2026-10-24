import { haversineM, lineLengthM, type Position, type StreetSegment } from '../../core/src/index';

export type TravelMode = 'car' | 'walk';

export interface RoutingRequest {
  origin: Position;
  destination: Position;
  mode: TravelMode;
  /** Tramos a evitar. Con Amazon Location se traducen a Avoid.Areas (preferencia, no garantía). */
  avoidSegmentIds: Set<string>;
}

export interface RoutingResult {
  distanceM: number;
  durationS: number;
  coordinates: Position[];
  /** Tramos recorridos (para medir el riesgo residual). */
  segmentIds: string[];
}

export interface RoutingProvider {
  calculate(req: RoutingRequest): Promise<RoutingResult | null>;
}

const SPEED_MPS: Record<TravelMode, number> = { car: 30 / 3.6, walk: 5 / 3.6 };
/** Distancia máxima para "enganchar" origen/destino a la red de la zona piloto. */
export const MAX_SNAP_M = 1000;

interface Edge {
  to: number;
  segmentId: string;
  lengthM: number;
  coords: Position[];
}

/** Ruteo local: Dijkstra sobre el grafo de segments.json. Sin AWS. */
export class LocalGraphRoutingProvider implements RoutingProvider {
  private readonly nodes: Position[] = [];
  private readonly adj: Edge[][] = [];

  constructor(segments: StreetSegment[]) {
    const ids = new Map<string, number>();
    const nodeId = (p: Position) => {
      const k = `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
      let id = ids.get(k);
      if (id === undefined) {
        id = this.nodes.length;
        ids.set(k, id);
        this.nodes.push(p);
        this.adj.push([]);
      }
      return id;
    };
    for (const s of segments) {
      const c = s.geometry.coordinates;
      if (c.length < 2) continue;
      const a = nodeId(c[0]!);
      const b = nodeId(c[c.length - 1]!);
      const lengthM = lineLengthM(c);
      this.adj[a]!.push({ to: b, segmentId: s.segmentId, lengthM, coords: c });
      this.adj[b]!.push({ to: a, segmentId: s.segmentId, lengthM, coords: [...c].reverse() });
    }
  }

  nearestNode(p: Position): { id: number; distanceM: number } | null {
    let best: { id: number; distanceM: number } | null = null;
    this.nodes.forEach((n, id) => {
      const d = haversineM(p, n);
      if (!best || d < best.distanceM) best = { id, distanceM: d };
    });
    return best;
  }

  async calculate(req: RoutingRequest): Promise<RoutingResult | null> {
    const start = this.nearestNode(req.origin);
    const end = this.nearestNode(req.destination);
    if (!start || !end || start.distanceM > MAX_SNAP_M || end.distanceM > MAX_SNAP_M) return null;

    const n = this.nodes.length;
    const dist = new Array<number>(n).fill(Infinity);
    const prev = new Array<Edge | undefined>(n);
    const prevNode = new Array<number>(n).fill(-1);
    const done = new Array<boolean>(n).fill(false);
    dist[start.id] = 0;

    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i]! < Infinity && (u === -1 || dist[i]! < dist[u]!)) u = i;
      if (u === -1 || u === end.id) break;
      done[u] = true;
      for (const e of this.adj[u]!) {
        if (req.avoidSegmentIds.has(e.segmentId)) continue;
        const nd = dist[u]! + e.lengthM;
        if (nd < dist[e.to]!) {
          dist[e.to] = nd;
          prev[e.to] = e;
          prevNode[e.to] = u;
        }
      }
    }
    if (dist[end.id] === Infinity) return null;

    const edges: Edge[] = [];
    for (let v = end.id; v !== start.id; v = prevNode[v]!) edges.unshift(prev[v]!);

    const coordinates: Position[] = [req.origin, this.nodes[start.id]!];
    for (const e of edges) coordinates.push(...e.coords.slice(1));
    coordinates.push(req.destination);

    const distanceM = Math.round(start.distanceM + dist[end.id]! + end.distanceM);
    return {
      distanceM,
      durationS: Math.round(distanceM / SPEED_MPS[req.mode]),
      coordinates,
      segmentIds: edges.map((e) => e.segmentId),
    };
  }
}

/**
 * TODO Fase 4: Amazon Location Routes v2 (`geo-routes:CalculateRoutes`) con Avoid.Areas.
 * Instalar @aws-sdk/client-geo-routes, convertir avoidSegmentIds a polígonos con buffer ~15 m
 * y mapear la geometría devuelta a segmentIds (nearestSegment) para medir el riesgo residual.
 */
export class AmazonLocationRoutingProvider implements RoutingProvider {
  async calculate(): Promise<RoutingResult | null> {
    throw new Error('AmazonLocationRoutingProvider no implementado (Fase 4)');
  }
}
