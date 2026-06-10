/* Magic Library landing — Download button wiring
 *
 * Currently DISABLED (DMG not ready). When ready, this will:
 * 1. Fetch latest release from GitHub Releases API
 * 2. Find the .dmg asset
 * 3. Wire the primary CTA to download that file
 *
 * For now, the button is shown with a "Coming Soon" badge and the click is a no-op.
 */

const RELEASE_API = "https://api.github.com/repos/Azaze10x/magic-library/releases/latest";
const DMG_PATTERN = /\.dmg$/i;

let latestRelease = null;

async function fetchLatestRelease() {
  try {
    const res = await fetch(RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      console.warn(`[download] GitHub API returned ${res.status} — DMG may not be published yet`);
      return null;
    }
    const data = await res.json();
    const dmg = (data.assets || []).find((a) => DMG_PATTERN.test(a.name));
    if (!dmg) {
      console.warn("[download] Latest release has no .dmg asset");
      return null;
    }
    return {
      version: data.tag_name,
      url: dmg.browser_download_url,
      size: dmg.size,
      name: dmg.name,
    };
  } catch (err) {
    console.error("[download] Failed to fetch release:", err);
    return null;
  }
}

function enableDownload(release) {
  const buttons = [
    document.getElementById("download-btn"),
    document.getElementById("download-btn-2"),
  ].filter(Boolean);
  const badge = document.getElementById("download-badge");
  if (!release || buttons.length === 0) return;

  for (const btn of buttons) {
    btn.setAttribute("href", release.url);
    btn.setAttribute("download", release.name);
    btn.setAttribute("rel", "noopener");
    btn.removeAttribute("aria-disabled");
    btn.removeAttribute("onclick");
    btn.onclick = null;
  }

  if (badge) {
    badge.textContent = `v${release.version} · ${formatBytes(release.size)}`;
    badge.classList.add("available");
  }
  console.log(`[download] Wired to ${release.name} (${formatBytes(release.size)})`);
}

function formatBytes(bytes) {
  if (typeof bytes !== "number" || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(0)} MB`;
}

(async function init() {
  /* Try to fetch — if no release yet, button stays disabled with "Coming soon" badge */
  const release = await fetchLatestRelease();
  if (release) {
    latestRelease = release;
    enableDownload(release);
  } else {
    console.log("[download] No release available — button stays disabled");
  }
})();
