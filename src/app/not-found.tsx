import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/nav";
import { SadFaceIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Background Effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-linear-to-b from-purple-900/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-linear-to-r from-indigo-900/5 to-cyan-900/5" />
      </div>

      {/* Minimal Header */}
      <header className="relative z-10 bg-bg/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center h-16">
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="text-center max-w-lg">
          {/* 404 Number */}
          <div className="relative mb-8">
            <p className="text-[8rem] sm:text-[12rem] font-bold leading-none text-white/5 select-none">
              404
            </p>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center">
                <SadFaceIcon size={40} className="text-accent" />
              </div>
            </div>
          </div>

          {/* Message */}
          <h1 className="font-semibold text-3xl mb-4">Page Not Found</h1>
          <p className="text-text-muted text-lg mb-8">
            Looks like this page missed soundcheck. It might have been moved,
            deleted, or never existed.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/"
              className="inline-flex items-center justify-center bg-white text-bg px-8 py-3 rounded-full text-sm tracking-widest uppercase font-medium transition-all duration-300 hover:bg-gray-200"
            >
              Back to Home
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center border border-white/30 text-white px-8 py-3 rounded-full text-sm tracking-widest uppercase transition-all duration-300 hover:border-white/60 hover:bg-white/5"
            >
              View Events
            </Link>
          </div>

          {/* Quick Links */}
          <div className="pt-8 border-t border-white/5">
            <p className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Popular Pages
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/"
                className="text-text-dim hover:text-white transition-colors text-sm"
              >
                Events
              </Link>
              <span className="text-text-dim/30">•</span>
              <Link
                href="/photos"
                className="text-text-dim hover:text-white transition-colors text-sm"
              >
                Photos
              </Link>
              <span className="text-text-dim/30">•</span>
              <Link
                href="/results"
                className="text-text-dim hover:text-white transition-colors text-sm"
              >
                Results
              </Link>
              <span className="text-text-dim/30">•</span>
              <Link
                href="/about"
                className="text-text-dim hover:text-white transition-colors text-sm"
              >
                About
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer variant="simple" />
    </div>
  );
}




