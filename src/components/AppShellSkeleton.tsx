import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder enquanto Firebase / rotas protegidas inicializam — espelha layout dashboard. */
export function AppShellSkeleton() {
  return (
    <div
      className="flex min-h-screen bg-gray-50"
      aria-busy="true"
      aria-label="Carregando a plataforma"
    >
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white p-4">
        <Skeleton className="mx-auto h-12 w-12 rounded-xl" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
          <Skeleton className="h-8 w-40 sm:w-56" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </header>
        <main className="flex-1 space-y-6 p-4 sm:p-6">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
        </main>
      </div>
    </div>
  );
}
