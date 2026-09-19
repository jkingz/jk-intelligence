import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Block({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-border/70 motion-safe:animate-pulse",
        className
      )}
    />
  );
}

function MetricCard() {
  return (
    <Card className="rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
      <div className="flex flex-row items-center justify-between text-xs">
        <Block className="h-3 w-24" />
        <Block className="h-3.5 w-3.5 rounded-full" />
      </div>
      <div className="py-2 flex flex-wrap items-baseline gap-2">
        <Block className="h-7 w-28" />
        <Block className="h-3.5 w-12" />
      </div>
      <Block className="h-3 w-40" />
    </Card>
  );
}

export default function DashboardSkeleton() {
  return (
    <div
      className="min-h-screen w-full min-w-0 flex flex-col font-sans antialiased bg-background text-foreground"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading dashboard</span>

      <header className="border-b border-default bg-surface sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-serif text-lg font-bold">
                J
              </div>
              <span className="font-serif text-base sm:text-lg tracking-tight font-medium truncate">
                JK Intelligence
              </span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-border-subtle shrink-0" />
            <Block className="h-8 w-36 sm:w-56" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Block className="hidden md:block h-6 w-24 rounded-full" />
            <Block className="h-8 w-24" />
            <Block className="h-8 w-8 rounded-full" />
            <Block className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        <div className="flex flex-col gap-6 sm:gap-8">
          <section className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-4 border-b border-default pb-4">
              <div className="min-w-0 flex flex-col gap-2">
                <Block className="h-3 w-64 sm:w-80" />
                <Block className="h-9 w-[min(100%,36rem)]" />
                <Block className="h-9 w-[min(80%,28rem)]" />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
                <Block className="h-8 w-36 rounded-lg" />
                <Block className="h-8 w-full sm:w-72 rounded-lg" />
              </div>
            </div>
          </section>

          <section aria-label="Performance metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard />
            <MetricCard />
            <MetricCard />
            <MetricCard />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="relative lg:col-span-2 min-w-0">
              <div className="relative bg-surface rounded-xl border border-default p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex flex-col gap-1.5">
                    <Block className="h-3 w-28" />
                    <Block className="h-3 w-40" />
                  </div>
                  <Block className="h-3 w-32" />
                </div>
                <Block className="h-80 w-full rounded-lg" />
              </div>
            </div>
            <Card className="rounded-2xl p-4 sm:p-6 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <Block className="h-5 w-40" />
                <Block className="h-3 w-full" />
                <div className="flex flex-col gap-3 pt-1">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="p-3 bg-surface border border-default rounded-md flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Block className="h-3 w-28" />
                        <Block className="h-4 w-10 rounded" />
                      </div>
                      <Block className="h-3 w-full" />
                      <Block className="h-3 w-4/5" />
                    </div>
                  ))}
                </div>
              </div>
              <Block className="h-8 w-full mt-4 rounded-lg" />
            </Card>
          </section>

          <Card className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Block className="h-4 w-36" />
              <Block className="h-8 w-full sm:w-56 rounded-lg" />
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Block key={index} className="h-9 w-full" />
              ))}
            </div>
          </Card>

          <section className="bg-surface rounded-xl border border-default p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                <Block className="h-5 w-64" />
                <Block className="h-3 w-48" />
              </div>
              <Block className="h-6 w-40 rounded-md self-start sm:self-auto" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="p-4 space-y-2">
                  <div className="flex flex-row items-center justify-between">
                    <Block className="h-3 w-16" />
                    <Block className="h-3 w-10" />
                  </div>
                  <Block className="h-3 w-24" />
                  <Block className="h-3 w-full" />
                </Card>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-default bg-surface py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Block className="h-3 w-64" />
          <Block className="h-3 w-72" />
        </div>
      </footer>
    </div>
  );
}
