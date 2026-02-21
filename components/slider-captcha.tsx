"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { IconRefresh, IconCheck } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface SliderCaptchaProps {
  onVerify: (verified: boolean) => void
  disabled?: boolean
}

type PointerSample = {
  x: number
  y: number
  t: number
}

export function SliderCaptcha({ onVerify, disabled }: SliderCaptchaProps) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const samplesRef = React.useRef<PointerSample[]>([])
  const pointerIdRef = React.useRef<number | null>(null)
  const metricsRef = React.useRef<{ left: number; maxX: number } | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const pendingPointRef = React.useRef<{ x: number; y: number } | null>(null)
  const positionRef = React.useRef(0)
  const pointerTypeRef = React.useRef<string>("mouse")

  const [isDragging, setIsDragging] = React.useState(false)
  const [status, setStatus] = React.useState<"idle" | "dragging" | "success" | "failed">("idle")
  const [message, setMessage] = React.useState("Drag the slider to verify")
  const [position, setPosition] = React.useState(0)

  const thumbSize = 36
  const threshold = 0.96
  const verified = status === "success"

  const reset = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIsDragging(false)
    setStatus("idle")
    setMessage("Drag the slider to verify")
    setPosition(0)
    positionRef.current = 0
    samplesRef.current = []
    pointerIdRef.current = null
    metricsRef.current = null
    pendingPointRef.current = null
    onVerify(false)
  }, [onVerify])

  const updatePosition = React.useCallback(
    (clientX: number, clientY: number) => {
      const metrics = metricsRef.current
      if (!metrics || verified) return 0

      const next = Math.min(Math.max(0, clientX - metrics.left - thumbSize / 2), metrics.maxX)
      setPosition(next)
      positionRef.current = next
      samplesRef.current.push({ x: clientX, y: clientY, t: performance.now() })
      return next / metrics.maxX
    },
    [thumbSize, verified]
  )

  const isHumanLikeTrajectory = React.useCallback(() => {
    const samples = samplesRef.current
    if (samples.length < 4) return false

    const first = samples[0]
    const last = samples[samples.length - 1]
    const duration = last.t - first.t
    if (duration < 180 || duration > 15000) return false

    const dx = last.x - first.x
    if (dx < 80) return false

    let pathDistance = 0
    let maxSegmentDistance = 0
    const speeds: number[] = []

    for (let i = 1; i < samples.length; i += 1) {
      const prev = samples[i - 1]
      const curr = samples[i]
      const segDx = curr.x - prev.x
      const segDy = curr.y - prev.y
      const segDist = Math.hypot(segDx, segDy)
      const segDt = Math.max(1, curr.t - prev.t)

      pathDistance += segDist
      maxSegmentDistance = Math.max(maxSegmentDistance, segDist)
      speeds.push(segDist / segDt)
    }

    const straightness = pathDistance / Math.max(1, dx)
    if (straightness < 1 || straightness > 6) return false
    if (maxSegmentDistance > 240) return false

    const meanSpeed = speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length)
    const variance =
      speeds.reduce((acc, v) => acc + (v - meanSpeed) ** 2, 0) / Math.max(1, speeds.length)
    const speedStd = Math.sqrt(variance)
    const speedJitter = speedStd / Math.max(0.0001, meanSpeed)
    if (pointerTypeRef.current !== "touch" && speedJitter < 0.01 && duration < 700) return false

    return true
  }, [])

  const startDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || verified) return

      reset()
      setIsDragging(true)
      setStatus("dragging")
      setMessage("Keep sliding to the end")
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Some mobile browsers don't fully support pointer capture on buttons.
      }
      pointerIdRef.current = event.pointerId
      pointerTypeRef.current = event.pointerType || "mouse"
      if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect()
        metricsRef.current = { left: rect.left, maxX: Math.max(1, rect.width - thumbSize) }
      }
      updatePosition(event.clientX, event.clientY)
    },
    [disabled, reset, thumbSize, updatePosition, verified]
  )

  const queueDragMove = React.useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      if (!isDragging || disabled || verified) return
      if (pointerIdRef.current !== null && pointerId !== pointerIdRef.current) return
      pendingPointRef.current = { x: clientX, y: clientY }
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const point = pendingPointRef.current
        if (!point) return
        updatePosition(point.x, point.y)
      })
    },
    [disabled, isDragging, updatePosition, verified]
  )

  const stopDrag = React.useCallback(
    (pointerId?: number) => {
      if (!isDragging) return
      if (pointerIdRef.current !== null && pointerId !== undefined && pointerId !== pointerIdRef.current) return

      setIsDragging(false)
      pointerIdRef.current = null

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const metrics = metricsRef.current
      const reachedEnd = metrics ? positionRef.current / metrics.maxX >= threshold : false
      const humanLike = isHumanLikeTrajectory()

      if (reachedEnd && humanLike) {
        setStatus("success")
        setMessage("Verified")
        onVerify(true)
        return
      }

      setStatus("failed")
      setMessage("Verification failed, try a natural drag")
      setPosition(0)
      positionRef.current = 0
      onVerify(false)
      samplesRef.current = []
      metricsRef.current = null
      pendingPointRef.current = null
    },
    [isDragging, isHumanLikeTrajectory, onVerify, threshold]
  )

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      queueDragMove(event.pointerId, event.clientX, event.clientY)
    },
    [queueDragMove]
  )

  const onPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      stopDrag(event.pointerId)
    },
    [stopDrag]
  )

  React.useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (event: PointerEvent) => {
      queueDragMove(event.pointerId, event.clientX, event.clientY)
    }
    const handlePointerEnd = (event: PointerEvent) => {
      stopDrag(event.pointerId)
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerEnd)
    window.addEventListener("pointercancel", handlePointerEnd)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerEnd)
      window.removeEventListener("pointercancel", handlePointerEnd)
    }
  }, [isDragging, queueDragMove, stopDrag])

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Verification</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={reset}
          disabled={disabled}
          title="Reset slider"
        >
          <IconRefresh className="size-4" />
        </Button>
      </div>

      <div
        ref={trackRef}
        className={cn(
          "relative h-11 rounded-md border bg-background select-none overflow-hidden transition-colors",
          status === "success" && "border-emerald-500/60",
          status === "failed" && "border-destructive/60"
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 ease-out",
            status === "success" ? "bg-emerald-500/15" : "bg-primary/10",
            isDragging ? "transition-none" : "transition-[width] duration-150"
          )}
          style={{ width: `${Math.max(thumbSize, position + thumbSize)}px` }}
        />

        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {message}
        </div>

        <button
          type="button"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 h-8 w-8 rounded-md border bg-background shadow-sm touch-none",
            "flex items-center justify-center text-muted-foreground transition-colors",
            status === "dragging" && "border-primary text-primary",
            status === "success" && "border-emerald-500 text-emerald-600",
            status === "failed" && "border-destructive text-destructive"
          )}
          style={{ left: `${position}px` }}
          onPointerDown={startDrag}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          disabled={disabled || verified}
          aria-label="Slide to verify"
        >
          {verified ? (
            <IconCheck className="size-4" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 1 }}
            >
              <path d="M5 12h14m-7-7l7 7l-7 7" />
            </svg>
          )}
        </button>
      </div>

      {status === "failed" ? (
        <p className="text-xs text-destructive">Verification failed. Please drag again.</p>
      ) : null}
    </div>
  )
}
