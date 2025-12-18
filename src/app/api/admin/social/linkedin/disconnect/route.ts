/**
 * LinkedIn Disconnect - Remove OAuth connection
 *
 * DELETE /api/admin/social/linkedin/disconnect
 *
 * Removes the stored LinkedIn connection.
 * Admin-only endpoint.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { disconnectSocialAccount } from "@/lib/social/db";

export async function DELETE() {
  // Check admin auth
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await disconnectSocialAccount("linkedin");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LinkedIn disconnect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Disconnect failed" },
      { status: 500 }
    );
  }
}

