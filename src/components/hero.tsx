"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface HeroFocalPoint {
  x: number; // 0-100 percentage from left
  y: number; // 0-100 percentage from top
}

export interface HeroProps {
  /** Hero title */
  title: string;
  /** Subtitle or tagline */
  subtitle?: string;
  /** Background image URL (or placeholder gradient if not provided) */
  backgroundImage?: string;
  /** Focal point for image positioning (0-100 for both x and y) */
  focalPoint?: HeroFocalPoint;
  /** CTA buttons */
  actions?: {
    label: string;
    href: string;
    variant?: "outline" | "filled" | "accent";
  }[];
  /** Height variant */
  size?: "sm" | "md" | "lg" | "full";
  /** Overlay intensity */
  overlay?: "light" | "medium" | "heavy";
  /** Additional children (e.g., badges, stats) */
  children?: React.ReactNode;
  className?: string;
}

export function Hero({
  title,
  subtitle,
  backgroundImage,
  focalPoint = { x: 50, y: 50 },
  actions,
  size = "lg",
  overlay = "heavy",
  children,
  className,
}: HeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden flex items-center justify-center",
        {
          "min-h-[40vh]": size === "sm",
          "min-h-[60vh]": size === "md",
          "min-h-[80vh]": size === "lg",
          "min-h-screen": size === "full",
        },
        className
      )}
    >
      {/* Background */}
      {backgroundImage ? (
        <Image
          src={backgroundImage}
          alt=""
          fill
          className="object-cover"
          style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
          priority
          unoptimized={backgroundImage.startsWith("http")}
        />
      ) : (
        // Gradient fallback
        <div className="absolute inset-0 bg-gradient-to-br from-bg via-bg-surface to-bg" />
      )}

      {/* Overlay */}
      <div
        className={cn("absolute inset-0", {
          "bg-bg/40": overlay === "light",
          "bg-bg/60": overlay === "medium",
          "bg-bg/80": overlay === "heavy",
        })}
      />

      {/* Gradient overlay at bottom for smooth transition */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white mb-6 tracking-tight">
          {title}
        </h1>

        {subtitle && (
          <p className="text-lg sm:text-xl text-text-muted mb-8 max-w-2xl mx-auto">
            {subtitle}
          </p>
        )}

        {actions && actions.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            {actions.map((action, index) => (
              <Link key={index} href={action.href}>
                <Button variant={action.variant || "outline"} size="lg">
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        )}

        {children}
      </div>
    </section>
  );
}

// Simpler variant for page headers (not full hero)
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("py-12 lg:py-16 border-b border-white/5", className)}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white mb-4">
          {title}
        </h1>
        {subtitle && (
          <p className="text-lg text-text-muted max-w-2xl">{subtitle}</p>
        )}
        {children}
      </div>
    </div>
  );
}

