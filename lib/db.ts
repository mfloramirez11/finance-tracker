import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

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
  return db(text, params)
}

export type QueryResult<T> = T[]
