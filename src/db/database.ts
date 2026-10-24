import * as SQLite from 'expo-sqlite';
import { isCachedBreed } from '../api/dogApi';
import { Breed, BreedGroup } from '../types/breed';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initializeDb().catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function initializeDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('dog_explorer_v2.db');
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.withTransactionAsync(async () => {
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((version?.user_version ?? 0) < 1) {
        // Legacy payloads contain fabricated defaults whose original provenance is lost.
        // Keep the old table for recovery, but do not present those values as facts.
        const existing = await db.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'breeds'"
        );
        if (existing) await db.execAsync('ALTER TABLE breeds RENAME TO breeds_legacy;');
        await db.execAsync(`
          DROP INDEX IF EXISTS idx_breeds_group;
          DROP INDEX IF EXISTS idx_breeds_name;
          CREATE TABLE IF NOT EXISTS breed_groups (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);
          CREATE TABLE breeds (
            id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL,
            group_name TEXT, size_bucket TEXT, coat_length TEXT, hypoallergenic INTEGER,
            payload TEXT NOT NULL, updated_at INTEGER NOT NULL
          );
          CREATE INDEX idx_breeds_group ON breeds(group_name);
          CREATE INDEX idx_breeds_name ON breeds(name);
          CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
          DELETE FROM sync_meta WHERE key IN ('last_synced_at', 'last_sync_partial');
          PRAGMA user_version = 1;
        `);
      }
    });
    return db;
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

function enqueueWrite<T>(task: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const result = writeQueue.then(async () => task(await getDb()));
  // A failed write must not prevent future writes from running.
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function upsertGroups(db: SQLite.SQLiteDatabase, groups: BreedGroup[]): Promise<void> {
  for (const group of groups) {
    await db.runAsync('INSERT OR REPLACE INTO breed_groups (id, name) VALUES (?, ?)', [group.id, group.name]);
  }
}

async function upsertBreeds(db: SQLite.SQLiteDatabase, breeds: Breed[], now: number): Promise<void> {
  for (const breed of breeds) {
    await db.runAsync(`
      INSERT OR REPLACE INTO breeds
      (id, name, group_name, size_bucket, coat_length, hypoallergenic, payload, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      breed.id, breed.name, breed.groupName, breed.sizeBucket, breed.coatLength,
      breed.hypoallergenic === null ? null : breed.hypoallergenic ? 1 : 0,
      JSON.stringify(breed), now,
    ]);
  }
}

export function saveGroupsToDb(groups: BreedGroup[]): Promise<void> {
  return enqueueWrite(async (db) => {
    await db.withTransactionAsync(() => upsertGroups(db, groups));
  });
}

// Detail refresh updates only the record, never catalog freshness metadata.
export function saveBreedsToDb(breeds: Breed[]): Promise<void> {
  return enqueueWrite(async (db) => {
    await db.withTransactionAsync(() => upsertBreeds(db, breeds, Date.now()));
  });
}

export function saveCatalogToDb(
  breeds: Breed[], groups: BreedGroup[], partial: boolean
): Promise<number | null> {
  return enqueueWrite(async (db) => {
    let completedAt: number | null = null;
    await db.withTransactionAsync(async () => {
      await upsertGroups(db, groups);
      await upsertBreeds(db, breeds, Date.now());
      await db.runAsync('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)',
        ['last_sync_partial', partial ? '1' : '0']);
      if (!partial) {
        completedAt = Date.now();
        await db.runAsync('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)',
          ['last_synced_at', String(completedAt)]);
      }
    });
    return completedAt;
  });
}

export async function loadCachedCatalog(): Promise<{
  breeds: Breed[]; groups: BreedGroup[]; lastSyncedAt: number | null; lastSyncPartial: boolean;
}> {
  // Hydration precedes writes in the store; also wait for any previously queued writes.
  await writeQueue;
  const db = await getDb();
  const breedRows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM breeds ORDER BY group_name ASC, name ASC');
  const groups = await db.getAllAsync<BreedGroup>('SELECT id, name FROM breed_groups ORDER BY name ASC');
  const syncRows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM sync_meta');
  const meta = new Map(syncRows.map((row) => [row.key, row.value]));
  const timestamp = Number(meta.get('last_synced_at'));
  const breeds: Breed[] = [];
  for (const row of breedRows) {
    try {
      const parsed: unknown = JSON.parse(row.payload);
      if (isCachedBreed(parsed)) breeds.push(parsed);
    } catch {
      // Ignore invalid cached JSON; the next sync can restore the record.
    }
  }
  return {
    breeds, groups,
    lastSyncedAt: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null,
    lastSyncPartial: meta.get('last_sync_partial') === '1',
  };
}