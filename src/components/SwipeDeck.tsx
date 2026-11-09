"use client";
import { createContext, useContext, useRef, useState } from "react";

export type Direction = "left" | "right";

/**
 * A stack of cards. Drag the top card (or use the buttons / arrow keys) to swipe.
 * `onSwipe` returns an error message to show, or null on success.
 */
export function SwipeDeck<T extends { id: string }>({
  items,
  render,
  onSwipe,
  empty,
  rightLabel = "Interested",
  leftLabel = "Not a fit",
}: {
  items: T[];
  render: (item: T) => React.ReactNode;
  onSwipe: (item: T, dir: Direction) => Promise<string | null>;
  empty: React.ReactNode;
  rightLabel?: string;
  leftLabel?: string;
}) {
  const [queue, setQueue] = useState(items);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<Direction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = useRef<number | null>(null);
  const top = queue[0];

  async function swipe(dir: Direction) {
    if (!top || leaving) return;
    setError(null);
    setLeaving(dir);
    const err = await onSwipe(top, dir);
    if (err) {
      setError(err);
      setLeaving(null);
      setDx(0);
      return;
    }
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setLeaving(null);
      setDx(0);
    }, 220);
  }

  /** Remove the top card without swiping (e.g. "hide this company"). */
  function drop(predicate: (item: T) => boolean) {
    setQueue((q) => q.filter((i) => !predicate(i)));
  }

  if (!top) return <div className="card text-center text-muted">{empty}</div>;

  const offset = leaving ? (leaving === "right" ? 600 : -600) : dx;
  return (
    <div
      className="mx-auto w-full max-w-md outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") swipe("right");
        if (e.key === "ArrowLeft") swipe("left");
      }}
    >
      <div className="relative h-[30rem]">
        {queue.slice(0, 2).reverse().map((item) => {
          const isTop = item.id === top.id;
          return (
            <div
              key={item.id}
              className="card absolute inset-0 touch-none select-none overflow-y-auto"
              style={
                isTop
                  ? {
                      transform: `translateX(${offset}px) rotate(${offset / 20}deg)`,
                      transition: start.current === null ? "transform 220ms ease-out" : "none",
                    }
                  : { transform: "scale(0.96) translateY(10px)", opacity: 0.7 }
              }
              onPointerDown={isTop ? (e) => { start.current = e.clientX; (e.target as Element).setPointerCapture?.(e.pointerId); } : undefined}
              onPointerMove={isTop ? (e) => { if (start.current !== null) setDx(e.clientX - start.current); } : undefined}
              onPointerUp={isTop ? () => {
                start.current = null;
                if (dx > 120) swipe("right");
                else if (dx < -120) swipe("left");
                else setDx(0);
              } : undefined}
            >
              {isTop && dx !== 0 && (
                <span
                  className={`absolute top-4 rounded-md border-2 px-2 py-1 text-sm font-black uppercase ${dx > 0 ? "left-4 border-green-600 text-green-600" : "right-4 border-brand text-brand"}`}
                  style={{ opacity: Math.min(Math.abs(dx) / 120, 1) }}
                >
                  {dx > 0 ? rightLabel : leftLabel}
                </span>
              )}
              <DeckContext.Provider value={{ drop }}>{render(item)}</DeckContext.Provider>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-center text-sm text-brand">{error}</p>}
      <div className="mt-5 flex justify-center gap-6">
        <button aria-label={leftLabel} onClick={() => swipe("left")} className="btn-ghost h-14 w-14 !rounded-full !p-0 text-2xl">✕</button>
        <button aria-label={rightLabel} onClick={() => swipe("right")} className="btn-primary h-14 w-14 !rounded-full !p-0 text-2xl">♥</button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">Drag the card, or use ← and → keys</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DeckApi = { drop: (predicate: (item: any) => boolean) => void };
const DeckContext = createContext<DeckApi>({ drop: () => {} });
export function useDeck<T>() {
  return useContext(DeckContext) as unknown as { drop: (predicate: (item: T) => boolean) => void };
}
