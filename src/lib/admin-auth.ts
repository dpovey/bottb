import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

/**
 * @deprecated Use withAdminAuth from api-protection.ts instead
 */
export async function requireAdminAuth(_request: NextRequest) {
  const session = await auth();

  if (!session?.user || !session.user.isAdmin) {
    return {
      error: "Unauthorized - Admin access required",
      status: 401,
    };
  }

  return { session };
}
