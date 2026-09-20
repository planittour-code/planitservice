import { useState } from "react";
import { RecordSection } from "@/components/house-panels";
import { CATEGORY_PHOTO } from "@/lib/housefile/fields";
import { MEASURE_GUIDES, type MeasureGuide } from "@/lib/housefile/measure";
import { cn } from "@/lib/utils";

export function MeasureGuidePanel({
  audience = "both",
}: {
  audience?: "manager" | "homeowner" | "both";
}) {
  const [openId, setOpenId] = useState(MEASURE_GUIDES[0]!.id);
  const guide = MEASURE_GUIDES.find((g) => g.id === openId) ?? MEASURE_GUIDES[0]!;
  const blurb =
    audience === "manager"
      ? "Walk the house once. Put these numbers on the record before you invite a shop — they price from what is already known."
      : audience === "homeowner"
        ? "You can take these yourself. A tape, photos, and what is already on this record are enough for a first estimate."
        : "Property managers and homeowners can take these without a shop on site. Put them on the record, then ask for numbers.";

  return (
    <RecordSection
      title="How to take your own measurements"
      blurb={blurb}
      photo={CATEGORY_PHOTO.house}
      countLabel={`${MEASURE_GUIDES.length} trades`}
      chips={
        <ul className="flex flex-wrap gap-1.5">
          {MEASURE_GUIDES.map((g) => (
            <li key={g.id}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5 text-xs font-semibold">
                <img src={g.photo} alt="" className="size-6 rounded-full object-cover" />
                {g.chip}
              </span>
            </li>
          ))}
        </ul>
      }
    >
      <div className="flex flex-wrap gap-2">
        {MEASURE_GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setOpenId(g.id)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs shadow-[var(--shadow-border)]",
              openId === g.id
                ? "bg-secondary text-secondary-foreground"
                : "bg-background hover:shadow-[var(--shadow-border-hover)]",
            )}
          >
            <img src={g.photo} alt="" className="size-6 rounded-full object-cover" />
            {g.name}
          </button>
        ))}
      </div>
      <MeasureGuideBody guide={guide} />
    </RecordSection>
  );
}

export function MeasureGuideBody({ guide }: { guide: MeasureGuide }) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl bg-background shadow-[var(--shadow-border)]">
        <img src={guide.photo} alt="" className="aspect-[16/7] w-full object-cover" />
        <div className="space-y-2 p-4">
          <p className="font-display text-xl font-medium tracking-tight">{guide.name}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{guide.what}</p>
          <p className="text-sm">
            <span className="font-medium">What you need. </span>
            <span className="text-muted-foreground">{guide.tools}</span>
          </p>
        </div>
      </div>
      <ol className="space-y-3">
        {guide.steps.map((step, i) => (
          <li key={step.title} className="rounded-xl bg-background p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Step {i + 1}
            </p>
            <p className="mt-1 font-medium">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm leading-relaxed text-muted-foreground">{guide.tip}</p>
    </div>
  );
}
