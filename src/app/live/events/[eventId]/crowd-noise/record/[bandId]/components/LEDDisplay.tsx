interface LEDDisplayProps {
  audioLevel: number;
  ledCount?: number;
  sensitivity?: number;
  size?: "small" | "medium" | "large";
  className?: string;
}

export default function LEDDisplay({
  audioLevel,
  ledCount = 12,
  sensitivity = 0.3,
  size = "medium",
  className = "",
}: LEDDisplayProps) {
  const getSizeClasses = () => {
    switch (size) {
      case "small":
        return "w-1.5 sm:w-2 h-3 sm:h-4";
      case "medium":
        return "w-2 sm:w-3 h-4 sm:h-6";
      case "large":
        return "w-1.5 sm:w-2 lg:w-4 h-3 sm:h-4 lg:h-8";
      default:
        return "w-2 sm:w-3 h-4 sm:h-6";
    }
  };

  const getShadowIntensity = () => {
    switch (size) {
      case "small":
        return Math.min(audioLevel * 15, 12);
      case "medium":
        return Math.min(audioLevel * 10, 8);
      case "large":
        return Math.min(audioLevel * 15, 12);
      default:
        return Math.min(audioLevel * 10, 8);
    }
  };

  const getColorThresholds = () => {
    switch (size) {
      case "small":
        return { green: 8, yellow: 14 };
      case "medium":
        return { green: 4, yellow: 8 };
      case "large":
        return { green: 8, yellow: 14 };
      default:
        return { green: 4, yellow: 8 };
    }
  };

  const thresholds = getColorThresholds();

  return (
    <div className={`flex items-center space-x-0.5 sm:space-x-1 ${className}`}>
      {Array.from({ length: ledCount }, (_, i) => {
        const threshold = (i + 1) / ledCount;
        const isActive = audioLevel > threshold * sensitivity;
        let colorClass = size === "large" ? "bg-gray-700" : "bg-gray-600";

        if (isActive) {
          if (i < thresholds.green) {
            colorClass = "bg-green-500";
          } else if (i < thresholds.yellow) {
            colorClass = "bg-yellow-500";
          } else {
            colorClass = "bg-red-500";
          }
        }

        return (
          <div
            key={i}
            className={`${getSizeClasses()} rounded-xs transition-all duration-50 ${colorClass} ${
              isActive ? "shadow-lg" : ""
            }`}
            style={{
              boxShadow: isActive
                ? `0 0 ${getShadowIntensity()}px currentColor`
                : "none",
            }}
          />
        );
      })}
    </div>
  );
}



