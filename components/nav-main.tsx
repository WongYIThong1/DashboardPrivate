"use client"

import * as React from "react"
import Link from "next/link"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { IconLock } from "@tabler/icons-react"

type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  isActive?: boolean
  disabled?: boolean
}

export function NavMain({
  items,
  label,
  className,
}: {
  items: NavItem[]
  label?: string
  className?: string
}) {
  const [showDialog, setShowDialog] = React.useState(false)

  return (
    <>
      <SidebarGroup className={className}>
        {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.disabled ? (
                <SidebarMenuButton 
                  isActive={item.isActive}
                  onClick={() => setShowDialog(true)}
                  className="cursor-not-allowed opacity-50"
                >
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton asChild isActive={item.isActive}>
                  {item.url.startsWith("http") ? (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </a>
                  ) : (
                    <Link href={item.url} prefetch>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  )}
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconLock className="size-4" />
              Not Available
            </DialogTitle>
            <DialogDescription className="pt-2">
              This feature is currently under development.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
