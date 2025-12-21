'use client'

import {
  // Social
  LinkedInIcon,
  FacebookIcon,
  InstagramIcon,
  YouTubeIcon,
  TikTokIcon,
  TwitterIcon,
  // UI
  CloseIcon,
  MenuIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckIcon,
  SpinnerIcon,
  PlusIcon,
  ExternalLinkIcon,
  DownloadIcon,
  InfoIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  MaximizeIcon,
  FilterIcon,
  GridIcon,
  ZoomInIcon,
  ZoomOutIcon,
  // Admin
  CalendarIcon,
  VideoIcon,
  PhotoIcon,
  ShareIcon,
  HomeIcon,
  LogoutIcon,
  SettingsIcon,
  EditIcon,
  DeleteIcon,
  // Misc
  EmailIcon,
  BuildingIcon,
  UsersIcon,
  MusicNoteIcon,
  CameraIcon,
  PlayCircleIcon,
  RandomIcon,
  SadFaceIcon,
  LightningIcon,
  CropIcon,
  PlayIcon,
  PauseIcon,
  MapPinIcon,
  ClockIcon,
  TicketIcon,
  LinkIcon,
  StarIcon,
  WarningIcon,
  GlobeIcon,
  HeartIcon,
} from '@/components/icons'
import { ComponentType, SVGProps } from 'react'

interface IconInfo {
  name: string
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
  hoverClass?: string
}

const SOCIAL_ICONS: IconInfo[] = [
  { name: 'LinkedInIcon', icon: LinkedInIcon },
  { name: 'YouTubeIcon', icon: YouTubeIcon },
  { name: 'InstagramIcon', icon: InstagramIcon },
  { name: 'FacebookIcon', icon: FacebookIcon },
  { name: 'TikTokIcon', icon: TikTokIcon },
  { name: 'TwitterIcon', icon: TwitterIcon },
]

const UI_ICONS: IconInfo[] = [
  { name: 'CloseIcon', icon: CloseIcon },
  { name: 'MenuIcon', icon: MenuIcon },
  { name: 'SearchIcon', icon: SearchIcon },
  { name: 'ChevronLeftIcon', icon: ChevronLeftIcon },
  { name: 'ChevronRightIcon', icon: ChevronRightIcon },
  { name: 'ChevronDownIcon', icon: ChevronDownIcon },
  { name: 'CheckIcon', icon: CheckIcon },
  { name: 'PlusIcon', icon: PlusIcon },
  { name: 'DownloadIcon', icon: DownloadIcon },
  { name: 'ExternalLinkIcon', icon: ExternalLinkIcon },
  { name: 'InfoIcon', icon: InfoIcon },
  { name: 'FilterIcon', icon: FilterIcon },
  { name: 'ArrowLeftIcon', icon: ArrowLeftIcon },
  { name: 'ArrowRightIcon', icon: ArrowRightIcon },
  { name: 'MaximizeIcon', icon: MaximizeIcon },
  { name: 'GridIcon', icon: GridIcon },
  { name: 'ZoomInIcon', icon: ZoomInIcon },
  { name: 'ZoomOutIcon', icon: ZoomOutIcon },
  { name: 'SpinnerIcon', icon: SpinnerIcon },
]

const ADMIN_ICONS: IconInfo[] = [
  { name: 'HomeIcon', icon: HomeIcon },
  { name: 'CalendarIcon', icon: CalendarIcon },
  { name: 'PhotoIcon', icon: PhotoIcon },
  { name: 'VideoIcon', icon: VideoIcon },
  { name: 'ShareIcon', icon: ShareIcon },
  { name: 'SettingsIcon', icon: SettingsIcon },
  { name: 'EditIcon', icon: EditIcon },
  {
    name: 'DeleteIcon',
    icon: DeleteIcon,
    hoverClass: 'group-hover:text-error',
  },
  { name: 'LogoutIcon', icon: LogoutIcon },
]

