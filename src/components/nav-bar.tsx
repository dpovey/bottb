"use client";

import Image from "next/image";
import Link from "next/link";

export function NavBar() {
  return (
    <nav className="bg-transparent">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center md:justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/images/logos/bottb-horizontal.png"
                alt="BOTTB"
                width={240}
                height={80}
                className="h-16 w-auto"
                priority
              />
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {/* Navigation links can be added here in the future */}
            <div className="flex items-center space-x-6">
              {/* Placeholder for future navigation items */}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
