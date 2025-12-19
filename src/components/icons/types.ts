import type { SVGProps } from "react";

/**
 * Base props for all icon components.
 * Extends SVGProps to allow full customization of the underlying SVG element.
 */
export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Size in pixels or CSS value (sets both width and height) */
  size?: number | string;
}

