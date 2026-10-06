export function ProductPreview({
  kicker = "Sample Property Record",
  title = "142 Maple Street",
  place = "Marietta, GA · labeled sample",
}: {
  kicker?: string;
  title?: string;
  place?: string;
}) {
  return (
    <aside className="overflow-hidden rounded-xl bg-card text-foreground shadow-[var(--shadow-border)]">
      <img
        src="/houses/maple-front.jpg"
        alt="Sample craftsman bungalow used as a Property Record preview"
        className="aspect-[16/9] w-full object-cover"
      />
      <div className="space-y-4 p-5">
        <div>
          <p className="text-sm tracking-wide text-muted-foreground uppercase">{kicker}</p>
          <p className="font-display text-xl font-semibold tracking-tight">{title}</p>
          <p className="text-sm text-muted-foreground">{place}</p>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between gap-3">
            <span>Architectural shingle reroof</span>
            <span className="text-muted-foreground">2019</span>
          </li>
          <li className="flex justify-between gap-3">
            <span>Exterior — SW 7008 Alabaster</span>
            <span className="text-muted-foreground">2023</span>
          </li>
          <li className="flex justify-between gap-3">
            <span>Roll Lock Gutter Guards</span>
            <span className="text-muted-foreground">Lifetime</span>
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Known shop on file. Next visit already has the product, color, and warranty.
        </p>
      </div>
    </aside>
  );
}
