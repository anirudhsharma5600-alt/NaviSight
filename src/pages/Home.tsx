import { motion } from 'framer-motion'
import { Eye, Mic, ScanText, MapPin, AlertTriangle, Volume2, ArrowRight, Zap, Shield, Cpu, Compass } from 'lucide-react'
import Hero from '../components/Hero'
import FeatureCard from '../components/FeatureCard'
import { Link } from 'react-router-dom'

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' as const },
  }),
}

const features = [
  { icon: <Compass className="w-8 h-8 text-cyan-400" />, title: 'Remember', description: '"Navi remembers what matters." Save routes, important places, trusted contacts, and familiar surroundings.', tag: 'Live' as const, link: '/remember' },
  { icon: <Eye className="w-8 h-8" />, title: 'AI Vision', description: 'Real-time object detection powered by COCO-SSD. Identifies objects and their positions in your surroundings.', tag: 'Live' as const, link: '/dashboard' },
  { icon: <Mic className="w-8 h-8" />, title: 'Voice Assistant', description: 'Talk to Navi, your intelligent AI companion. Use voice commands to interact hands-free.', tag: 'Live' as const, link: '/voice' },
  { icon: <ScanText className="w-8 h-8" />, title: 'Smart OCR', description: 'Read signs, labels, and documents instantly using your camera. Text is read aloud for you.', tag: 'Live' as const, link: '/ocr' },
  { icon: <MapPin className="w-8 h-8" />, title: 'Navigation', description: 'GPS-powered location awareness with interactive maps and voice guidance.', tag: 'Live' as const, link: '/navigation' },
  { icon: <AlertTriangle className="w-8 h-8" />, title: 'Road Intelligence', description: 'Detect potholes, barriers, and road hazards for safer walking paths.', tag: 'Coming Soon' as const, link: '#' },
  { icon: <Volume2 className="w-8 h-8" />, title: 'Sound Intelligence', description: 'Recognize environmental sounds like horns, doorbells, and alarms.', tag: 'Coming Soon' as const, link: '#' },
]

const steps = [
  { num: '01', title: 'Open Your Camera', description: 'Grant camera access and point your device at your surroundings.', icon: <Eye className="w-6 h-6" /> },
  { num: '02', title: 'AI Analyzes Everything', description: 'Our AI detects objects, reads text, and understands the scene in real-time.', icon: <Cpu className="w-6 h-6" /> },
  { num: '03', title: 'Hear the Results', description: 'NaviAble speaks descriptions aloud so you can navigate confidently.', icon: <Volume2 className="w-6 h-6" /> },
]

export default function Home() {
  return (
    <main>
      <Hero />

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/[0.02] to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 mb-4">
              Powerful Features
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Intelligence at Your <span className="gradient-text">Fingertips</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Every feature is designed with accessibility first — real AI, real assistance, zero compromise.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                {f.link !== '#' ? (
                  <Link to={f.link}>
                    <FeatureCard icon={f.icon} title={f.title} description={f.description} tag={f.tag} />
                  </Link>
                ) : (
                  <FeatureCard icon={f.icon} title={f.title} description={f.description} tag={f.tag} />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-neon-purple/10 text-neon-purple border border-neon-purple/20 mb-4">
              Simple & Powerful
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              How It <span className="gradient-text">Works</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="glass-card p-8 text-center relative group"
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-neon-blue flex items-center justify-center text-sm font-bold">
                  {step.num}
                </div>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/10 to-neon-purple/10 flex items-center justify-center mx-auto mb-5 mt-2 text-cyan-400 group-hover:scale-110 transition-transform">
                  {step.icon}
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card p-8 md:p-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '80+', label: 'Object Classes' },
              { value: '<200ms', label: 'Detection Speed' },
              { value: '100%', label: 'Client-Side AI' },
              { value: 'Free', label: 'No API Keys' },
            ].map((s) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
              >
                <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">{s.value}</div>
                <div className="text-gray-400 text-sm">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Ready to <span className="gradient-text">Experience</span> NaviAble?
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            Start using AI-powered vision assistance right now. No downloads, no API keys, completely free.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2 justify-center">
              <Eye className="w-5 h-5" /> Launch AI Vision
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/voice" className="btn-secondary inline-flex items-center gap-2 justify-center">
              <Mic className="w-5 h-5" /> Talk to Navi
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  )
}
