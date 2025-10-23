import { NextRequest, NextResponse } from "next/server";
import { getMiddlewareSession } from "@/lib/middleware-auth";

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const session = await getMiddlewareSession(request);

  // Protect admin routes (except login page)
  if (
    nextUrl.pathname.startsWith("/admin") &&
    nextUrl.pathname !== "/admin/login"
  ) {
    if (!session?.user || !session.user.isAdmin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // Protect judge voting routes
  if (nextUrl.pathname.startsWith("/vote/judge")) {
    if (!session?.user || !session.user.isAdmin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // Redirect from login page if already authenticated as admin
  if (
    nextUrl.pathname === "/admin/login" &&
    session?.user &&
    session.user.isAdmin
  ) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/vote/judge/:path*"],
};
