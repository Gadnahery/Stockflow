import { useEffect, useRef, useState } from 'react'
import { X, Zap, ZapOff, Keyboard, CameraOff } from 'lucide-react'
import { haptic } from '../../lib/util'

interface Props {
  onDetect: (code: string) => void
  onClose: () => void
  /** Keep the camera open after each scan (cart / checkout use). */
  continuous?: boolean
  title?: string
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code']

export default function BarcodeScanner({ onDetect, onClose, continuous = false, title = 'Scan barcode' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const onDetectRef = useRef(onDetect)
  const onCloseRef = useRef(onClose)
  const [error, setError] = useState<string | null>(null)
  const [torch, setTorch] = useState<boolean | null>(null) // null = unsupported
  const [flash, setFlash] = useState(false)
  const [manual, setManual] = useState(false)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => { onDetectRef.current = onDetect; onCloseRef.current = onClose }, [onDetect, onClose])

  useEffect(() => {
    let stopped = false
    let raf = 0
    let zxingControls: { stop: () => void } | null = null

    const handle = (code: string) => {
      const now = Date.now()
      const last = lastRef.current
      if (code === last.code && now - last.at < 1800) return
      lastRef.current = { code, at: now }
      haptic(40)
      setFlash(true)
      setTimeout(() => setFlash(false), 450)
      onDetectRef.current(code)
      if (!continuous) setTimeout(() => onCloseRef.current(), 180)
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera is not available in this browser. Type the code instead.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        await video.play().catch(() => undefined)

        const track = stream.getVideoTracks()[0]
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
        if (caps.torch) setTorch(false)

        if ('BarcodeDetector' in window) {
          let formats = FORMATS
          try {
            const supported = await BarcodeDetector.getSupportedFormats()
            formats = FORMATS.filter((f) => supported.includes(f))
          } catch { /* use defaults */ }
          const detector = new BarcodeDetector({ formats })
          let busy = false
          let lastRun = 0
          const loop = async (t: number) => {
            if (stopped) return
            if (!busy && t - lastRun > 110 && video.readyState >= 2) {
              busy = true
              lastRun = t
              try {
                const found = await detector.detect(video)
                if (found[0]?.rawValue) handle(found[0].rawValue)
              } catch { /* frame not ready */ }
              busy = false
            }
            raf = requestAnimationFrame(loop)
          }
          raf = requestAnimationFrame(loop)
        } else {
          // Fallback (iOS Safari, Firefox): ZXing, loaded on demand
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          const reader = new BrowserMultiFormatReader()
          zxingControls = await reader.decodeFromStream(stream, video, (result) => {
            if (result) handle(result.getText())
          })
        }
      } catch (e) {
        const name = (e as DOMException).name
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was blocked. Allow camera access in your browser settings, or type the code instead.'
            : name === 'NotFoundError'
              ? 'No camera found on this device. Type the code instead.'
              : 'Could not start the camera. Type the code instead.'
        )
      }
    }

    start()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      zxingControls?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [continuous])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torch
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorch(next)
    } catch { /* ignore */ }
  }

  const submitManual = () => {
    const code = manualCode.trim()
    if (!code) return
    onDetectRef.current(code)
    setManualCode('')
    if (!continuous) onCloseRef.current()
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label={title}>
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black/35" />

      {/* top bar */}
      <div className="relative flex items-center justify-between px-4" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
        <button onClick={onClose} aria-label="Close scanner" className="press h-11 w-11 rounded-full bg-white/20 backdrop-blur-xl text-white flex items-center justify-center">
          <X size={22} />
        </button>
        <span className="text-white text-[17px] font-semibold">{title}</span>
        {torch !== null ? (
          <button onClick={toggleTorch} aria-label="Toggle flashlight" className={`press h-11 w-11 rounded-full backdrop-blur-xl flex items-center justify-center ${torch ? 'bg-yellow-300 text-black' : 'bg-white/20 text-white'}`}>
            {torch ? <Zap size={20} /> : <ZapOff size={20} />}
          </button>
        ) : <span className="h-11 w-11" />}
      </div>

      {/* viewfinder */}
      <div className="relative flex-1 flex items-center justify-center px-8">
        {error ? (
          <div className="glass rounded-3xl p-6 text-center max-w-sm">
            <CameraOff size={32} className="mx-auto text-ink-secondary" />
            <p className="mt-3 text-[15px] text-ink">{error}</p>
          </div>
        ) : (
          <div className={`relative w-full max-w-sm aspect-[4/3] rounded-[28px] transition-all duration-300 ${flash ? 'scale-[1.03]' : ''}`}
            style={{ boxShadow: '0 0 0 100vmax rgba(0,0,0,0.38)', outline: flash ? '3px solid #34C759' : '2px solid rgba(255,255,255,0.85)', outlineOffset: '-2px' }}>
            <span className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_14px_rgba(239,68,68,0.9)]" style={{ animation: 'scan-line 2.2s ease-in-out infinite' }} />
          </div>
        )}
      </div>

      {/* bottom */}
      <div className="relative px-5 pb-6 space-y-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}>
        {!error && <p className="text-center text-white/90 text-[15px]">Point the camera at a barcode</p>}
        {manual || error ? (
          <div className="flex gap-2 max-w-sm mx-auto">
            <input
              autoFocus={!!error}
              inputMode="numeric"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitManual() }}
              placeholder="Type barcode number"
              className="field flex-1 !bg-white"
            />
            <button onClick={submitManual} className="press h-[46px] px-5 rounded-[14px] bg-primary text-white font-semibold">Add</button>
          </div>
        ) : (
          <button onClick={() => setManual(true)} className="press mx-auto flex items-center gap-2 h-11 px-5 rounded-full bg-white/20 backdrop-blur-xl text-white text-[15px] font-medium">
            <Keyboard size={18} /> Type code instead
          </button>
        )}
      </div>
    </div>
  )
}
