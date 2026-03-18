import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative flex flex-1 items-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.08),transparent_35%),linear-gradient(180deg,transparent,rgba(0,0,0,0.03))]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20 sm:px-10 lg:flex-row lg:items-end lg:justify-between lg:px-16">
        <section className="max-w-2xl space-y-6">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Design System Documentation
          </p>
          <div className="space-y-4">
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Hackathon UI for fast, consistent product surfaces.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Reference docs for the shared primitives used across this monorepo, starting
              with the two most reused building blocks: buttons and cards.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
            >
              Browse Docs
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/docs/button"
              className="inline-flex items-center gap-2 border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              View Button Spec
            </Link>
          </div>
        </section>

        <section className="grid w-full max-w-xl gap-4 sm:grid-cols-2">
          <div className="border border-border/80 bg-card p-5 text-card-foreground shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Components</p>
            <p className="mt-3 text-3xl font-semibold">2</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Focused docs for `Button` and `Card`, including variants, anatomy, and
              implementation notes.
            </p>
          </div>
          <div className="border border-border/80 bg-card p-5 text-card-foreground shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Source of Truth</p>
            <p className="mt-3 text-3xl font-semibold">@hackathon/ui</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Live examples use the real shared package so docs stay aligned with shipped
              styles and props.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
