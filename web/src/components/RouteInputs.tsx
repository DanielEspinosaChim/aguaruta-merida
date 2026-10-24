import { useEffect, useRef, useState } from 'react';
import type { Position } from '../api/types';

interface Place { label: string; detail: string; pos: Position }

/** Sugerencias de lugares en Mérida (Nominatim/OSM) con espera de 350 ms entre teclas. */
function usePlaces(q: string) {
  const [items, setItems] = useState<Place[]>([]);
  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) return setItems([]);
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=mx&viewbox=-89.75,21.08,-89.52,20.88&bounded=1&q=${encodeURIComponent(text.slice(0, 120))}`;
        const r = (await (await fetch(url, { signal: ctrl.signal })).json()) as { lon: string; lat: string; display_name: string }[];
        setItems(
          r.map((x) => {
            const parts = x.display_name.split(',').map((s) => s.trim());
            return { label: parts[0] ?? x.display_name, detail: parts.slice(1, 3).join(', '), pos: [Number(x.lon), Number(x.lat)] };
          }),
        );
      } catch {
        /* abortado o sin red */
      }
    }, 350);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);
  return items;
}

function PlaceField({
  label,
  marker,
  value,
  placeholder,
  onPick,
  extra,
}: {
  label: string;
  marker: string;
  value: string | null;
  placeholder: string;
  onPick: (p: Place) => void;
  extra?: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const items = usePlaces(q);
  const box = useRef<HTMLDivElement>(null);

  return (
    <div className="place" ref={box}>
      <span className={`place-marker m-${marker}`}>{marker}</span>
      <div className="place-body">
        <label className="place-label">{label}</label>
        <div className="place-row">
          <input
            type="search"
            maxLength={120}
            placeholder={value ?? placeholder}
            aria-label={label}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {extra}
        </div>
        {value && !q && <span className="place-value">{value}</span>}
        {open && items.length > 0 && (
          <ul className="suggest" role="listbox">
            {items.map((it, i) => (
              <li key={i} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(it);
                    setQ('');
                    setOpen(false);
                  }}
                >
                  <strong>{it.label}</strong>
                  <span>{it.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Origen y destino por texto (con sugerencias) o con tu ubicación actual. También se puede tocar el mapa. */
export function RouteInputs({ onOrigin, onDestination }: { onOrigin: (p: Position) => void; onDestination: (p: Position) => void }) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [dest, setDest] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const locate = () => {
    if (!navigator.geolocation) return setMsg('Tu navegador no permite ubicación.');
    setMsg('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onOrigin([pos.coords.longitude, pos.coords.latitude]);
        setOrigin('Mi ubicación actual');
        setMsg(null);
      },
      () => setMsg('No se pudo obtener tu ubicación (revisa el permiso del navegador).'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="panel route-inputs">
      <PlaceField
        label="Origen"
        marker="A"
        value={origin}
        placeholder="Escribe un lugar o usa tu ubicación"
        onPick={(p) => {
          onOrigin(p.pos);
          setOrigin(p.label);
        }}
        extra={
          <button type="button" className="locate" onClick={locate} aria-label="Usar mi ubicación" title="Usar mi ubicación">
            ◎
          </button>
        }
      />
      <PlaceField
        label="Destino"
        marker="B"
        value={dest}
        placeholder="Escribe a dónde vas"
        onPick={(p) => {
          onDestination(p.pos);
          setDest(p.label);
        }}
      />
      {msg && <p className="muted">{msg}</p>}
      <p className="muted">O toca el mapa con “Elegir origen / destino”.</p>
    </div>
  );
}
