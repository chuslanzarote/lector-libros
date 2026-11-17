// IDI-2 — Declaración tipada de mensajes (archivo aparte para evitar importaciones circulares).
type Table = Record<string, string>;

/** Mensajes de un espacio de nombres: en y el deben tener exactamente las mismas claves que es. */
export function defineMessages<T extends Table>(m: { es: T; en: Record<keyof T, string>; el: Record<keyof T, string> }) {
  return m;
}
