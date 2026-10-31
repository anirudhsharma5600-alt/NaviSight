import React from 'react'
import {
  CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldAlert,
  Camera, Sliders, Activity, Info
} from 'lucide-react'
import type { CameraTelemetry } from '../services/cameraManager'

interface CameraDiagnosticsProps {
  telemetry: CameraTelemetry
  onRetry?: () => void
  onSwitchCamera?: (deviceId: string) => void
}

export default function CameraDiagnostics({
  telemetry,
  onRetry,
  onSwitchCamera,
}: CameraDiagnosticsProps) {
  const isSecure = telemetry.isSecureContext
  const isStreaming = telemetry.streamStatus === 'streaming'

  return (
    <div className="glass-card p-5 mb-6 border-cyan-500/20 bg-[#0a0e1a]/95 text-xs">
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-sm text-white">Live Camera Telemetry & Diagnostics</h3>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full font-mono uppercase text-[10px] font-bold ${
            isStreaming
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : telemetry.streamStatus === 'initializing'
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {telemetry.streamStatus}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-4">
        {/* Secure Context Status */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
          <span className="text-gray-500 block mb-1">Context Security</span>
          <div className="flex items-center gap-1.5 font-medium">
            {isSecure ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                <span className="text-green-400 font-mono">HTTPS / Secure</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-red-400 font-mono">Insecure HTTP</span>
              </>
            )}
          </div>
        </div>

        {/* Camera Permission */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
          <span className="text-gray-500 block mb-1">Permission</span>
          <div className="flex items-center gap-1.5 font-medium capitalize">
            {telemetry.permissionState === 'granted' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            ) : telemetry.permissionState === 'denied' ? (
              <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
            )}
            <span
              className={
                telemetry.permissionState === 'granted'
                  ? 'text-green-400'
                  : telemetry.permissionState === 'denied'
                  ? 'text-red-400'
                  : 'text-yellow-400'
              }
            >
              {telemetry.permissionState}
            </span>
          </div>
        </div>

        {/* MediaDevices API */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
          <span className="text-gray-500 block mb-1">getUserMedia API</span>
          <div className="flex items-center gap-1.5 font-medium">
            {telemetry.hasGetUserMedia ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                <span className="text-green-400">Supported</span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-red-400">Unavailable</span>
              </>
            )}
          </div>
        </div>

        {/* Video Tracks */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
          <span className="text-gray-500 block mb-1">Active Tracks</span>
          <span className="font-mono text-white font-semibold">
            {telemetry.activeTrackCount} track ({telemetry.trackReadyState})
          </span>
        </div>

        {/* Video Dimensions */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
          <span className="text-gray-500 block mb-1">Dimensions</span>
          <span className="font-mono text-cyan-400 font-semibold">
            {telemetry.videoWidth > 0
              ? `${telemetry.videoWidth} × ${telemetry.videoHeight}`
              : '0 × 0 (Standby)'}
          </span>
        </div>

        {/* Facing Constraint Used */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
          <span className="text-gray-500 block mb-1">Constraint Mode</span>
          <span className="font-mono text-purple-400 font-medium">
            {telemetry.facingModeUsed}
          </span>
        </div>
      </div>

      {/* Selected Camera Details & Switching */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3 mb-3">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-cyan-400" />
          <span className="text-gray-400">Selected Hardware:</span>
          <strong className="text-white">
            {telemetry.selectedCameraLabel || 'No camera attached'}
          </strong>
        </div>

        {telemetry.availableCameras.length > 1 && onSwitchCamera && (
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={telemetry.selectedCameraId}
              onChange={(e) => onSwitchCamera(e.target.value)}
              className="bg-navy-900 border border-white/20 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-cyan-400"
            >
              {telemetry.availableCameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Insecure Context Warning if running on mobile via raw IP */}
      {!isSecure && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3 text-amber-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block mb-1">Mobile Browser HTTPS Requirement:</strong>
              <p className="leading-relaxed text-[11px] text-amber-200/90">
                Android Chrome and Apple iOS Safari enforce an operating-system level security check:
                they disable camera access (<code className="bg-black/30 px-1 py-0.5 rounded">getUserMedia</code>) when loaded over an unencrypted local IP address (e.g., <code className="bg-black/30 px-1 py-0.5 rounded">http://10.51.4.131:5173</code>).
                To test on a physical mobile device, access the site via HTTPS, run an HTTPS tunnel, or use Chrome’s <code className="bg-black/30 px-1 py-0.5 rounded">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Exact Error Message */}
      {telemetry.errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start justify-between gap-3 text-red-300">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block mb-0.5">
                {telemetry.errorType || 'Camera Stream Failure'}:
              </strong>
              <p className="text-[11px] text-red-300/90 leading-relaxed">{telemetry.errorMessage}</p>
            </div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 rounded-lg text-xs font-semibold text-red-200 transition-colors flex-shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}

