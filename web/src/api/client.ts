import {
  ApiError,
  type AguaRutaApi,
  type CreateReportRequest,
  type ErrorResponse,
  type FloodReport,
  type FloodReportList,
  type ListReportsParams,
  type ListRiskSegmentsParams,
  type PhotoUploadRequest,
  type PhotoUploadResponse,
  type RouteRequest,
  type RouteResult,
  type SegmentRiskCollection,
  type GetRainfallParams,
  type RainfallSeries,
} from './types';

export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:4010/v1';

function isErrorResponse(x: unknown): x is ErrorResponse {
  const e = (x as ErrorResponse | null)?.error;
  return !!e && typeof e.message === 'string' && typeof e.code === 'string';
}

function query(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function createApiClient(
  baseUrl: string = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): AguaRutaApi {
  const base = baseUrl.replace(/\/+$/, '');

  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, {
        error: { code: 'INTERNAL_ERROR', message: 'No se pudo conectar con el servidor.', requestId: 'local' },
      });
    }
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      throw new ApiError(
        res.status,
        isErrorResponse(data)
          ? data
          : {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Ocurrió un error inesperado. Intenta de nuevo.',
                requestId: 'local',
              },
            },
      );
    }
    return data as T;
  }

  return {
    listRiskSegments: (p: ListRiskSegmentsParams) =>
      request<SegmentRiskCollection>('GET', `/risk/segments${query(p)}`),
    getRainfall: (p: GetRainfallParams) => request<RainfallSeries>('GET', `/rainfall${query(p)}`),
    createReport: (b: CreateReportRequest) => request<FloodReport>('POST', '/reports', b),
    listReports: (p: ListReportsParams) => request<FloodReportList>('GET', `/reports${query(p)}`),
    createPhotoUploadUrl: (b: PhotoUploadRequest) =>
      request<PhotoUploadResponse>('POST', '/reports/photo-upload-url', b),
    calculateRoute: (b: RouteRequest) => request<RouteResult>('POST', '/routes', b),
  };
}

export const api = createApiClient();
