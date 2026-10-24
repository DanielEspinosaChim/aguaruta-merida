import { randomBytes } from 'node:crypto';

export type ApiErrorCode = 'INVALID_REQUEST' | 'ROUTE_NOT_FOUND' | 'INTERNAL_ERROR';

export interface ApiRequest {
  method: string;
  /** Ruta sin query, p. ej. /v1/risk/segments */
  path: string;
  query: Record<string, string | undefined>;
  /** Cuerpo crudo (texto) o undefined. */
  body?: string;
  requestId?: string;
}

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, 'INVALID_REQUEST', message);

export const newRequestId = () => `req_${randomBytes(3).toString('hex')}`;

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN ?? '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  };
}

export function json(statusCode: number, payload: unknown): ApiResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
    body: JSON.stringify(payload),
  };
}

export function errorResponse(status: number, code: ApiErrorCode, message: string, requestId: string): ApiResponse {
  return json(status, { error: { code, message, requestId } });
}
