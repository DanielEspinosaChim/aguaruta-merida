/**
 * Lluvia real para Mérida en pasos de 15 min (mm en los 15 min que terminan en t).
 * - Últimos ~90 días y hasta 3 días adelante: Open-Meteo forecast (pronóstico + observado reciente).
 * - Antes: Open-Meteo historical-forecast (archivo de corridas de modelos de alta resolución).
 * Caché en memoria por día (los días pasados no cambian; el día de hoy se refresca cada 15 min).
 */
export const STEP_MS = 15 * 60 * 1000;
const LAT = 20.97;
const LON = -89.62;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RainSeries {
  source: string;
  /** ms (fin del paso) → mm */
  byStep: Map<number, number>;
}

export interface RainProvider {
  get(fromMs: number, toMs: number): Promise<RainSeries>;
}

type Fetch = typeof fetch;

export class OpenMeteoRain implements RainProvider {
  private readonly cache = new Map<string, { at: number; data: Promise<{ source: string; pairs: [number, number][] }> }>();

  constructor(
    private readonly fetchFn: Fetch = fetch,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private day(dayMs: number) {
    const date = new Date(dayMs).toISOString().slice(0, 10);
    const isRecent = dayMs > this.now() - 85 * DAY_MS;
    const key = date;
    const hit = this.cache.get(key);
    const fresh = hit && (dayMs + DAY_MS < this.now() - DAY_MS || this.now() - hit.at < STEP_MS);
    if (hit && fresh) return hit.data;
    const base = isRecent ? 'https://api.open-meteo.com/v1/forecast' : 'https://historical-forecast-api.open-meteo.com/v1/forecast';
    const source = isRecent ? 'Open-Meteo forecast' : 'Open-Meteo historical-forecast';
    const url = `${base}?latitude=${LAT}&longitude=${LON}&minutely_15=precipitation&timezone=UTC&start_date=${date}&end_date=${date}`;
    const data = this.fetchFn(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
        return r.json() as Promise<{ minutely_15?: { time: string[]; precipitation: (number | null)[] } }>;
      })
      .then((j) => ({
        source,
        pairs: (j.minutely_15?.time ?? []).map((t, i) => [Date.parse(t + 'Z'), j.minutely_15!.precipitation[i] ?? 0] as [number, number]),
      }));
    data.catch(() => this.cache.delete(key));
    this.cache.set(key, { at: this.now(), data });
    return data;
  }

  async get(fromMs: number, toMs: number): Promise<RainSeries> {
    const days: number[] = [];
    for (let d = Math.floor(fromMs / DAY_MS) * DAY_MS; d <= toMs; d += DAY_MS) days.push(d);
    const parts = await Promise.all(days.map((d) => this.day(d)));
    const byStep = new Map<number, number>();
    for (const p of parts) for (const [t, mm] of p.pairs) if (t > fromMs - STEP_MS && t <= toMs) byStep.set(t, mm);
    return { source: [...new Set(parts.map((p) => p.source))].join(' + '), byStep };
  }
}

/** Serie fija (tests y modo sin red). */
export class StaticRain implements RainProvider {
  constructor(private readonly byStep: Map<number, number>, private readonly source = 'serie fija') {}
  async get(fromMs: number, toMs: number): Promise<RainSeries> {
    const out = new Map<number, number>();
    for (const [t, mm] of this.byStep) if (t > fromMs - STEP_MS && t <= toMs) out.set(t, mm);
    return { source: this.source, byStep: out };
  }
}
