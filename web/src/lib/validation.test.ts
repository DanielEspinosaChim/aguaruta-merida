import { describe, expect, it } from 'vitest';
import { formatBbox, isValidBbox, isValidPosition, validateNotes, validatePhoto } from './validation';

describe('validación', () => {
  it('bbox con formato del contrato y rangos válidos', () => {
    expect(isValidBbox('-89.64,20.95,-89.60,20.99')).toBe(true);
    expect(isValidBbox('-89.64,20.95,-89.60')).toBe(false);
    expect(isValidBbox('a,b,c,d')).toBe(false);
    expect(isValidBbox('-89.60,20.95,-89.64,20.99')).toBe(false); // min > max
    expect(isValidBbox('-200,20,-89,21')).toBe(false);
  });

  it('formatBbox usa 4 decimales', () => {
    expect(formatBbox(-89.640123, 20.95, -89.6, 20.99)).toBe('-89.6401,20.9500,-89.6000,20.9900');
  });

  it('posiciones [lon, lat] en rango', () => {
    expect(isValidPosition([-89.62, 20.97])).toBe(true);
    expect(isValidPosition([20.97, -189.62])).toBe(false);
    expect(isValidPosition([Number.NaN, 1])).toBe(false);
  });

  it('C002-5: notas > 280 se rechazan', () => {
    expect(validateNotes('a'.repeat(280))).toBeNull();
    expect(validateNotes('a'.repeat(281))).toMatch(/280/);
  });

  it('C002-5: foto con tipo no permitido o > 5 MB se rechaza', () => {
    expect(validatePhoto({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validatePhoto({ type: 'image/png', size: 5_242_880 })).toBeNull();
    expect(validatePhoto({ type: 'image/gif', size: 1000 })).toMatch(/JPEG o PNG/);
    expect(validatePhoto({ type: 'image/jpeg', size: 5_242_881 })).toMatch(/5 MB/);
    expect(validatePhoto({ type: 'image/jpeg', size: 0 })).not.toBeNull();
  });
});
