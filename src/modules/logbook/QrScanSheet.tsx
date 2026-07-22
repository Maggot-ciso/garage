import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { X } from 'lucide-react'

// Live QR scanner that runs entirely in the webview — getUserMedia preview +
// jsQR frame decode. No native scanner plugin (ML Kit is CocoaPods-only and this
// project is SPM/Capacitor 8). The camera permission string already lives in
// Info.plist for the receipt scanner. Works the same in the browser preview.
type Status = 'starting' | 'scanning' | 'denied' | 'unavailable'

export function QrScanSheet({
  onScan,
  onCancel,
}: {
  onScan: (decoded: string) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>('starting')

  // The camera effect runs once; a ref keeps it calling the current onScan.
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let done = false

    function stop() {
      done = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (done || !video || !canvas) return
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(image.data, image.width, image.height, {
            inversionAttempts: 'dontInvert',
          })
          if (code && code.data.length > 2) {
            const decoded = code.data
            stop()
            onScanRef.current(decoded)
            return
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (done) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        // iOS WKWebView requires these to autoplay inline without fullscreen.
        video.setAttribute('playsinline', 'true')
        await video.play()
        setStatus('scanning')
        raf = requestAnimationFrame(tick)
      } catch (err) {
        setStatus(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'denied'
            : 'unavailable',
        )
      }
    }

    void start()
    return stop
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 text-white">
        <span className="font-semibold">Scan receipt QR</span>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="p-1">
          <X className="h-6 w-6" strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        {status === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
          </div>
        )}

        {(status === 'starting' || status === 'denied' || status === 'unavailable') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-white">
            {status === 'starting' && <p>Starting camera…</p>}
            {status === 'denied' && (
              <p>
                Camera access was denied. Allow camera for GarageBook in Settings, or enter the
                entry by hand.
              </p>
            )}
            {status === 'unavailable' && (
              <p>No camera available here. Try on the phone, or enter the entry by hand.</p>
            )}
            {status !== 'starting' && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl bg-white px-6 py-2.5 font-semibold text-slate-900 active:bg-slate-200"
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>

      {status === 'scanning' && (
        <p className="px-6 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 text-center text-sm text-white/80">
          Point at the QR code on your eKasa receipt.
        </p>
      )}
    </div>
  )
}
