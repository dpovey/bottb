export function EventCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden bg-bg-elevated aspect-[4/3] animate-pulse">
      <div className="w-full h-full bg-bg-muted" />
    </div>
  );
}

export function PhotoStripSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden px-2 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 shrink-0 rounded-lg bg-bg animate-pulse"
        />
      ))}
    </div>
  );
}

export function VideoStripSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-bg-elevated rounded animate-pulse" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-[280px] sm:w-[320px] shrink-0 rounded-lg bg-bg-elevated animate-pulse"
            style={{ aspectRatio: "16/9" }}
          />
        ))}
      </div>
    </>
  );
}

export function CompanyLogoMarqueeSkeleton() {
  return (
    <div className="flex items-center gap-16 py-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-12 w-32 bg-bg-elevated rounded animate-pulse shrink-0"
        />
      ))}
    </div>
  );
}

