"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

import { THEME_EVENT, applyTheme, getThemePref, isDarkTheme } from "../../lib/theme";

// Keeps the theme class, Android status bar and home-screen widget in step with the app.
export function ThemeSync() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      applyTheme(getThemePref());
      if (!Capacitor.isNativePlatform()) return;
      const dark = isDarkTheme();
      StatusBar.setBackgroundColor({ color: dark ? "#09090B" : "#F7F7F8" }).catch(() => undefined);
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
    };
    apply();
    query.addEventListener("change", apply);
    window.addEventListener(THEME_EVENT, apply);
    if (Capacitor.isNativePlatform()) void import("../../lib/widget").then(({ refreshWidget }) => refreshWidget()).catch(() => undefined);
    return () => {
      query.removeEventListener("change", apply);
      window.removeEventListener(THEME_EVENT, apply);
    };
  }, []);
  return null;
}
