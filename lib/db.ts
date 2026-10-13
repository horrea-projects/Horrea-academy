import postgres from "postgres";

/**
 * Use `Sql<any>` (not `ReturnType<typeof postgres>` → `Sql<{}>`).
 * With `Sql<{}>`, `TTypes[keyof TTypes]` is `never` and nested
 * `sql(row, …keys)` helpers fail to typecheck inside tagged templates
 * (TS2345 / TS1320).
 */
type Sql = postgres.Sql<any>;

declare global {
  // eslint-disable-next-line no-var
  var __horreaSql: Sql | undefined;
}

function createSql(): Sql {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  }) as Sql;
}

function getSql(): Sql {
  if (!globalThis.__horreaSql) {
    globalThis.__horreaSql = createSql();
  }
  return globalThis.__horreaSql;
}

/**
 * Shared Postgres client (postgres.js), lazy-initialized so `next build`
 * can import server modules without DATABASE_URL at compile time.
 * Server-side only — never import from client components.
 *
 * Proxy must be callable (tagged templates + `sql(row, ...keys)` helpers).
 * Property gets use the real client as Reflect receiver so getters/methods
 * do not see the Proxy; functions are bound to the client.
 */
const sql: Sql = new Proxy(function horreaSql() {} as unknown as Sql, {
  apply(_target, _thisArg, args) {
    const client = getSql();
    return Reflect.apply(
      client as unknown as (...a: unknown[]) => unknown,
      client,
      args
    );
  },
  get(_target, prop) {
    // Avoid thenable mis-detection if something awaits the export itself.
    if (prop === "then") return undefined;
    const client = getSql();
    const value = Reflect.get(client as object, prop, client);
    return typeof value === "function"
      ? (value as (...a: unknown[]) => unknown).bind(client)
      : value;
  },
  has(_target, prop) {
    return Reflect.has(getSql() as object, prop);
  },
});

export default sql;

/** Supabase-compatible error shape used across the app. */
export type DbError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export type DbResult<T> = { data: T; error: null } | { data: null; error: DbError };

export function asDbError(err: unknown): DbError {
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      code?: string;
      detail?: string;
      details?: string;
      hint?: string;
    };
    return {
      message: e.message ?? String(err),
      code: e.code,
      details: e.details ?? e.detail,
      hint: e.hint,
    };
  }
  return { message: String(err) };
}

/** Run a query and return `{ data, error }` like supabase-js. */
export async function dbResult<T>(fn: () => Promise<T>): Promise<DbResult<T>> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: asDbError(err) };
  }
}

/**
 * Expect exactly one row (supabase `.single()`).
 * Returns error if 0 or >1 rows.
 */
export async function dbSingle<T extends Record<string, unknown>>(
  fn: () => Promise<T[]>
): Promise<DbResult<T>> {
  try {
    const rows = await fn();
    if (rows.length === 0) {
      return {
        data: null,
        error: {
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
          details: "The result contains 0 rows",
        },
      };
    }
    if (rows.length > 1) {
      return {
        data: null,
        error: {
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
          details: `The result contains ${rows.length} rows`,
        },
      };
    }
    return { data: rows[0], error: null };
  } catch (err) {
    return { data: null, error: asDbError(err) };
  }
}

/**
 * Expect 0 or 1 row (supabase `.maybeSingle()`).
 * Returns null data if empty; error if >1 rows.
 */
export async function dbMaybeSingle<T extends Record<string, unknown>>(
  fn: () => Promise<T[]>
): Promise<DbResult<T | null>> {
  try {
    const rows = await fn();
    if (rows.length === 0) {
      return { data: null, error: null };
    }
    if (rows.length > 1) {
      return {
        data: null,
        error: {
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
          details: `The result contains ${rows.length} rows`,
        },
      };
    }
    return { data: rows[0], error: null };
  } catch (err) {
    return { data: null, error: asDbError(err) };
  }
}

/** True when Postgres reports an undefined column (schema fallbacks). */
export function isUndefinedColumnError(error: DbError | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (error.message?.includes("column") && error.message?.includes("does not exist")) ||
    error.message?.toLowerCase().includes("schema cache") === true
  );
}
