import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getVideos, getEvents, getBandsForEvent } from "@/lib/db";
import { VideoAdminClient } from "./video-admin-client";

export default async function VideoAdminPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect("/admin/login");
  }

  // Fetch videos and events
  const [videos, events] = await Promise.all([
    getVideos({ limit: 100 }),
    getEvents(),
  ]);

  // Fetch bands for all events
  const bandsMap: Record<string, { id: string; name: string }[]> = {};
  for (const event of events) {
    const bands = await getBandsForEvent(event.id);
    bandsMap[event.id] = bands.map((b) => ({ id: b.id, name: b.name }));
  }

  return (
    <VideoAdminClient
      initialVideos={videos}
      events={events.map((e) => ({ id: e.id, name: e.name }))}
      bandsMap={bandsMap}
    />
  );
}

