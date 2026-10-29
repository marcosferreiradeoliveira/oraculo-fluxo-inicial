import { useMemo, type CSSProperties } from 'react';

const BALLOON_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
];

const CONFETTI_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#22c55e',
  '#ffffff',
];

type BalloonSpec = {
  id: number;
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
};

type ConfettiSpec = {
  id: number;
  left: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  round: boolean;
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Bolas e confetes — respeita prefers-reduced-motion. */
export function CelebrationOverlay() {
  const balloons = useMemo<BalloonSpec[]>(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: randomBetween(4, 92),
        size: randomBetween(36, 56),
        color: BALLOON_COLORS[i % BALLOON_COLORS.length],
        delay: randomBetween(0, 4),
        duration: randomBetween(7, 11),
        drift: randomBetween(-40, 40),
      })),
    [],
  );

  const confetti = useMemo<ConfettiSpec[]>(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: randomBetween(0, 100),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: randomBetween(0, 2.5),
        duration: randomBetween(3.5, 6.5),
        size: randomBetween(6, 11),
        round: i % 3 === 0,
      })),
    [],
  );

  return (
    <div
      className="celebration-root pointer-events-none fixed inset-0 z-[45] overflow-hidden"
      aria-hidden
    >
      {balloons.map((b) => (
        <div
          key={`balloon-${b.id}`}
          className="celebration-balloon absolute bottom-0"
          style={
            {
              left: `${b.left}%`,
              ['--balloon-size' as string]: `${b.size}px`,
              ['--balloon-drift' as string]: `${b.drift}px`,
              ['--balloon-duration' as string]: `${b.duration}s`,
              ['--balloon-delay' as string]: `${b.delay}s`,
              ['--balloon-color' as string]: b.color,
            } as CSSProperties
          }
        >
          <span className="celebration-balloon-body" />
          <span className="celebration-balloon-string" />
        </div>
      ))}

      {confetti.map((c) => (
        <span
          key={`confetti-${c.id}`}
          className={`celebration-confetti absolute top-0 ${c.round ? 'rounded-full' : 'rounded-sm'}`}
          style={
            {
              left: `${c.left}%`,
              width: c.size,
              height: c.round ? c.size : c.size * 1.6,
              backgroundColor: c.color,
              ['--confetti-duration' as string]: `${c.duration}s`,
              ['--confetti-delay' as string]: `${c.delay}s`,
            } as CSSProperties
          }
        />
      ))}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .celebration-root { display: none; }
        }

        .celebration-balloon {
          animation: celebration-balloon-rise var(--balloon-duration) ease-in infinite;
          animation-delay: var(--balloon-delay);
          transform: translateY(110vh);
          opacity: 0;
        }

        .celebration-balloon-body {
          display: block;
          width: var(--balloon-size);
          height: calc(var(--balloon-size) * 1.22);
          margin: 0 auto;
          border-radius: 50% 50% 45% 45%;
          background: radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), var(--balloon-color) 45%);
          box-shadow: inset -4px -8px 12px rgba(0,0,0,0.12);
        }

        .celebration-balloon-string {
          display: block;
          width: 1px;
          height: calc(var(--balloon-size) * 0.9);
          margin: 2px auto 0;
          background: linear-gradient(to bottom, rgba(100,100,100,0.5), transparent);
        }

        @keyframes celebration-balloon-rise {
          0% {
            transform: translateY(105vh) translateX(0) rotate(-6deg);
            opacity: 0;
          }
          8% { opacity: 0.95; }
          100% {
            transform: translateY(-115vh) translateX(var(--balloon-drift)) rotate(8deg);
            opacity: 0.35;
          }
        }

        .celebration-confetti {
          animation: celebration-confetti-fall var(--confetti-duration) linear infinite;
          animation-delay: var(--confetti-delay);
          opacity: 0.9;
          box-shadow: 0 0 1px rgba(0,0,0,0.15);
        }

        @keyframes celebration-confetti-fall {
          0% {
            transform: translateY(-5vh) rotate(0deg) translateX(0);
            opacity: 0;
          }
          5% { opacity: 1; }
          100% {
            transform: translateY(105vh) rotate(720deg) translateX(24px);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
