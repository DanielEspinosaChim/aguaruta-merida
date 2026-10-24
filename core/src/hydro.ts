/**
 * Modelo hidrológico v1 (puro, sin AWS): llenado-derrame de hondonadas con escurrimiento SCS-CN.
 *
 *  1. Escurrimiento acumulado Q(P) con el método del número de curva (NRCS/SCS):
 *       S = 25400/CN − 254,  Ia = 0.2·S,  Q = (P − Ia)² / (P − Ia + S)  si P > Ia
 *  2. Cada hondonada recibe ΔQ × área de su cuenca y pierde `drainMmPerH` (pozos de absorción / karst)
 *     sobre la misma cuenca; el volumen se topa en su capacidad (lo demás se derrama).
 *  3. El nivel del agua sale de la forma real del fondo (cotas de sus celdas): V(h) = Σ max(0, h − zᵢ)·A.
 *  4. Profundidad en un tramo = nivel − cota más baja del tramo dentro de esa hondonada.
 */

export interface HydroDepression {
  /** Cota de derrame (m). */
  spill: number;
  /** Área que drena hacia la hondonada (m²). */
  catchAreaM2: number;
  /** Cotas (m) de las celdas de la hondonada, ascendentes. */
  zs: number[];
}

export interface HydroModel {
  cellAreaM2: number;
  depressions: HydroDepression[];
  /** segmentId → [[índice de hondonada, cota mínima del tramo en ella (m)], …] */
  segments: Record<string, [number, number][]>;
}

export interface HydroParams {
  curveNumber: number;
  drainMmPerH: number;
  /** Profundidad (cm) que equivale a score 1. */
  depthCmMaxScore: number;
}

export function scsRunoffMm(pMm: number, cn: number): number {
  const s = 25400 / cn - 254;
  const ia = 0.2 * s;
  return pMm > ia ? (pMm - ia) ** 2 / (pMm - ia + s) : 0;
}

export function capacityM3(d: HydroDepression, cellAreaM2: number): number {
  let v = 0;
  for (const z of d.zs) v += Math.max(0, d.spill - z);
  return v * cellAreaM2;
}

/** Nivel del agua (m) para un volumen dado; NaN si está seca. */
export function levelForVolume(d: HydroDepression, cellAreaM2: number, volumeM3: number): number {
  if (volumeM3 <= 0 || d.zs.length === 0) return NaN;
  let v = 0;
  for (let k = 0; k < d.zs.length; k++) {
    const next = k + 1 < d.zs.length ? d.zs[k + 1]! : d.spill;
    const add = (next - d.zs[k]!) * (k + 1) * cellAreaM2;
    if (v + add >= volumeM3) return d.zs[k]! + (volumeM3 - v) / ((k + 1) * cellAreaM2);
    v += add;
  }
  return d.spill;
}

/**
 * Simula la lluvia (mm por paso de 15 min, del más antiguo al actual) y devuelve el nivel final de cada hondonada.
 */
export function simulateLevels(model: HydroModel, rain15Mm: number[], p: HydroParams): Float64Array {
  const steps = rain15Mm.length;
  const dQ = new Float64Array(steps);
  let pCum = 0;
  let qPrev = 0;
  for (let k = 0; k < steps; k++) {
    pCum += Math.max(0, rain15Mm[k] ?? 0);
    const q = scsRunoffMm(pCum, p.curveNumber);
    dQ[k] = q - qPrev;
    qPrev = q;
  }
  const drainPerStepMm = p.drainMmPerH / 4;
  const levels = new Float64Array(model.depressions.length).fill(NaN);
  model.depressions.forEach((d, i) => {
    const cap = capacityM3(d, model.cellAreaM2);
    let v = 0;
    for (let k = 0; k < steps; k++) {
      v += ((dQ[k]! - drainPerStepMm) / 1000) * d.catchAreaM2;
      v = Math.min(Math.max(v, 0), cap);
    }
    levels[i] = levelForVolume(d, model.cellAreaM2, v);
  });
  return levels;
}

/** Profundidad (cm) por tramo con agua; los tramos secos no aparecen. */
export function segmentDepthsCm(model: HydroModel, levels: Float64Array): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, list] of Object.entries(model.segments)) {
    let best = 0;
    for (const [dep, zMin] of list) {
      const h = levels[dep]!;
      if (!Number.isNaN(h) && h > zMin) best = Math.max(best, (h - zMin) * 100);
    }
    if (best > 0) out.set(id, Math.round(best));
  }
  return out;
}

/** Score 0–1 a partir de la profundidad; con los umbrales 0.33/0.66 y 30 cm: <10 cm bajo, 10–20 medio, ≥20 alto. */
export function depthToScore(depthCm: number, p: HydroParams): number {
  return Math.min(1, Math.max(0, depthCm / p.depthCmMaxScore));
}
