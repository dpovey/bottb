import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicLayout } from '@/components/layouts'
import { PhotoStrip } from '@/components/photos/photo-strip'
import {
  SocialIconLink,
  HeroBackground,
  photosToHeroImages,
} from '@/components/ui'
import Image from 'next/image'
import {
  InstagramIcon,
  GlobeIcon,
  EmailIcon,
  CameraIcon,
  MapPinIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
} from '@/components/icons'
import {
  getPhotographerBySlug,
  getPhotographerRandomPhoto,
  getPhotosByLabel,
  PHOTO_LABELS,
} from '@/lib/db'
import { getBaseUrl } from '@/lib/seo'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const photographer = await getPhotographerBySlug(slug)

  if (!photographer) {
    return {
      title: 'Photographer Not Found | Battle of the Tech Bands',
    }
  }

  const baseUrl = getBaseUrl()

  return {
    title: `${photographer.name} | Photographers | Battle of the Tech Bands`,
    description:
      photographer.bio ||
      `View photos by ${photographer.name} from Battle of the Tech Bands events.`,
    alternates: {
      canonical: `${baseUrl}/photographer/${slug}`,
    },
    openGraph: {
      title: `${photographer.name} | Battle of the Tech Bands`,
      description:
        photographer.bio ||
        `View photos by ${photographer.name} from Battle of the Tech Bands events.`,
      type: 'profile',
    },
  }
}

export default async function PhotographerPage({ params }: Props) {
  const { slug } = await params
  const photographer = await getPhotographerBySlug(slug)

  if (!photographer) {
    notFound()
  }

  // Get hero photos - try labeled heroes first, fall back to random photo
  const heroPhotos = await getPhotosByLabel(PHOTO_LABELS.PHOTOGRAPHER_HERO, {
    photographerName: photographer.name,
  })

  // If no labeled heroes, fall back to a single random photo
  let heroImages = heroPhotos.length > 0 ? photosToHeroImages(heroPhotos) : null
  if (!heroImages) {
    const randomPhoto = await getPhotographerRandomPhoto(photographer.name)
    if (randomPhoto) {
      heroImages = photosToHeroImages([randomPhoto])
    }
  }

  return (
    <PublicLayout
      headerVariant="transparent"
      footerVariant="full"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Photographers', href: '/photographers' },
        { label: photographer.name },
      ]}
    >
      {/* Hero Section - supports multiple photographer hero photos */}
      <section className="relative min-h-[70vh] flex items-end">
        {/* Background Image(s) - crossfades if multiple */}
        <HeroBackground
          photos={heroImages || []}
          alt={`Photo by ${photographer.name}`}
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/60 to-transparent" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pb-16 pt-32">
          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Photographer Avatar */}
            <div className="w-24 h-24 rounded-full bg-bg-elevated border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              {photographer.avatar_url ? (
                <Image
                  src={photographer.avatar_url}
                  alt={photographer.name}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                  sizes="96px"
                />
              ) : (
                <CameraIcon className="w-12 h-12 text-accent" />
              )}
            </div>

            {/* Photographer Info */}
            <div className="flex-1">
              {/* Name */}
              <h1 className="font-semibold text-4xl sm:text-5xl md:text-6xl mb-3">
                {photographer.name}
              </h1>

              {/* Location */}
              {photographer.location && (
                <p className="text-text-muted text-lg mb-6 flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5" />
                  {photographer.location}
                </p>
              )}

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-3xl font-bold text-accent">
                    {photographer.photo_count}
                  </div>
                  <div className="text-xs tracking-widest uppercase text-text-dim">
                    Photos
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bio Section */}
      {photographer.bio && (
        <section className="py-12 bg-bg border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <p className="text-text-muted text-lg max-w-3xl leading-relaxed">
              {photographer.bio}
            </p>
          </div>
        </section>
      )}

      {/* Photos Section */}
      <PhotoStrip
        photographer={photographer.name}
        title="Gallery"
        viewAllLink={`/photos?photographer=${encodeURIComponent(photographer.name)}`}
        className="bg-bg"
      />

      {/* Contact & Links Section */}
      <section className="py-16 bg-bg">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Social Links */}
            <div className="flex flex-wrap gap-3">
              {photographer.instagram && (
                <SocialIconLink
                  href={photographer.instagram}
                  platform="instagram"
                  label="Instagram"
                  location="photographer_page"
                  className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <InstagramIcon size={20} />
                  Instagram
                </SocialIconLink>
              )}
              {photographer.website && (
                <SocialIconLink
                  href={photographer.website}
                  platform="website"
                  label="Website"
                  location="photographer_page"
                  className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <GlobeIcon className="w-5 h-5" />
                  Website
                </SocialIconLink>
              )}
              {photographer.email && (
                <SocialIconLink
                  href={`mailto:${photographer.email}`}
                  platform="email"
                  label="Contact"
                  location="photographer_page"
                  className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <EmailIcon className="w-5 h-5" />
                  Contact
                </SocialIconLink>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              <Link
                href="/photographers"
                className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-6 py-3 rounded-full text-sm tracking-widest uppercase flex items-center gap-2 transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                All Photographers
              </Link>
              <Link
                href={`/photos?photographer=${encodeURIComponent(photographer.name)}`}
                className="bg-accent hover:bg-accent-light text-white px-6 py-3 rounded-full text-sm tracking-widest uppercase flex items-center gap-2 transition-colors"
              >
                All Photos
                <ChevronRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
