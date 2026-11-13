export type ThemePref = "system" | "light" | "dark";

const KEY = "tally.theme";
export const THEME_EVENT = "tally:theme-changed";

export function getThemePref(): ThemePref {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function isDarkTheme(pref = getThemePref()) {
  if (pref === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return pref === "dark";
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  root.classList.toggle("theme-light", pref === "light");
  root.classList.toggle("theme-dark", pref === "dark");
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, pref);
  } catch {
    // Storage can be unavailable; the choice still applies for this session.
  }
  applyTheme(pref);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Inline script for <head>: applies the saved theme before first paint. */
export const themeBootScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.classList.add("theme-"+t)}catch(e){}`;
