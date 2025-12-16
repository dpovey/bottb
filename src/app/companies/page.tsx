"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PublicLayout } from "@/components/layouts";
import { CompanyCard } from "@/components/company-card";
import { Card, Button, BandThumbnail } from "@/components/ui";

interface Company {
  slug: string;
  name: string;
  logo_url?: string | null;
  icon_url?: string | null;
  website?: string | null;
  band_count: number;
  event_count: number;
}

interface Band {
  id: string;
  name: string;
  event_id: string;
  event_name: string;
  event_date: string;
  hero_thumbnail_url?: string;
  company_slug?: string;
  info?: {
    logo_url?: string;
  };
}

// Inner component that uses useSearchParams
function CompaniesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedCompanySlug = searchParams.get("company");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyBands, setCompanyBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBands, setLoadingBands] = useState(false);

  // Fetch all companies on mount
  useEffect(() => {
    async function fetchCompanies() {
      try {
        const res = await fetch("/api/companies");
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
        }
      } catch (error) {
        console.error("Failed to fetch companies:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCompanies();
  }, []);

  // Fetch selected company details when slug changes
  useEffect(() => {
    if (!selectedCompanySlug) {
      setSelectedCompany(null);
      setCompanyBands([]);
      return;
    }

    async function fetchCompanyDetails() {
      setLoadingBands(true);
      try {
        const res = await fetch(`/api/companies?slug=${selectedCompanySlug}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedCompany(data.company);
          setCompanyBands(data.bands || []);
        }
      } catch (error) {
        console.error("Failed to fetch company details:", error);
      } finally {
        setLoadingBands(false);
      }
    }
    fetchCompanyDetails();
  }, [selectedCompanySlug]);

  const clearSelection = () => {
    router.push("/companies");
  };

  // Group bands by event for display
  const bandsByEvent = companyBands.reduce(
    (acc, band) => {
      if (!acc[band.event_id]) {
        acc[band.event_id] = {
          event_id: band.event_id,
          event_name: band.event_name,
          event_date: band.event_date,
          bands: [],
        };
      }
      acc[band.event_id].bands.push(band);
      return acc;
    },
    {} as Record<string, { event_id: string; event_name: string; event_date: string; bands: Band[] }>
  );

  // Sort events by date descending
  const sortedEvents = Object.values(bandsByEvent).sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );

  return (
    <PublicLayout
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Companies" },
        ...(selectedCompany ? [{ label: selectedCompany.name }] : []),
      ]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            {selectedCompany ? (
              /* Selected company - show logo or name */
              selectedCompany.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={selectedCompany.logo_url}
                  alt={selectedCompany.name}
                  className="h-16 max-w-xs object-contain"
                />
              ) : (
                <h1 className="font-semibold text-4xl">
                  {selectedCompany.name}
                </h1>
              )
            ) : (
              <>
                <h1 className="font-semibold text-4xl mb-2">Companies</h1>
                <p className="text-text-muted">
                  {companies.length} compan{companies.length !== 1 ? "ies" : "y"} have
                  participated in Battle of the Tech Bands
                </p>
              </>
            )}
          </div>
          {selectedCompany && (
            <div className="flex gap-3">
              <Link href={`/photos?company=${selectedCompanySlug}`}>
                <Button variant="outline" size="sm">
                  View Photos
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                ← All Companies
              </Button>
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-text-muted">Loading companies...</div>
          </div>
        ) : selectedCompany ? (
          /* Selected Company View */
          <div>
            {loadingBands ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-text-muted">Loading bands...</div>
              </div>
            ) : sortedEvents.length === 0 ? (
              <Card variant="elevated" className="text-center py-12">
                <p className="text-text-muted">
                  No bands found for this company.
                </p>
              </Card>
            ) : (
              <div className="space-y-8">
                {sortedEvents.map((eventGroup) => (
                  <div key={eventGroup.event_id}>
                    {/* Event Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <Link
                          href={`/event/${eventGroup.event_id}`}
                          className="text-xl font-semibold text-white hover:text-accent transition-colors"
                        >
                          {eventGroup.event_name}
                        </Link>
                        <p className="text-text-dim text-sm">
                          {new Date(eventGroup.event_date).toLocaleDateString("en-AU", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <Link href={`/event/${eventGroup.event_id}`}>
                        <Button variant="outline" size="sm">
                          View Event
                        </Button>
                      </Link>
                    </div>

                    {/* Bands Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {eventGroup.bands.map((band) => (
                        <Link key={band.id} href={`/band/${band.id}`}>
                          <Card variant="interactive" padding="none" className="overflow-hidden">
                            <div className="p-4 flex items-center gap-4">
                              {/* Band Logo/Image */}
                              <BandThumbnail
                                logoUrl={band.info?.logo_url}
                                heroThumbnailUrl={band.hero_thumbnail_url}
                                bandName={band.name}
                                size="sm"
                              />

                              {/* Band Info */}
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-semibold truncate">
                                  {band.name}
                                </h3>
                                <p className="text-text-dim text-sm">View band details →</p>
                              </div>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Companies Grid */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <CompanyCard key={company.slug} company={company} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !selectedCompany && companies.length === 0 && (
          <Card variant="elevated" className="text-center py-12">
            <p className="text-text-muted">
              No companies found. Companies are populated from band registrations.
            </p>
          </Card>
        )}
      </main>
    </PublicLayout>
  );
}

// Loading fallback for Suspense
function CompaniesLoading() {
  return (
    <PublicLayout
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Companies" },
      ]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-semibold text-4xl mb-2">Companies</h1>
            <p className="text-text-muted">Loading...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-text-muted">Loading companies...</div>
        </div>
      </main>
    </PublicLayout>
  );
}

// Main page component wraps content in Suspense for useSearchParams
export default function CompaniesPage() {
  return (
    <Suspense fallback={<CompaniesLoading />}>
      <CompaniesContent />
    </Suspense>
  );
}

