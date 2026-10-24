import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'aguaruta-theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* sin almacenamiento: usar preferencia del sistema */
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

/**
 * Tema claro/oscuro: respeta el sistema, recuerda la elección y la aplica en <html data-theme>.
 * El cambio se revela con un círculo que crece desde el botón (View Transitions API si existe).
 */
export function useTheme(): [Theme, (origin?: { x: number; y: number }) => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignorar */
    }
  }, [theme]);

  const toggle = (origin?: { x: number; y: number }) => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    const doc = document as ViewTransitionDoc;
    if (!doc.startViewTransition || !origin || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTheme(next);
      return;
    }
    const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    const vt = doc.startViewTransition(() => {
      document.documentElement.dataset.theme = next;
      setTheme(next);
    });
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 700, easing: 'cubic-bezier(.7,0,.2,1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  };

  return [theme, toggle];
}
