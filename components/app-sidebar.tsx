"use client"

import type { ComponentProps } from "react"
import {
  IconChecklist,
  IconKey,
  IconHistory,
  IconFolder,
  IconBook,
  IconUsers,
  IconMessageCircle,
  IconShieldOff,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  navWorkplace: [
    {
      title: "Tasks",
      url: "/tasks",
      icon: IconChecklist,
      disabled: true,
    },
    {
      title: "Dumper",
      url: "/dumper",
      icon: IconChecklist,
    },
    {
      title: "Dehasher",
      url: "/dehasher",
      icon: IconKey,
      disabled: true,
    },
    {
      title: "Antipublic",
      url: "/antipublic",
      icon: IconShieldOff,
      disabled: true,
    },
  ],
  navManagement: [
    {
      title: "History",
      url: "/history",
      icon: IconHistory,
    },
    {
      title: "Cloud",
      url: "/files",
      icon: IconFolder,
    },
  ],
  navSupport: [
    {
      title: "Documentation",
      url: "https://discord.gg/es6vcqA5zS",
      icon: IconBook,
    },
    {
      title: "Community",
      url: "https://discord.gg/es6vcqA5zS",
      icon: IconUsers,
    },
    {
      title: "Feedback",
      url: "https://discord.gg/es6vcqA5zS",
      icon: IconMessageCircle,
    },
  ],
}

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="!size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 8V4H8" />
                  <rect width="16" height="12" x="4" y="8" rx="2" />
                  <path d="M2 14h2m16 0h2m-7-1v2m-6-2v2" />
                </svg>
                <span className="text-base font-semibold">SQLBots</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navWorkplace} label="Workplace" />
        <NavMain items={data.navManagement} label="Management" />
        <NavMain items={data.navSupport} label="Support" className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
