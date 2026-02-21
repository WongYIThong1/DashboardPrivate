"use client"

import * as React from "react"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  // Auth is enforced by middleware/proxy; keep this as a lightweight passthrough.
  return <>{children}</>
}
