import { DatabaseSync } from 'node:sqlite';

/** A durable RoundStore. Node 22.18's SQLite API is experimental. */
export function sqliteRoundStore(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS rounds (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, transcript TEXT NOT NULL)');
  return {
    async read(id) {
      const row = db.prepare('SELECT transcript FROM rounds WHERE id=?').get(id);
      return row ? JSON.parse(row.transcript) : undefined;
    },
    async compareAndSet(transcript, expectedRevision) {
      const json = JSON.stringify(transcript), revision = transcript.events.length;
      const result = expectedRevision === null
        ? db.prepare('INSERT OR IGNORE INTO rounds VALUES(?,?,?)').run(transcript.spec.id, revision, json)
        : db.prepare('UPDATE rounds SET revision=?, transcript=? WHERE id=? AND revision=?')
          .run(revision, json, transcript.spec.id, expectedRevision);
      return result.changes === 1;
    },
    close() { db.close(); },
  };
}
