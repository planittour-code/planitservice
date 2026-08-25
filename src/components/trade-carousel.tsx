import { useNavigate } from "@tanstack/react-router";
import {
  AppWindow,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Droplets,
  Fence,
  House,
  Layers,
  PaintRoller,
  type LucideIcon,
} from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { WORK_TYPES } from "@/lib/housefile/quote";
import { cn } from "@/lib/utils";

const TRADE_FACE: Record<string, { icon: LucideIcon; surface: string }> = {
  paint: { icon: PaintRoller, surface: "bg-trade-paint text-primary-foreground" },
  roof: { icon: House, surface: "bg-trade-roof text-primary-foreground" },
  windows: { icon: AppWindow, surface: "bg-trade-windows text-primary-foreground" },
  gutters: { icon: Droplets, surface: "bg-trade-gutters text-primary-foreground" },
  siding: { icon: Layers, surface: "bg-trade-siding text-primary-foreground" },
  deck: { icon: Fence, surface: "bg-trade-deck text-primary-foreground" },
  porch: { icon: Columns2, surface: "bg-trade-porch text-primary-foreground" },
};

export function TradeCarousel() {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);

  function scroll(dir: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector("[data-card]");
    const step = card instanceof HTMLElement ? card.offsetWidth + 16 : 280;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <section className="border-t border-border overflow-x-hidden">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex items-end justify-between gap-3">
          <p className="font-display text-2xl font-medium tracking-tight">Estimating Made Easy</p>
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="icon" aria-label="Previous trades" onClick={() => scroll(-1)}>
              <ChevronLeft />
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label="Next trades" onClick={() => scroll(1)}>
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div
          ref={scroller}
          className="mt-6 -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {WORK_TYPES.map((work) => {
            const face = TRADE_FACE[work.id] ?? TRADE_FACE.paint;
            const Icon = face.icon;
            return (
              <button
                key={work.id}
                type="button"
                data-card
                onClick={() => void navigate({ to: "/app/new", search: { work: work.id } })}
                className={cn(
                  "w-[min(18rem,80vw)] shrink-0 snap-start rounded-xl p-5 text-left",
                  "transition-opacity duration-150 hover:opacity-95",
                  face.surface,
                )}
              >
                <Icon className="size-8" aria-hidden />
                <p className="mt-4 font-display text-2xl font-medium">{work.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">{work.blurb}</p>
                <p className="mt-4 text-sm font-medium">Quote {work.name}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
