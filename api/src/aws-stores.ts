import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { Snapshot, StreetSegment } from '../../core/src/index';
import type { PhotoSigner, ReportStore, SnapshotIndexEntry, SnapshotStore, StoredReport } from './stores';

/* Implementaciones AWS de los stores. La Lambda usa su rol IAM; nunca hay claves en el código. */

const s3 = new S3Client({});

async function getJson<T>(bucket: string, key: string): Promise<T> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return JSON.parse(await res.Body!.transformToString('utf-8')) as T;
}

/** Lee segments.json y snapshots/ de S3; los cachea en memoria entre invocaciones. */
export class S3SnapshotStore implements SnapshotStore {
  private segments?: Promise<StreetSegment[]>;
  private index?: Promise<SnapshotIndexEntry[]>;
  private readonly cache = new Map<string, Promise<Snapshot>>();

  constructor(private readonly bucket: string) {}

  getSegments(): Promise<StreetSegment[]> {
    this.segments ??= getJson<StreetSegment[]>(this.bucket, 'segments.json');
    return this.segments;
  }

  getIndex(): Promise<SnapshotIndexEntry[]> {
    this.index ??= getJson<{ instants: SnapshotIndexEntry[] }>(this.bucket, 'snapshots/index.json').then((i) =>
      i.instants.slice().sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf)),
    );
    return this.index;
  }

  getSnapshot(key: string): Promise<Snapshot> {
    if (!/^\d{8}T\d{4}Z$/.test(key)) return Promise.reject(new Error('clave de snapshot inválida'));
    let s = this.cache.get(key);
    if (!s) {
      s = getJson<Snapshot>(this.bucket, `snapshots/${key}.json`);
      this.cache.set(key, s);
    }
    return s;
  }
}

/** Tabla Reports (PK reportId, TTL expiresAt). Scan con filtro: la tabla es pequeña en la demo. */
export class DynamoReportStore implements ReportStore {
  private readonly doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

  constructor(private readonly table: string) {}

  async put(report: StoredReport): Promise<void> {
    await this.doc.send(new PutCommand({ TableName: this.table, Item: report }));
  }

  async listSince(sinceMs: number): Promise<StoredReport[]> {
    const items: StoredReport[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new ScanCommand({
          TableName: this.table,
          FilterExpression: 'createdAt >= :since AND expiresAt > :now',
          ExpressionAttributeValues: { ':since': new Date(sinceMs).toISOString(), ':now': Math.floor(Date.now() / 1000) },
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...((res.Items ?? []) as StoredReport[]));
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return items;
  }
}

/** URL prefirmada de S3: PUT con Content-Type fijo (5 min); GET prefirmado de 1 h para ver la foto. */
export class S3PhotoSigner implements PhotoSigner {
  constructor(private readonly bucket: string) {}

  createUploadUrl(photoKey: string, contentType: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(s3, new PutObjectCommand({ Bucket: this.bucket, Key: photoKey, ContentType: contentType }), {
      expiresIn: expiresInSeconds,
    });
  }

  publicUrl(photoKey: string): Promise<string> {
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: this.bucket, Key: photoKey }), { expiresIn: 3600 });
  }
}
