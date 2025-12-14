"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { AdminBanner } from "@/components/admin-banner";
import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";

export interface HeaderProps {
  /** Show main navigation links */
  showNav?: boolean;
  /** Optional breadcrumbs to display */
  breadcrumbs?: BreadcrumbItem[];
  /** Background style */
  variant?: "transparent" | "glass" | "solid";
  /** Show admin banner (if user is admin) */
  showAdminBanner?: boolean;
  /** Make header fixed/sticky */
  fixed?: boolean;
}

const navLinks = [
  { href: "/", label: "Events" },
  { href: "/photos", label: "Photos" },
  { href: "/about", label: "About" },
];

export function Header({
  showNav = true,
  breadcrumbs,
  variant = "glass",
  showAdminBanner = true,
  fixed = true,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Admin Banner */}
      {showAdminBanner && <AdminBanner />}
      
      {/* Main Header */}
      <header
        className={cn(
          "z-50 transition-colors duration-300",
          {
            "fixed top-0 left-0 right-0": fixed,
            "relative": !fixed,
          },
          {
            "bg-transparent": variant === "transparent",
            "bg-bg/80 backdrop-blur-lg border-b border-white/5": variant === "glass",
            "bg-bg border-b border-white/5": variant === "solid",
          }
        )}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center shrink-0">
              {/* Square logo for mobile */}
              <Image
                src="/images/logos/bottb-dark-square.png"
                alt="BOTTB"
                width={40}
                height={40}
                className="h-10 w-auto sm:hidden transition-transform duration-200 hover:scale-105"
              />
              {/* Horizontal logo for desktop */}
              <Image
                src="/images/logos/bottb-horizontal.png"
                alt="Battle of the Tech Bands"
                width={160}
                height={40}
                className="h-10 w-auto hidden sm:block transition-transform duration-200 hover:scale-105"
              />
            </Link>
            
            {/* Desktop Navigation (centered) */}
            {showNav && (
              <nav className="hidden md:flex items-center justify-center gap-8 flex-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm tracking-widest uppercase text-text-muted hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}
            
            {/* Breadcrumbs (right side on desktop) */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className="hidden md:block shrink-0">
                <Breadcrumbs items={breadcrumbs} />
              </div>
            )}
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden ml-auto text-text-muted hover:text-white transition-colors p-2"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {mobileMenuOpen && showNav && (
          <div className="md:hidden bg-bg-elevated border-t border-white/5">
            <nav className="px-6 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm tracking-widest uppercase text-text-muted hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              
              {/* Mobile Breadcrumbs */}
              {breadcrumbs && breadcrumbs.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <Breadcrumbs items={breadcrumbs} />
                </div>
              )}
            </nav>
          </div>
        )}
      </header>
      
      {/* Spacer for fixed header */}
      {fixed && <div className="h-16" />}
    </>
  );
}

