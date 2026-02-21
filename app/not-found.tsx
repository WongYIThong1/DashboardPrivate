import Link from "next/link"
import { IconArrowLeft, IconHome2, IconSearchOff } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-foreground/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-muted blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-20">
        <div className="w-full motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-reduce:animate-none">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <IconSearchOff className="size-3.5" />
            Error 404
          </div>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight sm:text-7xl">Page not found</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            The page you requested does not exist, was moved, or is currently unavailable.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/dumper">
                <IconHome2 className="size-4" />
                Go to dumper
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dumper">
                <IconArrowLeft className="size-4" />
                Back to dumper
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
