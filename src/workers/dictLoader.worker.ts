// Descarga e instala el diccionario fuera del hilo principal (parsear 33 MB de JSON bloquearía la UI).
import { ElliDB } from '../db.ts';
import { installDict, readDictResponse } from '../lib/dictStore.ts';

self.onmessage = async (e: MessageEvent<{ url: string; dbName: string }>) => {
  try {
    const res = await fetch(e.data.url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    postMessage({ type: 'progress', phase: 'parse', p: 0 });
    const dict = await readDictResponse(res);
    // El worker no ve localStorage: la base de datos del idioma activo llega en el mensaje
    const db = new ElliDB(e.data.dbName);
    const meta = await installDict(db, dict, (p) => postMessage({ type: 'progress', phase: 'install', p }));
    db.close();
    postMessage({ type: 'done', version: meta.version });
  } catch (err) {
    postMessage({ type: 'error', message: String((err as Error)?.message ?? err) });
  }
};
