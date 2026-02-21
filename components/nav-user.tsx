"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronsUpDown,
  LogOut,
  Sparkles,
  Settings,
  User,
  Bell,
  Shield,
  Loader2,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarImageComponent } from "@/components/avatar-image"
import { toast } from "sonner"
import { getCachedUserInfo, setCachedUserInfo, clearCachedUserInfo } from "@/lib/user-cache"

interface UserInfo {
  id: string
  username: string
  email: string
  plan?: string
  avatarUrl?: string | null
  avatarHash?: string | null
}

interface UserSettings {
  username: string
  email: string
  plan: string
  credits: number
  notification: boolean
  privacy: boolean
}

function normalizePlan(plan: unknown): "Free" | "Starter" | "Pro" | "Pro+" {
  const value = typeof plan === "string" ? plan.trim().toLowerCase() : ""
  if (value === "starter") return "Starter"
  if (value === "pro+" || value === "pro plus" || value === "pro_plus") return "Pro+"
  if (value === "pro") return "Pro"
  return "Free"
}

export function NavUser() {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const [showSettings, setShowSettings] = React.useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false)
  const [user, setUser] = React.useState<UserInfo | null>(null)
  const [isLoadingUser, setIsLoadingUser] = React.useState(true)
  const [settings, setSettings] = React.useState<UserSettings | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)
  const [privacyMode, setPrivacyMode] = React.useState(false)
  const [systemNotification, setSystemNotification] = React.useState(true)

  // 从 Supabase 获取用户信息
  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        // 先尝试从缓存加载
        const cached = getCachedUserInfo()
        if (cached) {
          setUser({
            id: cached.id || '',
            username: cached.username,
            email: cached.email,
            plan: normalizePlan(cached.plan),
            avatarUrl: cached.avatarUrl,
            avatarHash: cached.avatarHash,
          })
          setIsLoadingUser(false)
        }

        // 然后从服务器获取最新数据
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          // Fetch from user_profiles table
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('username, plan, avatar_url, avatar_hash')
            .eq('id', user.id)
            .single()

          const username = profile?.username || user.email?.split('@')[0] || 'User'
          const email = user.email || 'user@example.com'
          const plan = normalizePlan(profile?.plan)

          setUser({
            id: user.id,
            username,
            email,
            plan,
            avatarUrl: profile?.avatar_url,
            avatarHash: profile?.avatar_hash,
          })

          // 缓存用于跨页面快速回显，后台再静默刷新
          setCachedUserInfo({
            id: user.id,
            username,
            email,
            plan,
            avatarUrl: profile?.avatar_url,
            avatarHash: profile?.avatar_hash,
          })
        } else {
          console.warn('User not authenticated')
          clearCachedUserInfo()
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
      } finally {
        setIsLoadingUser(false)
      }
    }

    fetchUser()
  }, [router])

  // Fetch settings when dialog opens
  React.useEffect(() => {
    if (showSettings) {
      fetchSettings()
    }
  }, [showSettings])

  const fetchSettings = async () => {
    setIsLoading(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Fetch from user_profiles table
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profile) {
          setSystemNotification(profile.system_notification)
          setPrivacyMode(profile.privacy_mode)
          
          setSettings({
            username: profile.username || 'User',
            email: profile.email || user.email || 'user@example.com',
            plan: normalizePlan(profile.plan),
            credits: profile.credits || 0,
            notification: profile.system_notification,
            privacy: profile.privacy_mode,
          })
        } else {
          toast.error("Please Try Again")
        }
      } else {
        toast.error("Please Try Again")
      }
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
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error("User not authenticated")
        return
      }

      // Update user_profiles table
      const { error } = await supabase
        .from('user_profiles')
        .update({
          system_notification: systemNotification,
          privacy_mode: privacyMode,
        })
        .eq('id', user.id)

      if (error) {
        toast.error(error.message || "Failed to save settings")
        return
      }

      setSettings(prev => prev ? {
        ...prev,
        notification: systemNotification,
        privacy: privacyMode,
      } : null)
      
      toast.success("Settings saved successfully")
      setShowSettings(false)
    } catch (error) {
      console.error('Save settings error:', error)
      toast.error("Failed to save settings. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      
      const { error } = await supabase.auth.signOut()

      if (error) {
        toast.error(error.message || "Failed to log out")
        setIsLoggingOut(false)
      } else {
        // 清除用户信息缓存
        clearCachedUserInfo()
        toast.success("Logged out successfully")
        router.replace("/login")
      }
    } catch (error) {
      console.error('Logout error:', error)
      toast.error("Failed to log out")
      setIsLoggingOut(false)
    }
  }

  const displayName = user?.username || (isLoadingUser ? "Loading..." : "User")
  const initials = displayName.slice(0, 2).toUpperCase()

  const formatDate = (date: string | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const formatCredits = (credits: number) => {
    return credits.toLocaleString()
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                disabled={isLoadingUser}
              >
                {isLoadingUser ? (
                  <>
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="grid flex-1 text-left text-sm leading-tight gap-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </>
                ) : (
                  <>
                    {user ? (
                      <AvatarImageComponent
                        userId={user.id}
                        avatarUrl={user.avatarUrl}
                        avatarHash={user.avatarHash}
                        username={displayName}
                        size="sm"
                      />
                    ) : (
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{displayName}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </>
                )}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  {user ? (
                    <AvatarImageComponent
                      userId={user.id}
                      avatarUrl={user.avatarUrl}
                      avatarHash={user.avatarHash}
                      username={displayName}
                      size="sm"
                    />
                  ) : (
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem disabled={user?.plan === 'Pro+'}>
                  <Sparkles />
                  {user?.plan === 'Free' && 'Upgrade to Starter'}
                  {user?.plan === 'Starter' && 'Upgrade to Pro'}
                  {user?.plan === 'Pro' && 'Upgrade to Pro+'}
                  {user?.plan === 'Pro+' && 'Current Pro+ Plan'}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/settings" prefetch>
                    <Settings />
                    Settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setShowLogoutConfirm(true)}>
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[480px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="size-5" />
              Settings
            </DialogTitle>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-6 py-4 overflow-y-auto flex-1 pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {/* Profile Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="size-4" />
                    Profile
                  </div>
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="grid gap-2">
                      <Label htmlFor="username">Username</Label>
                      <Input 
                        id="username" 
                        value={settings?.username || ""} 
                        disabled 
                        className="bg-muted" 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={settings?.email || ""} 
                        disabled 
                        className="bg-muted" 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="plan">Plan</Label>
                      <Input 
                        id="plan" 
                        value={settings?.plan || "Free"} 
                        disabled 
                        className="bg-muted capitalize" 
                      />
                    </div>
                    <div className="grid gap-2 col-span-2">
                      <Label htmlFor="credits">Credits</Label>
                      <Input 
                        id="credits" 
                        value={formatCredits(settings?.credits || 0)} 
                        disabled 
                        className="bg-muted font-[family-name:var(--font-jetbrains-mono)]" 
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Notifications Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Bell className="size-4" />
                    Notifications
                  </div>
                  <div className="pl-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="system-notification">System Notification</Label>
                      </div>
                      <Switch 
                        id="system-notification" 
                        checked={systemNotification}
                        onCheckedChange={setSystemNotification}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Privacy Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Shield className="size-4" />
                    Privacy
                  </div>
                  <div className="pl-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <Label htmlFor="privacy-mode">Privacy Mode</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your data will not be trained on or used to improve our product
                        </p>
                      </div>
                      <Switch 
                        id="privacy-mode" 
                        checked={privacyMode}
                        onCheckedChange={setPrivacyMode}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSettings} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to log in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Logging out...
                </>
              ) : (
                "Log out"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
