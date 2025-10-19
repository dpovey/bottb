"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { VUMeter, VolumeGraph, Oscilloscope } from "./components";

interface Band {
  id: string;
  name: string;
  order: number;
  info?: {
    logo_url?: string;
    [key: string]: unknown;
  };
}

interface _CrowdNoiseMeasurement {
  id: string;
  event_id: string;
  band_id: string;
  energy_level: number;
  peak_volume: number;
  recording_duration: number;
  created_at: string;
}

export default function CrowdNoiseRecordPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const bandId = params.bandId as string;

  const [band, setBand] = useState<Band | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [peakVolume, setPeakVolume] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [crowdScore, setCrowdScore] = useState(0);
  const [microphonePermission, setMicrophonePermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  const [isCheckingMic, setIsCheckingMic] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [viewportScale, setViewportScale] = useState(1);
  const [oscilloscopeFrame, setOscilloscopeFrame] = useState(0);

  const [availableMicrophones, setAvailableMicrophones] = useState<
    MediaDeviceInfo[]
  >([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>("");

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const energyAccumulatorRef = useRef(0);
  const isActiveRef = useRef(false);

  const checkMicrophonePermission = useCallback(async (): Promise<boolean> => {
    setIsCheckingMic(true);
    try {
      // First get available microphones to set the correct default
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter((device) => {
        if (device.kind !== "audioinput") return false;

        // Filter out virtual audio devices
        const label = device.label.toLowerCase();
        const isVirtual =
          label.includes("virtual") ||
          label.includes("background music") ||
          label.includes("loopback") ||
          label.includes("stereo mix") ||
          label.includes("what u hear");

        return !isVirtual;
      });

      // Sort microphones by priority
      const sortedMicrophones = microphones.sort((a, b) => {
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();

        if (aLabel.includes("built-in") && !bLabel.includes("built-in"))
          return -1;
        if (!aLabel.includes("built-in") && bLabel.includes("built-in"))
          return 1;
        if (aLabel.includes("usb") && !bLabel.includes("usb")) return -1;
        if (!aLabel.includes("usb") && bLabel.includes("usb")) return 1;
        if (aLabel.includes("external") && !bLabel.includes("external"))
          return -1;
        if (!aLabel.includes("external") && bLabel.includes("external"))
          return 1;
        if (aLabel.includes("default") && !bLabel.includes("default"))
          return -1;
        if (!aLabel.includes("default") && bLabel.includes("default")) return 1;

        return aLabel.localeCompare(bLabel);
      });

      setAvailableMicrophones(sortedMicrophones);

      // Get the best microphone ID directly
      const bestMicrophoneId =
        sortedMicrophones.length > 0 ? sortedMicrophones[0].deviceId : null;

      // Set the selected microphone ID
      if (bestMicrophoneId) {
        setSelectedMicrophoneId(bestMicrophoneId);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: bestMicrophoneId
          ? { deviceId: { exact: bestMicrophoneId } }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100,
              channelCount: 1,
            },
      });
      setMicrophonePermission("granted");

      // Set up audio monitoring for real-time feedback with the correct stream
      await setupAudioMonitoring(stream);

      return true;
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setMicrophonePermission("denied");
      return false;
    } finally {
      setIsCheckingMic(false);
    }
  }, []);

  useEffect(() => {
    const fetchBand = async () => {
      try {
        const response = await fetch(`/api/bands/${eventId}`);
        const bands = await response.json();
        const foundBand = bands.find((b: Band) => b.id === bandId);
        if (foundBand) {
          setBand(foundBand);
        } else {
          router.push(`/admin/events/${eventId}/crowd-noise`);
        }
      } catch (error) {
        console.error("Error fetching band:", error);
        router.push(`/admin/events/${eventId}/crowd-noise`);
      }
    };

    fetchBand();
    checkMicrophonePermission();
  }, [eventId, bandId, router, checkMicrophonePermission]);

  // Calculate viewport scale based on screen size
  useEffect(() => {
    const calculateScale = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Base dimensions for scaling (desktop reference)
      const baseWidth = 1200;
      const baseHeight = 800;

      // Calculate scale based on both width and height, use the smaller one
      const scaleX = vw / baseWidth;
      const scaleY = vh / baseHeight;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1

      // Minimum scale to prevent elements from becoming too small
      const minScale = 0.4;
      const finalScale = Math.max(scale, minScale);

      setViewportScale(finalScale);
    };

    calculateScale();
    window.addEventListener("resize", calculateScale);

    return () => {
      window.removeEventListener("resize", calculateScale);
    };
  }, []);

  const _getAvailableMicrophones = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter((device) => {
        if (device.kind !== "audioinput") return false;

        // Filter out virtual audio devices
        const label = device.label.toLowerCase();
        const isVirtual =
          label.includes("virtual") ||
          label.includes("background music") ||
          label.includes("loopback") ||
          label.includes("stereo mix") ||
          label.includes("what u hear");

        return !isVirtual;
      });

      // Sort microphones by priority for better ordering
      const sortedMicrophones = microphones.sort((a, b) => {
        // Priority order: Built-in mics first, then USB/external, then others
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();

        // Built-in microphones (usually better for crowd noise)
        if (aLabel.includes("built-in") && !bLabel.includes("built-in"))
          return -1;
        if (!aLabel.includes("built-in") && bLabel.includes("built-in"))
          return 1;

        // USB microphones (good quality)
        if (aLabel.includes("usb") && !bLabel.includes("usb")) return -1;
        if (!aLabel.includes("usb") && bLabel.includes("usb")) return 1;

        // External microphones
        if (aLabel.includes("external") && !bLabel.includes("external"))
          return -1;
        if (!aLabel.includes("external") && bLabel.includes("external"))
          return 1;

        // Default microphones
        if (aLabel.includes("default") && !bLabel.includes("default"))
          return -1;
        if (!aLabel.includes("default") && bLabel.includes("default")) return 1;

        // Sort by label alphabetically as fallback
        return aLabel.localeCompare(bLabel);
      });

      setAvailableMicrophones(sortedMicrophones);

      // Auto-select the first (highest priority) microphone if none selected
      if (sortedMicrophones.length > 0 && !selectedMicrophoneId) {
        setSelectedMicrophoneId(sortedMicrophones[0].deviceId);
      }
    } catch (error) {
      console.error("Error getting microphones:", error);
    }
  };

  const startAudioMonitoring = async () => {
    try {
      await setupAudioMonitoring();
    } catch (error) {
      console.error("Error starting audio monitoring:", error);
    }
  };

  const setupAudioMonitoring = async (stream?: MediaStream) => {
    try {
      // Clean up any existing monitoring
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Get stream with selected microphone if not provided
      let audioStream = stream;
      if (!audioStream && selectedMicrophoneId) {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: selectedMicrophoneId } },
        });
      } else if (!audioStream) {
        // Try to get a real microphone, not virtual audio devices
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
            channelCount: 1,
          },
        });
      }

      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();

      // Resume audio context if it's suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;

      const source = audioContext.createMediaStreamSource(audioStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      setIsMonitoring(true);

      const monitorAudio = () => {
        // Only monitor if we're not actively recording
        if (!isActiveRef.current) {
          analyser.getByteTimeDomainData(dataArray);
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          setAudioLevel(rms);
        }

        animationRef.current = requestAnimationFrame(monitorAudio);
      };

      monitorAudio();
    } catch (error) {
      console.error("Error setting up audio monitoring:", error);
      setIsMonitoring(false);
    }
  };

  const startCountdown = async () => {
    if (microphonePermission !== "granted") {
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) {
        return;
      }
    }

    // Pre-setup audio context BEFORE countdown starts
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMicrophoneId
          ? { deviceId: { exact: selectedMicrophoneId } }
          : true,
      });

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

      // Keep the stream active during countdown
      // Don't stop the stream - we'll use it when recording starts
    } catch (err) {
      console.error("Error setting up audio:", err);
      alert(`Microphone error: ${(err as Error).message}`);
      return;
    }

    let countdownValue = 3;
    setCountdown(countdownValue);

    const countdownInterval = setInterval(() => {
      countdownValue--;
      if (countdownValue > 0) {
        setCountdown(countdownValue);
      } else {
        setCountdown(0);
        clearInterval(countdownInterval);
        // Start recording immediately after countdown - everything is already set up
        startRecording();
      }
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  };

  const startRecording = async () => {
    try {
      // Check if audio context is still valid and stream is active
      let needsNewStream =
        !audioContextRef.current || !analyserRef.current || !sourceRef.current;

      if (sourceRef.current && sourceRef.current.mediaStream) {
        // Check if the stream is still active
        const activeTracks = sourceRef.current.mediaStream
          .getAudioTracks()
          .filter((track) => track.readyState === "live");
        if (activeTracks.length === 0) {
          needsNewStream = true;
        }
      }

      if (needsNewStream) {
        // Clean up existing connections
        if (sourceRef.current) {
          sourceRef.current.disconnect();
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }

        // Get a fresh stream with selected microphone
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMicrophoneId
            ? { deviceId: { exact: selectedMicrophoneId } }
            : true,
        });

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
      }

      // Start recording state
      setIsRecording(true);
      setTimeLeft(10);
      setTotalEnergy(0);
      setPeakVolume(0);
      setOscilloscopeFrame(0);

      startTimeRef.current = Date.now();
      energyAccumulatorRef.current = 0;
      isActiveRef.current = true;

      // Start visualization immediately
      visualize();
    } catch (err) {
      console.error("Error starting recording:", err);
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
    // Calculate crowd score out of 10 based on energy level
    const energyScore = Math.min(10, Math.max(1, Math.round(totalEnergy * 10)));
    setCrowdScore(energyScore);

    setIsRecording(false);
    setTimeLeft(0);
    setShowResults(true);
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

    // Update audio level for debugging
    setAudioLevel(rms);

    const dt = 1 / 60;
    energyAccumulatorRef.current += rms * rms * dt;

    setPeakVolume((prev) => Math.max(prev, rms));

    // Force oscilloscope update
    setOscilloscopeFrame((prev) => prev + 1);

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const remaining = Math.max(0, 10 - elapsed);
    setTimeLeft(remaining);
    setTotalEnergy(energyAccumulatorRef.current);

    if (remaining > 0) {
      animationRef.current = requestAnimationFrame(visualize);
    } else {
      stopRecording();
    }
  };

  const submitMeasurement = async () => {
    if (!band) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/events/${eventId}/crowd-noise`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          band_id: band.id,
          energy_level: totalEnergy,
          peak_volume: peakVolume,
          recording_duration: 10,
          crowd_score: crowdScore,
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        setTimeout(() => {
          router.push(`/admin/events/${eventId}/crowd-noise`);
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

  const doItAgain = () => {
    setShowResults(false);
    setTotalEnergy(0);
    setPeakVolume(0);
    setIsSubmitted(false);
  };

  if (!band) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-4xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex flex-col p-1 sm:p-2">
      <div
        className="w-full max-w-7xl mx-auto flex-1 flex flex-col"
        style={{
          transform: `scale(${viewportScale})`,
          transformOrigin: "top center",
          height: `${100 / viewportScale}%`, // Compensate for scale to maintain full height
        }}
      >
        {/* Header */}
        <div className="text-center mb-1 sm:mb-2 flex-shrink-0">
          <div className="mb-1 sm:mb-2">
            {band.info?.logo_url ? (
              <img
                src={band.info.logo_url}
                alt={`${band.name} logo`}
                className="mx-auto h-8 sm:h-12 w-auto object-contain"
              />
            ) : (
              <div className="mx-auto h-8 sm:h-12 w-8 sm:w-12 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-sm sm:text-xl text-gray-400 font-bold">
                  {band.name.charAt(0)}
                </span>
              </div>
            )}
          </div>
          <h1 className="text-xl sm:text-3xl font-bold text-white mb-1">
            {band.name}
          </h1>
          <div className="text-sm sm:text-base text-gray-300">
            Scream-o-meter
          </div>
        </div>

        {/* Microphone Status */}
        {!isRecording && !showResults && (
          <div className="text-center mb-2 sm:mb-4 flex-shrink-0">
            <div className="mb-2 sm:mb-3">
              {microphonePermission === "granted" ? (
                <div className="text-3xl sm:text-5xl text-green-400 mb-2">
                  🎤✓
                </div>
              ) : microphonePermission === "denied" ? (
                <div className="text-3xl sm:text-5xl text-red-400 mb-2">
                  🎤✗
                </div>
              ) : (
                <div className="text-3xl sm:text-5xl text-yellow-400 mb-2">
                  🎤?
                </div>
              )}
            </div>

            {microphonePermission === "denied" && (
              <div className="bg-red-600/20 border border-red-400 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3 max-w-2xl mx-auto">
                <p className="text-red-400 text-sm sm:text-base mb-1">
                  Microphone access denied
                </p>
                <p className="text-gray-300 text-xs">
                  Please allow microphone access in your browser settings and
                  refresh the page
                </p>
              </div>
            )}

            {microphonePermission === "unknown" && (
              <div className="bg-yellow-600/20 border border-yellow-400 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3 max-w-2xl mx-auto">
                <p className="text-yellow-400 text-sm sm:text-base mb-1">
                  Microphone access required
                </p>
                <p className="text-gray-300 text-xs">
                  Click &quot;Check Microphone&quot; to enable audio recording
                </p>
              </div>
            )}

            {microphonePermission === "granted" && (
              <div className="bg-green-600/20 border border-green-400 rounded-2xl p-3 sm:p-6 mb-4 sm:mb-8 max-w-2xl mx-auto">
                <div className="flex items-center justify-center mb-2 sm:mb-4">
                  <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    <p className="text-green-400 text-lg sm:text-xl">
                      ✓ Microphone ready
                    </p>
                    <div className="flex items-center space-x-1">
                      {/* LED Level Display */}
                      {Array.from({ length: 12 }, (_, i) => {
                        const threshold = (i + 1) / 12;
                        const isActive = audioLevel > threshold * 0.3; // Less sensitive - need louder sounds
                        let colorClass = "bg-gray-600"; // Default off

                        if (isActive) {
                          if (i < 4) {
                            colorClass = "bg-green-500"; // Green LEDs (0-3)
                          } else if (i < 8) {
                            colorClass = "bg-yellow-500"; // Yellow LEDs (4-7)
                          } else {
                            colorClass = "bg-red-500"; // Red LEDs (8-11)
                          }
                        }

                        return (
                          <div
                            key={i}
                            className={`w-2 sm:w-3 h-4 sm:h-6 rounded-sm transition-all duration-75 ${colorClass} ${
                              isActive ? "shadow-lg" : ""
                            }`}
                            style={{
                              boxShadow: isActive
                                ? `0 0 ${Math.min(
                                    audioLevel * 10,
                                    8
                                  )}px currentColor`
                                : "none",
                            }}
                          ></div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Microphone Selection */}
                {availableMicrophones.length > 1 && (
                  <div className="mb-2 sm:mb-4">
                    <label className="block text-xs sm:text-sm text-gray-300 mb-1 sm:mb-2">
                      Select Microphone:
                    </label>
                    <select
                      value={selectedMicrophoneId}
                      onChange={async (e) => {
                        setSelectedMicrophoneId(e.target.value);
                        setIsMonitoring(false);
                        setAudioLevel(0);

                        // Restart monitoring with new microphone
                        try {
                          await setupAudioMonitoring();
                        } catch (error) {
                          console.error("Error switching microphone:", error);
                        }
                      }}
                      className="w-full bg-gray-800 text-white rounded-lg p-1 sm:p-2 border border-gray-600 text-xs sm:text-sm"
                    >
                      {availableMicrophones.map((mic) => (
                        <option key={mic.deviceId} value={mic.deviceId}>
                          {mic.label ||
                            `Microphone ${mic.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="text-center">
                  <div className="text-xs text-gray-400 mt-1 sm:mt-2 mb-2 sm:mb-3">
                    {isMonitoring
                      ? "Monitoring audio input"
                      : "Audio monitoring not active"}
                  </div>
                  {!isMonitoring && (
                    <button
                      onClick={startAudioMonitoring}
                      className="px-3 sm:px-4 py-1 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded-lg transition-colors"
                    >
                      Start Monitoring
                    </button>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={startCountdown}
              disabled={isCheckingMic || microphonePermission === "denied"}
              className={`px-8 sm:px-16 py-4 sm:py-8 rounded-2xl text-2xl sm:text-4xl font-bold transition-all transform hover:scale-105 ${
                microphonePermission === "denied"
                  ? "bg-red-600 text-red-200 cursor-not-allowed"
                  : isCheckingMic
                  ? "bg-yellow-600 text-yellow-200 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white shadow-2xl animate-pulse border-2 sm:border-4 border-green-400/50"
              }`}
            >
              {isCheckingMic
                ? "Checking Microphone..."
                : microphonePermission === "denied"
                ? "Microphone Denied"
                : microphonePermission === "unknown"
                ? "Check Microphone"
                : "Start Recording"}
            </button>
          </div>
        )}

        {/* Countdown */}
        {countdown > 0 && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 transition-opacity duration-300">
            <div className="text-center">
              <div className="text-6xl sm:text-9xl font-bold text-white animate-pulse mb-4 sm:mb-8 drop-shadow-2xl">
                {countdown}
              </div>
              <div className="text-2xl sm:text-4xl text-gray-300 animate-bounce">
                Get ready to scream!
              </div>
              <div className="mt-4 sm:mt-8">
                <div className="w-16 sm:w-32 h-16 sm:h-32 border-2 sm:border-4 border-white rounded-full animate-spin mx-auto"></div>
              </div>
            </div>
          </div>
        )}

        {/* Recording Interface */}
        {isRecording && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-center flex-shrink-0">
              <div className="text-xl sm:text-2xl lg:text-4xl font-bold text-red-500 mb-2 sm:mb-4 lg:mb-8 animate-pulse drop-shadow-2xl">
                🔴 RECORDING
              </div>
              <div className="text-xl sm:text-3xl lg:text-6xl font-bold text-white mb-2 sm:mb-4 lg:mb-8 drop-shadow-lg">
                {timeLeft.toFixed(1)}s
              </div>
              <div className="text-xs sm:text-sm lg:text-2xl text-gray-300 mb-2 sm:mb-4 lg:mb-8 bg-black/30 rounded-2xl p-1 sm:p-2 lg:p-4 backdrop-blur-sm">
                Energy: {totalEnergy.toFixed(4)} | Peak: {peakVolume.toFixed(3)}{" "}
                | Live: {audioLevel.toFixed(3)}
              </div>

              {/* Large LED Level Display during recording */}
              <div className="flex justify-center mb-2 sm:mb-4 lg:mb-8">
                <div className="flex items-center space-x-0.5 sm:space-x-1">
                  {Array.from({ length: 20 }, (_, i) => {
                    const threshold = (i + 1) / 20;
                    const isActive = audioLevel > threshold * 0.15; // Less sensitive for recording
                    let colorClass = "bg-gray-700"; // Default off

                    if (isActive) {
                      if (i < 8) {
                        colorClass = "bg-green-500"; // Green LEDs (0-7)
                      } else if (i < 14) {
                        colorClass = "bg-yellow-500"; // Yellow LEDs (8-13)
                      } else {
                        colorClass = "bg-red-500"; // Red LEDs (14-19)
                      }
                    }

                    return (
                      <div
                        key={i}
                        className={`w-1.5 sm:w-2 lg:w-4 h-3 sm:h-4 lg:h-8 rounded-sm transition-all duration-50 ${colorClass} ${
                          isActive ? "shadow-lg" : ""
                        }`}
                        style={{
                          boxShadow: isActive
                            ? `0 0 ${Math.min(
                                audioLevel * 15,
                                12
                              )}px currentColor`
                            : "none",
                        }}
                      ></div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Visualizations */}
            <div className="flex-1 flex flex-col space-y-1 sm:space-y-2 min-h-0 overflow-hidden">
              {/* VU Meter */}
              <VUMeter rms={audioLevel} peakVolume={peakVolume} />

              {/* Side by side graphs */}
              <div className="grid grid-cols-1 gap-1 flex-1 min-h-0">
                {dataArrayRef.current && dataArrayRef.current.length > 0 ? (
                  <>
                    <VolumeGraph
                      rms={audioLevel}
                      startTime={startTimeRef.current}
                      duration={10}
                    />
                    <Oscilloscope
                      key={`oscilloscope-${oscilloscopeFrame}`}
                      dataArray={dataArrayRef.current || new Uint8Array(0)}
                    />
                  </>
                ) : (
                  <div className="col-span-2 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="text-2xl mb-2">🎵</div>
                      <div>Waiting for audio data...</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {showResults && !isSubmitted && (
          <div className="text-center">
            <div className="text-4xl sm:text-8xl mb-4 sm:mb-8 animate-bounce">
              🎉
            </div>
            <div className="text-3xl sm:text-5xl font-bold text-green-400 mb-4 sm:mb-8 drop-shadow-lg">
              Recording Complete!
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 sm:p-8 mb-4 sm:mb-8 max-w-4xl mx-auto border border-green-400/30 shadow-2xl flex">
              {/* Crowd Score - Prominent Display */}
              <div className="flex-grow text-center mb-4 sm:mb-8">
                <div className="text-gray-400 mb-2 sm:mb-4 text-lg sm:text-2xl">
                  Crowd Energy Score
                </div>
                <div className="text-4xl sm:text-8xl font-bold text-yellow-400 drop-shadow-2xl animate-pulse">
                  {crowdScore}/10
                </div>
                <div className="text-sm sm:text-lg text-gray-300 mt-2">
                  {crowdScore >= 8
                    ? "🔥 INCREDIBLE!"
                    : crowdScore >= 6
                    ? "🎉 AMAZING!"
                    : crowdScore >= 4
                    ? "👏 GREAT!"
                    : crowdScore >= 2
                    ? "👍 GOOD!"
                    : "💪 KEEP TRYING!"}
                </div>
              </div>

              {/* Technical Details */}
              <div className="grid grid-cols-1 gap-4 text-lg sm:text-3xl">
                <div className="bg-black/20 rounded-xl p-3 sm:p-6">
                  <div className="text-gray-400 mb-1 sm:mb-2 text-sm sm:text-base">
                    Energy Level
                  </div>
                  <div className="text-white font-bold text-xl sm:text-4xl">
                    {totalEnergy.toFixed(4)}
                  </div>
                </div>
                <div className="bg-black/20 rounded-xl p-3 sm:p-6">
                  <div className="text-gray-400 mb-1 sm:mb-2 text-sm sm:text-base">
                    Peak Volume
                  </div>
                  <div className="text-white font-bold text-xl sm:text-4xl">
                    {peakVolume.toFixed(3)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-6 justify-center">
              <button
                onClick={submitMeasurement}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 sm:py-6 px-6 sm:px-12 rounded-2xl text-lg sm:text-2xl transition-all transform hover:scale-105 shadow-2xl border-2 border-blue-400/50"
              >
                {isSubmitting ? "Saving..." : "Save & Continue"}
              </button>
              <button
                onClick={doItAgain}
                disabled={isSubmitting}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 sm:py-6 px-6 sm:px-12 rounded-2xl text-lg sm:text-2xl transition-all transform hover:scale-105 shadow-2xl border-2 border-gray-400/50"
              >
                Do It Again
              </button>
            </div>
          </div>
        )}

        {/* Success Message */}
        {isSubmitted && (
          <div className="text-center">
            <div className="text-4xl sm:text-8xl mb-4 sm:mb-8">✅</div>
            <div className="text-3xl sm:text-5xl font-bold text-green-400 mb-4 sm:mb-8">
              Measurement Saved!
            </div>
            <div className="text-lg sm:text-2xl text-gray-300">
              Returning to band selection...
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="fixed top-2 sm:top-4 left-2 sm:left-4">
          <Link
            href={`/admin/events/${eventId}/crowd-noise`}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 sm:py-3 px-3 sm:px-6 rounded-xl transition-colors text-sm sm:text-base"
          >
            ← Back
          </Link>
        </div>
      </div>
    </div>
  );
}
