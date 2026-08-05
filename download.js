/* Magic Library landing — Download button wiring
 *
 * GitHub Releases is the single download source. This module:
 * 1. Wire the buttons to SHIPPED_RELEASE immediately, so a published build is
 *    downloadable on first paint with no network call of our own
 * 2. Ask the GitHub Releases API whether something newer exists, and upgrade
 * 3. Promote whichever platform matches the visitor's OS to the gold treatment
 *
 * The API is an upgrade, never a dependency. It used to be the only source, and
 * the failure mode was unacceptable: unauthenticated GitHub allows 60 requests
 * per hour per IP, and every page load spent one. Once an office, a campus or a
 * CGNAT range burned through them, api.github.com answered 403 and this page
 * quietly told every visitor the app was still "Coming soon" — with the buttons
 * dead. A shipped build must not stop existing because a rate limit was hit,
 * GitHub had an outage, or a firewall dislikes api.github.com.
 *
 * SHIPPED_RELEASE therefore has to be bumped when a release is published. If it
 * goes stale the page offers an older build rather than no build, which is the
 * right way round to be wrong.
 *
 * The Windows installer is not code-signed, so SmartScreen shows "Windows
 * protected your PC" on first run. Telling people that up front — with the
 * exact way through it — costs nothing and is the single biggest lever on
 * download→install drop-off for an unsigned build.
 */

const DOWNLOAD_ENABLED = true;
const MIN_PUBLIC_VERSION = [0, 1, 1];

/* The newest release known at publish time. `null` means that platform has no
   installer yet and its button stays "Coming soon". */
const SHIPPED_RELEASE = {
  version: "0.1.12",
  mac: null,
  win: {
    url: "https://github.com/Azaze10x/magic-library/releases/download/v0.1.12/Magic-Library-0.1.12-x64-setup.exe",
    name: "Magic-Library-0.1.12-x64-setup.exe",
    size: 149519043,
  },
};

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
      // 403 here is almost always the 60-per-hour unauthenticated rate limit.
      console.warn(`[download] GitHub API returned ${res.status} — keeping the shipped build`);
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
   is the safer thing to lead with for someone we cannot identify. */
function ownKind() {
  return detectPlatform() === "win" ? "win" : "mac";
}

function otherKind(kind) {
  return kind === "win" ? "mac" : "win";
}

function buttonsFor(kind) {
  return document.querySelectorAll(`[data-download="${kind}"]`);
}

function isWired(kind) {
  const btn = buttonsFor(kind)[0];
  return Boolean(btn) && !btn.hasAttribute("aria-disabled");
}

/* Move the gold onto the visitor's own platform — unless nothing has shipped for
   it, in which case the emphasis goes to a build they can actually download. */
function emphasizePlatform() {
  const own = ownKind();
  const kind = isWired(own) || !isWired(otherKind(own)) ? own : otherKind(own);

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
  if (!asset) return;
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

function applyRelease(release) {
  wirePlatform("mac", release.mac, release.version);
  wirePlatform("win", release.win, release.version);
  emphasizePlatform();
}

/** Strictly newer than the build baked in at publish time? */
function supersedesShipped(version) {
  const next = parseVersion(version);
  const current = parseVersion(SHIPPED_RELEASE.version);
  if (!next || !current) return false;
  for (let index = 0; index < next.length; index += 1) {
    if (next[index] > current[index]) return true;
    if (next[index] < current[index]) return false;
  }
  return false;
}

(async function init() {
  if (!DOWNLOAD_ENABLED) {
    emphasizePlatform();
    console.log("[download] Disabled by DOWNLOAD_ENABLED flag — buttons stay Coming soon");
    return;
  }

  applyRelease(SHIPPED_RELEASE);

  /* From here on it is only ever an upgrade: a failed or rate-limited API call
     leaves the shipped build in place instead of taking the buttons away. */
  const latest = await fetchLatestRelease();
  if (!latest) return;
  if (!supersedesShipped(latest.version)) {
    console.log(`[download] API has v${latest.version}; shipped v${SHIPPED_RELEASE.version} already covers it`);
    return;
  }
  console.log(`[download] Upgrading to v${latest.version} from the API`);
  applyRelease(latest);
})();
