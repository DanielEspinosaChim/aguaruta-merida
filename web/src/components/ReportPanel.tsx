import { useState, type FormEvent } from 'react';
import { ApiError, type AguaRutaApi, type FloodReport, type Position, type WaterLevel } from '../api/types';
import { MAX_NOTES_LENGTH, validateNotes, validatePhoto, type AllowedPhotoType } from '../lib/validation';

export const WATER_LEVEL_LABELS: Record<WaterLevel, string> = {
  puddle: 'Charco',
  ankle: 'Tobillo',
  knee: 'Rodilla',
  impassable: 'Intransitable',
};

export interface ReportPanelProps {
  api: Pick<AguaRutaApi, 'createPhotoUploadUrl' | 'createReport'>;
  location?: Position;
  picking: boolean;
  onPick: () => void;
  onCreated: (r: FloodReport) => void;
  putFile?: (url: string, file: File, contentType: string) => Promise<boolean>;
}

async function defaultPut(url: string, file: File, contentType: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
    return res.ok;
  } catch {
    return false;
  }
}

export function ReportPanel({ api, location, picking, onPick, onCreated, putFile = defaultPut }: ReportPanelProps) {
  const [waterLevel, setWaterLevel] = useState<WaterLevel>('ankle');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!location) {
      setError('Toca el mapa para ubicar el reporte.');
      return;
    }
    const notesError = validateNotes(notes);
    if (notesError) {
      setError(notesError);
      return;
    }
    if (photo) {
      const photoError = validatePhoto(photo);
      if (photoError) {
        setError(photoError);
        return;
      }
    }
    setSending(true);
    try {
      let photoKey: string | null = null;
      if (photo) {
        const contentType = photo.type as AllowedPhotoType;
        const up = await api.createPhotoUploadUrl({ contentType, sizeBytes: photo.size });
        if (await putFile(up.uploadUrl, photo, contentType)) {
          photoKey = up.photoKey;
        } else {
          setNotice('No se pudo subir la foto; el reporte se envía sin foto.');
        }
      }
      const created = await api.createReport({
        location: { type: 'Point', coordinates: location },
        waterLevel,
        notes: notes.trim() || undefined,
        photoKey,
      });
      onCreated(created);
      setNotes('');
      setPhoto(null);
      setNotice((n) => (n ? `${n} Reporte enviado.` : 'Reporte enviado. Gracias.'));
    } catch (err) {
      setError(err instanceof ApiError ? err.body.error.message : 'Ocurrió un error inesperado. Intenta de nuevo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} aria-label="Reportar calle inundada">
      <h2>Reportar calle inundada</h2>
      <div className="row">
        <button type="button" className={picking ? 'active' : ''} onClick={onPick}>
          Ubicar en el mapa
        </button>
        <span className="muted">{location ? `${location[0].toFixed(4)}, ${location[1].toFixed(4)}` : '—'}</span>
      </div>
      <label>
        Nivel del agua{' '}
        <select value={waterLevel} onChange={(e) => setWaterLevel(e.target.value as WaterLevel)}>
          {(Object.keys(WATER_LEVEL_LABELS) as WaterLevel[]).map((w) => (
            <option key={w} value={w}>
              {WATER_LEVEL_LABELS[w]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Notas
        <textarea
          aria-label="Notas"
          value={notes}
          maxLength={MAX_NOTES_LENGTH}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </label>
      <div className="muted">
        {notes.length}/{MAX_NOTES_LENGTH}
      </div>
      <label>
        Foto (opcional, JPEG/PNG ≤ 5 MB){' '}
        <input
          aria-label="Foto"
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
      </label>
      <button type="submit" disabled={sending}>
        {sending ? 'Enviando…' : 'Enviar reporte'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="notice">{notice}</p>}
    </form>
  );
}
