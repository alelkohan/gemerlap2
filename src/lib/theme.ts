import { Image } from "react-native";

export type ThemeMode = "light" | "dark" | "system";

export const LIGHT_COLORS = {
  primary: "#1a7a4a",
  primaryLight: "#239a5d",
  primaryDark: "#125735",
  accent: "#f5a623",
  accentLight: "#f7b74a",
  bg: "#f8f9fa",
  surface: "#ffffff",
  surfaceAlt: "#f3f4f6",
  text: "#1f2937",
  textSecondary: "#4b5563",
  textTertiary: "#9ca3af",
  textOnPrimary: "#ffffff",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  success: "#10b981",
  successBg: "#d1fae5",
  error: "#ef4444",
  errorBg: "#fee2e2",
  warning: "#f5a623",
  warningBg: "#fef3c7",
  info: "#3b82f6",
  infoBg: "#dbeafe",
  tabBarBg: "#ffffff",
  headerBg: "#ffffff",
  overlay: "rgba(0,0,0,0.5)",
};

export const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: "#2bb472",
  primaryLight: "#3ccf86",
  primaryDark: "#1a7a4a",
  accent: "#f5a623",
  accentLight: "#f7b74a",
  bg: "#0f1419",
  surface: "#1a2027",
  surfaceAlt: "#252d36",
  text: "#f3f4f6",
  textSecondary: "#9ca3af",
  textTertiary: "#6b7280",
  textOnPrimary: "#ffffff",
  border: "#374151",
  borderLight: "#252d36",
  success: "#34d399",
  successBg: "#064e3b",
  error: "#f87171",
  errorBg: "#7f1d1d",
  warning: "#fbbf24",
  warningBg: "#78350f",
  info: "#60a5fa",
  infoBg: "#1e3a8a",
  tabBarBg: "#1a2027",
  headerBg: "#1a2027",
  overlay: "rgba(0,0,0,0.7)",
};

// Default (light) - used by non-themed places (e.g. PDF generation)
export const Colors = LIGHT_COLORS;

// Use relative path for reliability
export const LOGO_IMG = require("../../assets/images/logo_gemerlap.png");

// Resolve URI safely to avoid initialization crashes on web SSR
let resolvedLogoUrl = "";
try {
  if (typeof Image.resolveAssetSource === "function") {
    resolvedLogoUrl = Image.resolveAssetSource(LOGO_IMG)?.uri || "";
  }
} catch (e) {
  // Silently ignore on web SSR environment
}

export const LOGO_URL = resolvedLogoUrl;

export const ORG = {
  name: "TPS3R Assalafiyyah",
  alamat:
    "Jl. Kiai Masduqi Mlangi, Mlangi, Nogotirto, Kec. Gamping, Kab. Sleman, DIY 55592",
  org: "Unit Pengelolaan Sampah Assalafiyyah Terpadu",
};
