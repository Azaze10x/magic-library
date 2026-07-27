/* Magic Library landing — Download button wiring
 *
 * GitHub Releases is the single download source. This module:
 * 1. Fetch latest release from GitHub Releases API
 * 2. Find the .dmg (macOS) and -setup.exe (Windows) assets
 * 3. Wire the primary CTA to whichever matches the visitor's OS, and offer the
 *    other one as a secondary link
 *
 * The existing unsigned v0.1.0 remains hidden. Downloads turn on automatically
 * when the first public release at or above MIN_PUBLIC_VERSION is published.
 *
 * The Windows installer is not code-signed, so SmartScreen shows "Windows
 * protected your PC" on first run. Telling people that up front — with the
 * exact way through it — costs nothing and is the single biggest lever on
 * download→install drop-off for an unsigned build.
 */

const DOWNLOAD_ENABLED = true;
const MIN_PUBLIC_VERSION = [0, 1, 1];

const RELEASE_API = "https://api.github.com/repos/Azaze10x/magic-library/releases/latest";
const DMG_PATTERN = /\.dmg$/i;
const EXE_PATTERN = /-setup\.exe$/i;

function parseVersion(tag) {
  const match = String(tag || "").match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function isSupportedPublicVersion(tag) {
  const version = parseVersion(tag);
  if (!version) return false;
  for (let index = 0; index < version.length; index += 1) {
    if (version[index] > MIN_PUBLIC_VERSION[index]) return true;
    if (version[index] < MIN_PUBLIC_VERSION[index]) return false;
  }
  return true;
}

/** "win" | "mac" | null — null when we cannot tell, which falls back to macOS. */
function detectPlatform() {
  const hints = navigator.userAgentData?.platform || "";
  const ua = `${hints} ${navigator.userAgent || ""}`.toLowerCase();
  if (ua.includes("win")) return "win";
  if (ua.includes("mac")) return "mac";
  return null;
}

function findAsset(assets, pattern) {
  const asset = (assets || []).find((a) => pattern.test(a.name));
  return asset
    ? { url: asset.browser_download_url, size: asset.size, name: asset.name }
    : null;
}

async function fetchLatestRelease() {
  try {
    const res = await fetch(RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      console.warn(`[download] GitHub API returned ${res.status} — installers may not be published yet`);
      return null;
    }
    const data = await res.json();
    if (!isSupportedPublicVersion(data.tag_name)) {
      console.warn(`[download] ${data.tag_name} predates the first public release`);
      return null;
    }
    const mac = findAsset(data.assets, DMG_PATTERN);
    const win = findAsset(data.assets, EXE_PATTERN);
    if (!mac && !win) {
      console.warn("[download] Latest release has no installer asset");
      return null;
    }
    return { version: data.tag_name.replace(/^v/, ""), mac, win };
  } catch (err) {
    console.error("[download] Failed to fetch release:", err);
    return null;
  }
}

function formatBytes(bytes) {
  if (typeof bytes !== "number" || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(0)} MB`;
}

/** Text for a key from the active dictionary, falling back to the markup. */
function translate(key, fallback) {
  const dict = window.__mlDict;
  if (!dict) return fallback;
  const value = key.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), dict);
  return typeof value === "string" ? value : fallback;
}

function enableDownload(release) {
  // Unknown platform is treated as macOS: it is the signed, notarized build, so
  // it is the safer thing to hand someone we cannot identify.
  const primaryKind = detectPlatform() === "win" ? "win" : "mac";
  const secondaryKind = primaryKind === "win" ? "mac" : "win";
  const primary = release[primaryKind];
  const secondary = release[secondaryKind];

  const buttons = [
    document.getElementById("download-btn"),
    document.getElementById("download-btn-2"),
  ].filter(Boolean);
  if (buttons.length === 0) return;

  // No build for this visitor's OS — a release can legitimately carry only one
  // platform. Leave the CTA in its "Coming soon" state rather than handing a
  // macOS user a .exe, but still surface the other build so the page is not a
  // dead end for someone downloading on behalf of another machine.
  if (!primary) {
    for (const alt of document.querySelectorAll("[data-download-alt]")) {
      if (!secondary) break;
      const key = secondaryKind === "win" ? "download.altWindows" : "download.altMac";
      alt.textContent = translate(key, secondaryKind === "win" ? "Also for Windows" : "Also for macOS");
      alt.setAttribute("data-i18n", key);
      alt.setAttribute("href", secondary.url);
      alt.setAttribute("download", secondary.name);
      alt.setAttribute("rel", "noopener");
      alt.hidden = false;
    }
    console.log(`[download] No ${primaryKind} asset in this release — CTA stays disabled`);
    return;
  }

  for (const btn of buttons) {
    btn.setAttribute("href", primary.url);
    btn.setAttribute("download", primary.name);
    btn.setAttribute("rel", "noopener");
    btn.removeAttribute("aria-disabled");
    btn.removeAttribute("onclick");
    btn.onclick = null;
    const label = btn.querySelector("[data-i18n]");
    if (label) {
      const key = primaryKind === "win" ? "download.forWindows" : "download.forMac";
      label.textContent = translate(key, primaryKind === "win" ? "Download for Windows" : "Download for macOS");
      label.removeAttribute("data-i18n"); // stop applyTranslations resetting it on locale change
      label.setAttribute("data-i18n", key);
    }
  }

  const badge = document.getElementById("download-badge");
  if (badge) {
    badge.textContent = `v${release.version} · ${formatBytes(primary.size)}`;
    badge.classList.add("available");
    badge.removeAttribute("data-i18n");
  }

  for (const alt of document.querySelectorAll("[data-download-alt]")) {
    if (!secondary) {
      alt.hidden = true;
      continue;
    }
    const key = secondaryKind === "win" ? "download.altWindows" : "download.altMac";
    alt.textContent = translate(key, secondaryKind === "win" ? "Also for Windows" : "Also for macOS");
    alt.setAttribute("data-i18n", key);
    alt.setAttribute("href", secondary.url);
    alt.setAttribute("download", secondary.name);
    alt.setAttribute("rel", "noopener");
    alt.hidden = false;
  }

  // Shown only to Windows visitors — macOS users never see SmartScreen, and an
  // unexplained security warning on someone else's page is just noise.
  for (const note of document.querySelectorAll("[data-win-note]")) {
    note.hidden = primaryKind !== "win";
  }

  console.log(`[download] Primary ${primaryKind}: ${primary.name} (${formatBytes(primary.size)})`);
}

(async function init() {
  if (!DOWNLOAD_ENABLED) {
    console.log("[download] Disabled by DOWNLOAD_ENABLED flag — buttons stay Coming soon");
    return;
  }
  /* Try to fetch — if no release yet, button stays disabled with "Coming soon" badge */
  const release = await fetchLatestRelease();
  if (release) {
    enableDownload(release);
  } else {
    console.log("[download] No release available — button stays disabled");
  }
})();
