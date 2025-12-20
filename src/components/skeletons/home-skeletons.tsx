import { Skeleton } from "@/components/ui";

export function EventCardSkeleton() {
  return (
    <Skeleton className="aspect-[4/3] rounded-lg" />
  );
}

export function PhotoStripSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden px-2 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton
          key={i}
          className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 shrink-0"
        />
      ))}
    </div>
  );
}

export function VideoStripSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="w-[280px] sm:w-[320px] shrink-0 aspect-video"
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
        <Skeleton
          key={i}
          className="h-12 w-32 shrink-0"
        />
      ))}
    </div>
  );
}
