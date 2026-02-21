"use client"

import * as React from "react"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import { IconRefresh } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface TurnstileCaptchaProps {
  action: "login" | "register"
  disabled?: boolean
  onTokenChange: (token: string | null) => void
}

export function TurnstileCaptcha({ action, disabled, onTokenChange }: TurnstileCaptchaProps) {
  const turnstileRef = React.useRef<TurnstileInstance | undefined>(undefined)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const reset = React.useCallback(() => {
    turnstileRef.current?.reset()
    setErrorMessage(null)
    onTokenChange(null)
  }, [onTokenChange])

  React.useEffect(() => {
    onTokenChange(null)
  }, [action, onTokenChange])

  if (!siteKey) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Verification</Label>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Verification is unavailable. Missing `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
        </div>
      </div>
    )
  }

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
          title="Reset verification"
        >
          <IconRefresh className="size-4" />
        </Button>
      </div>

      <div className={cn(disabled && "pointer-events-none opacity-60")}>
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onSuccess={(token) => {
            setErrorMessage(null)
            onTokenChange(token)
          }}
          onExpire={() => {
            setErrorMessage("Verification expired. Please verify again.")
            onTokenChange(null)
          }}
          onError={() => {
            setErrorMessage("Verification failed. Please retry.")
            onTokenChange(null)
          }}
          options={{
            action,
            size: "flexible",
            theme: "auto",
            retry: "auto",
            refreshExpired: "auto",
          }}
        />
      </div>

      {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
    </div>
  )
}
