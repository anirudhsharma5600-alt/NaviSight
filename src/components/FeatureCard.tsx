import React from 'react'

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  tag?: 'Live' | 'Beta' | 'Coming Soon'
}

const tagStyles: Record<string, string> = {
  Live: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-cyan-500/10',
  Beta: 'bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-blue-500/10',
  'Coming Soon': 'bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-purple-500/10',
}

const tagDots: Record<string, string> = {
  Live: 'bg-cyan-400',
  Beta: 'bg-blue-400',
  'Coming Soon': 'bg-purple-400',
}

export default function FeatureCard({ icon, title, description, tag }: FeatureCardProps) {
  return (
    <div className="group relative rounded-2xl p-[1px] transition-all duration-500 hover:scale-[1.02]">
      {/* Animated border gradient on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/0 via-blue-500/0 to-purple-500/0 group-hover:from-cyan-500/50 group-hover:via-blue-500/30 group-hover:to-purple-500/50 transition-all duration-500 opacity-0 group-hover:opacity-100" />

      {/* Outer glow on hover */}
      <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-cyan-500/0 to-blue-500/0 group-hover:from-cyan-500/20 group-hover:to-blue-500/20 blur-xl transition-all duration-500 opacity-0 group-hover:opacity-100" />

      {/* Card body */}
      <div className="relative rounded-2xl bg-[#0c1222]/80 backdrop-blur-xl border border-white/[0.06] group-hover:border-cyan-500/30 p-7 h-full transition-all duration-500 overflow-hidden">
        {/* Inner ambient glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/0 group-hover:bg-cyan-500/5 rounded-full blur-3xl transition-all duration-700" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/0 group-hover:bg-purple-500/5 rounded-full blur-3xl transition-all duration-700" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Icon + Tag row */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/10 group-hover:border-cyan-500/25 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] text-cyan-400 transition-all duration-500">
              {icon}
            </div>

            {tag && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-sm ${tagStyles[tag]}`}
              >
                {tag === 'Live' && (
                  <span className={`w-1.5 h-1.5 rounded-full ${tagDots[tag]} animate-pulse`} />
                )}
                {tag !== 'Live' && (
                  <span className={`w-1.5 h-1.5 rounded-full ${tagDots[tag]}`} />
                )}
                {tag}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-white mb-2.5 group-hover:text-cyan-50 transition-colors duration-300">
            {title}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-400 leading-relaxed flex-grow group-hover:text-gray-300 transition-colors duration-300">
            {description}
          </p>

          {/* Bottom decorative line */}
          <div className="mt-6 h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-cyan-500/50 via-blue-500/50 to-purple-500/50 rounded-full transition-all duration-700" />
        </div>
      </div>
    </div>
  )
}
