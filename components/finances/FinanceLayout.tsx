'use client'

import Link from 'next/link'
import TabBar from './TabBar'

interface FinanceLayoutProps {
  title: string
  children: React.ReactNode
  rightAction?: React.ReactNode
}

export default function FinanceLayout({ title, children, rightAction }: FinanceLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F7FA', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 bg-white border-b border-gray-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-lg font-bold" style={{ color: '#1B2A4A' }}>{title}</h1>
          <div className="flex items-center gap-2">
            {rightAction}
            <Link
              href="/finances/settings"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600"
            >
              ⚙️
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main
        className="flex-1 overflow-auto px-4 py-4 pb-28"
      >
        {children}
      </main>

      <TabBar />
    </div>
  )
}
