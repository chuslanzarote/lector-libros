// SYS-2 — Backup completo en JSON (sin el diccionario base) y fusión registro a registro por updatedAt.
import type { ElliDB } from '../db.ts';
import { BOOK_TABLES, USER_TABLES, today } from '../db.ts';
import type { TargetLang } from './langs.ts';

export const BACKUP_FORMAT = 1;
type TableName = (typeof USER_TABLES)[number] | (typeof BOOK_TABLES)[number];

export interface Backup {
  app: 'elliniko';
  format: number;
  exportedAt: string;
  includesBooks: boolean;
  /** idioma de estudio (IDI-3); los backups antiguos no lo llevan y son de griego */
  lang?: TargetLang;
  tables: Partial<Record<TableName, Record<string, unknown>[]>>;
}

export async function exportBackup(database: ElliDB, opts: { includeBooks: boolean; lang?: TargetLang }): Promise<Backup> {
  const tables: Backup['tables'] = {};
  const names: TableName[] = [...USER_TABLES, ...(opts.includeBooks ? BOOK_TABLES : [])];
  for (const name of names) tables[name] = (await database.table(name).toArray()) as Record<string, unknown>[];
  return { app: 'elliniko', format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), includesBooks: opts.includeBooks, lang: opts.lang ?? 'el', tables };
}

export function backupFileName(d = new Date(), lang: TargetLang = 'el'): string {
  return `elliniko-${lang === 'el' ? '' : lang + '-'}backup-${today(d)}.json`;
}

/** El backup es de otro idioma de estudio: no se mezcla (IDI-3) */
export class BackupLangError extends Error {
  lang: TargetLang;
  constructor(lang: TargetLang) {
    super(`Backup de otro idioma (${lang})`);
    this.lang = lang;
  }
}

export interface MergeReport { added: number; updated: number; kept: number; perTable: Record<string, { added: number; updated: number; kept: number }> }

/** Fusiona un backup: para cada registro gana el `updatedAt` más reciente. Nunca borra nada. */
export async function importBackup(database: ElliDB, data: unknown, lang: TargetLang = 'el'): Promise<MergeReport> {
  const b = data as Backup;
  if (!b || b.app !== 'elliniko' || typeof b.tables !== 'object') throw new Error('El archivo no es un backup de Ellinikó');
  if (b.format > BACKUP_FORMAT) throw new Error('Backup de una versión más nueva de la app; actualiza primero');
  if ((b.lang ?? 'el') !== lang) throw new BackupLangError(b.lang ?? 'el');
  const report: MergeReport = { added: 0, updated: 0, kept: 0, perTable: {} };
  const allowed = new Set<string>([...USER_TABLES, ...BOOK_TABLES]);

  for (const [name, rows] of Object.entries(b.tables)) {
    if (!allowed.has(name) || !Array.isArray(rows)) continue;
    const table = database.table(name);
    const pk = table.schema.primKey.keyPath as string;
    const r = { added: 0, updated: 0, kept: 0 };
    await database.transaction('rw', table, async () => {
      const keys = rows.map((x) => (x as Record<string, unknown>)[pk]).filter((k) => k !== undefined) as string[];
      const existing = await table.bulkGet(keys);
      const toPut: unknown[] = [];
      rows.forEach((row, i) => {
        const prev = existing[i] as { updatedAt?: number } | undefined;
        const incoming = row as { updatedAt?: number };
        if (!prev) { toPut.push(row); r.added++; }
        else if ((incoming.updatedAt ?? 0) > (prev.updatedAt ?? 0)) { toPut.push(row); r.updated++; }
        else r.kept++;
      });
      if (toPut.length) await table.bulkPut(toPut);
    });
    report.perTable[name] = r;
    report.added += r.added;
    report.updated += r.updated;
    report.kept += r.kept;
  }
  return report;
}
