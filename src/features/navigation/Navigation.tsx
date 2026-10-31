import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Locate, Loader2, Navigation2, Search, AlertCircle,
  Route, Clock, Ruler, X, Volume2, ChevronDown,
} from 'lucide-react'
import { speak } from '../../services/speechService'
import 'leaflet/dist/leaflet.css'

// Fix leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Destination marker (purple)
const destIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'hue-rotate-[270deg]',
})

interface GeoResult {
  lat: number
  lng: number
  display_name: string
}

interface RouteData {
  distanceKm: number
  durationMin: number
  geometry: [number, number][]
  steps: { instruction: string; distanceM: number }[]
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
  }, [bounds, map])
  return null
}

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
  const [searching, setSearching] = useState(false)
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null)
  const [searchResults, setSearchResults] = useState<GeoResult[]>([])
  const [destination, setDestination] = useState<GeoResult | null>(null)
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [showSteps, setShowSteps] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getLocation = useCallback(() => {
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
  }, [])

  useEffect(() => { getLocation() }, [getLocation])

  // Geocode search using Nominatim (free, no API key)
  const searchPlace = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=0`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await resp.json()
      setSearchResults(
        data.map((r: any) => ({
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          display_name: r.display_name as string,
        }))
      )
    } catch {
      setSearchResults([])
    }
    setSearching(false)
  }, [])

  // Debounced search
  const onSearchInput = (val: string) => {
    setSearchQuery(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchPlace(val), 400)
  }

  // Select destination and compute route via OSRM
  const selectDestination = useCallback(async (result: GeoResult) => {
    setDestination(result)
    setSearchResults([])
    setSearchQuery(result.display_name.split(',')[0])

    if (!location) {
      setError('Your location is needed to compute a route.')
      return
    }

    setRouteLoading(true)
    setRouteData(null)
    try {
      // OSRM free routing API (walking profile)
      const resp = await fetch(
        `https://router.project-osrm.org/route/v1/foot/${location.lng},${location.lat};${result.lng},${result.lat}?overview=full&geometries=geojson&steps=true`
      )
      const data = await resp.json()
      if (data.code !== 'Ok' || !data.routes?.length) {
        setError('Could not compute a walking route. The destination might be unreachable on foot.')
        setRouteLoading(false)
        return
      }
      const route = data.routes[0]
      const geometry: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]] as [number, number]
      )
      const steps = route.legs[0].steps.map((s: any) => ({
        instruction: s.maneuver?.type
          ? `${s.maneuver.modifier ? s.maneuver.modifier + ' ' : ''}${s.maneuver.type}${s.name ? ' onto ' + s.name : ''}`
          : s.name || 'Continue',
        distanceM: Math.round(s.distance),
      })).filter((s: any) => s.distanceM > 0)

      setRouteData({
        distanceKm: Math.round(route.distance / 10) / 100,
        durationMin: Math.round(route.duration / 60),
        geometry,
        steps,
      })

      // Announce route
      const summary = `Route found. ${Math.round(route.distance / 10) / 100} kilometers, approximately ${Math.round(route.duration / 60)} minutes walking.`
      speak(summary)
    } catch {
      setError('Failed to fetch route. Check your internet connection.')
    }
    setRouteLoading(false)
  }, [location])

  const clearRoute = () => {
    setDestination(null)
    setRouteData(null)
    setSearchQuery('')
    setShowSteps(false)
  }

  const defaultCenter: [number, number] = location ? [location.lat, location.lng] : [20.5937, 78.9629]
  const defaultZoom = location ? 16 : 5

  // Bounds for auto-fit when route exists
  const routeBounds = routeData && location && destination
    ? L.latLngBounds(
        [location.lat, location.lng],
        [destination.lat, destination.lng]
      )
    : null

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Smart <span className="gradient-text">Navigation</span>
          </h1>
          <p className="text-gray-400">GPS-powered walking directions with voice guidance</p>
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
                  {!routeBounds && flyTo && <FlyToLocation lat={flyTo.lat} lng={flyTo.lng} />}
                </>
              )}
              {destination && (
                <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
                  <Popup>
                    <strong>Destination</strong><br />
                    {destination.display_name.split(',').slice(0, 2).join(', ')}
                  </Popup>
                </Marker>
              )}
              {routeData && (
                <Polyline
                  positions={routeData.geometry}
                  pathOptions={{ color: '#00e5ff', weight: 5, opacity: 0.85, dashArray: '10 6' }}
                />
              )}
              {routeBounds && <FitBounds bounds={routeBounds} />}
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
                <Navigation2 className="w-5 h-5 text-purple-400" /> Find Destination
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchInput(e.target.value)}
                  placeholder="Search a place..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/40"
                  aria-label="Search destination"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
                )}
              </div>

              {/* Search results dropdown */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-2 bg-[#0f1428] border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto"
                  >
                    {searchResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => selectDestination(r)}
                        className="w-full text-left px-4 py-3 text-xs text-gray-300 hover:bg-cyan-400/10 hover:text-white border-b border-white/5 last:border-b-0 transition-colors"
                      >
                        <MapPin className="inline w-3 h-3 text-cyan-400 mr-1.5" />
                        {r.display_name.length > 80 ? r.display_name.slice(0, 80) + '…' : r.display_name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Route Info */}
            {routeLoading && (
              <div className="glass-card p-5 flex items-center justify-center gap-2 text-cyan-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Computing walking route...
              </div>
            )}

            {routeData && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                    <Route className="w-5 h-5 text-green-400" /> Route
                  </h3>
                  <button onClick={clearRoute} className="text-gray-500 hover:text-red-400 transition-colors" aria-label="Clear route">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                    <Ruler className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-white">{routeData.distanceKm}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">km</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                    <Clock className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-white">{routeData.durationMin}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">minutes</div>
                  </div>
                </div>

                {/* Read aloud */}
                <button
                  onClick={() => speak(`Walking route: ${routeData.distanceKm} kilometers, approximately ${routeData.durationMin} minutes.`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-400/30 hover:bg-green-500/30 transition-all mb-3"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Read Route Aloud
                </button>

                {/* Turn-by-turn steps */}
                {routeData.steps.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowSteps(!showSteps)}
                      className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-white transition-colors mb-2"
                    >
                      <span>{routeData.steps.length} turn-by-turn steps</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showSteps ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {showSteps && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {routeData.steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-gray-300 bg-white/[0.02] rounded-lg px-3 py-2">
                                <span className="text-cyan-400 font-mono w-5 flex-shrink-0">{i + 1}.</span>
                                <span className="capitalize">{step.instruction}</span>
                                <span className="ml-auto text-gray-500 flex-shrink-0">{step.distanceM}m</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </motion.div>
            )}

            {/* Safety Notice */}
            <div className="glass-card p-4 bg-yellow-500/5 border-yellow-500/10">
              <p className="text-yellow-400/80 text-xs leading-relaxed">
                ⚠️ Navigation data is for reference only. GPS directions do not confirm a physically safe walking path. Always use caution and assistance when needed.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
