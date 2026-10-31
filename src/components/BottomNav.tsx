import { Link, useLocation } from 'react-router-dom'
import {
  Home, LayoutDashboard, Compass, Banknote, Mic,
} from 'lucide-react'

const items = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: LayoutDashboard, label: 'Vision', path: '/dashboard' },
  { icon: Compass, label: 'Remember', path: '/remember' },
  { icon: Banknote, label: 'Currency', path: '/currency' },
  { icon: Mic, label: 'Voice', path: '/voice' },
]

export default function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0a0e1a]/95 backdrop-blur-xl border-t border-cyan-500/10 safe-bottom"
      role="navigation"
      aria-label="Main mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {items.map(({ icon: Icon, label, path }) => {
          const active = path === '/' ? pathname === '/' : pathname.startsWith(path)
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] rounded-xl transition-all duration-200 ${
                active
                  ? 'text-cyan-400'
                  : 'text-gray-500 active:text-gray-300'
              }`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`} strokeWidth={active ? 2.4 : 1.8} />
              <span className={`text-[10px] font-medium leading-none ${active ? 'text-cyan-400' : 'text-gray-500'}`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

