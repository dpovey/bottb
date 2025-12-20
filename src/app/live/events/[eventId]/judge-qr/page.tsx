"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";
import { formatEventDate } from "@/lib/date-utils";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  timezone: string;
  status: string;
}

export default function JudgeQRPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [judgeQRCode, setJudgeQRCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}`);
        if (response.ok) {
          const data = await response.json();
          setEvent(data);
        }
      } catch (error) {
        console.error("Error fetching event:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    if (event) {
      const generateQRCode = async () => {
        const baseUrl = window.location.origin;
        const judgeUrl = `${baseUrl}/vote/judge/${eventId}`;

        try {
          const judgeQR = await QRCode.toDataURL(judgeUrl, {
            width: 400,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });

          setJudgeQRCode(judgeQR);
        } catch (error) {
          console.error("Error generating QR code:", error);
        }
      };

      generateQRCode();
    }
  }, [event, eventId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white text-xl">Event not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4">
      {/* Event Header - Reduced size */}
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          {event.name}
        </h1>
        <div className="text-lg md:text-xl text-gray-300 mb-1">
          {event.location}
        </div>
        <div className="text-base md:text-lg text-gray-400">
          {formatEventDate(event.date, event.timezone)}
        </div>
        <div className="mt-3">
          <span
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              event.status === "voting"
                ? "bg-green-600 text-white"
                : event.status === "finalized"
                ? "bg-blue-600 text-white"
                : "bg-gray-600 text-white"
            }`}
          >
            {event.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Main Content - Responsive Layout */}
      <div className="grid lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
        {/* QR Code Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center">
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Judge Scoring
            </h2>
            <p className="text-gray-300 text-lg">
              Scan to score bands on judging criteria
            </p>
          </div>

          {judgeQRCode ? (
            <div className="bg-white p-4 rounded-xl inline-block shadow-2xl">
              <Image
                src={judgeQRCode}
                alt="Judge Scoring QR Code"
                width={300}
                height={300}
                className="mx-auto"
              />
            </div>
          ) : (
            <div className="bg-white p-4 rounded-xl inline-block shadow-2xl">
              <div className="w-[300px] h-[300px] bg-gray-200 rounded-sm flex items-center justify-center">
                <span className="text-gray-500">Loading QR Code...</span>
              </div>
            </div>
          )}

          <div className="mt-4">
            <p className="text-gray-400 text-sm">
              Judges only • Detailed scoring system
            </p>
          </div>
        </div>

        {/* Instructions Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">
            Judge Instructions
          </h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 shrink-0 text-sm">
                1
              </span>
              <span className="text-gray-300 text-lg">
                Scan the QR code with your phone or tablet
              </span>
            </div>
            <div className="flex items-start">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 shrink-0 text-sm">
                2
              </span>
              <span className="text-gray-300 text-lg">
                Score each band on the three criteria using sliders
              </span>
            </div>
            <div className="flex items-start">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 shrink-0 text-sm">
                3
              </span>
              <span className="text-gray-300 text-lg">
                Song Choice (0-20), Performance (0-30), Crowd Vibe (0-30)
              </span>
            </div>
            <div className="flex items-start">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 shrink-0 text-sm">
                4
              </span>
              <span className="text-gray-300 text-lg">
                Submit all scores at once when complete
              </span>
            </div>
          </div>

          {/* Results Link */}
          {event.status === "finalized" && (
            <div className="text-center mt-8">
              <a
                href={`/results/${eventId}`}
                className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl text-lg transition-colors inline-block"
              >
                View Results
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
