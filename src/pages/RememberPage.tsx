/**
 * NaviAble AI — Remember Dashboard
 * Tagline: "Navi remembers what matters."
 * 
 * Accessible personal memory companion:
 * 1. Saved Routes (GPS recording, landmarks, distance, deviation alerts, safety reminder)
 * 2. Saved Places (Named GPS locations, voice notes, proximity)
 * 3. People & Contacts (Zero face recognition, opt-in signed QR badges, quiet public mode)
 * 4. Visual Memories (Scene signatures, object tags, color fingerprints, match comparison)
 * 5. Gemini Live Multimodal AI Companion integration & settings
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  Compass, MapPin, Users, Eye, Search, Plus, Play, Square,
  QrCode, Volume2, Trash2, ShieldCheck, AlertTriangle, Key,
  Sparkles, CheckCircle2, ChevronRight, Navigation
} from 'lucide-react'
import { MemoryManager } from '../remember/MemoryManager'
import { RouteMemory } from '../remember/RouteMemory'
import { SavedPlaces } from '../remember/SavedPlaces'
import { PeopleMemory } from '../remember/PeopleMemory'
import { VisualMemory } from '../remember/VisualMemory'
import { RouteTrackingService, type RouteStatus } from '../services/RouteTrackingService'
import { IdentityTokenService, type ScannedContactResult } from '../services/IdentityTokenService'
import { VoiceManager } from '../services/VoiceAnnouncementManager'
import { NaviLiveSession } from '../assistant/NaviLiveSession'
import { GPSService, type GPSPosition } from '../services/GPSService'
import type { SavedRoute, SavedPlace, SavedPerson, VisualMemory as IVisualMemory, MemorySearchResult } from '../remember/MemoryRepository'

type ActiveTab = 'routes' | 'places' | 'people' | 'visual'

export default function RememberPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('routes')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Route recording state
  const [routeStatus, setRouteStatus] = useState<RouteStatus>(RouteTrackingService.getStatus())
  const [newRouteName, setNewRouteName] = useState('')
  const [newLandmarkName, setNewLandmarkName] = useState('')
  const [newLandmarkNote, setNewLandmarkNote] = useState('')
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([])

  // Places state
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([])
  const [newPlaceName, setNewPlaceName] = useState('')
  const [newPlaceDesc, setNewPlaceDesc] = useState('')

  // People state
  const [savedPeople, setSavedPeople] = useState<SavedPerson[]>([])
  const [myQrUrl, setMyQrUrl] = useState<string>('')
  const [showMyBadge, setShowMyBadge] = useState(false)
  const [quietMode, setQuietMode] = useState<boolean>(IdentityTokenService.isQuietPublicMode())
  const [isScanningQR, setIsScanningQR] = useState(false)
  const [scannedContact, setScannedContact] = useState<ScannedContactResult | null>(null)

  // Visual Memory state
  const [visualMemories, setVisualMemories] = useState<IVisualMemory[]>([])
  const [newMemoryName, setNewMemoryName] = useState('')

  // Live Companion & API settings
  const [apiKeyInput, setApiKeyInput] = useState<string>(NaviLiveSession.getApiKey())
  const [showKeyModal, setShowKeyModal] = useState(false)

  // Camera preview ref for QR / Visual scan
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const qrStreamRef = useRef<MediaStream | null>(null)

  // Load all initial memories
  useEffect(() => {
    refreshAll()

    const unsubRoute = RouteTrackingService.subscribeStatus((status) => {
      setRouteStatus(status)
    })

    const unsubDeviation = RouteTrackingService.subscribeDeviation((dev) => {
      const msg = `Attention: You are ${Math.round(dev.deviationDistanceMeters)} meters off your recorded route.`
      VoiceManager.announce(msg, 'HIGH', { force: true })
    })

    return () => {
      unsubRoute()
      unsubDeviation()
      stopCameraScan()
    }
  }, [])

  const refreshAll = async () => {
    const [r, pl, pe, v] = await Promise.all([
      RouteMemory.getRoutes(),
      SavedPlaces.getPlaces(),
      PeopleMemory.getContacts(),
      VisualMemory.getMemories(),
    ])
    setSavedRoutes(r)
    setSavedPlaces(pl)
    setSavedPeople(pe)
    setVisualMemories(v)
  }

  // ─── Search Engine ───
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setIsSearching(false)
      setSearchResults([])
      return
    }
    setIsSearching(true)
    const results = await MemoryManager.search(query)
    setSearchResults(results)
  }

  const speakText = (text: string) => {
    VoiceManager.announce(text, 'HIGH', { force: true })
  }

  // ─── Route Handlers ───
  const handleStartRoute = async () => {
    const name = newRouteName.trim() || `Route ${new Date().toLocaleTimeString()}`
    const ok = await RouteTrackingService.startRecording(name)
    if (ok) {
      speakText(`Route recording started for ${name}. Walk safely.`)
      setNewRouteName('')
    } else {
      speakText('Could not start GPS tracking. Please enable location permissions.')
    }
  }

  const handleAddLandmark = async () => {
    if (!newLandmarkName.trim()) return
    try {
      const lm = await RouteTrackingService.addLandmark(newLandmarkName, newLandmarkNote)
      speakText(`Landmark ${lm.name} recorded.`)
      setNewLandmarkName('')
      setNewLandmarkNote('')
    } catch (err: any) {
      speakText(`Error adding landmark: ${err.message}`)
    }
  }

  const handleStopRoute = async () => {
    try {
      const saved = await RouteTrackingService.stopAndSaveRecording()
      speakText(`Route saved as ${saved.route_name}. Total distance: ${saved.distance} meters.`)
      refreshAll()
    } catch (err: any) {
      speakText(`Error saving route: ${err.message}`)
    }
  }

  const handleDescribeRoute = (route: SavedRoute) => {
    const desc = RouteMemory.describeRoute(route)
    speakText(desc)
  }

  const handleDeleteRoute = async (id: string, name: string) => {
    await RouteMemory.deleteRoute(id)
    speakText(`Deleted route ${name}`)
    refreshAll()
  }

  // ─── Place Handlers ───
  const handleSaveCurrentPlace = async () => {
    if (!newPlaceName.trim()) return
    try {
      const p = await SavedPlaces.saveCurrentLocation(newPlaceName, newPlaceDesc)
      speakText(`Place ${p.place_name} saved at your current location.`)
      setNewPlaceName('')
      setNewPlaceDesc('')
      refreshAll()
    } catch (err: any) {
      speakText(`Could not save place: ${err.message}`)
    }
  }

  const handleDeletePlace = async (id: string, name: string) => {
    await SavedPlaces.deletePlace(id)
    speakText(`Deleted place ${name}`)
    refreshAll()
  }

  // ─── People & Privacy Handlers ───
  const handleGenerateMyBadge = async () => {
    const badge = await IdentityTokenService.issueIdentityBadge({
      displayName: 'User',
      relationship: 'Friend',
      expiryHours: 24,
    })
    setMyQrUrl(badge.qrDataUrl)
    setShowMyBadge(true)
    speakText('Generated voluntary cryptographic badge valid for 24 hours.')
  }

  const handleToggleQuietMode = (val: boolean) => {
    setQuietMode(val)
    IdentityTokenService.setQuietPublicMode(val)
    speakText(val ? 'Quiet public mode enabled. Names will not be spoken loudly in public.' : 'Quiet mode disabled.')
  }

  const startCameraScan = async () => {
    setIsScanningQR(true)
    setScannedContact(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      qrStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      speakText('Camera scanner active. Point at a friend\'s NaviAble QR badge.')
      scanLoop()
    } catch (err: any) {
      speakText(`Camera access failed: ${err.message}`)
      setIsScanningQR(false)
    }
  }

  const stopCameraScan = () => {
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach(t => t.stop())
      qrStreamRef.current = null
    }
    setIsScanningQR(false)
  }

  const scanLoop = async () => {
    if (!qrStreamRef.current || !videoRef.current) return
    const res = await IdentityTokenService.scanVideoFrame(videoRef.current)
    if (res) {
      setScannedContact(res)
      const spoken = IdentityTokenService.formatSpokenAnnouncement(res)
      speakText(spoken)
      stopCameraScan()
      return
    }
    if (isScanningQR) {
      requestAnimationFrame(scanLoop)
    }
  }

  const handleSaveScannedPerson = async () => {
    if (!scannedContact) return
    await PeopleMemory.importContactFromToken(
      scannedContact.rawToken,
      scannedContact.payload.nick || scannedContact.payload.name,
      scannedContact.payload.rel
    )
    speakText(`Saved ${scannedContact.payload.name} to verified contacts.`)
    setScannedContact(null)
    refreshAll()
  }

  const handleDeletePerson = async (id: string, name: string) => {
    await PeopleMemory.deleteContact(id)
    speakText(`Deleted contact ${name}`)
    refreshAll()
  }

  // ─── Visual Memory Handlers ───
  const handleSaveVisualScene = async () => {
    if (!newMemoryName.trim()) return
    try {
      const mem = await VisualMemory.saveCurrentScene({
        name: newMemoryName,
        detectedObjects: ['room', 'entrance', 'door'],
        cameraElement: videoRef.current || undefined,
        includeGPS: true,
      })
      speakText(`Visual memory ${mem.memory_name} saved.`)
      setNewMemoryName('')
      refreshAll()
    } catch (err: any) {
      speakText(`Failed to save visual memory: ${err.message}`)
    }
  }

  const handleDeleteVisual = async (id: string, name: string) => {
    await VisualMemory.deleteMemory(id)
    speakText(`Deleted visual memory ${name}`)
    refreshAll()
  }

  // ─── Gemini Live Key Handler ───
  const handleSaveApiKey = () => {
    NaviLiveSession.setApiKey(apiKeyInput)
    setShowKeyModal(false)
    speakText(apiKeyInput ? 'Gemini Live companion key saved.' : 'Live key cleared. Operating in on-device local mode.')
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-white pt-20 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header with High-Contrast Tagline & Accessible Controls */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-950/40 via-cyan-950/20 to-purple-950/30 border border-cyan-500/20 backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Personal Memory
              </span>
              <span className="text-xs text-gray-400">100% On-Device & Private</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-300 to-indigo-300 mt-1">
              REMEMBER
            </h1>
            <p className="text-gray-300 text-sm md:text-base font-medium mt-0.5">
              "Navi remembers what matters."
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowKeyModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 min-h-[48px] rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/30 font-medium text-sm transition-all"
              aria-label="Configure Gemini Live Companion"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>{NaviLiveSession.getApiKey() ? 'Live Vision Active' : 'Enable Gemini Live'}</span>
            </button>

            <button
              onClick={handleGenerateMyBadge}
              className="flex items-center gap-2 px-4 py-2.5 min-h-[48px] rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-200 border border-cyan-500/30 font-medium text-sm transition-all"
              aria-label="Show my voluntary identity badge"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>My Identity Badge</span>
            </button>
          </div>
        </header>

        {/* Global Memory Search */}
        <section aria-label="Search memories" className="relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search saved routes, places, people, or memories..."
              aria-label="Search all personal memories"
              className="w-full pl-12 pr-4 py-3.5 min-h-[48px] bg-slate-900/80 border border-slate-700/80 focus:border-cyan-400 rounded-xl text-white placeholder-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm px-2 py-1"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>

          {/* Search Results Dropdown/Card */}
          {isSearching && (
            <div className="mt-3 p-4 rounded-xl bg-slate-900/95 border border-cyan-500/30 shadow-2xl space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Found {searchResults.length} Memory Match{searchResults.length === 1 ? '' : 'es'}
              </h2>
              {searchResults.length === 0 ? (
                <p className="text-sm text-gray-400">No matching memories found.</p>
              ) : (
                <div className="grid gap-2 max-h-72 overflow-y-auto">
                  {searchResults.map((res) => (
                    <div
                      key={res.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
                      onClick={() => speakText(`${res.title}: ${res.subtitle}`)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-bold">
                            {res.type}
                          </span>
                          <span className="text-sm font-semibold text-white">{res.title}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{res.subtitle}</p>
                      </div>
                      <Volume2 className="w-5 h-5 text-cyan-400 hover:scale-110" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 4 Accessible Tabs Navigation */}
        <nav
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-slate-900/70 border border-slate-800"
          role="tablist"
          aria-label="Remember sections"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'routes'}
            onClick={() => setActiveTab('routes')}
            className={`flex items-center justify-center gap-2 py-3 px-4 min-h-[48px] rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'routes'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Saved Routes ({savedRoutes.length})</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'places'}
            onClick={() => setActiveTab('places')}
            className={`flex items-center justify-center gap-2 py-3 px-4 min-h-[48px] rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'places'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Saved Places ({savedPlaces.length})</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'people'}
            onClick={() => setActiveTab('people')}
            className={`flex items-center justify-center gap-2 py-3 px-4 min-h-[48px] rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'people'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>People & Badges ({savedPeople.length})</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'visual'}
            onClick={() => setActiveTab('visual')}
            className={`flex items-center justify-center gap-2 py-3 px-4 min-h-[48px] rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'visual'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Visual Memories ({visualMemories.length})</span>
          </button>
        </nav>

        {/* ─── TAB 1: SAVED ROUTES ─── */}
        {activeTab === 'routes' && (
          <div className="space-y-6">
            {/* Live Recording Panel */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-cyan-400" />
                    <span>Route Recorder & Live Tracking</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Record walking routes with GPS breadcrumbs, landmark tags, and off-route warnings.
                  </p>
                </div>
                {routeStatus.mode === 'RECORDING' && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span>Recording: {routeStatus.currentRouteName}</span>
                  </div>
                )}
              </div>

              {/* Status metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="text-xs text-gray-400">Distance</span>
                  <p className="text-lg font-bold text-cyan-300">{routeStatus.distanceMeters} m</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Elapsed</span>
                  <p className="text-lg font-bold text-white">{Math.floor(routeStatus.elapsedSeconds / 60)}m {routeStatus.elapsedSeconds % 60}s</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">GPS Accuracy</span>
                  <p className={`text-lg font-bold ${routeStatus.lastAccuracyMeters > 20 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {routeStatus.lastAccuracyMeters ? `±${routeStatus.lastAccuracyMeters}m` : 'Ready'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Landmarks</span>
                  <p className="text-lg font-bold text-purple-300">{routeStatus.landmarksCount}</p>
                </div>
              </div>

              {/* Recording Controls */}
              {routeStatus.mode === 'IDLE' ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newRouteName}
                    onChange={(e) => setNewRouteName(e.target.value)}
                    placeholder="Route Name (e.g. College to Library)"
                    aria-label="Route name input"
                    className="flex-1 px-4 py-3 min-h-[48px] bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={handleStartRoute}
                    className="flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Recording Route</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Add landmark row */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={newLandmarkName}
                      onChange={(e) => setNewLandmarkName(e.target.value)}
                      placeholder="Landmark name (e.g. Main Gate, Speed Breaker)"
                      className="flex-1 px-4 py-2.5 min-h-[48px] bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400"
                    />
                    <input
                      type="text"
                      value={newLandmarkNote}
                      onChange={(e) => setNewLandmarkNote(e.target.value)}
                      placeholder="Voice note / instructions (optional)"
                      className="flex-1 px-4 py-2.5 min-h-[48px] bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={handleAddLandmark}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[48px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tag Landmark</span>
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleStopRoute}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>Stop & Save Route</span>
                    </button>
                    <button
                      onClick={() => RouteTrackingService.cancelRecording()}
                      className="px-4 py-3 min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 font-medium text-sm transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Spatial Safety Disclaimer */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Safety Notice:</strong> GPS precision may degrade indoors or near tall buildings. Saved routes cannot guarantee the absence of temporary road hazards, construction, or dynamic obstacles. Always stay attentive.
                </span>
              </div>
            </div>

            {/* List of Saved Routes */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">Your Saved Routes ({savedRoutes.length})</h3>
              {savedRoutes.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-gray-400 text-sm">
                  No routes saved yet. Tap "Start Recording Route" above or say "Hey Navi, remember this route."
                </div>
              ) : (
                <div className="grid gap-3">
                  {savedRoutes.map((route) => (
                    <div
                      key={route.id}
                      className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-bold text-white">{route.route_name}</h4>
                          <span className="text-xs text-gray-400">
                            {new Date(route.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-cyan-300">
                          {route.start_location} → {route.end_location}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 pt-1">
                          <span><strong>{route.distance}</strong> meters</span>
                          <span>•</span>
                          <span><strong>{Math.round(route.duration / 60)}</strong> min</span>
                          <span>•</span>
                          <span><strong>{route.landmarks?.length || 0}</strong> landmark{route.landmarks?.length === 1 ? '' : 's'}</span>
                          <span>•</span>
                          <span>GPS avg ±{route.gps_accuracy_avg || 8}m</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDescribeRoute(route)}
                          className="flex items-center gap-1.5 px-4 py-2.5 min-h-[48px] rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-sm font-semibold transition-all"
                          aria-label={`Spoken description of ${route.route_name}`}
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>Speak Route</span>
                        </button>
                        <button
                          onClick={() => {
                            const res = RouteTrackingService.startNavigation(route)
                            speakText(res.safetyDisclaimer)
                          }}
                          className="flex items-center gap-1.5 px-4 py-2.5 min-h-[48px] rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-sm font-semibold transition-all"
                          aria-label={`Navigate route ${route.route_name}`}
                        >
                          <Compass className="w-4 h-4" />
                          <span>Follow</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRoute(route.id, route.route_name)}
                          className="p-3 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                          aria-label={`Delete route ${route.route_name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: SAVED PLACES ─── */}
        {activeTab === 'places' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-cyan-400" />
                <span>Save Current Location as a Place</span>
              </h2>
              <p className="text-xs text-gray-400">
                Mark your current GPS coordinates as a memorable destination (e.g. Home, Classroom 102, Clinic).
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newPlaceName}
                  onChange={(e) => setNewPlaceName(e.target.value)}
                  placeholder="Place Name (e.g. Home, Library Desk, Bus Stop 14)"
                  className="flex-1 px-4 py-3 min-h-[48px] bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400"
                />
                <input
                  type="text"
                  value={newPlaceDesc}
                  onChange={(e) => setNewPlaceDesc(e.target.value)}
                  placeholder="Voice note / landmarks (optional)"
                  className="flex-1 px-4 py-3 min-h-[48px] bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={handleSaveCurrentPlace}
                  className="flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Place</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">Your Saved Places ({savedPlaces.length})</h3>
              {savedPlaces.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-gray-400 text-sm">
                  No places saved yet. Mark your first place above or say "Hey Navi, save this place as Home."
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {savedPlaces.map((place) => (
                    <div
                      key={place.id}
                      className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold text-white">{place.place_name}</h4>
                          <span className="text-xs text-gray-400">
                            {new Date(place.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-cyan-300 mt-1">{place.description}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          GPS: {place.location.lat.toFixed(5)}, {place.location.lng.toFixed(5)} (±{Math.round(place.location.accuracy || 5)}m)
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <button
                          onClick={() => speakText(`Place: ${place.place_name}. ${place.description}`)}
                          className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold py-2 px-3 min-h-[48px]"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>Announce</span>
                        </button>
                        <button
                          onClick={() => handleDeletePlace(place.id, place.place_name)}
                          className="p-2 min-h-[48px] min-w-[48px] flex items-center justify-center text-red-400 hover:text-red-300"
                          aria-label={`Delete ${place.place_name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: PEOPLE & CONSENT-BASED CONTACTS ─── */}
        {activeTab === 'people' && (
          <div className="space-y-6">
            {/* Strict Privacy Banner */}
            <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-emerald-200">Zero Biometrics & Strict Consent Policy</h2>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  Navi never stores face embeddings or runs unconsented facial recognition. People are identified exclusively when they voluntarily present or share a temporary, cryptographically signed QR badge.
                </p>
              </div>
            </div>

            {/* Quick Actions & Quiet Mode Toggle */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white">Quiet Public Announcement Mode</h3>
                  <p className="text-xs text-gray-400">
                    When enabled, Navi will not announce full contact names loudly in public spaces.
                  </p>
                </div>
                <button
                  onClick={() => handleToggleQuietMode(!quietMode)}
                  className={`px-5 py-2.5 min-h-[48px] rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                    quietMode
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-slate-800 text-gray-400 hover:text-white'
                  }`}
                  aria-pressed={quietMode}
                >
                  {quietMode ? 'Quiet Mode ON' : 'Quiet Mode OFF'}
                </button>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={startCameraScan}
                  className="flex items-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-sm shadow-lg shadow-cyan-600/20"
                >
                  <Eye className="w-4 h-4" />
                  <span>Scan Contact's Badge (Camera)</span>
                </button>

                <button
                  onClick={handleGenerateMyBadge}
                  className="flex items-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-200 font-semibold text-sm"
                >
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  <span>Show My Identity Badge</span>
                </button>
              </div>

              {/* Active Scanner Viewfinder */}
              {isScanningQR && (
                <div className="mt-4 p-4 rounded-xl bg-black border border-cyan-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      Camera QR Scanner Active
                    </span>
                    <button
                      onClick={stopCameraScan}
                      className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1"
                    >
                      Close Scanner
                    </button>
                  </div>
                  <video
                    ref={videoRef}
                    playsInline
                    autoPlay
                    muted
                    className="w-full max-h-64 object-cover rounded-lg border border-slate-800"
                  />
                  <p className="text-xs text-gray-400 text-center">
                    Hold contact's signed NaviAble QR code steady within the frame.
                  </p>
                </div>
              )}

              {/* Scanned Contact Result Dialog */}
              {scannedContact && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-emerald-400">Verified Badge Scanned</span>
                    <h4 className="text-base font-bold text-white">
                      {scannedContact.payload.rel}: {scannedContact.payload.name}
                    </h4>
                    <p className="text-xs text-gray-400">
                      Token valid until {new Date(scannedContact.payload.exp).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    onClick={handleSaveScannedPerson}
                    className="px-4 py-2 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    Save Contact
                  </button>
                </div>
              )}
            </div>

            {/* Verified Contacts List */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">Verified Contacts ({savedPeople.length})</h3>
              {savedPeople.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-gray-400 text-sm">
                  No verified contacts yet. Tap "Scan Contact's Badge" to import someone's signed digital badge.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {savedPeople.map((person) => (
                    <div
                      key={person.id}
                      className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 font-bold">
                            {person.relationship_label}
                          </span>
                          <h4 className="text-base font-bold text-white">{person.nickname || person.display_name}</h4>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Status: <span className="text-emerald-400 font-medium">Consent Active</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => speakText(`Contact: ${person.relationship_label} ${person.nickname || person.display_name}`)}
                          className="p-3 min-h-[48px] min-w-[48px] flex items-center justify-center text-cyan-400 hover:text-cyan-300"
                          aria-label={`Announce ${person.display_name}`}
                        >
                          <Volume2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeletePerson(person.id, person.display_name)}
                          className="p-3 min-h-[48px] min-w-[48px] flex items-center justify-center text-red-400 hover:text-red-300"
                          aria-label={`Remove ${person.display_name}`}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 4: VISUAL MEMORIES ─── */}
        {activeTab === 'visual' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-cyan-400" />
                <span>Save Visual Memory of Familiar Surroundings</span>
              </h2>
              <p className="text-xs text-gray-400">
                Captures reference object tags and dominant color profiles so Navi can later tell you: "This resembles your saved college entrance."
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newMemoryName}
                  onChange={(e) => setNewMemoryName(e.target.value)}
                  placeholder="Scene Name (e.g. College Entrance, My Desk, Living Room Door)"
                  className="flex-1 px-4 py-3 min-h-[48px] bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={handleSaveVisualScene}
                  className="flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Remember Current View</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">Saved Visual Memories ({visualMemories.length})</h3>
              {visualMemories.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-gray-400 text-sm">
                  No visual memories saved yet. Point camera at a landmark and tap "Remember Current View" or say "Hey Navi, remember what this looks like."
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {visualMemories.map((mem) => (
                    <div
                      key={mem.id}
                      className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/30 transition-all flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold text-white">{mem.memory_name}</h4>
                          <span className="text-xs text-gray-400">
                            {new Date(mem.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">{mem.description}</p>
                        
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {mem.detected_objects.map((tag, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <button
                          onClick={() => speakText(`Visual memory: ${mem.memory_name}. Features: ${mem.detected_objects.join(', ')}.`)}
                          className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold py-2 px-3 min-h-[48px]"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>Announce</span>
                        </button>
                        <button
                          onClick={() => handleDeleteVisual(mem.id, mem.memory_name)}
                          className="p-2 min-h-[48px] min-w-[48px] flex items-center justify-center text-red-400 hover:text-red-300"
                          aria-label={`Delete ${mem.memory_name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ─── MODAL 1: MY IDENTITY BADGE ─── */}
      {showMyBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-sm w-full p-6 rounded-3xl bg-slate-900 border border-cyan-500/30 text-center space-y-4">
            <h3 className="text-lg font-bold text-white">Your Voluntary Identity Badge</h3>
            <p className="text-xs text-gray-300">
              Show this QR code to a companion's NaviAble camera. It is cryptographically signed and expires in 24 hours.
            </p>
            {myQrUrl && (
              <div className="p-3 bg-white rounded-2xl inline-block shadow-xl">
                <img src={myQrUrl} alt="NaviAble Voluntary Identity Badge" className="w-56 h-56 mx-auto" />
              </div>
            )}
            <button
              onClick={() => setShowMyBadge(false)}
              className="w-full py-3 min-h-[48px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm"
            >
              Close Badge
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: GEMINI LIVE CONFIGURATION ─── */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border border-purple-500/30 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white">Gemini Live Companion Setup</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Navi supports real-time multimodal camera understanding with continuous conversational voice.
              To enable live cloud vision, provide your Gemini API key below.
              It is stored locally on this device only.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400">Gemini API Key</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 min-h-[48px] bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-400"
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Leave blank to operate 100% offline using Navi's built-in on-device AI models.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveApiKey}
                className="flex-1 py-3 min-h-[48px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm"
              >
                Save Settings
              </button>
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-3 min-h-[48px] rounded-xl bg-slate-800 text-gray-300 font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
