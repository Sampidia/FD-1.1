'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Camera, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
}

const navItems: NavItem[] = [
  {
    href: '/',
    icon: Home,
    label: 'Home'
  },
  {
    href: '/scan',
    icon: Camera,
    label: 'Scan'
  },
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard'
  }
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-bottom">
        <div className="grid grid-cols-3 h-16">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center transition-colors duration-200 relative',
                  active
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-900 active:text-blue-600'
                )}
              >
                <div className={cn(
                  'relative flex items-center justify-center w-8 h-8 mb-1 transition-all duration-200',
                  active && 'scale-110'
                )}>
                  <Icon
                    className={cn(
                      'w-6 h-6 transition-all duration-200',
                      active && 'drop-shadow-sm'
                    )}
                  />
                </div>
                {active && (
                  <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-blue-600 rounded-full" />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Minimal Mobile Spacing Fix - prevents content overlapping with nav */}
      <div className="md:hidden pb-safe h-16" />
    </>
  )
}
