import { auth } from '@/auth'

export interface FinanceAuthResult {
  authorized: boolean
  reason?: '401' | '403'
  role?: string
  userId?: string
  username?: string
}

export async function requireFinanceAuth(requireAdmin = false): Promise<FinanceAuthResult> {
  const session = await auth()

  if (!session?.user) {
    return { authorized: false, reason: '401' }
  }

  const role = (session.user as any).role ?? 'viewer'

  if (requireAdmin && role !== 'admin') {
    return { authorized: false, reason: '403' }
  }

  return {
    authorized: true,
    role,
    userId: (session.user as any).id,
    username: session.user.name ?? undefined,
  }
}

export function unauthorizedResponse(reason: '401' | '403') {
  const status = reason === '401' ? 401 : 403
  const message = reason === '401' ? 'Unauthorized' : 'Forbidden'
  return Response.json({ data: null, error: message }, { status })
}
