'use client'

import { Drawer } from 'vaul'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Drawer.Portal>
        {/* Scrim */}
        <Drawer.Overlay
          className="fixed inset-0 z-40 backdrop-blur-sm"
          style={{ backgroundColor: 'var(--overlay)' }}
        />

        {/* Sheet */}
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
          style={{ backgroundColor: 'var(--sheet-bg)' }}
          aria-describedby={undefined}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <Drawer.Title className="text-base font-semibold" style={{ color: 'var(--text)' }}>
              {title}
            </Drawer.Title>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-medium transition-colors"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--text-2)' }}
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div
            className="overflow-y-auto flex-1 px-5 py-4"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