const MISC_ICONS: IconInfo[] = [
  { name: 'EmailIcon', icon: EmailIcon },
  { name: 'BuildingIcon', icon: BuildingIcon },
  { name: 'UsersIcon', icon: UsersIcon },
  { name: 'MusicNoteIcon', icon: MusicNoteIcon },
  { name: 'CameraIcon', icon: CameraIcon },
  { name: 'MapPinIcon', icon: MapPinIcon },
  { name: 'GlobeIcon', icon: GlobeIcon },
  { name: 'HeartIcon', icon: HeartIcon, hoverClass: 'group-hover:text-error' },
  { name: 'StarIcon', icon: StarIcon, hoverClass: 'group-hover:text-warning' },
  { name: 'PlayIcon', icon: PlayIcon },
  { name: 'PauseIcon', icon: PauseIcon },
  { name: 'ClockIcon', icon: ClockIcon },
  { name: 'TicketIcon', icon: TicketIcon },
  { name: 'LinkIcon', icon: LinkIcon },
  {
    name: 'WarningIcon',
    icon: WarningIcon,
    hoverClass: 'group-hover:text-warning',
  },
  {
    name: 'LightningIcon',
    icon: LightningIcon,
    hoverClass: 'group-hover:text-accent',
  },
  { name: 'CropIcon', icon: CropIcon },
  { name: 'RandomIcon', icon: RandomIcon },
  { name: 'SadFaceIcon', icon: SadFaceIcon },
  { name: 'PlayCircleIcon', icon: PlayCircleIcon },
]

function IconGrid({
  icons,
  columns = 'grid-cols-3 sm:grid-cols-6',
}: {
  icons: IconInfo[]
  columns?: string
}) {
  return (
    <div className={`grid ${columns} gap-4`}>
      {icons.map(({ name, icon: Icon, hoverClass }) => (
        <div
          key={name}
          className="flex flex-col items-center gap-2 p-4 rounded-lg bg-bg border border-white/5 hover:border-white/10 transition-colors group"
        >
          <Icon
            className={`w-6 h-6 text-text-muted ${hoverClass || 'group-hover:text-white'} transition-colors`}
          />
          <span className="text-[10px] text-text-dim text-center">
            {name.replace('Icon', '')}
          </span>
        </div>
      ))}
    </div>
  )
}

