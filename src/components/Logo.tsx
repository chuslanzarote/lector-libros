// MAR-1 — el símbolo de eglosa: un bocadillo redondo que habla.
// Los colores salen de los tokens (--logo-*) para que el modo Noche use su versión.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg class="logo-mark" width={size} height={size} viewBox="3 4 92 92" aria-hidden="true">
      <path d="M26 66 L12 92 L42 78 Z" fill="var(--logo-bubble)" stroke="var(--logo-bubble)" stroke-width="4" stroke-linejoin="round" />
      <circle cx="50" cy="44" r="38" fill="var(--logo-bubble)" />
      <path d="M31 33 H69 Q69 65 50 65 Q31 65 31 33 Z" fill="var(--logo-mouth)" />
      <path d="M39 57 Q50 47 61 57 Q56 65 50 65 Q44 65 39 57 Z" fill="var(--logo-tongue)" />
    </svg>
  );
}

/** Firma: símbolo + «εglosa» (ε en boli sobre fosforito). Se lee y se anuncia como «eglosa». */
export function Wordmark({ size = 22, as: Tag = 'span' }: { size?: number; as?: 'span' | 'h1' }) {
  return (
    <Tag class="wordmark" style={{ fontSize: `${size}px` }} aria-label="eglosa">
      <LogoMark size={Math.round(size * 1.2)} />
      <span aria-hidden="true"><span class="eps">ε</span>glosa</span>
    </Tag>
  );
}
