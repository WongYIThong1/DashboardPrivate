"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { IconRefresh, IconCheck } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface SliderCaptchaProps {
  onVerify: (result: SliderCaptchaResult) => void
  disabled?: boolean
}

export interface SliderCaptchaResult {
  verified: boolean
  qualityScore: number
  attempts: number
  pointerType: "mouse" | "touch" | "pen" | "unknown"
  dragDurationMs: number
  reachedEnd: boolean
}

type PointerSample = {
  x: number
  y: number
  t: number
}

type TrajectoryAnalysis = {
  humanLike: boolean
  qualityScore: number
  dragDurationMs: number
}

export function SliderCaptcha({ onVerify, disabled }: SliderCaptchaProps) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const samplesRef = React.useRef<PointerSample[]>([])
  const pointerIdRef = React.useRef<number | null>(null)
  const metricsRef = React.useRef<{ left: number; maxX: number } | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const pendingPointRef = React.useRef<{ x: number; y: number } | null>(null)
  const positionRef = React.useRef(0)
  const pointerTypeRef = React.useRef<"mouse" | "touch" | "pen" | "unknown">("mouse")

  const [isDragging, setIsDragging] = React.useState(false)
  const [status, setStatus] = React.useState<"idle" | "dragging" | "success" | "failed">("idle")
  const [message, setMessage] = React.useState("Drag the slider to verify")
  const [position, setPosition] = React.useState(0)
  const [attempts, setAttempts] = React.useState(0)

  const thumbSize = 36
  const threshold = 0.9
  const verified = status === "success"

  const clearDragState = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIsDragging(false)
    setPosition(0)
    positionRef.current = 0
    samplesRef.current = []
    pointerIdRef.current = null
    metricsRef.current = null
    pendingPointRef.current = null
  }, [])

  const reset = React.useCallback(() => {
    clearDragState()
    setIsDragging(false)
    setStatus("idle")
    setMessage("Drag the slider to verify")
    setAttempts(0)
    onVerify({
      verified: false,
      qualityScore: 0,
      attempts: 0,
      pointerType: pointerTypeRef.current,
      dragDurationMs: 0,
      reachedEnd: false,
    })
  }, [clearDragState, onVerify])

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

  const analyzeTrajectory = React.useCallback((): TrajectoryAnalysis => {
    const samples = samplesRef.current
    if (samples.length < 4) {
      return { humanLike: false, qualityScore: 15, dragDurationMs: 0 }
    }

    const first = samples[0]
    const last = samples[samples.length - 1]
    const duration = last.t - first.t
    const dragDurationMs = Math.max(0, Math.round(duration))

    const dx = last.x - first.x

    let pathDistance = 0
    let maxSegmentDistance = 0
    let yTravel = 0
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
      yTravel += Math.abs(segDy)
      speeds.push(segDist / segDt)
    }

    const straightness = pathDistance / Math.max(1, Math.abs(dx))

    const meanSpeed = speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length)
    const variance =
      speeds.reduce((acc, v) => acc + (v - meanSpeed) ** 2, 0) / Math.max(1, speeds.length)
    const speedStd = Math.sqrt(variance)
    const speedJitter = speedStd / Math.max(0.0001, meanSpeed)

    let qualityScore = 100

    if (duration < 120) qualityScore -= 35
    if (duration > 18_000) qualityScore -= 20
    if (dx < 60) qualityScore -= 30
    if (straightness < 1 || straightness > 8) qualityScore -= 25
    if (maxSegmentDistance > 280) qualityScore -= 20
    if (pointerTypeRef.current !== "touch" && speedJitter < 0.006 && duration < 800) qualityScore -= 18
    if (yTravel < 1.5) qualityScore -= 8

    qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)))
    const humanLike = qualityScore >= 45 && duration >= 90 && dx >= 60

    return { humanLike, qualityScore, dragDurationMs }
  }, [])

  const startDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || verified) return

      clearDragState()
      setIsDragging(true)
      setStatus("dragging")
      setMessage("Keep sliding to the end")
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Some mobile browsers don't fully support pointer capture on buttons.
      }
      pointerIdRef.current = event.pointerId
      pointerTypeRef.current =
        event.pointerType === "mouse" || event.pointerType === "touch" || event.pointerType === "pen"
          ? event.pointerType
          : "unknown"
      if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect()
        metricsRef.current = { left: rect.left, maxX: Math.max(1, rect.width - thumbSize) }
      }
      updatePosition(event.clientX, event.clientY)
    },
    [clearDragState, disabled, thumbSize, updatePosition, verified]
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
      const analysis = analyzeTrajectory()
      const nextAttempts = attempts + 1
      setAttempts(nextAttempts)

      if (reachedEnd && analysis.humanLike) {
        setStatus("success")
        setMessage("Verified")
        onVerify({
          verified: true,
          qualityScore: analysis.qualityScore,
          attempts: nextAttempts,
          pointerType: pointerTypeRef.current,
          dragDurationMs: analysis.dragDurationMs,
          reachedEnd: true,
        })
        return
      }

      if (nextAttempts <= 1) {
        setStatus("idle")
        setMessage("Almost there, try once more")
      } else {
        setStatus("failed")
        setMessage("Verification failed, try a natural drag")
      }

      clearDragState()
      onVerify({
        verified: false,
        qualityScore: analysis.qualityScore,
        attempts: nextAttempts,
        pointerType: pointerTypeRef.current,
        dragDurationMs: analysis.dragDurationMs,
        reachedEnd,
      })
    },
    [analyzeTrajectory, attempts, clearDragState, isDragging, onVerify, threshold]
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
      ) : attempts > 0 && !verified ? (
        <p className="text-xs text-muted-foreground">Attempt {attempts + 1} of 2</p>
      ) : null}
    </div>
  )
}
