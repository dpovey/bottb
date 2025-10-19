"use client";

import { useRef, useEffect } from "react";

interface VolumeGraphProps {
  rms: number;
  startTime: number;
  duration: number;
}

export default function VolumeGraph({
  rms,
  startTime,
  duration,
}: VolumeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startTime === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Setup canvas dimensions - only resize if dimensions changed
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const newWidth = rect.width * dpr;
    const newHeight = rect.height * dpr;

    if (rect.width > 0 && rect.height > 0) {
      // Only resize if dimensions actually changed
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.scale(dpr, dpr);
        // Reset initialization when canvas resizes
        canvas.dataset.initialized = "";
        canvas.dataset.lastX = "";
        canvas.dataset.lastY = "";
      }
    }

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Don't clear the canvas - we want to keep the previous lines
    // Only clear on the first call
    if (!canvas.dataset.initialized) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      canvas.dataset.initialized = "true";
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(elapsed / duration, 1);
    const x = progress * width;
    const y = height - rms * 2 * height; // Less sensitive scaling

    // Draw a line from the previous point to the current point
    if (canvas.dataset.lastX && canvas.dataset.lastY) {
      const lastX = parseFloat(canvas.dataset.lastX);
      const lastY = parseFloat(canvas.dataset.lastY);

      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, Math.max(0, Math.min(height, y)));
      ctx.stroke();
    }

    // Store current position for next line
    canvas.dataset.lastX = x.toString();
    canvas.dataset.lastY = Math.max(0, Math.min(height, y)).toString();
  }, [rms, startTime, duration]);

  return (
    <div className="bg-gray-800 rounded-lg p-1 sm:p-2 flex flex-col min-h-0">
      <h3 className="text-xs sm:text-sm font-semibold mb-1 text-gray-400 flex-shrink-0">
        VOLUME GRAPH
      </h3>
      <div className="flex-1 min-h-[120px]">
        <canvas ref={canvasRef} className="w-full h-full rounded" />
      </div>
    </div>
  );
}
