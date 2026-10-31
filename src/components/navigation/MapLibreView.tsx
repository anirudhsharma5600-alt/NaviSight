/**
 * NaviAble AI — Accessible MapLibre GL JS Interactive Map
 * 
 * Features:
 * - OpenStreetMap tiles with compliant attribution.
 * - Dynamic route line rendering (GeoJSON source).
 * - High-contrast current location marker with pulsating accuracy aura.
 * - Interactive destination selection by clicking anywhere on the map.
 * - Smooth camera tracking along walking progress.
 */

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Locate, Compass, Layers, AlertCircle } from 'lucide-react'
import type { PedestrianRoute, GeoCoordinate } from '../../services/navigation/types'
import type { GPSPosition } from '../../services/GPSService'

interface MapLibreViewProps {
  currentPosition: GPSPosition | null
  route: PedestrianRoute | null
  destination: GeoCoordinate | null
  isNavigating: boolean
  onSelectMapDestination?: (coord: GeoCoordinate) => void
}

export default function MapLibreView({
  currentPosition,
  route,
  destination,
  isNavigating,
  onSelectMapDestination,
}: MapLibreViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const destMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [followUser, setFollowUser] = useState(true)

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const initialLng = currentPosition ? currentPosition.lng : 77.2090 // Default New Delhi or GPS
    const initialLat = currentPosition ? currentPosition.lat : 28.6139

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [initialLng, initialLat],
      zoom: currentPosition ? 16 : 14,
      attributionControl: { compact: false },
    })

    // Navigation controls
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right')

    map.on('load', () => {
      // Add GeoJSON Route Source & Layers
      map.addSource('route-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [],
          },
        },
      })

      // Route casing (outline)
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#1e3a8a',
          'line-width': 9,
          'line-opacity': 0.8,
        },
      })

      // Route inner line (high-visibility blue)
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 6,
        },
      })

      setMapLoaded(true)
    })

    // Click on map to select destination
    map.on('click', (e) => {
      if (onSelectMapDestination) {
        onSelectMapDestination({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      }
    })

    // User drag breaks camera follow
    map.on('dragstart', () => {
      setFollowUser(false)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update Route Geometry
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const source = map.getSource('route-source') as maplibregl.GeoJSONSource | undefined

    if (source) {
      if (route && route.geometry.length > 0) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route.geometry,
          },
        })

        // Fit map bounds to show entire route
        const bounds = new maplibregl.LngLatBounds()
        route.geometry.forEach((coord) => bounds.extend(coord))
        map.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 1200 })
      } else {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [],
          },
        })
      }
    }
  }, [route, mapLoaded])

  // Update User Marker & Pulsing Accuracy Circle
  useEffect(() => {
    if (!mapRef.current || !currentPosition) return

    const map = mapRef.current
    const { lng, lat, accuracy } = currentPosition

    if (!userMarkerRef.current) {
      // Create user marker element
      const el = document.createElement('div')
      el.className = 'user-gps-marker'
      el.innerHTML = `
        <div style="position: relative; width: 24px; height: 24px;">
          <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: #3b82f6; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);"></div>
          <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(59, 130, 246, 0.35); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        </div>
      `
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat([lng, lat])
    }

    // Follow camera if enabled
    if (followUser && isNavigating) {
      map.easeTo({
        center: [lng, lat],
        zoom: Math.max(16, map.getZoom()),
        duration: 800,
      })
    }
  }, [currentPosition, followUser, isNavigating])

  // Update Destination Marker
  useEffect(() => {
    if (!mapRef.current) return

    const map = mapRef.current

    if (destination) {
      if (!destMarkerRef.current) {
        const el = document.createElement('div')
        el.className = 'dest-marker'
        el.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="width: 32px; height: 32px; border-radius: 50% 50% 50% 0; background: #ef4444; border: 2px solid #ffffff; transform: rotate(-45deg); box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
              <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%;"></div>
            </div>
          </div>
        `
        destMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([destination.lng, destination.lat])
          .addTo(map)
      } else {
        destMarkerRef.current.setLngLat([destination.lng, destination.lat])
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove()
      destMarkerRef.current = null
    }
  }, [destination])

  const handleRecenter = () => {
    if (!mapRef.current || !currentPosition) return
    setFollowUser(true)
    mapRef.current.flyTo({
      center: [currentPosition.lng, currentPosition.lat],
      zoom: 16.5,
      duration: 1000,
    })
  }

  return (
    <div className="relative w-full h-[480px] md:h-[580px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-navy-950">
      <div ref={mapContainer} className="w-full h-full" aria-label="Interactive pedestrian navigation map" />

      {/* Map Controls */}
      <div className="absolute bottom-5 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleRecenter}
          className={`p-3 rounded-xl backdrop-blur-md border text-white shadow-lg transition-all ${
            followUser ? 'bg-primary-600 border-primary-400' : 'bg-navy-900/80 border-white/10 hover:bg-navy-800'
          }`}
          aria-label="Re-center map on current GPS location"
          title="Re-center location"
        >
          <Locate className="w-5 h-5" />
        </button>
      </div>

      {/* Map Click Hint */}
      {!route && (
        <div className="absolute top-4 left-4 z-10 pointer-events-none bg-navy-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300">
          Tip: Tap anywhere on map or search to choose a destination
        </div>
      )}
    </div>
  )
}
