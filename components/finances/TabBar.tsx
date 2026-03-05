'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/* ── SVG icon components ─────────────────────────────────────── */
function IconDashboard({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function IconMonthly({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
      <line x1="8"  y1="14" x2="8.01" y2="14" strokeWidth="2.5" />
      <line x1="12" y1="14" x2="12.01" y2="14" strokeWidth="2.5" />
      <line x1="16" y1="14" x2="16.01" y2="14" strokeWidth="2.5" />
    </svg>
  )
}

function IconAnnual({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
      <polyline points="9 16 11 18 15 14" />
    </svg>
  )
}

function IconDebts({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <line x1="2"  y1="11" x2="22" y2="11" />
      <line x1="6"  y1="15" x2="9"  y2="15" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function IconInsights({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

const TABS = [
  { href: '/finances',          label: 'Dashboard', Icon: IconDashboard },
  { href: '/finances/monthly',  label: 'Monthly',   Icon: IconMonthly   },
  { href: '/finances/annual',   label: 'Annual',    Icon: IconAnnual    },
  { href: '/finances/debts',    label: 'Debts',     Icon: IconDebts     },
  { href: '/finances/insights', label: 'Insights',  Icon: IconInsights  },
]

export default function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t"
      style={{
        backgroundColor: 'var(--tab-bg)',
        borderColor: 'var(--tab-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const isActive = href === '/finances'
          ? pathname === '/finances'
          : pathname.startsWith(href)

        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-colors"
            style={{
              minHeight: 56,
              color: isActive ? 'var(--color-teal)' : 'var(--text-3)',
            }}
          >
            {/* Active bar indicator */}
            <span
              className="absolute top-0 rounded-full transition-all duration-200"
              style={{
                width: isActive ? 24 : 0,
                height: 2,
                backgroundColor: isActive ? 'var(--color-teal)' : 'transparent',
              }}
            />
            <Icon active={isActive} />
            <span
              className="text-[10px] font-semibold leading-none tracking-wide transition-colors"
              style={{ color: isActive ? 'var(--color-teal)' : 'var(--text-3)' }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
