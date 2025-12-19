import Link from "next/link";
import { TicketIcon, ExternalLinkIcon } from "@/components/icons";

interface TicketCTAProps {
  ticketUrl: string;
  eventName?: string;
  variant?: "default" | "compact";
}

/**
 * Call-to-action button for purchasing event tickets
 */
export function TicketCTA({
  ticketUrl,
  eventName,
  variant = "default",
}: TicketCTAProps) {
  if (variant === "compact") {
    return (
      <Link
        href={ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-accent text-bg px-5 py-2.5 rounded-full font-medium text-sm tracking-wide hover:bg-accent-light transition-colors group"
      >
        <TicketIcon className="w-4 h-4" />
        Get Tickets
        <ExternalLinkIcon className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
      </Link>
    );
  }

  return (
    <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-2xl p-6 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-accent/10 mb-4">
        <TicketIcon className="w-7 h-7 text-accent" />
      </div>
      <h3 className="font-semibold text-xl mb-2">Get Your Tickets</h3>
      <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
        {eventName
          ? `Secure your spot at ${eventName}. All proceeds support Youngcare.`
          : "Secure your spot at this event. All proceeds support Youngcare."}
      </p>
      <Link
        href={ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-accent text-bg px-8 py-3 rounded-full font-semibold tracking-wide hover:bg-accent-light transition-colors group"
      >
        Purchase Tickets
        <ExternalLinkIcon className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
      </Link>
      <p className="text-text-dim text-xs mt-4">
        Opens in a new tab
      </p>
    </div>
  );
}

