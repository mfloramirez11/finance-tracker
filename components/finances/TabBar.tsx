'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/finances', label: 'Dashboard', icon: '⊞' },
  { href: '/finances/monthly', label: 'Monthly', icon: '📋' },
  { href: '/finances/annual', label: 'Annual', icon: '📅' },
  { href: '/finances/debts', label: 'Debts', icon: '💳' },
  { href: '/finances/trends', label: 'Trends', icon: '📈' },
]

export default function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => {
        const isActive = tab.href === '/finances'
          ? pathname === '/finances'
          : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              isActive ? 'text-teal-600' : 'text-gray-400'
            }`}
            style={{ minHeight: 56 }}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-teal-600' : 'text-gray-400'}`}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
