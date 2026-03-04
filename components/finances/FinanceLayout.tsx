'use client'

import Link from 'next/link'
import TabBar from './TabBar'

interface FinanceLayoutProps {
  title: string
  children: React.ReactNode
  rightAction?: React.ReactNode
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

export default function FinanceLayout({ title, children, rightAction }: FinanceLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          backgroundColor: 'var(--header-bg)',
          borderColor: 'var(--header-border)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            {title}
          </h1>
          <div className="flex items-center gap-2">
            {rightAction}
            <Link
              href="/finances/settings"
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
              style={{
                backgroundColor: 'var(--surface)',
                color: 'var(--text-2)',
              }}
            >
              <IconSettings />
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto px-4 py-4 pb-28">
        {children}
      </main>

      <TabBar />
    </div>
  )
}
