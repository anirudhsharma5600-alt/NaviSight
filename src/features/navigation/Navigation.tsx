/**
 * NaviAble AI — Pedestrian Voice Navigation Dashboard
 * 
 * Accessible, WCAG-compliant interface designed for visually impaired and sighted users:
 * - Real GPS walking navigation with MapLibre GL JS & OpenStreetMap.
 * - Spoken turn-by-turn directions via central SmartAnnouncementManager.
 * - Dynamic route matching, progress tracking, and off-route detection.
 * - Real-time obstacle awareness from camera object detection.
 * - Laptop route simulator for indoor verification.
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Navigation2, Search, MapPin, Locate, Play, Pause, Square, RotateCcw,
  Volume2, VolumeX, ShieldAlert, AlertTriangle, Eye, Compass,
  ArrowUp, CornerUpLeft, CornerUpRight, ArrowUpLeft, ArrowUpRight,
  Clock, Footprints, Info, Sparkles, CheckCircle2
} from 'lucide-react'
import MapLibreView from '../../components/navigation/MapLibreView'
import { navigationEngine } from '../../services/navigation/navigationEngine'
import { geocodingService } from '../../services/navigation/geocodingService'
import { GPSService } from '../../services/GPSService'
import { SmartAnnouncementManager } from '../../services/SmartAnnouncementManager'
import type {
  PedestrianRoute,
  NavigationMode,
  NavigationProgress,
  GPSAccuracyQuality,
  ObstacleDetectionWarning,
  GeocodingResult,
  GeoCoordinate,
  ManeuverType,
} from '../../services/navigation/types'
import type { GPSPosition } from '../../services/GPSService'

export default function Navigation() {
  const [mode, setMode] = useState<NavigationMode>('IDLE')
  const [route, setRoute] = useState<PedestrianRoute | null>(null)
  const [currentPosition, setCurrentPosition] = useState<GPSPosition | null>(null)
  const [progress, setProgress] = useState<NavigationProgress | null>(null)
  const [gpsQuality, setGpsQuality] = useState<GPSAccuracyQuality>({ accuracyMeters: 999, quality: 'UNUSABLE', isReliableForTurns: false })
  const [activeObstacle, setActiveObstacle] = useState<ObstacleDetectionWarning | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  // Search input state
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([])
  const [destinationCoord, setDestinationCoord] = useState<GeoCoordinate | null>(null)
  const [destinationName, setDestinationName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [speechMuted, setSpeechMuted] = useState(false)
  const [showSimControls, setShowSimControls] = useState(false)
  const [simSpeed, setSimSpeed] = useState(1.0)

  const searchTimeoutRef = useRef<any>(null)

  // Subscribe to NavigationEngine updates
  useEffect(() => {
    const unsubscribe = navigationEngine.subscribe((state) => {
      setMode(state.mode)
      setRoute(state.route)
      setCurrentPosition(state.currentPosition)
      setProgress(state.progress)
      setGpsQuality(state.gpsQuality)
      setActiveObstacle(state.activeObstacle)
      setIsSimulating(state.isSimulating)
      if (state.route) {
        setDestinationCoord(state.route.destination)
        setDestinationName(state.route.destinationName)
      }
    })

    // Request initial position
    GPSService.getCurrentPosition().catch((err) => {
      console.warn('[NavigationUI] Initial GPS request:', err.message)
    })

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      unsubscribe()
    }
  }, [])

  // Debounced Place Search
  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setErrorMessage(null)

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!val.trim() || val.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await geocodingService.searchPlaces(val)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 450)
  }

  // Handle Destination Selection from Search
  const handleSelectDestination = async (item: GeocodingResult) => {
    setSearchQuery(item.name)
    setDestinationName(item.name)
    setSearchResults([])
    setErrorMessage(null)

    const targetCoord: GeoCoordinate = { lat: item.lat, lng: item.lng }
    setDestinationCoord(targetCoord)

    try {
      await navigationEngine.setDestination(targetCoord, item.name)
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not find a walking route to this location.')
    }
  }

  // Handle Map Click Destination Selection
  const handleSelectMapCoordinate = async (coord: GeoCoordinate) => {
    setSearchResults([])
    setErrorMessage(null)
    setDestinationCoord(coord)

    const resolvedName = await geocodingService.reverseGeocode(coord)
    setSearchQuery(resolvedName)
    setDestinationName(resolvedName)

    try {
      await navigationEngine.setDestination(coord, resolvedName)
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not calculate a pedestrian route to this pin.')
    }
  }

  // Navigation Control Actions
  const handleStart = () => {
    setErrorMessage(null)
    navigationEngine.startNavigation()
  }

  const handlePause = () => {
    navigationEngine.pauseNavigation()
  }

  const handleResume = () => {
    navigationEngine.resumeNavigation()
  }

  const handleStop = () => {
    navigationEngine.stopNavigation()
    setRoute(null)
    setDestinationCoord(null)
    setDestinationName('')
    setSearchQuery('')
    setProgress(null)
  }

  const handleRecalculate = () => {
    navigationEngine.recalculateRoute()
  }

  const handleRepeatDirection = () => {
    navigationEngine.repeatInstruction()
  }

  const toggleMute = () => {
    const newMuted = !speechMuted
    setSpeechMuted(newMuted)
    navigationEngine.setConfig({ voiceGuidanceEnabled: !newMuted })
    if (newMuted) {
      SmartAnnouncementManager.silence()
    } else {
      SmartAnnouncementManager.announce('Voice directions enabled.', 'NORMAL')
    }
  }

  // Simulation handlers
  const handleToggleSimulation = () => {
    if (isSimulating) {
      navigationEngine.stopSimulation()
    } else {
      navigationEngine.startSimulation(simSpeed)
    }
  }

  const handleSimSpeedChange = (speed: number) => {
    setSimSpeed(speed)
    if (isSimulating) {
      navigationEngine.startSimulation(speed)
    }
  }

  // Format Helper: Meters & Kilometers
  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`
    }
    return `${Math.round(meters)} m`
  }

  // Format Helper: Minutes & Hours
  const formatDuration = (seconds: number) => {
    const min = Math.round(seconds / 60)
    if (min >= 60) {
      const h = Math.floor(min / 60)
      const m = min % 60
      return `${h}h ${m}m`
    }
    return `${min} min`
  }

  // Maneuver Icon Renderer
  const renderManeuverIcon = (maneuver?: ManeuverType) => {
    switch (maneuver) {
      case 'turn_left':
      case 'turn_sharp_left':
        return <CornerUpLeft className="w-8 h-8 text-primary-400" />
      case 'turn_slight_left':
        return <ArrowUpLeft className="w-8 h-8 text-primary-400" />
      case 'turn_right':
      case 'turn_sharp_right':
        return <CornerUpRight className="w-8 h-8 text-primary-400" />
      case 'turn_slight_right':
        return <ArrowUpRight className="w-8 h-8 text-primary-400" />
      case 'arrive':
        return <CheckCircle2 className="w-8 h-8 text-emerald-400" />
      case 'depart':
      case 'continue':
      default:
        return <ArrowUp className="w-8 h-8 text-primary-400" />
    }
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display mb-2">
          NAVI <span className="gradient-text">Voice Navigation</span>
        </h1>
        <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
          Accessible, pedestrian-first walking guidance with live GPS tracking, turn announcements, and obstacle awareness.
        </p>
      </div>

      {/* Critical Safety Notice (Section 10) */}
      <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs md:text-sm text-amber-200/90 leading-relaxed">
          <strong className="text-amber-300">Important Mobility Safety Notice:</strong> NaviAble provides walking route directions only. It cannot guarantee that pathways or pedestrian crossings are free of obstacles, surface hazards, or oncoming traffic. Always rely on your primary mobility aid (white cane or guide dog) and your senses.
        </div>
      </div>

      {/* Obstacle Awareness Warning Banner (Section 9 & 12) */}
      <AnimatePresence>
        {activeObstacle && mode === 'NAVIGATING' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 rounded-xl bg-rose-500/20 border-2 border-rose-500/60 shadow-lg shadow-rose-950/40 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/30 text-rose-300 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="font-semibold text-rose-200 text-sm md:text-base">
                  Possible Obstacle Ahead: <span className="capitalize">{activeObstacle.objectClass}</span>
                </div>
                <div className="text-xs text-rose-300/80">
                  Detected in camera view ({activeObstacle.position} zone). Pause and check with your cane.
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-600 text-white uppercase tracking-wider">
              Caution
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Map & Simulation Controls */}
        <div className="lg:col-span-2 space-y-4">
          <MapLibreView
            currentPosition={currentPosition}
            route={route}
            destination={destinationCoord}
            isNavigating={mode === 'NAVIGATING'}
            onSelectMapDestination={handleSelectMapCoordinate}
          />

          {/* GPS Quality Bar & Lat/Lng details */}
          <div className="glass-card p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                gpsQuality.quality === 'EXCELLENT' || gpsQuality.quality === 'GOOD' ? 'bg-emerald-500 animate-pulse' :
                gpsQuality.quality === 'MODERATE' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
              <span className="text-gray-300 font-medium">GPS Status:</span>
              <span className={`font-semibold ${
                gpsQuality.quality === 'EXCELLENT' || gpsQuality.quality === 'GOOD' ? 'text-emerald-400' :
                gpsQuality.quality === 'MODERATE' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {gpsQuality.quality} ({currentPosition ? `±${Math.round(currentPosition.accuracy)}m` : 'Acquiring...'})
              </span>
            </div>

            {currentPosition && (
              <div className="text-gray-400 font-mono">
                {currentPosition.lat.toFixed(5)}, {currentPosition.lng.toFixed(5)}
              </div>
            )}

            <button
              onClick={() => setShowSimControls(!showSimControls)}
              className="text-xs text-primary-400 hover:text-primary-300 underline font-medium"
            >
              {showSimControls ? 'Hide Laptop Testing Simulator' : 'Show Laptop Testing Simulator'}
            </button>
          </div>

          {/* Route Simulation Panel (Laptop Testing - Section 16) */}
          <AnimatePresence>
            {showSimControls && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-card p-4 rounded-xl border border-primary-500/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary-400" />
                    <span className="font-semibold text-sm text-gray-200">Laptop Testing: Pedestrian Route Simulator</span>
                  </div>
                  <span className="text-xs text-gray-400">Simulates walking coordinates along route</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleToggleSimulation}
                    disabled={!route}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                      isSimulating
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white'
                    }`}
                  >
                    {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isSimulating ? 'Pause Simulator' : 'Start Walking Simulator'}
                  </button>

                  <button
                    onClick={() => navigationEngine.simulateDeviation()}
                    disabled={!isSimulating}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-navy-800 hover:bg-navy-700 disabled:opacity-30 border border-white/10 text-gray-300"
                  >
                    Simulate Off-Route Deviation
                  </button>

                  <div className="flex items-center gap-1.5 ml-auto text-xs text-gray-400">
                    <span>Speed:</span>
                    {[1, 2, 4].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSimSpeedChange(s)}
                        className={`px-2 py-1 rounded border text-xs font-mono ${
                          simSpeed === s ? 'bg-primary-500 border-primary-400 text-white' : 'bg-navy-900 border-white/10 text-gray-400'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Destination Search & Turn Guidance */}
        <div className="space-y-5">
          {/* Destination Search Box */}
          <div className="glass-card p-5 rounded-2xl border border-white/10 relative">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-400" />
              Destination
            </h2>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search place, college, library..."
                className="w-full bg-navy-900/90 border border-white/15 rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Enter walking destination"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>

            {/* Suggestions Dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-2 rounded-xl bg-navy-900/95 border border-white/15 overflow-hidden shadow-2xl divide-y divide-white/5 z-20">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectDestination(item)}
                    className="w-full text-left p-3 hover:bg-primary-600/20 text-xs transition-colors flex items-start gap-2.5"
                  >
                    <MapPin className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-gray-200">{item.name}</div>
                      <div className="text-gray-400 text-[11px] line-clamp-1">{item.displayName}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {isSearching && (
              <div className="text-xs text-primary-400 flex items-center gap-2 mt-2">
                <span className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                Searching OpenStreetMap...
              </div>
            )}

            {errorMessage && (
              <div className="mt-3 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Active Turn-by-Turn Card */}
          <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-primary-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {mode === 'NAVIGATING' ? 'Live Walking Guidance' : 'Route Overview'}
                </span>
              </div>

              <button
                onClick={toggleMute}
                className={`p-1.5 rounded-lg border text-xs transition-all ${
                  speechMuted ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-navy-800 border-white/10 text-gray-300'
                }`}
                aria-label={speechMuted ? 'Unmute voice navigation' : 'Mute voice navigation'}
                title={speechMuted ? 'Unmute' : 'Mute'}
              >
                {speechMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {progress && progress.currentStep ? (
              <div className="space-y-4">
                {/* Primary Maneuver Card */}
                <div className="p-4 rounded-xl bg-primary-600/15 border border-primary-500/30 flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary-500/20 border border-primary-400/40">
                    {renderManeuverIcon(progress.currentStep.maneuver)}
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-black text-white tracking-tight">
                      {formatDistance(progress.distanceToNextTurnMeters)}
                    </div>
                    <div className="text-sm font-medium text-primary-200 mt-1 leading-snug">
                      {progress.currentStep.instruction}
                    </div>
                  </div>
                </div>

                {/* Remaining Route Stats */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-navy-900/60 border border-white/5">
                    <div className="text-xs text-gray-400 flex items-center justify-center gap-1 mb-1">
                      <Footprints className="w-3.5 h-3.5" /> Remaining
                    </div>
                    <div className="text-lg font-bold text-gray-200">
                      {formatDistance(progress.distanceRemainingMeters)}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-navy-900/60 border border-white/5">
                    <div className="text-xs text-gray-400 flex items-center justify-center gap-1 mb-1">
                      <Clock className="w-3.5 h-3.5" /> Est. Time
                    </div>
                    <div className="text-lg font-bold text-gray-200">
                      {formatDuration(progress.estimatedTimeRemainingSeconds)}
                    </div>
                  </div>
                </div>

                {/* Repeat Instruction Button */}
                <button
                  onClick={handleRepeatDirection}
                  className="w-full py-2.5 px-4 rounded-xl bg-navy-800 hover:bg-navy-700 border border-white/10 text-xs font-semibold text-gray-200 flex items-center justify-center gap-2 transition-all"
                >
                  <Volume2 className="w-4 h-4 text-primary-400" />
                  Repeat Last Direction
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-xs space-y-2">
                <Navigation2 className="w-8 h-8 text-gray-600 mx-auto" />
                <p>Choose a destination on the map or type in search to preview walking directions.</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              {mode === 'ROUTE_LOADED' && (
                <button
                  onClick={handleStart}
                  className="w-full py-3.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg shadow-primary-900/50 transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Start Navigation
                </button>
              )}

              {mode === 'NAVIGATING' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handlePause}
                    className="py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition-all"
                  >
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                  <button
                    onClick={handleStop}
                    className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition-all"
                  >
                    <Square className="w-4 h-4 fill-current" /> Stop
                  </button>
                </div>
              )}

              {mode === 'PAUSED' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleResume}
                    className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" /> Resume
                  </button>
                  <button
                    onClick={handleStop}
                    className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition-all"
                  >
                    <Square className="w-4 h-4 fill-current" /> Stop
                  </button>
                </div>
              )}

              {route && (
                <button
                  onClick={handleRecalculate}
                  className="w-full py-2.5 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 border border-white/10 text-xs font-semibold text-gray-300 flex items-center justify-center gap-2 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
                  Recalculate Route
                </button>
              )}
            </div>
          </div>

          {/* Voice Command Hints */}
          <div className="p-4 rounded-xl bg-navy-900/40 border border-white/5 space-y-2 text-xs text-gray-400">
            <div className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-400" /> NAVI Voice Commands:
            </div>
            <ul className="space-y-1 list-disc list-inside text-gray-400 text-[11px]">
              <li>"Start navigation" / "Stop navigation"</li>
              <li>"Take me to the library" / "Navigate to college"</li>
              <li>"How far is the next turn?"</li>
              <li>"Repeat the last direction"</li>
              <li>"Where am I according to GPS?"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
