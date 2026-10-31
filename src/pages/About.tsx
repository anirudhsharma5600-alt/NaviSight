import { motion } from 'framer-motion'
import { Eye, Cpu, Shield, Zap, Heart, Globe, Mic, ScanText, MapPin, Brain } from 'lucide-react'

const techStack = [
  { icon: <Brain className="w-6 h-6" />, name: 'TensorFlow.js', desc: 'Client-side AI inference' },
  { icon: <Eye className="w-6 h-6" />, name: 'COCO-SSD', desc: '80-class object detection' },
  { icon: <ScanText className="w-6 h-6" />, name: 'Tesseract.js', desc: 'In-browser OCR engine' },
  { icon: <Mic className="w-6 h-6" />, name: 'Web Speech API', desc: 'Voice recognition & synthesis' },
  { icon: <MapPin className="w-6 h-6" />, name: 'OpenStreetMap', desc: 'Free map & navigation data' },
  { icon: <Globe className="w-6 h-6" />, name: 'React + Vite', desc: 'Modern web framework' },
]

const values = [
  { icon: <Shield className="w-8 h-8" />, title: 'Privacy First', desc: 'All AI processing happens in your browser. No camera or microphone data is uploaded or stored.' },
  { icon: <Zap className="w-8 h-8" />, title: 'Real-Time', desc: 'Object detection runs at 5+ FPS with sub-200ms latency. No server round-trips needed.' },
  { icon: <Heart className="w-8 h-8" />, title: 'Accessible', desc: 'Built with screen readers, keyboard navigation, high contrast, and voice-first interaction in mind.' },
  { icon: <Cpu className="w-8 h-8" />, title: 'Free & Open', desc: 'No API keys, no subscriptions, no paywalls. NaviAble runs entirely on free, open-source technology.' },
]

export default function About() {
  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-20">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 mb-6">
            Our Mission
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-bold mb-6">
            Making the World <span className="gradient-text">Visible</span> for Everyone
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
            NaviAble AI is an open-source accessibility platform that uses artificial intelligence to help visually impaired individuals understand, navigate, and interact with the world around them — all from their browser.
          </p>
        </motion.div>

        {/* Values */}
        <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-20">
          <h2 className="font-display text-3xl font-bold text-center mb-10">
            What We <span className="gradient-text">Stand For</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 flex gap-5"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-400/10 to-neon-purple/10 flex items-center justify-center text-cyan-400 flex-shrink-0">
                  {v.icon}
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold mb-2">{v.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{v.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Tech Stack */}
        <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-20">
          <h2 className="font-display text-3xl font-bold text-center mb-10">
            Powered By <span className="gradient-text">Modern AI</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {techStack.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-5 text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400/10 to-neon-purple/10 flex items-center justify-center text-cyan-400 mx-auto mb-3 group-hover:scale-110 transition-transform">
                  {t.icon}
                </div>
                <h4 className="font-semibold text-sm mb-1">{t.name}</h4>
                <p className="text-gray-500 text-xs">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Team */}
        <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center">
          <div className="glass-card p-10">
            <h2 className="font-display text-3xl font-bold mb-4">
              Built with <span className="text-red-400">❤</span> by Passionate Developers
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              NaviAble AI is a hackathon project built to demonstrate that powerful accessibility tools can be free, private, and run entirely in the browser. We believe technology should serve everyone.
            </p>
          </div>
        </motion.section>
      </div>
    </div>
  )
}

