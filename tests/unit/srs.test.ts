import { describe, it, expect } from 'vitest';
import { newCardRow, reviewCard, previewIntervals, reviveCard, humanInterval } from '../../src/lib/srs.ts';

describe('VOC-2 FSRS', () => {
  const now = new Date('2026-11-15T10:00:00Z');

  it('una tarjeta nueva vence ya y guarda la frase de contexto', async () => {
    const c = await newCardRow('γράφω', { id: '0.1', text: 'Έγραψα ένα γράμμα.' }, now);
    expect(c.dueAt).toBe(now.getTime());
    expect(c.sentence).toBe('Έγραψα ένα γράμμα.');
    expect(typeof c.fsrs.dueAt).toBe('string'); // serializado
  });

  it('«Bien» aplaza más que «Otra vez», y «Fácil» más que «Bien»', async () => {
    const c = await newCardRow('γράφω', undefined, now);
    const again = await reviewCard(c, 1, now);
    const good = await reviewCard(c, 3, now);
    const easy = await reviewCard(c, 4, now);
    expect(again.dueAt).toBeLessThan(good.dueAt);
    expect(good.dueAt).toBeLessThan(easy.dueAt);
  });

  it('sobrevive a JSON (backup) y sigue programando', async () => {
    let c = await newCardRow('γράφω', undefined, now);
    c = await reviewCard(c, 3, now);
    const back = JSON.parse(JSON.stringify(c));
    const next = await reviewCard(back, 3, new Date(c.dueAt));
    expect(next.dueAt).toBeGreaterThan(c.dueAt);
    expect(reviveCard(back.fsrs).dueAt).toBeInstanceOf(Date);
  });

  it('muestra intervalos legibles', async () => {
    const c = await newCardRow('γράφω', undefined, now);
    const p = await previewIntervals(c, now);
    expect(Object.keys(p)).toEqual(['1', '2', '3', '4']);
    expect(humanInterval(3 * 86400000)).toBe('3 d');
  });
});
