import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Block({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

function MetricCard() {
  return (
    <Card className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      <CardHeader className="p-0 flex flex-row items-center justify-between">
        <Block className="h-3 w-24" />
        <Block className="h-3.5 w-3.5 rounded-full" />
      </CardHeader>
      <CardContent className="p-0 flex flex-col gap-2">
        <Block className="h-7 w-28" />
        <Block className="h-3 w-40" />
      </CardContent>
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
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 flex flex-col gap-6 sm:gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-3">
              <Block className="h-6 w-64 sm:w-96" />
              <Block className="h-4 w-56" />
            </div>
            <Block className="h-8 w-40" />
          </div>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard />
          <MetricCard />
          <MetricCard />
          <MetricCard />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 rounded-2xl p-4 sm:p-5 flex flex-col gap-5">
            <Block className="h-4 w-40" />
            <Block className="h-64 w-full" />
          </Card>
          <Card className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
            <Block className="h-4 w-32" />
            <Block className="h-12 w-full" />
            <Block className="h-12 w-full" />
            <Block className="h-12 w-full" />
          </Card>
        </section>

        <Card className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
          <Block className="h-4 w-36" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Block key={index} className="h-9 w-full" />
          ))}
        </Card>
      </main>
    </div>
  );
}
