import { neon, Pool, type NeonQueryFunction } from '@neondatabase/serverless'

// Lazily initialized — safe during Next.js build even without DATABASE_URL set
let _sql: NeonQueryFunction<false, false> | null = null

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL environment variable is not set')
    _sql = neon(url)
  }
  return _sql
}

// sql tagged-template wrapper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sql: NeonQueryFunction<false, false> = new Proxy(function () {} as any, {
  apply(_target, _thisArg, args) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSql() as any)(...args)
  },
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSql() as any)[prop]
  },
})

// Raw parameterized query helper for dynamic SQL strings
export async function rawSql(text: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSql() as any
  return db.query(text, params)
}

export type QueryResult<T> = T[]

// ─── Transaction support via Pool (WebSocket connection) ─────────────────────

let _pool: Pool | null = null
function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL environment variable is not set')
    _pool = new Pool({ connectionString: url })
  }
  return _pool
}

/**
 * Run a callback inside a single PostgreSQL transaction.
 * Automatically COMMITs on success and ROLLBACKs on any thrown error.
 *
 * @example
 * const result = await withTransaction(async client => {
 *   await client.query('INSERT INTO foo VALUES ($1)', [1])
 *   await client.query('UPDATE bar SET x = x + 1 WHERE id = $1', [2])
 *   return 'done'
 * })
 */
export async function withTransaction<T>(
  fn: (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }) => Promise<T>
): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client as Parameters<typeof fn>[0])
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(client as any).release()
  }
}
