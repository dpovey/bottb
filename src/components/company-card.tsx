import Link from "next/link";
import Image from "next/image";
import { Card, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

interface CompanyCardProps {
  company: {
    slug: string;
    name: string;
    logo_url?: string | null;
    website?: string | null;
    band_count: number;
    event_count: number;
  };
  /** Whether this company is currently selected/highlighted */
  selected?: boolean;
}

/**
 * Card component for displaying a company with participation stats
 * Used on the Companies listing page
 */
export function CompanyCard({ company, selected = false }: CompanyCardProps) {
  return (
    <Link href={`/companies?company=${company.slug}`}>
      <Card
        variant="interactive"
        padding="none"
        className={cn(
          "overflow-hidden h-full",
          selected && "border-accent/30 bg-accent/5"
        )}
      >
        <div className="p-6">
          {/* Logo and Name */}
          <div className="flex items-start gap-4 mb-4">
            {company.logo_url ? (
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0">
                <Image
                  src={company.logo_url}
                  alt={`${company.name} logo`}
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <svg
                  className="w-6 h-6 text-text-dim"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">
                {company.name}
              </h3>
              {company.website && (
                <p className="text-text-dim text-xs truncate mt-0.5">
                  {company.website.replace(/^https?:\/\//, "")}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-white/5">
                {company.event_count} event{company.event_count !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-white/5">
                {company.band_count} band{company.band_count !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </div>

        {/* Action hint */}
        <div className="px-6 py-3 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-text-dim text-xs tracking-wider uppercase">
              View bands & photos
            </span>
            <svg
              className="w-4 h-4 text-text-dim"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </Card>
    </Link>
  );
}

