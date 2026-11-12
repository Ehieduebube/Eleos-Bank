import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  Account,
  AppNotification,
  Beneficiary,
  LedgerEntry,
  Profile,
  Transaction,
  UserPreferences,
  VirtualCard,
} from "@/lib/types";

/**
 * A tiny embedded "database" for running without Supabase.
 *
 * Guarantees:
 *  - Writes are serialised through a single in-process queue (one writer at a time).
 *  - Each write runs against a deep copy; the copy only replaces the live state
 *    after it has been durably written to disk, so a thrown error mid-operation
 *    leaves both memory and disk untouched (all-or-nothing, like a DB transaction).
 *  - The file is replaced atomically (write temp file, then rename).
 *
 * It is designed for one Node.js process (next dev / next start). Serverless
 * platforms have ephemeral, per-instance filesystems — use Supabase there.
 */

export interface LocalUser {
  id: string;
  email: string;
  /** scrypt hash; null for the passwordless demo user (demo button only). */
  passwordHash: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface LocalSession {
  id: string;
  tokenHash: string;
  userId: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface LocalSecurity {
  userId: string;
  pinHash: string | null;
  pinUpdatedAt: string | null;
  failedPinAttempts: number;
  pinLockedUntil: string | null;
}

export interface LocalIdempotencyRecord {
  userId: string;
  key: string;
  fingerprint: string;
  transactionId: string;
  createdAt: string;
}

export interface LocalDb {
  version: 1;
  createdAt: string;
  users: LocalUser[];
  sessions: LocalSession[];
  profiles: Profile[];
  accounts: Account[];
  transactions: Transaction[];
  ledgerEntries: LedgerEntry[];
  beneficiaries: Beneficiary[];
  notifications: AppNotification[];
  cards: VirtualCard[];
  preferences: UserPreferences[];
  security: LocalSecurity[];
  idempotency: LocalIdempotencyRecord[];
}

export function emptyDb(): LocalDb {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    users: [],
    sessions: [],
    profiles: [],
    accounts: [],
    transactions: [],
    ledgerEntries: [],
    beneficiaries: [],
    notifications: [],
    cards: [],
    preferences: [],
    security: [],
    idempotency: [],
  };
}

export class LocalStore {
  private db: LocalDb | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    /** null = memory only (tests). */
    readonly filePath: string | null,
    private readonly bootstrap?: (db: LocalDb) => void,
  ) {}

  private async load(): Promise<LocalDb> {
    if (this.db) return this.db;
    if (this.filePath) {
      try {
        const raw = await fs.readFile(this.filePath, "utf8");
        const parsed = JSON.parse(raw) as LocalDb;
        if (parsed.version !== 1 || !Array.isArray(parsed.transactions)) throw new Error("Unsupported store format");
        this.db = parsed;
        return parsed;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          const backup = `${this.filePath}.corrupt-${Date.now()}`;
          await fs.rename(this.filePath, backup).catch(() => undefined);
          console.warn(`[eleos] Local demo store was unreadable and was moved to ${backup}. Starting fresh.`);
        }
      }
    }
    const fresh = emptyDb();
    this.bootstrap?.(fresh);
    await this.persist(fresh);
    this.db = fresh;
    return fresh;
  }

  private async persist(db: LocalDb): Promise<void> {
    if (!this.filePath) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    const json = JSON.stringify(db);
    await fs.writeFile(tmp, json, "utf8");
    try {
      await fs.rename(tmp, this.filePath);
    } catch {
      // Windows can refuse a rename onto a file briefly held by an indexer/AV; fall back to an in-place write.
      await fs.writeFile(this.filePath, json, "utf8");
      await fs.rm(tmp, { force: true });
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Read a consistent snapshot. The result is a copy and may be used freely. */
  read<T>(fn: (db: Readonly<LocalDb>) => T): Promise<T> {
    return this.enqueue(async () => structuredClone(fn(await this.load())));
  }

  /**
   * Run `fn` against a draft copy. If it throws, nothing changes. Otherwise the
   * draft is written to disk and becomes the live state.
   */
  write<T>(fn: (draft: LocalDb) => T): Promise<T> {
    return this.enqueue(async () => {
      const current = await this.load();
      const draft = structuredClone(current);
      const result = fn(draft);
      await this.persist(draft);
      this.db = draft;
      return structuredClone(result);
    });
  }
}

export function defaultStorePath(): string {
  if (process.env.LOCAL_DATA_FILE) return path.resolve(process.env.LOCAL_DATA_FILE);
  // Serverless filesystems are read-only outside the temp dir (and ephemeral).
  if (process.env.VERCEL) return path.join(os.tmpdir(), "eleos-demo-db.json");
  return path.join(process.cwd(), ".data", "eleos-demo-db.json");
}
