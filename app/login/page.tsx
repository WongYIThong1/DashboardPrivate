"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { IconMail, IconLock, IconLoader2, IconAlertCircle } from "@tabler/icons-react"
import { toast } from "sonner"
import {
  createAntiBotChallenge,
  collectAntiBotSignals,
  cleanupAntiBotChallenge,
  trackInputTiming,
  type AntiBotChallenge,
} from "@/lib/anti-bot"
import { evaluateAuthRisk, type AuthCaptchaState } from "@/lib/auth-risk"
import { SliderCaptcha, type SliderCaptchaResult } from "@/components/slider-captcha"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const formRef = React.useRef<HTMLFormElement>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true)
  const [rememberMe, setRememberMe] = React.useState(false)
  const [errors, setErrors] = React.useState<{ email?: string; password?: string }>({})
  const toastThrottleRef = React.useRef<Record<string, number>>({})
  const submitLockRef = React.useRef(false)
  const hasShownRegistrationToast = React.useRef(false)
  
  // Anti-bot challenge
  const [antiBotChallenge, setAntiBotChallenge] = React.useState<AntiBotChallenge | null>(null)
  const [challengeRequired, setChallengeRequired] = React.useState(false)
  const [sliderResult, setSliderResult] = React.useState<SliderCaptchaResult | null>(null)
  const [cooldownUntil, setCooldownUntil] = React.useState<number | null>(null)

  // Initialize anti-bot challenge
  React.useEffect(() => {
    const challenge = createAntiBotChallenge()
    setAntiBotChallenge(challenge)

    return () => {
      cleanupAntiBotChallenge()
    }
  }, [])

  // 读取并清除 URL 中的 redirect 参数，或从 sessionStorage 读取
  React.useEffect(() => {
    // 优先从 URL 参数读取
    const redirect = searchParams.get('redirect')
    if (redirect) {
      // 保存重定向路径到状态
      // 同时保存到 sessionStorage（作为备份）
      // 清除 URL 参数，使用 replace 避免在历史记录中留下痕迹
      router.replace('/login', { scroll: false })
    } else {
      // 如果没有 URL 参数，尝试从 sessionStorage 读取
      const savedRedirect = sessionStorage.getItem('redirectAfterLogin')
      if (savedRedirect) {
        // 清除 sessionStorage，避免重复使用
        sessionStorage.removeItem('redirectAfterLogin')
      }
    }
  }, [searchParams, router])

  // 检查是否已登录（已登录用户应重定向到 dashboard）
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          // 已登录，重定向到 dashboard 或原始页面
          const targetPath = '/dumper'
          router.replace(targetPath)
          return
        }
      } catch (error) {
        console.error('Auth check error:', error)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()
  }, [router])

  // 检查是否有注册成功的提示（只显示一次）
  React.useEffect(() => {
    const registered = searchParams.get("registered")
    if (registered === "true" && !hasShownRegistrationToast.current) {
      hasShownRegistrationToast.current = true
      toast.success("Registration successful! Please verify your email and log in.")
    }
  }, [searchParams])

  // 验证邮箱格式
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const notifyErrorOnce = React.useCallback((key: string, message: string, windowMs = 1800) => {
    const now = Date.now()
    const last = toastThrottleRef.current[key] || 0
    if (now - last < windowMs) return
    toastThrottleRef.current[key] = now
    toast.error(message, { id: key })
  }, [])

  // 如果正在检查认证状态，显示加载
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitLockRef.current) return
    submitLockRef.current = true
    setErrors({})
    try {
      // 先获取表单数据（在异步操作之前）
      const formData = new FormData(e.currentTarget)
      const email = formData.get("email") as string
      const password = formData.get("password") as string
      const honeypot = formData.get("website") as string

      if (cooldownUntil && Date.now() < cooldownUntil) {
        const waitSec = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000))
        notifyErrorOnce("login-cooldown", `Too many attempts. Please retry in ${waitSec}s.`)
        return
      }

      const antiBotSignals = collectAntiBotSignals(antiBotChallenge)
      const captchaState: AuthCaptchaState = sliderResult
        ? sliderResult.verified
          ? "slider_passed"
          : "slider_failed"
        : "none"
      const risk = await evaluateAuthRisk({
        action: "login",
        captchaState,
        clientSignals: {
          elapsedMs: antiBotSignals.elapsedMs,
          antiBotScore: antiBotSignals.antiBotScore,
          inputSwitchCount: antiBotSignals.inputSwitchCount,
          hasMouseMovement: antiBotSignals.hasMouseMovement,
          hasNaturalMousePath: antiBotSignals.hasNaturalMousePath,
          hasNaturalInputPattern: antiBotSignals.hasNaturalInputPattern,
          hasFocusActivity: antiBotSignals.hasFocusActivity,
          slider: sliderResult,
        },
      })

      if (!risk.success) {
        notifyErrorOnce("login-risk-failed", risk.error || "Risk evaluation failed. Please retry.")
        return
      }

      if (risk.decision === "throttle" || risk.decision === "deny") {
        const cooldownMs = Math.max(15, risk.cooldownSec || 15) * 1000
        setCooldownUntil(Date.now() + cooldownMs)
        notifyErrorOnce(
          "login-throttle",
          risk.decision === "deny"
            ? `Request blocked. Retry in ${Math.max(15, risk.cooldownSec || 15)}s.`
            : `Too many attempts. Retry in ${Math.max(15, risk.cooldownSec || 15)}s.`
        )
        return
      }

      if (risk.decision === "challenge") {
        setChallengeRequired(true)
        if (!sliderResult?.verified) {
          notifyErrorOnce("login-need-challenge", "Please complete the verification challenge")
          return
        }
        notifyErrorOnce(
          "login-challenge-quality",
          "Verification quality was too low. Please drag naturally and try again."
        )
        setSliderResult(null)
        return
      }
      setChallengeRequired(false)
      setCooldownUntil(null)

      // Check honeypot
      if (honeypot) {
        return // Bot detected
      }

      // 客户端验证
      const newErrors: { email?: string; password?: string } = {}
      if (!email) {
        newErrors.email = "Email is required"
      } else if (!validateEmail(email)) {
        newErrors.email = "Invalid email format"
      }
      if (!password) {
        newErrors.password = "Password is required"
      } else if (password.length < 8) {
        newErrors.password = "Password must be at least 8 characters"
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        return
      }

      setIsLoading(true)
      // Risk API includes rate-limit recording and risk event telemetry.

      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })

        if (error) {
          const errorMessages: Record<string, string> = {
            'Invalid login credentials': "Invalid email or password",
            'Email not confirmed': "Please verify your email address",
          }
          
          const errorMessage = errorMessages[error.message] || error.message || "Login failed"
          toast.error(errorMessage, {
            id: "login-auth-error",
            icon: <IconAlertCircle className="size-4" />,
          })
          return
        }

        if (data.user) {
          toast.success("Login successful!")
          
          const savedRedirect = sessionStorage.getItem('redirectAfterLogin')
          const targetPath = '/dumper'
          
          if (savedRedirect) {
            sessionStorage.removeItem('redirectAfterLogin')
          }
          
          setTimeout(() => {
            router.replace(targetPath)
            router.refresh()
          }, 100)
        }
      } catch (error) {
        console.error("Login error:", error)
        toast.error("Network error. Please check your connection.", {
          id: "login-network",
          icon: <IconAlertCircle className="size-4" />,
        })
      } finally {
        setIsLoading(false)
      }
    } finally {
      submitLockRef.current = false
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className={cn("flex flex-col gap-6 w-full max-w-[420px]")}>
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="32"
            height="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 1 }}
          >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2m16 0h2m-7-1v2m-6-2v2" />
          </svg>
          <span className="text-2xl font-bold">SQLBots</span>
        </div>

        <Card className="rounded-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Login to your account</CardTitle>
            <CardDescription>
              Enter your credentials below to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Honeypot - hidden from real users */}
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <IconMail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    className={cn("pl-10", errors.email && "border-destructive")}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                    onChange={() => trackInputTiming('email')}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="text-sm text-destructive flex items-center gap-1">
                    <IconAlertCircle className="size-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                  <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    id="password"
                    name="password"
                    type="password" 
                    placeholder="••••••••"
                    className={cn("pl-10", errors.password && "border-destructive")}
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                    onChange={() => trackInputTiming('password')}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                  />
                </div>
                {errors.password && (
                  <p id="password-error" className="text-sm text-destructive flex items-center gap-1">
                    <IconAlertCircle className="size-3" />
                    {errors.password}
                  </p>
                )}
              </div>

              {challengeRequired ? (
                <SliderCaptcha
                  onVerify={setSliderResult}
                  disabled={isLoading}
                />
              ) : null}

              <div className="flex items-center gap-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={isLoading}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  Remember me
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full mt-2 cursor-pointer"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <IconLoader2 className="size-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link href="/register" prefetch className="text-foreground underline underline-offset-4 hover:text-primary">
                  Sign up
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <a href="https://www.sqlbots.online/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">Terms</a>
          {" "}and{" "}
          <a href="https://www.sqlbots.online/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

