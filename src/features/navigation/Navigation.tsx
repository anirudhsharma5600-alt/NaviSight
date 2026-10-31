import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { motion } from 'framer-motion'
import { MapPin, Locate, Loader2, Navigation2, Search, AlertCircle } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

// Fix leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function FlyToLocation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 16, { duration: 1.5 })
  }, [lat, lng, map])
  return null
}

export default function Navigation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null)

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocation(loc)
        setFlyTo(loc)
        setLoading(false)
      },
      (err) => {
        setError(
          err.code === 1 ? 'Location permission denied.' :
          err.code === 2 ? 'Location unavailable.' :
          'Location request timed out.'
        )
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => { getLocation() }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    // Placeholder — real routing would integrate OSRM or similar
    alert(`Route planning to "${searchQuery}" is coming soon! This feature will use OpenStreetMap routing.`)
  }

  const defaultCenter: [number, number] = location ? [location.lat, location.lng] : [20.5937, 78.9629]
  const defaultZoom = location ? 16 : 5

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Smart <span className="gradient-text">Navigation</span>
          </h1>
          <p className="text-gray-400">GPS-powered location awareness with interactive maps</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-2 glass-card overflow-hidden" style={{ minHeight: 500 }}>
            <MapContainer
              center={defaultCenter}
              zoom={defaultZoom}
              className="w-full"
              style={{ height: 500, borderRadius: 16 }}
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              />
              {location && (
                <>
                  <Marker position={[location.lat, location.lng]}>
                    <Popup>
                      <strong>Your Location</strong><br />
                      {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </Popup>
                  </Marker>
                  {flyTo && <FlyToLocation lat={flyTo.lat} lng={flyTo.lng} />}
                </>
              )}
            </MapContainer>
          </motion.div>

          {/* Sidebar */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="space-y-4">
            {/* Location Info */}
            <div className="glass-card p-5">
              <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-cyan-400" /> Your Location
              </h3>
              {loading ? (
                <div className="flex items-center gap-2 text-cyan-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Getting location...
                </div>
              ) : location ? (
                <div className="space-y-2 text-sm">
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <span className="text-gray-500">Latitude:</span>{' '}
                    <span className="text-cyan-400 font-mono">{location.lat.toFixed(6)}</span>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <span className="text-gray-500">Longitude:</span>{' '}
                    <span className="text-cyan-400 font-mono">{location.lng.toFixed(6)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Location not available</p>
              )}

              {error && (
                <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
                </div>
              )}

              <button onClick={getLocation} disabled={loading} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30 disabled:opacity-40 transition-all">
                <Locate className="w-4 h-4" /> Center on Me
              </button>
            </div>

            {/* Destination Search */}
            <div className="glass-card p-5">
              <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
                <Navigation2 className="w-5 h-5 text-neon-purple" /> Find Destination
              </h3>
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search destination..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/40"
                  />
                </div>
                <button type="submit" className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 transition-all">
                  <Navigation2 className="w-4 h-4" /> Get Directions
                </button>
              </form>
              <p className="text-gray-600 text-xs mt-3 text-center">
                🚧 Full route planning coming soon
              </p>
            </div>

            {/* Safety Notice */}
            <div className="glass-card p-4 bg-yellow-500/5 border-yellow-500/10">
              <p className="text-yellow-400/80 text-xs leading-relaxed">
                ⚠️ Navigation data is for reference only. GPS directions do not confirm a physically safe walking path. Always use caution.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

