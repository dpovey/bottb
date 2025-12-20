"use client";

import { useRef, useEffect } from "react";

interface OscilloscopeProps {
  dataArray: Uint8Array;
  frameCount: number;
}

export default function Oscilloscope({
  dataArray,
  frameCount,
}: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataArray || dataArray.length === 0) return;

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

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;

    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Vertical lines every 10% of width
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw oscilloscope trace
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128.0; // Normalize to -1 to 1, centered around 0
      const y = (v * height) / 2 + height / 2; // Center vertically

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();
  }, [dataArray, frameCount]);

  return (
    <div className="bg-gray-800 rounded-lg p-1 sm:p-2 flex flex-col min-h-0">
      <div className="flex-1 min-h-[120px]">
        <canvas ref={canvasRef} className="w-full h-full rounded-sm" />
      </div>
    </div>
  );
}
