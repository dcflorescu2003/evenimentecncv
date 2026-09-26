import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import pkg from "../../package.json";

export interface AppVersionInfo {
  platform: "android" | "ios" | "web";
  currentVersion: string;
  minVersion: string;
  latestVersion: string;
  storeUrl: string | null;
}

/** Compares two semver-ish versions: returns -1 if a < b, 0 if equal, 1 if a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

export function getPlatform(): "android" | "ios" | "web" {
  const p = Capacitor.getPlatform();
  if (p === "android" || p === "ios") return p;
  return "web";
}

async function getInstalledVersion(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await App.getInfo();
      if (info.version) return info.version;
    } catch {
      // fall through to package.json version
    }
  }
  return pkg.version;
}

const CACHE_KEY = "cncv-app-version-check";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CachedCheck {
  info: AppVersionInfo;
  checkedAt: number;
}

function readCache(): CachedCheck | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCheck;
    if (!parsed?.info || typeof parsed.checkedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(info: AppVersionInfo) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ info, checkedAt: Date.now() } satisfies CachedCheck),
    );
  } catch {
    // storage unavailable — ignore
  }
}

/**
 * Returns version info when an update is required/available, or null when the
 * installed version is up to date (or the check cannot run, e.g. on web).
 * Results are cached locally for 6 hours to avoid querying on every render.
 */
export async function checkForUpdate(): Promise<AppVersionInfo | null> {
  const platform = getPlatform();
  if (platform === "web") return null;

  const currentVersion = await getInstalledVersion();

  const cached = readCache();
  if (
    cached &&
    cached.info.currentVersion === currentVersion &&
    Date.now() - cached.checkedAt < CACHE_TTL_MS
  ) {
    return needsUpdate(cached.info) ? cached.info : null;
  }

  const { data, error } = await supabase
    .from("app_versions")
    .select("platform, min_version, latest_version, store_url")
    .eq("platform", platform)
    .maybeSingle();

  if (error || !data) return null;

  const info: AppVersionInfo = {
    platform,
    currentVersion,
    minVersion: data.min_version,
    latestVersion: data.latest_version,
    storeUrl: data.store_url,
  };
  writeCache(info);

  return needsUpdate(info) ? info : null;
}

function needsUpdate(info: AppVersionInfo): boolean {
  return compareVersions(info.currentVersion, info.minVersion) < 0;
}

const DISMISS_KEY = "cncv-update-card-dismissed";

export function isUpdateCardDismissed(latestVersion: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === latestVersion;
  } catch {
    return false;
  }
}

export function dismissUpdateCard(latestVersion: string) {
  try {
    localStorage.setItem(DISMISS_KEY, latestVersion);
  } catch {
    // ignore
  }
}
