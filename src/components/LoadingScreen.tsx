import { Eye } from 'lucide-react'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#060a14]">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Main loader */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulsing ring */}
        <div className="absolute w-28 h-28 rounded-full border-2 border-cyan-500/20 animate-ping" />

        {/* Middle spinning ring */}
        <div className="absolute w-24 h-24 rounded-full border-2 border-transparent border-t-cyan-400 border-r-blue-500 animate-spin" />

        {/* Inner glowing circle */}
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 backdrop-blur-sm border border-cyan-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.3)] animate-pulse">
          <Eye className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
        </div>
      </div>

      {/* Text */}
      <div className="mt-10 flex flex-col items-center gap-3">
        <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
          Loading NaviAble AI...
        </h2>

        {/* Animated dots bar */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
              style={{
                animationDelay: `${i * 120}ms`,
                animationDuration: '1s',
              }}
            />
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-1">
          Initializing accessibility systems
        </p>
      </div>
    </div>
  )
}
