"use client";

import { useRef, useEffect } from "react";

interface VUMeterProps {
  rms: number;
  peakVolume: number;
}

export default function VUMeter({ rms, peakVolume }: VUMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Setup canvas dimensions
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = width * Math.min(rms * 2, 1); // Less sensitive scaling
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#00ff00");
    gradient.addColorStop(0.6, "#ffff00");
    gradient.addColorStop(0.85, "#ff8800");
    gradient.addColorStop(1, "#ff0000");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, barWidth, height);

    const peakX = width * Math.min(peakVolume * 2, 1); // Less sensitive scaling
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(peakX - 2, 0, 4, height);

    ctx.fillStyle = "#666";
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * width;
      ctx.fillRect(x, height - 10, 1, 10);
    }
  }, [rms, peakVolume]);

  return (
    <div className="bg-gray-800 rounded-lg p-1 sm:p-2 shrink-0">
      <h3 className="text-xs sm:text-sm font-semibold mb-1 text-gray-400">
        VU METER
      </h3>
      <div className="w-full h-8">
        <canvas ref={canvasRef} className="w-full h-full rounded-sm" />
      </div>
    </div>
  );
}
