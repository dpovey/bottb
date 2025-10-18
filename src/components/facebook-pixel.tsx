"use client";

import { useEffect } from "react";
import ReactPixel from "react-facebook-pixel";

const FacebookPixel = () => {
  useEffect(() => {
    // Only initialize in production and if pixel ID is provided
    const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;

    if (pixelId && process.env.NODE_ENV === "production") {
      ReactPixel.init(pixelId);
      ReactPixel.pageView();
    }
  }, []);

  return null;
};

export { FacebookPixel };
