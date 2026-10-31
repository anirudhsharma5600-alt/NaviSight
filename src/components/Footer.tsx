import { Link } from 'react-router-dom'
import { Eye, Heart, Globe, MessageCircle, Users } from 'lucide-react'

const quickLinks = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'Features', path: '/#features' },
  { name: 'Live Demo', path: '/dashboard' },
  { name: 'Voice Assistant', path: '/voice' },
  { name: 'Navigation', path: '/navigation' },
]

const socialLinks = [
  { icon: Globe, href: '#', label: 'Website' },
  { icon: MessageCircle, href: '#', label: 'Chat' },
  { icon: Users, href: '#', label: 'Community' },
]

export default function Footer() {
  return (
    <footer className="relative mt-20 border-t border-cyan-500/10">
      {/* Gradient glow line at the top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

      {/* Glass background */}
      <div className="bg-[#060a14]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
            {/* Brand Section */}
            <div className="md:col-span-5 space-y-5">
              <Link to="/" className="inline-flex items-center gap-2.5 group">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                  NaviAble AI
                </span>
              </Link>
              <p className="text-lg font-medium bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">
                Beyond Vision. Beyond Limits.
              </p>
              <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
                Empowering visually impaired individuals with AI-powered navigation,
                real-time scene understanding, and intelligent voice assistance.
              </p>

              {/* Socials */}
              <div className="flex items-center gap-3 pt-2">
                {socialLinks.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300"
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="md:col-span-3">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">
                Quick Links
              </h3>
              <ul className="space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.path}
                      className="text-sm text-gray-400 hover:text-cyan-400 transition-colors duration-300 inline-flex items-center gap-2 group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-600 group-hover:bg-cyan-400 transition-colors duration-300" />
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact / Info */}
            <div className="md:col-span-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">
                Get in Touch
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed mb-6">
                Have questions or want to contribute? We'd love to hear from you.
                NaviAble AI is built with accessibility at its core.
              </p>
              <a
                href="mailto:hello@naviable.ai"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-cyan-400 border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all duration-300"
              >
                Contact Us
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              © {new Date().getFullYear()} NaviAble AI. Crafted with
              <Heart className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />
              for accessibility.
            </p>
            <p className="text-xs text-gray-600">
              All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
