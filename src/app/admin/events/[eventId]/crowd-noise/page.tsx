"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Band {
  id: string;
  name: string;
  order: number;
  info?: {
    logo_url?: string;
    [key: string]: unknown;
  };
}

interface CrowdNoiseMeasurement {
  id: string;
  event_id: string;
  band_id: string;
  energy_level: number;
  peak_volume: number;
  recording_duration: number;
  created_at: string;
}

export default function CrowdNoisePage() {
  const params = useParams();
  const eventId = params.eventId as string;

  // Authentication is handled by middleware

  const [bands, setBands] = useState<Band[]>([]);
  const [selectedBandId, setSelectedBandId] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [peakVolume, setPeakVolume] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [microphonePermission, setMicrophonePermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  const [isCheckingMic, setIsCheckingMic] = useState(false);
  const [measurements, setMeasurements] = useState<
    Record<string, CrowdNoiseMeasurement>
  >({});

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const energyAccumulatorRef = useRef(0);
  const isActiveRef = useRef(false);

  const vuCanvasRef = useRef<HTMLCanvasElement>(null);
  const graphCanvasRef = useRef<HTMLCanvasElement>(null);
  const _spectrumCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fetchBands = async () => {
      try {
        const response = await fetch(`/api/bands/${eventId}`);
        const data = await response.json();
        setBands(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching bands:", error);
      }
    };

    const fetchMeasurements = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/crowd-noise`);
        if (response.ok) {
          const data = await response.json();
          const measurementsMap: Record<string, CrowdNoiseMeasurement> = {};
          data.forEach((measurement: CrowdNoiseMeasurement) => {
            measurementsMap[measurement.band_id] = measurement;
          });
          setMeasurements(measurementsMap);
        }
      } catch (error) {
        console.error("Error fetching measurements:", error);
      }
    };

    // Check microphone permission on component mount
    const checkInitialMicPermission = async () => {
      try {
        // Check if we already have permission
        const result = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        if (result.state === "granted") {
          setMicrophonePermission("granted");
        } else if (result.state === "denied") {
          setMicrophonePermission("denied");
        }
      } catch (_error) {
        // Fallback if permissions API is not supported
        console.log("Permissions API not supported, will check on first use");
      }
    };

    fetchBands();
    fetchMeasurements();
    checkInitialMicPermission();
  }, [eventId]);

  const checkMicrophonePermission = async (): Promise<boolean> => {
    setIsCheckingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophonePermission("granted");
      // Stop the stream immediately as we just needed to check permission
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setMicrophonePermission("denied");
      return false;
    } finally {
      setIsCheckingMic(false);
    }
  };

  const startCountdown = () => {
    if (microphonePermission !== "granted") {
      checkMicrophonePermission();
      return;
    }

    setCountdown(3);

    // Use setTimeout for more precise timing
    const countdown3 = setTimeout(() => setCountdown(2), 1000);
    const countdown2 = setTimeout(() => setCountdown(1), 2000);
    const countdown1 = setTimeout(() => {
      setCountdown(0);
      // Start recording immediately after countdown
      setTimeout(() => startRecording(), 100);
    }, 3000);

    // Cleanup function to clear timeouts if component unmounts
    return () => {
      clearTimeout(countdown3);
      clearTimeout(countdown2);
      clearTimeout(countdown1);
    };
  };

  const startRecording = async () => {
    try {
      // Always check microphone permission first
      if (microphonePermission !== "granted") {
        const hasPermission = await checkMicrophonePermission();
        if (!hasPermission) {
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioContextRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.3;

      sourceRef.current =
        audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      startTimeRef.current = Date.now();
      energyAccumulatorRef.current = 0;
      isActiveRef.current = true;

      setIsRecording(true);
      setTimeLeft(5);
      setTotalEnergy(0);
      setPeakVolume(0);

      visualize();
    } catch (err) {
      alert(`Microphone error: ${(err as Error).message}`);
    }
  };

  const stopRecording = () => {
    isActiveRef.current = false;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current.mediaStream
        .getTracks()
        .forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsRecording(false);
    setTimeLeft(0);
  };

  const visualize = () => {
    if (!isActiveRef.current || !analyserRef.current || !dataArrayRef.current)
      return;

    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    analyser.getByteTimeDomainData(dataArray as Uint8Array<ArrayBuffer>);

    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);

    const dt = 1 / 60;
    energyAccumulatorRef.current += rms * rms * dt;

    setPeakVolume((prev) => Math.max(prev, rms));

    drawVUMeter(rms);
    drawVolumeGraph(rms);

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const remaining = Math.max(0, 5 - elapsed);
    setTimeLeft(remaining);
    setTotalEnergy(energyAccumulatorRef.current);

    if (remaining > 0) {
      animationRef.current = requestAnimationFrame(visualize);
    } else {
      stopRecording();
    }
  };

  const drawVUMeter = (rms: number) => {
    const canvas = vuCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    const barWidth = width * Math.min(rms * 5, 1);
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#00ff00");
    gradient.addColorStop(0.6, "#ffff00");
    gradient.addColorStop(0.85, "#ff8800");
    gradient.addColorStop(1, "#ff0000");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, barWidth, height);

    const peakX = width * Math.min(peakVolume * 5, 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(peakX - 2, 0, 4, height);

    ctx.fillStyle = "#666";
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * width;
      ctx.fillRect(x, height - 10, 1, 10);
    }
  };

  const drawVolumeGraph = (rms: number) => {
    const canvas = graphCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const progress = Math.min(elapsed / 5, 1);
    const x = progress * width;
    const y = height - rms * 5 * height;

    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(x, Math.max(0, Math.min(height, y)));
    ctx.stroke();
  };

  const submitMeasurement = async () => {
    if (!selectedBandId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/events/${eventId}/crowd-noise`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          band_id: selectedBandId,
          energy_level: totalEnergy,
          peak_volume: peakVolume,
          recording_duration: 5,
        }),
      });

      if (response.ok) {
        const measurement = await response.json();
        setMeasurements((prev) => ({
          ...prev,
          [measurement.band_id]: measurement,
        }));
        setIsSubmitted(true);

        // Reset form after successful submission
        setTimeout(() => {
          setIsSubmitted(false);
          setTotalEnergy(0);
          setPeakVolume(0);
          setSelectedBandId("");
        }, 2000);
      } else {
        throw new Error("Failed to submit measurement");
      }
    } catch (error) {
      console.error("Error submitting measurement:", error);
      alert("Failed to submit measurement. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBand = bands.find((band) => band.id === selectedBandId);
  const hasMeasurement = selectedBand && measurements[selectedBand.id];

  // Show loading while fetching bands
  if (bands.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading bands...</div>
      </div>
    );
  }

  // Show completion message if all bands have been measured
  const allBandsMeasured =
    bands.length > 0 && bands.every((band) => measurements[band.id]);
  if (allBandsMeasured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-8">🎉 All Done!</h1>
            <p className="text-2xl text-gray-300 mb-8">
              Crowd noise measurements completed for all bands
            </p>
            <Link
              href={`/admin/events/${eventId}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors"
            >
              Back to Event Management
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Crowd Noise Measurement
          </h1>
          <div className="text-xl text-gray-300">
            Select a band to measure crowd noise
          </div>
        </div>

        {/* Band Selection */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Select Band
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bands.map((band) => {
              const hasMeasurement = measurements[band.id];
              return (
                <button
                  key={band.id}
                  onClick={() => setSelectedBandId(band.id)}
                  disabled={isRecording || isSubmitting}
                  className={`p-4 rounded-xl text-left transition-all ${
                    selectedBandId === band.id
                      ? "bg-blue-600 text-white"
                      : hasMeasurement
                      ? "bg-green-600/20 text-green-400 border-2 border-green-400"
                      : "bg-white/10 text-white hover:bg-white/20"
                  } ${
                    isRecording || isSubmitting
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <div className="font-bold text-lg">{band.name}</div>
                  {hasMeasurement && (
                    <div className="text-sm mt-1">✓ Measured</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Band Display */}
        {selectedBand && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              {selectedBand.name}
            </h2>
            {hasMeasurement && (
              <div className="bg-green-600/20 text-green-400 px-4 py-2 rounded-lg mb-4">
                ✓ Measurement completed
              </div>
            )}
          </div>
        )}

        {/* Countdown */}
        {countdown > 0 && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="text-9xl font-bold text-white animate-pulse mb-4">
                {countdown}
              </div>
              <div className="text-2xl text-gray-300">Get ready to record!</div>
            </div>
          </div>
        )}

        {/* Recording Interface - Only show when band is selected */}
        {selectedBand && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
            {!isRecording && !isSubmitted && (
              <div className="text-center">
                {/* Microphone Permission Status */}
                {microphonePermission === "unknown" && (
                  <div className="mb-4 p-4 bg-yellow-600/20 border border-yellow-400 rounded-lg">
                    <p className="text-yellow-400 mb-2">
                      Microphone access required
                    </p>
                    <p className="text-sm text-gray-300">
                      Click &quot;Check Microphone&quot; to enable audio
                      recording
                    </p>
                  </div>
                )}

                {microphonePermission === "denied" && (
                  <div className="mb-4 p-4 bg-red-600/20 border border-red-400 rounded-lg">
                    <p className="text-red-400 mb-2">
                      Microphone access denied
                    </p>
                    <p className="text-sm text-gray-300">
                      Please allow microphone access in your browser settings
                      and refresh the page
                    </p>
                  </div>
                )}

                {microphonePermission === "granted" && (
                  <div className="mb-4 p-4 bg-green-600/20 border border-green-400 rounded-lg">
                    <p className="text-green-400">✓ Microphone ready</p>
                  </div>
                )}

                <button
                  onClick={startCountdown}
                  disabled={
                    !!hasMeasurement ||
                    isCheckingMic ||
                    microphonePermission === "denied"
                  }
                  className={`px-8 py-4 rounded-xl text-2xl font-bold transition-colors ${
                    hasMeasurement
                      ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                      : microphonePermission === "denied"
                      ? "bg-red-600 text-red-200 cursor-not-allowed"
                      : isCheckingMic
                      ? "bg-yellow-600 text-yellow-200 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  {hasMeasurement
                    ? "Already Measured"
                    : isCheckingMic
                    ? "Checking Microphone..."
                    : microphonePermission === "denied"
                    ? "Microphone Denied"
                    : microphonePermission === "unknown"
                    ? "Check Microphone"
                    : "Start Recording"}
                </button>
                <p className="text-gray-300 mt-4">
                  {hasMeasurement
                    ? "This band has already been measured"
                    : microphonePermission === "denied"
                    ? "Please enable microphone access to continue"
                    : microphonePermission === "unknown"
                    ? "Click to check microphone permission first"
                    : "Click to start 3-2-1 countdown, then 5-second recording"}
                </p>
              </div>
            )}

            {isRecording && (
              <div className="text-center">
                <div className="text-6xl font-bold text-red-500 mb-4">
                  🔴 RECORDING
                </div>
                <div className="text-4xl font-bold text-white mb-4">
                  {timeLeft.toFixed(1)}s
                </div>
                <div className="text-xl text-gray-300">
                  Energy: {totalEnergy.toFixed(4)} | Peak:{" "}
                  {peakVolume.toFixed(3)}
                </div>
              </div>
            )}

            {isSubmitted && (
              <div className="text-center">
                <div className="text-6xl mb-4">✅</div>
                <div className="text-2xl font-bold text-green-400 mb-4">
                  Measurement Saved!
                </div>
                <div className="text-gray-300">Moving to next band...</div>
              </div>
            )}

            {/* Visualizations */}
            {(isRecording || isSubmitted) && (
              <div className="mt-8 space-y-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-2 text-gray-400">
                    VU METER
                  </h3>
                  <canvas
                    ref={vuCanvasRef}
                    width={800}
                    height={60}
                    className="w-full rounded"
                  />
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-2 text-gray-400">
                    VOLUME GRAPH
                  </h3>
                  <canvas
                    ref={graphCanvasRef}
                    width={800}
                    height={200}
                    className="w-full rounded"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            {!isRecording && !isSubmitted && totalEnergy > 0 && (
              <div className="text-center mt-8">
                <button
                  onClick={submitMeasurement}
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors"
                >
                  {isSubmitting ? "Saving..." : "Save Measurement"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-center">
          <Link
            href={`/admin/events/${eventId}`}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            ← Back to Event Management
          </Link>
        </div>
      </div>
    </div>
  );
}
