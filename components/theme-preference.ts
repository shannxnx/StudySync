"use client";
import { useEffect, useSyncExternalStore } from "react";
export type ThemePreference = "light" | "dark" | "system";
const storageKey = "studysync-theme";
const changeEvent = "studysync-theme-change";

function getPreference(): ThemePreference {
  let value;
  try {
    value = localStorage.getItem(storageKey);
  } catch {
    value = document.documentElement.dataset.theme;
  }
  return value === "light" || value === "dark" ? value : "system";
}
function apply(value: ThemePreference) {
  if (value === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;
}
function subscribe(update: () => void) {
  window.addEventListener("storage", update);
  window.addEventListener(changeEvent, update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener(changeEvent, update);
  };
}
export function setThemePreference(value: ThemePreference) {
  apply(value);
  try {
    if (value === "system") localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, value);
  } catch {
    /* The theme can still be applied for this visit. */
  }
  window.dispatchEvent(new Event(changeEvent));
}
const serverPreference = () => "system" as const;
export function useThemePreference() {
  const preference = useSyncExternalStore(
    subscribe,
    getPreference,
    serverPreference,
  );
  useEffect(() => {
    apply(getPreference());
  }, [preference]);
  return preference;
}
