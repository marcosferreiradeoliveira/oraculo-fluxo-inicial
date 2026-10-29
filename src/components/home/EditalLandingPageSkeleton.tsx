import logo from '@/assets/logo.png';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export function EditalLandingPageSkeleton() {
  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-zinc-900 font-sans antialiased"
      aria-busy="true"
      aria-label="Carregando edital"
    >
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="Oráculo Cultural" className="h-9 w-auto" />
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-start">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full max-w-lg" />
              <Skeleton className="h-5 w-2/3" />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl bg-zinc-900 p-6 md:p-8 space-y-4">
            <Skeleton className="h-7 w-full bg-zinc-700" />
            <Skeleton className="h-4 w-full bg-zinc-800" />
            <Skeleton className="h-10 w-full bg-zinc-800 rounded-md" />
            <Skeleton className="h-10 w-full bg-zinc-800 rounded-md" />
            <Skeleton className="h-14 w-full rounded-xl bg-yellow-400/30" />
          </div>
        </div>
      </main>
    </div>
  );
}
