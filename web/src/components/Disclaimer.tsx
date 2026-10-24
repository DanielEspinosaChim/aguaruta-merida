export const FALLBACK_DISCLAIMER = 'Riesgo estimado, no garantía.';

export function Disclaimer({ text }: { text?: string | null }) {
  return (
    <div className="disclaimer" role="note" aria-label="Aviso">
      ⚠️ {text?.trim() || FALLBACK_DISCLAIMER}
    </div>
  );
}
