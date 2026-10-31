import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles, Eye } from 'lucide-react'
import AIOrb from './AIOrb'

/* ── Animation variants ── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: 'easeOut' as const },
  },
}

const Hero = () => {
  return (
    <section className="particle-bg relative flex min-h-screen items-center overflow-hidden">
      {/* Background ambient gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-cyan-400/[0.04] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-neon-purple/[0.05] blur-[100px]" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-blue/[0.03] blur-[80px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
          {/* ─── Left: Content ─── */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center lg:text-left"
          >
            {/* Badge */}
            <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-4 py-1.5 text-sm font-medium text-cyan-400 backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                AI-Powered Accessibility
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              variants={fadeUp}
              className="font-display text-5xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl"
            >
              <span className="gradient-text">Beyond Vision.</span>
              <br />
              <span className="gradient-text">Beyond Limits.</span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-400 lg:mx-0"
            >
              Meet your intelligent companion that helps you understand the world around you.
            </motion.p>

            {/* Buttons */}
            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
            >
              {/* Explore NaviAble */}
              <a
                href="#features"
                className="btn-primary group inline-flex items-center gap-2"
              >
                <Eye className="h-5 w-5" />
                Explore NaviAble
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>

              {/* Try Live AI */}
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-purple to-neon-blue px-8 py-3 font-semibold text-white shadow-lg shadow-neon-purple/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-neon-purple/40"
              >
                <Sparkles className="h-5 w-5" />
                Try Live AI
              </Link>

              {/* Discover Features */}
              <a
                href="#features"
                className="btn-secondary inline-flex items-center gap-2"
              >
                Discover Features
              </a>
            </motion.div>

            {/* Stats row */}
            <motion.div
              variants={fadeUp}
              className="mt-12 flex items-center justify-center gap-8 lg:justify-start"
            >
              {[
                { value: '6+', label: 'AI Features' },
                { value: '99%', label: 'Accuracy' },
                { value: '< 1s', label: 'Response Time' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="font-display text-2xl font-bold text-cyan-400">{stat.value}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* ─── Right: 3D Orb ─── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative flex items-center justify-center"
          >
            {/* Glow behind the orb */}
            <div className="absolute h-[350px] w-[350px] rounded-full bg-cyan-400/[0.06] blur-[80px] sm:h-[420px] sm:w-[420px]" />
            <div className="absolute h-[250px] w-[250px] rounded-full bg-neon-purple/[0.08] blur-[60px] sm:h-[300px] sm:w-[300px]" />

            {/* Orb container */}
            <div className="h-[350px] w-[350px] sm:h-[450px] sm:w-[450px] lg:h-[500px] lg:w-[500px]">
              <AIOrb />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <a href="#features" className="flex flex-col items-center gap-2 text-gray-500 transition-colors hover:text-cyan-400">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="h-6 w-4 rounded-full border border-gray-600"
          >
            <div className="mx-auto mt-1 h-1.5 w-1 rounded-full bg-cyan-400" />
          </motion.div>
        </a>
      </motion.div>
    </section>
  )
}

export default Hero
