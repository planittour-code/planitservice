import { PROFILE_HAT_LABEL, type ProfileHat } from "@/lib/housefile/profile";

export function ProfileHatBadges({ hats }: { hats: ProfileHat[] }) {
  if (!hats.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {hats.map((hat) => (
        <li
          key={hat}
          className="inline-flex min-h-7 items-center rounded-full bg-secondary px-2.5 text-xs font-semibold tracking-wide text-secondary-foreground uppercase"
        >
          {PROFILE_HAT_LABEL[hat]}
        </li>
      ))}
    </ul>
  );
}
