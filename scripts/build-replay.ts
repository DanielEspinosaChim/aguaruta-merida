/**
 * Genera los snapshots del replay del 29-may-2026 en data/snapshots/:
 *   {yyyyMMddTHHmmZ}.json  y  index.json
 * Con --upload los sube a S3 (bucket en SNAPSHOT_BUCKET). Eso es Fase 3: requiere
 * `npm i @aws-sdk/client-s3` en api/ y un perfil AWS local; no se usa en la demo con mock.
 *
 * Uso: npx tsx scripts/build-replay.ts [--upload]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeRisk, type RiskModel, type Snapshot, type StreetSegment } from '../core/src/index';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const OUT_DIR = join(DATA_DIR, 'snapshots');

interface RainStep {
  t: string;
  accum1hMm: number;
  accum3hMm: number;
}

const readJson = <T>(file: string): T => JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as T;

export const snapshotKey = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z`;
};

const segments = readJson<StreetSegment[]>('segments.json');
const model = readJson<RiskModel>('model.json');
const rain = readJson<{ series: RainStep[] }>('rain-2026-05-29.json');

mkdirSync(OUT_DIR, { recursive: true });
const instants: { asOf: string; key: string }[] = [];
let peakHighInDepression = 0;
let peakHighTotal = 0;

for (const step of rain.series) {
  const rainfall = { accum1hMm: step.accum1hMm, accum3hMm: step.accum3hMm };
  const snapshot: Snapshot = {
    computedAt: step.t,
    modelVersion: model.modelVersion,
    rainfall,
    entries: segments.map((s) => {
      const { score, level } = computeRisk(s, rainfall, model);
      return {
        segmentId: s.segmentId,
        score: Math.round(score * 1000) / 1000,
        level,
        rainfall1hMm: step.accum1hMm,
        rainfall3hMm: step.accum3hMm,
      };
    }),
  };
  const key = snapshotKey(step.t);
  writeFileSync(join(OUT_DIR, `${key}.json`), JSON.stringify(snapshot));
  instants.push({ asOf: step.t, key });

  const high = snapshot.entries.filter((e) => e.level === 'high');
  if (high.length > peakHighTotal) {
    peakHighTotal = high.length;
    const depressed = new Set(segments.filter((s) => s.inDepression).map((s) => s.segmentId));
    peakHighInDepression = high.filter((e) => depressed.has(e.segmentId)).length;
  }
}

writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify({ event: '2026-05-29', instants }, null, 2));
console.log(
  `snapshots: ${instants.length} (${instants[0]?.asOf} → ${instants.at(-1)?.asOf}) · ` +
    `pico: ${peakHighTotal} tramos high, ${peakHighInDepression} en depresiones`,
);
if (peakHighInDepression === 0) {
  console.error('ERROR: en el pico no hay tramos high en depresiones; recalibrar data/model.json');
  process.exit(1);
}

if (process.argv.includes('--upload')) {
  const bucket = process.env.SNAPSHOT_BUCKET;
  if (!bucket) {
    console.error('Falta SNAPSHOT_BUCKET');
    process.exit(1);
  }
  // Import dinámico: el SDK solo se necesita en Fase 3.
  const moduleName = '@aws-sdk/client-s3';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdk: any = await import(moduleName);
  const s3 = new sdk.S3Client({});
  const files = [...instants.map((i) => `${i.key}.json`), 'index.json'];
  for (const f of files) {
    await s3.send(
      new sdk.PutObjectCommand({
        Bucket: bucket,
        Key: `snapshots/${f}`,
        Body: readFileSync(join(OUT_DIR, f)),
        ContentType: 'application/json',
      }),
    );
  }
  await s3.send(
    new sdk.PutObjectCommand({
      Bucket: bucket,
      Key: 'segments.json',
      Body: readFileSync(join(DATA_DIR, 'segments.json')),
      ContentType: 'application/json',
    }),
  );
  console.log(`subidos ${files.length + 1} objetos a s3://${bucket}`);
}
