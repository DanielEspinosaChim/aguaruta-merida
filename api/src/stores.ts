import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Position, Snapshot, StreetSegment, WaterLevel } from '../../core/src/index';

/* ---------- Snapshots (local ahora; S3 en Fase 3) ---------- */

export interface SnapshotIndexEntry {
  asOf: string;
  key: string;
}

export interface SnapshotStore {
  getSegments(): Promise<StreetSegment[]>;
  getIndex(): Promise<SnapshotIndexEntry[]>;
  getSnapshot(key: string): Promise<Snapshot>;
}

export class LocalSnapshotStore implements SnapshotStore {
  private segments?: StreetSegment[];
  private index?: SnapshotIndexEntry[];
  private readonly cache = new Map<string, Snapshot>();

  constructor(private readonly dataDir: string) {}

  private read<T>(...parts: string[]): T {
    return JSON.parse(readFileSync(join(this.dataDir, ...parts), 'utf8')) as T;
  }

  async getSegments(): Promise<StreetSegment[]> {
    this.segments ??= this.read<StreetSegment[]>('segments.json');
    return this.segments;
  }

  async getIndex(): Promise<SnapshotIndexEntry[]> {
    this.index ??= this.read<{ instants: SnapshotIndexEntry[] }>('snapshots', 'index.json').instants
      .slice()
      .sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf));
    return this.index;
  }

  async getSnapshot(key: string): Promise<Snapshot> {
    if (!/^\d{8}T\d{4}Z$/.test(key)) throw new Error('clave de snapshot inválida');
    let s = this.cache.get(key);
    if (!s) {
      s = this.read<Snapshot>('snapshots', `${key}.json`);
      this.cache.set(key, s);
    }
    return s;
  }
}

/** Snapshot más cercano anterior (o igual) a asOf; sin asOf, el último; si asOf es anterior a todos, el primero. */
export function pickSnapshot(index: SnapshotIndexEntry[], asOfMs?: number): SnapshotIndexEntry {
  if (index.length === 0) throw new Error('no hay snapshots');
  if (asOfMs === undefined) return index[index.length - 1]!;
  let chosen = index[0]!;
  for (const e of index) {
    if (Date.parse(e.asOf) <= asOfMs) chosen = e;
    else break;
  }
  return chosen;
}

/* ---------- Reportes (memoria ahora; DynamoDB en Fase 5) ---------- */

export interface StoredReport {
  reportId: string;
  location: { type: 'Point'; coordinates: Position };
  segmentId: string | null;
  waterLevel: WaterLevel;
  notes: string | null;
  photoKey: string | null;
  createdAt: string;
  expiresAt: number;
}

export interface ReportStore {
  put(report: StoredReport): Promise<void>;
  listSince(sinceMs: number): Promise<StoredReport[]>;
}

export class MemoryReportStore implements ReportStore {
  private readonly items: StoredReport[] = [];

  async put(report: StoredReport): Promise<void> {
    this.items.push(report);
  }

  async listSince(sinceMs: number): Promise<StoredReport[]> {
    const nowS = Date.now() / 1000;
    return this.items.filter((r) => Date.parse(r.createdAt) >= sinceMs && r.expiresAt > nowS);
  }
}

/* ---------- Fotos (servidor local ahora; S3 prefirmado en Fase 5) ---------- */

export interface PhotoSigner {
  createUploadUrl(photoKey: string, contentType: string, expiresInSeconds: number): Promise<string>;
  publicUrl(photoKey: string): string | Promise<string>;
}

/**
 * Firma local: la URL apunta a PUT {baseUrl}/local-photos/{key}?exp=…&ct=…&sig=… del servidor local.
 * Imita la URL prefirmada de S3 (caduca y fija el Content-Type).
 */
export class LocalPhotoSigner implements PhotoSigner {
  private readonly secret = randomBytes(32);

  constructor(private readonly baseUrl: string) {}

  private sign(photoKey: string, exp: number, contentType: string): string {
    return createHmac('sha256', this.secret).update(`${photoKey}|${exp}|${contentType}`).digest('hex');
  }

  async createUploadUrl(photoKey: string, contentType: string, expiresInSeconds: number): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const sig = this.sign(photoKey, exp, contentType);
    const q = new URLSearchParams({ exp: String(exp), ct: contentType, sig });
    return `${this.baseUrl}/local-photos/${photoKey}?${q.toString()}`;
  }

  verify(photoKey: string, exp: number, contentType: string, sig: string): boolean {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(photoKey, exp, contentType), 'hex');
    const given = Buffer.from(sig, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  publicUrl(photoKey: string): string {
    return `${this.baseUrl}/local-photos/${photoKey}`;
  }
}
