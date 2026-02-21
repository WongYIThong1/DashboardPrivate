"use client"

import * as React from "react"
import {
  IconUser,
  IconAt,
  IconCrown,
  IconCoins,
  IconBell,
  IconShield,
  IconLoader2,
} from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarUpload } from "@/components/avatar-upload"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface UserSettings {
  username: string
  email: string
  plan: string
  credits: number
  notification: boolean
  privacy: boolean
  avatarUrl?: string | null
  avatarHash?: string | null
  subscription_days?: number
  subscription_expires_at?: string | null
  days_remaining?: number | null
  is_expired?: boolean
}

function normalizePlan(plan: unknown): "Free" | "Starter" | "Pro" | "Pro+" {
  const value = typeof plan === "string" ? plan.trim().toLowerCase() : ""
  if (value === "starter") return "Starter"
  if (value === "pro+" || value === "pro plus" || value === "pro_plus") return "Pro+"
  if (value === "pro") return "Pro"
  return "Free"
}

export function SettingsContent() {
  const [settings, setSettings] = React.useState<UserSettings | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [privacyMode, setPrivacyMode] = React.useState(false)
  const [systemNotification, setSystemNotification] = React.useState(true)
  const [userId, setUserId] = React.useState<string>('')

  React.useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setIsLoading(true)
    
    try {
      // 先获取 user ID
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setUserId(user.id)
      }

      const response = await fetch('/api/settings', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to fetch settings:', error)
        toast.error("Please Try Again")
        return
      }

      const data = await response.json()
      
      setSystemNotification(data.notification)
      setPrivacyMode(data.privacy)
      
      setSettings({
        username: data.username,
        email: data.email,
        plan: normalizePlan(data.plan),
        credits: data.credits,
        notification: data.notification,
        privacy: data.privacy,
        avatarUrl: data.avatarUrl,
        avatarHash: data.avatarHash,
        subscription_days: data.subscription_days,
        subscription_expires_at: data.subscription_expires_at,
        days_remaining: data.days_remaining,
        is_expired: data.is_expired,
      })
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      toast.error("Please Try Again")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notification: systemNotification,
          privacy: privacyMode,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Update error:', error)
        toast.error(error.error || "Failed to save settings")
        return
      }

      setSettings(prev => prev ? {
        ...prev,
        notification: systemNotification,
        privacy: privacyMode,
      } : null)
      
      toast.success("Settings saved successfully")
    } catch (error) {
      console.error('Save settings error:', error)
      toast.error("Failed to save settings. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarUpload = (avatarUrl: string, hash: string) => {
    setSettings(prev => prev ? {
      ...prev,
      avatarUrl,
      avatarHash: hash,
    } : null)
  }

  const handleAvatarRemove = () => {
    setSettings(prev => prev ? {
      ...prev,
      avatarUrl: null,
      avatarHash: null,
    } : null)
  }

  const formatCredits = (credits: number) => {
    return credits.toLocaleString()
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col min-w-0 p-6">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* Profile Section Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Section Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-56 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            </CardContent>
          </Card>

          {/* Privacy Section Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full mt-2" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            </CardContent>
          </Card>

          {/* Buttons Skeleton */}
          <div className="flex justify-end gap-2 pt-4">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-w-0 p-6">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUser className="size-5" />
              Profile
            </CardTitle>
            <CardDescription>
              Your account information and plan details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Upload */}
            {userId && settings && (
              <div>
                <Label className="mb-3 block">Profile Picture</Label>
                <AvatarUpload
                  userId={userId}
                  username={settings.username}
                  currentAvatarUrl={settings.avatarUrl}
                  currentAvatarHash={settings.avatarHash}
                  onUploadSuccess={handleAvatarUpload}
                  onRemoveSuccess={handleAvatarRemove}
                />
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <IconUser className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    value={settings?.username || ""}
                    disabled
                    className="bg-muted pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <IconAt className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={settings?.email || ""}
                    disabled
                    className="bg-muted pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan">Plan</Label>
                <div className="relative">
                  <IconCrown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="plan"
                    value={settings?.plan || "Free"}
                    disabled
                    className="bg-muted pl-9 capitalize"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="credits">Credits</Label>
                <div className="relative">
                  <IconCoins className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="credits"
                    value={formatCredits(settings?.credits || 0)}
                    disabled
                    className="bg-muted pl-9 font-[family-name:var(--font-jetbrains-mono)]"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Details Section */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
            <CardDescription>
              Your current plan and subscription details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Starter Plan */}
              <div className={`border rounded-lg p-4 ${settings?.plan === 'Starter' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">Starter</h3>
                    <p className="text-sm text-muted-foreground">Entry paid plan</p>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Storage</span>
                      <span className="font-medium">1 GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credits</span>
                      <span className="font-medium">500</span>
                    </div>
                    {settings?.plan === 'Starter' && (
                      <>
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Purchased Days</span>
                          <span className="font-medium">{settings?.subscription_days || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expires</span>
                          <span className={`font-medium ${settings?.is_expired ? 'text-destructive' : ''}`}>
                            {settings?.is_expired ? 'Expired' : formatDate(settings?.subscription_expires_at)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {settings?.plan === 'Starter' && (
                    <div className="pt-2">
                      <span className="text-xs font-medium text-primary">Current Plan</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pro Plan */}
              <div className={`border rounded-lg p-4 ${settings?.plan === 'Pro' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">Pro</h3>
                    <p className="text-sm text-muted-foreground">For professionals</p>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Storage</span>
                      <span className="font-medium">5 GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credits</span>
                      <span className="font-medium">2,000</span>
                    </div>
                    {settings?.plan === 'Pro' && (
                      <>
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Purchased Days</span>
                          <span className="font-medium">{settings?.subscription_days || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expires</span>
                          <span className={`font-medium ${settings?.is_expired ? 'text-destructive' : ''}`}>
                            {settings?.is_expired ? 'Expired' : formatDate(settings?.subscription_expires_at)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {settings?.plan === 'Pro' && (
                    <div className="pt-2">
                      <span className="text-xs font-medium text-primary">Current Plan</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pro+ Plan */}
              <div className={`border rounded-lg p-4 ${settings?.plan === 'Pro+' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">Pro+</h3>
                    <p className="text-sm text-muted-foreground">Maximum power</p>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Storage</span>
                      <span className="font-medium">10 GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credits</span>
                      <span className="font-medium">5,000</span>
                    </div>
                    {settings?.plan === 'Pro+' && (
                      <>
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Purchased Days</span>
                          <span className="font-medium">{settings?.subscription_days || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expires</span>
                          <span className={`font-medium ${settings?.is_expired ? 'text-destructive' : ''}`}>
                            {settings?.is_expired ? 'Expired' : formatDate(settings?.subscription_expires_at)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {settings?.plan === 'Pro+' && (
                    <div className="pt-2">
                      <span className="text-xs font-medium text-primary">Current Plan</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBell className="size-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure your notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="system-notification">System Notification</Label>
                <p className="text-sm text-muted-foreground">
                  Receive system notifications and updates
                </p>
              </div>
              <Switch 
                id="system-notification" 
                checked={systemNotification}
                onCheckedChange={setSystemNotification}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconShield className="size-5" />
              Privacy
            </CardTitle>
            <CardDescription>
              Control your privacy and data settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="privacy-mode">Privacy Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Your data will not be trained on or used to improve our product
                </p>
              </div>
              <Switch 
                id="privacy-mode" 
                checked={privacyMode}
                onCheckedChange={setPrivacyMode}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving ? (
              <>
                <IconLoader2 className="size-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

