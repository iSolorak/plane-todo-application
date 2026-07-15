import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface ReminderRow {
  work_item_id: string;
  project_id: string;
  name: string;
  target_date: string | null;
  url: string;
  dedup_hash: string;
  updated_at: string;
}

/** Trimmed reminder shape exposed by the /debug/reminders route. */
export interface ReminderSummary {
  work_item_id: string;
  name: string;
  target_date: string | null;
  project_id: string;
  updated_at: string;
}

const MIGRATION = `
  CREATE TABLE IF NOT EXISTS reminders (
    work_item_id TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL,
    name         TEXT NOT NULL,
    target_date  TEXT,
    url          TEXT NOT NULL,
    dedup_hash   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sent_log (
    work_item_id TEXT NOT NULL,
    offset_key   TEXT NOT NULL,
    sent_at      TEXT NOT NULL,
    PRIMARY KEY (work_item_id, offset_key)
  );

  CREATE TABLE IF NOT EXISTS devices (
    token    TEXT PRIMARY KEY,
    added_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_reminders_target_date
    ON reminders (target_date);
`;

/**
 * Open the SQLite database and run migrations. Migrations use
 * `CREATE TABLE IF NOT EXISTS`, so running them on every boot is idempotent.
 */
export function openDb(path: string): Database.Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: Database.Database): void {
  db.exec(MIGRATION);
}

/**
 * Thin repository over the schema. All methods are synchronous (better-sqlite3).
 */
export class Store {
  private readonly db: Database.Database;

  private readonly stmts: {
    upsertReminder: Database.Statement;
    deleteReminder: Database.Statement;
    deleteSentForItem: Database.Statement;
    allWithTargetDate: Database.Statement;
    dueOn: Database.Statement;
    isSent: Database.Statement;
    markSent: Database.Statement;
    upsertDevice: Database.Statement;
    removeDevice: Database.Statement;
    listDevices: Database.Statement;
    listReminders: Database.Statement;
  };

  constructor(db: Database.Database) {
    this.db = db;
    this.stmts = {
      upsertReminder: db.prepare(`
        INSERT INTO reminders
          (work_item_id, project_id, name, target_date, url, dedup_hash, updated_at)
        VALUES
          (@work_item_id, @project_id, @name, @target_date, @url, @dedup_hash, @updated_at)
        ON CONFLICT(work_item_id) DO UPDATE SET
          project_id  = excluded.project_id,
          name        = excluded.name,
          target_date = excluded.target_date,
          url         = excluded.url,
          dedup_hash  = excluded.dedup_hash,
          updated_at  = excluded.updated_at
      `),
      deleteReminder: db.prepare(`DELETE FROM reminders WHERE work_item_id = ?`),
      deleteSentForItem: db.prepare(`DELETE FROM sent_log WHERE work_item_id = ?`),
      allWithTargetDate: db.prepare(
        `SELECT * FROM reminders WHERE target_date IS NOT NULL`,
      ),
      dueOn: db.prepare(
        `SELECT * FROM reminders WHERE substr(target_date, 1, 10) = ?`,
      ),
      isSent: db.prepare(
        `SELECT 1 FROM sent_log WHERE work_item_id = ? AND offset_key = ?`,
      ),
      markSent: db.prepare(
        `INSERT OR IGNORE INTO sent_log (work_item_id, offset_key, sent_at) VALUES (?, ?, ?)`,
      ),
      upsertDevice: db.prepare(
        `INSERT INTO devices (token, added_at) VALUES (?, ?) ON CONFLICT(token) DO NOTHING`,
      ),
      removeDevice: db.prepare(`DELETE FROM devices WHERE token = ?`),
      listDevices: db.prepare(`SELECT token FROM devices`),
      listReminders: db.prepare(
        `SELECT work_item_id, name, target_date, project_id, updated_at
           FROM reminders
          ORDER BY updated_at DESC`,
      ),
    };
  }

  upsertReminder(row: ReminderRow): void {
    this.stmts.upsertReminder.run(row);
  }

  /** Delete a reminder and any sent_log rows tied to it (single transaction). */
  deleteReminder(workItemId: string): void {
    const tx = this.db.transaction((id: string) => {
      this.stmts.deleteSentForItem.run(id);
      this.stmts.deleteReminder.run(id);
    });
    tx(workItemId);
  }

  /**
   * Clear only the sent_log entries for a work item, leaving the reminder row
   * in place. Used by the debug endpoint to re-arm the same-day / offset
   * guards for a specific item without recreating it. Returns the number of
   * rows deleted so callers can distinguish "no such id" from "cleared".
   */
  clearSentForItem(workItemId: string): number {
    const info = this.stmts.deleteSentForItem.run(workItemId);
    return typeof info.changes === "number" ? info.changes : 0;
  }

  allWithTargetDate(): ReminderRow[] {
    return this.stmts.allWithTargetDate.all() as ReminderRow[];
  }

  /** All mirrored reminders (trimmed columns) for debug/observability. */
  listReminders(): ReminderSummary[] {
    return this.stmts.listReminders.all() as ReminderSummary[];
  }

  /** Reminders whose target_date falls on the given YYYY-MM-DD. */
  dueOn(ymd: string): ReminderRow[] {
    return this.stmts.dueOn.all(ymd) as ReminderRow[];
  }

  isSent(workItemId: string, offsetKey: string): boolean {
    return this.stmts.isSent.get(workItemId, offsetKey) !== undefined;
  }

  markSent(workItemId: string, offsetKey: string, sentAt: string): void {
    this.stmts.markSent.run(workItemId, offsetKey, sentAt);
  }

  upsertDevice(token: string, addedAt: string = new Date().toISOString()): void {
    this.stmts.upsertDevice.run(token, addedAt);
  }

  removeDevice(token: string): void {
    this.stmts.removeDevice.run(token);
  }

  listDeviceTokens(): string[] {
    return (this.stmts.listDevices.all() as Array<{ token: string }>).map(
      (r) => r.token,
    );
  }
}
