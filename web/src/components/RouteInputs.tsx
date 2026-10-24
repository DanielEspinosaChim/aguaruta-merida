import { useState } from 'react';
import type { Position } from '../api/types';

/** Origen con la ubicación actual y destino escrito (geocodificado con Nominatim/OSM, acotado a Mérida). */
export function RouteInputs({ onOrigin, onDestination }: { onOrigin: (p: Position) => void; onDestination: (p: Position) => void }) {
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const locate = () => {
    if (!navigator.geolocation) return setMsg('Tu navegador no permite ubicación.');
    setMsg('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onOrigin([pos.coords.longitude, pos.coords.latitude]);
        setMsg('Origen: tu ubicación actual.');
      },
      () => setMsg('No se pudo obtener tu ubicación.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setMsg('Buscando dirección…');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&viewbox=-89.75,21.08,-89.52,20.88&bounded=1&q=${encodeURIComponent(q.trim().slice(0, 120))}`;
      const r = (await (await fetch(url)).json()) as { lon: string; lat: string; display_name: string }[];
      if (!r[0]) return setMsg('No encontré esa dirección en Mérida.');
      onDestination([Number(r[0].lon), Number(r[0].lat)]);
      setMsg(`Destino: ${r[0].display_name.split(',').slice(0, 2).join(',')}`);
    } catch {
      setMsg('No se pudo buscar la dirección.');
    }
  };

  return (
    <div className="panel route-inputs">
      <button type="button" onClick={locate}>
        ◎ Mi ubicación como origen
      </button>
      <form className="row" onSubmit={search}>
        <input
          className="addr"
          type="search"
          maxLength={120}
          placeholder="Destino: p. ej. Gran Plaza, Mérida"
          aria-label="Dirección de destino"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="go">Buscar</button>
      </form>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
