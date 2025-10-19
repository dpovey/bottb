"use client";

import { useRef, useEffect } from "react";

interface CircularOscilloscopeProps {
  dataArray: Uint8Array;
  size?: number;
  className?: string;
}

export default function CircularOscilloscope({
  dataArray,
  size = 200,
  className = "",
}: CircularOscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataArray || dataArray.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Setup canvas dimensions
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Calculate center and radius
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.4; // Leave some padding

    // No grid lines - clean circular oscilloscope

    // Draw oscilloscope trace in a circle
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const dataLength = dataArray.length;
    const angleStep = (2 * Math.PI) / dataLength;

    for (let i = 0; i < dataLength; i++) {
      // Normalize audio data to -1 to 1
      const v = (dataArray[i] - 128) / 128.0;

      // Calculate angle for this data point
      const angle = i * angleStep;

      // Calculate radius based on audio amplitude
      // Use a base radius and add amplitude variation
      const amplitude = Math.abs(v) * radius * 0.3; // Scale amplitude
      const currentRadius = radius * 0.7 + amplitude;

      // Calculate position
      const x = centerX + Math.cos(angle) * currentRadius;
      const y = centerY + Math.sin(angle) * currentRadius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Close the circle
    const firstAngle = 0;
    const firstV = (dataArray[0] - 128) / 128.0;
    const firstAmplitude = Math.abs(firstV) * radius * 0.3;
    const firstRadius = radius * 0.7 + firstAmplitude;
    const firstX = centerX + Math.cos(firstAngle) * firstRadius;
    const firstY = centerY + Math.sin(firstAngle) * firstRadius;
    ctx.lineTo(firstX, firstY);

    ctx.stroke();

    // Add a pulsing center dot
    const time = Date.now() * 0.005;
    const pulseRadius = 3 + Math.sin(time) * 2;
    ctx.fillStyle = "#00ff00";
    ctx.beginPath();
    ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
    ctx.fill();
  }, [dataArray, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`${className}`}
      style={{ width: size, height: size }}
    />
  );
}
