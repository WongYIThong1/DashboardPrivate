"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { IconMail, IconLock, IconUser, IconLoader2, IconAlertCircle, IconEye, IconEyeOff, IconCheck, IconX } from "@tabler/icons-react"
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

export default function RegisterPage() {
  const router = useRouter()
  const formRef = React.useRef<HTMLFormElement>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true)
  const [agreed, setAgreed] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [errors, setErrors] = React.useState<{ 
    username?: string
    email?: string
    password?: string 
  }>({})
  const toastThrottleRef = React.useRef<Record<string, number>>({})
  const submitLockRef = React.useRef(false)
  
  // Anti-bot challenge
  const [antiBotChallenge, setAntiBotChallenge] = React.useState<AntiBotChallenge | null>(null)
  const [challengeRequired, setChallengeRequired] = React.useState(false)
  const [sliderResult, setSliderResult] = React.useState<SliderCaptchaResult | null>(null)
  const [cooldownUntil, setCooldownUntil] = React.useState<number | null>(null)
  
  // Password strength indicators
  const [passwordStrength, setPasswordStrength] = React.useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  })

  // 检查是否已登录（已登录用户应重定向到 dashboard）
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          router.push('/dumper')
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

  // Initialize anti-bot challenge when component mounts
  React.useEffect(() => {
    const challenge = createAntiBotChallenge()
    setAntiBotChallenge(challenge)

    return () => {
      cleanupAntiBotChallenge()
    }
  }, [])

  // Check password strength
  React.useEffect(() => {
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    })
  }, [password])

  // Validation functions
  const validateUsername = (username: string): string | undefined => {
    if (!username) return "Username is required"
    if (username.length < 3) return "Username must be at least 3 characters"
    if (username.length > 20) return "Username must be less than 20 characters"
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return "Username can only contain letters, numbers and underscores"
    return undefined
  }

  const validateEmail = (email: string): string | undefined => {
    if (!email) return "Email is required"
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return "Invalid email format"
    return undefined
  }

  const validatePassword = (password: string): string | undefined => {
    if (!password) return "Password is required"
    if (password.length < 8) return "Password must be at least 8 characters"
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter"
    if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter"
    if (!/[0-9]/.test(password)) return "Password must contain at least one number"
    return undefined
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
      const username = (formData.get("username") as string).trim()
      const email = (formData.get("email") as string).trim()
      const password = formData.get("password") as string
      const honeypot = formData.get("website") as string

      if (cooldownUntil && Date.now() < cooldownUntil) {
        const waitSec = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000))
        notifyErrorOnce("register-cooldown", `Too many attempts. Please retry in ${waitSec}s.`)
        return
      }

      const antiBotSignals = collectAntiBotSignals(antiBotChallenge)
      const captchaState: AuthCaptchaState = sliderResult
        ? sliderResult.verified
          ? "slider_passed"
          : "slider_failed"
        : "none"
      const risk = await evaluateAuthRisk({
        action: "register",
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
        notifyErrorOnce("register-risk-failed", risk.error || "Risk evaluation failed. Please retry.")
        return
      }

      if (risk.decision === "throttle" || risk.decision === "deny") {
        const cooldownMs = Math.max(15, risk.cooldownSec || 15) * 1000
        setCooldownUntil(Date.now() + cooldownMs)
        notifyErrorOnce(
          "register-throttle",
          risk.decision === "deny"
            ? `Request blocked. Retry in ${Math.max(15, risk.cooldownSec || 15)}s.`
            : `Too many attempts. Retry in ${Math.max(15, risk.cooldownSec || 15)}s.`
        )
        return
      }

      if (risk.decision === "challenge") {
        setChallengeRequired(true)
        if (!sliderResult?.verified) {
          notifyErrorOnce("register-need-challenge", "Please complete the verification challenge")
          return
        }
        notifyErrorOnce(
          "register-challenge-quality",
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

      // Client-side validation
      const newErrors: typeof errors = {}
      const usernameError = validateUsername(username)
      const emailError = validateEmail(email)
      const passwordError = validatePassword(password)

      if (usernameError) newErrors.username = usernameError
      if (emailError) newErrors.email = emailError
      if (passwordError) newErrors.password = passwordError

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        return
      }

      if (!agreed) {
        notifyErrorOnce("register-terms", "You must agree to the Terms of Service and Privacy Policy")
        return
      }

      setIsLoading(true)
      // Risk API includes rate-limit recording and risk event telemetry.

      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
      
        // 检查用户名是否已存在（不区分大小写）
        const { data: existingUser, error: checkError } = await supabase
          .from('user_profiles')
          .select('username')
          .ilike('username', username.trim())
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Username check error:', checkError)
          notifyErrorOnce("register-username-check", "Failed to verify username. Please try again.")
          setIsLoading(false)
          return
        }

        if (existingUser) {
          setErrors({ username: "This username is already taken. Please choose a different one." })
          setIsLoading(false)
          return
        }
      
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              username: username.trim(),
            },
            emailRedirectTo: `${window.location.origin}/login`,
          }
        })

        if (error) {
          const errorMessages: Record<string, string> = {
            'User already registered': "This email is already registered. Please use a different email or try logging in.",
            'Password should be at least 6 characters': "Password must be at least 8 characters",
          }
          
          const errorMessage = errorMessages[error.message] || error.message || "Registration failed"
          notifyErrorOnce("register-auth-error", errorMessage)
          return
        }

        if (data.user) {
          // 注册成功后立即登出，不自动登录
          await supabase.auth.signOut()
          
          // 跳转到登录页面，在那里显示成功消息
          router.push("/login?registered=true")
        }
      } catch {
        notifyErrorOnce("register-network", "Network error. Please check your connection.")
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
            <CardTitle className="text-xl">Create an account</CardTitle>
            <CardDescription>
              Enter your details below to create your account
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
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <IconUser className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="johndoe"
                    className={cn("pl-10", errors.username && "border-destructive")}
                    required
                    disabled={isLoading}
                    onChange={() => trackInputTiming('username')}
                    aria-invalid={!!errors.username}
                    aria-describedby={errors.username ? "username-error" : undefined}
                  />
                </div>
                {errors.username && (
                  <p id="username-error" className="text-sm text-destructive flex items-center gap-1">
                    <IconAlertCircle className="size-3" />
                    {errors.username}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  3-20 characters, letters, numbers and underscores only
                </p>
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
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className={cn("pl-10 pr-10", errors.password && "border-destructive")}
                    required
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      trackInputTiming('password')
                    }}
                    autoComplete="new-password"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : "password-requirements"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={isLoading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <IconEyeOff className="size-4" />
                    ) : (
                      <IconEye className="size-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-sm text-destructive flex items-center gap-1">
                    <IconAlertCircle className="size-3" />
                    {errors.password}
                  </p>
                )}
                {password && (
                  <div id="password-requirements" className="space-y-1.5 text-xs">
                    <div className={cn(
                      "flex items-center gap-1.5",
                      passwordStrength.hasMinLength ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
                    )}>
                      {passwordStrength.hasMinLength ? (
                        <IconCheck className="size-3" />
                      ) : (
                        <IconX className="size-3" />
                      )}
                      <span>At least 8 characters</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1.5",
                      passwordStrength.hasUpperCase ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
                    )}>
                      {passwordStrength.hasUpperCase ? (
                        <IconCheck className="size-3" />
                      ) : (
                        <IconX className="size-3" />
                      )}
                      <span>One uppercase letter</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1.5",
                      passwordStrength.hasLowerCase ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
                    )}>
                      {passwordStrength.hasLowerCase ? (
                        <IconCheck className="size-3" />
                      ) : (
                        <IconX className="size-3" />
                      )}
                      <span>One lowercase letter</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1.5",
                      passwordStrength.hasNumber ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
                    )}>
                      {passwordStrength.hasNumber ? (
                        <IconCheck className="size-3" />
                      ) : (
                        <IconX className="size-3" />
                      )}
                      <span>One number</span>
                    </div>
                  </div>
                )}
              </div>

              {challengeRequired ? (
                <SliderCaptcha
                  onVerify={setSliderResult}
                  disabled={isLoading}
                />
              ) : null}

              <div className="flex items-start gap-2">
                <Checkbox 
                  id="terms" 
                  className="mt-0.5" 
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked as boolean)}
                  disabled={isLoading}
                />
                <Label htmlFor="terms" className="text-sm font-normal cursor-pointer leading-relaxed">
                  I agree to the{" "}
                  <a href="#" className="underline underline-offset-4 hover:text-primary">Terms of Service</a>
                  {" "}and{" "}
                  <a href="#" className="underline underline-offset-4 hover:text-primary">Privacy Policy</a>
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
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" prefetch className="text-foreground underline underline-offset-4 hover:text-primary">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