export function IconsSection() {
  return (
    <div className="space-y-20">
      {/* Icon Gallery */}
      <section id="icon-gallery">
        <h2 className="font-semibold text-4xl mb-8">Icon Gallery</h2>
        <p className="text-text-muted text-lg mb-8 max-w-3xl">
          Shared icon components from{' '}
          <code className="bg-bg-elevated px-2 py-1 rounded-sm text-sm">
            src/components/icons/
          </code>
          . All icons extend{' '}
          <code className="bg-bg-elevated px-2 py-1 rounded-sm text-sm">
            SVGProps
          </code>{' '}
          with a{' '}
          <code className="bg-bg-elevated px-2 py-1 rounded-sm text-sm">
            size
          </code>{' '}
          prop for easy customization.
        </p>

        <div className="space-y-8">
          {/* API Usage */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              React Component API
            </h3>
            <pre className="bg-bg rounded-lg p-4 text-sm overflow-x-auto">
              <code className="text-text-dim">{`import { SearchIcon, CloseIcon, HeartIcon } from "@/components/icons";

// Basic usage
<SearchIcon />

// With size
<SearchIcon size={24} />

// With className (Tailwind)
<SearchIcon className="w-5 h-5 text-accent" />

// All SVG props are supported
<SearchIcon stroke="red" strokeWidth={3} className="hover:text-white" />`}</code>
            </pre>
          </div>

          {/* Social Platform Icons */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Social Platform Icons
            </h3>
            <p className="text-text-dim text-sm mb-6">
              Brand icons for social media platforms. Uses{' '}
              <code className="text-accent">fill=&quot;currentColor&quot;</code>
              .
            </p>
            <IconGrid icons={SOCIAL_ICONS} />
          </div>

          {/* UI Action Icons */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              UI Action Icons
            </h3>
            <p className="text-text-dim text-sm mb-6">
              Common UI actions and navigation. Uses{' '}
              <code className="text-accent">
                stroke=&quot;currentColor&quot;
              </code>
              .
            </p>
            <IconGrid
              icons={UI_ICONS}
              columns="grid-cols-4 sm:grid-cols-6 lg:grid-cols-10"
            />
          </div>

          {/* Admin/Dashboard Icons */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Admin/Dashboard Icons
            </h3>
            <p className="text-text-dim text-sm mb-6">
              Icons for admin interfaces and dashboards.
            </p>
            <IconGrid
              icons={ADMIN_ICONS}
              columns="grid-cols-3 sm:grid-cols-6 lg:grid-cols-9"
            />
          </div>

          {/* Misc Icons */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Misc Icons
            </h3>
            <p className="text-text-dim text-sm mb-6">
              Miscellaneous icons for various use cases.
            </p>
            <IconGrid
              icons={MISC_ICONS}
              columns="grid-cols-4 sm:grid-cols-6 lg:grid-cols-10"
            />
          </div>

          {/* File Structure */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              File Structure
            </h3>
            <pre className="bg-bg rounded-lg p-4 text-sm overflow-x-auto">
              <code className="text-text-dim">{`src/components/icons/
├── index.ts           # Exports all icons
├── types.ts           # IconProps interface
├── social/            # Social platform icons (LinkedIn, YouTube, etc.)
├── ui/                # UI action icons (Close, Search, Chevrons, etc.)
├── admin/             # Admin/dashboard icons (Home, Settings, Edit, etc.)
└── misc/              # Misc icons (Email, Building, Heart, etc.)`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Icon Sizes */}
      <section id="icon-sizes">
        <h2 className="font-semibold text-4xl mb-8">Icon Sizes</h2>

        <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
          <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
            Size Examples
          </h3>
          <div className="flex flex-wrap items-end gap-8">
            <div className="text-center">
              <SearchIcon className="w-4 h-4 text-text-muted mx-auto" />
              <p className="text-xs text-text-dim mt-2">16px</p>
              <code className="text-[10px] text-accent">w-4 h-4</code>
            </div>
            <div className="text-center">
              <SearchIcon className="w-5 h-5 text-text-muted mx-auto" />
              <p className="text-xs text-text-dim mt-2">20px</p>
              <code className="text-[10px] text-accent">w-5 h-5</code>
            </div>
            <div className="text-center">
              <SearchIcon className="w-6 h-6 text-text-muted mx-auto" />
              <p className="text-xs text-text-dim mt-2">24px</p>
              <code className="text-[10px] text-accent">w-6 h-6</code>
            </div>
            <div className="text-center">
              <SearchIcon className="w-8 h-8 text-text-muted mx-auto" />
              <p className="text-xs text-text-dim mt-2">32px</p>
              <code className="text-[10px] text-accent">w-8 h-8</code>
            </div>
            <div className="text-center">
              <SearchIcon className="w-10 h-10 text-text-muted mx-auto" />
              <p className="text-xs text-text-dim mt-2">40px</p>
              <code className="text-[10px] text-accent">w-10 h-10</code>
            </div>
            <div className="text-center">
              <SearchIcon className="w-12 h-12 text-text-muted mx-auto" />
              <p className="text-xs text-text-dim mt-2">48px</p>
              <code className="text-[10px] text-accent">w-12 h-12</code>
            </div>
          </div>
        </div>
      </section>

      {/* Icon Colors */}
      <section id="icon-colors">
        <h2 className="font-semibold text-4xl mb-8">Icon Colors</h2>

        <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
          <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
            Color Variants
          </h3>
          <div className="flex flex-wrap items-center gap-8">
            <div className="text-center">
              <HeartIcon className="w-8 h-8 text-white mx-auto" />
              <p className="text-xs text-text-dim mt-2">Default</p>
            </div>
            <div className="text-center">
              <HeartIcon className="w-8 h-8 text-text-muted mx-auto" />
              <p className="text-xs text-text-dim mt-2">Muted</p>
            </div>
            <div className="text-center">
              <HeartIcon className="w-8 h-8 text-text-dim mx-auto" />
              <p className="text-xs text-text-dim mt-2">Dim</p>
            </div>
            <div className="text-center">
              <HeartIcon className="w-8 h-8 text-accent mx-auto" />
              <p className="text-xs text-text-dim mt-2">Accent</p>
            </div>
            <div className="text-center">
              <HeartIcon className="w-8 h-8 text-error mx-auto" />
              <p className="text-xs text-text-dim mt-2">Error</p>
            </div>
            <div className="text-center">
              <HeartIcon className="w-8 h-8 text-success mx-auto" />
              <p className="text-xs text-text-dim mt-2">Success</p>
            </div>
            <div className="text-center">
              <HeartIcon className="w-8 h-8 text-warning mx-auto" />
              <p className="text-xs text-text-dim mt-2">Warning</p>
            </div>
            <div className="text-center">
              <HeartIcon className="w-8 h-8 text-info mx-auto" />
              <p className="text-xs text-text-dim mt-2">Info</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
