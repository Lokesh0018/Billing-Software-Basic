import { Capacitor } from '@capacitor/core';

/** True inside the Android app (Capacitor), false in a normal browser. */
export const isNative = Capacitor.isNativePlatform();

/** What the current platform can do. */
export const can = {
  /** Server-generated PDFs and exports are not available in the front-end-only app. */
  pdf: () => false,
};
