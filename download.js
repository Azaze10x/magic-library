/* Magic Library landing — Download button wiring
 *
 * GitHub Releases is the single download source. This module:
 * 1. Fetch latest release from GitHub Releases API
 * 2. Find the .dmg (macOS) and -setup.exe (Windows) assets
 * 3. Wire the macOS and Windows buttons independently, promoting whichever one
 *    matches the visitor's OS to the gold treatment
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

/* Unknown platform is treated as macOS: it is the signed, notarized build, so it
   is the safer thing to lead with for someone we cannot identify. The markup
   already leads with macOS, so this only has to move the emphasis for Windows. */
function leadKind() {
  return detectPlatform() === "win" ? "win" : "mac";
}

function buttonsFor(kind) {
  return document.querySelectorAll(`[data-download="${kind}"]`);
}

/* Move the gold treatment onto the visitor's own platform. Runs before the
   release API answers so the right button is emphasised from first paint. */
function emphasizePlatform(kind) {
  for (const btn of buttonsFor("mac")) btn.classList.toggle("btn-platform-lead", kind === "mac");
  for (const btn of buttonsFor("win")) btn.classList.toggle("btn-platform-lead", kind === "win");

  // Only alongside a promoted Windows build — someone heading for the .dmg never
  // meets SmartScreen, and an unexplained security warning is just noise to them.
  for (const note of document.querySelectorAll("[data-win-note]")) {
    note.hidden = kind !== "win";
  }
}

/* Wire one platform's buttons. A release can legitimately carry only one
   installer; the platform without an asset keeps its "Coming soon" state rather
   than pointing at a file that does not exist. */
function wirePlatform(kind, asset, version) {
  if (!asset) {
    console.log(`[download] No ${kind} asset in this release — that button stays disabled`);
    return;
  }
  for (const btn of buttonsFor(kind)) {
    btn.setAttribute("href", asset.url);
    btn.setAttribute("download", asset.name);
    btn.setAttribute("rel", "noopener");
    btn.removeAttribute("aria-disabled");
  }
  for (const meta of document.querySelectorAll(`[data-download-meta="${kind}"]`)) {
    meta.textContent = `v${version} · ${formatBytes(asset.size)}`;
    meta.classList.add("available");
    // Drop the key so a locale switch does not reset this back to "Coming soon".
    meta.removeAttribute("data-i18n");
  }
  console.log(`[download] ${kind}: ${asset.name} (${formatBytes(asset.size)})`);
}

function enableDownload(release) {
  wirePlatform("mac", release.mac, release.version);
  wirePlatform("win", release.win, release.version);

  // Never leave the gold on a button that cannot be clicked: if this release has
  // no build for the visitor's OS, lead with the one it does have.
  const preferred = leadKind();
  emphasizePlatform(release[preferred] ? preferred : preferred === "win" ? "mac" : "win");
}

(async function init() {
  emphasizePlatform(leadKind());
  if (!DOWNLOAD_ENABLED) {
    console.log("[download] Disabled by DOWNLOAD_ENABLED flag — buttons stay Coming soon");
    return;
  }
  /* Try to fetch — if no release yet, buttons stay disabled with "Coming soon" */
  const release = await fetchLatestRelease();
  if (release) {
    enableDownload(release);
  } else {
    console.log("[download] No release available — buttons stay disabled");
  }
})();
