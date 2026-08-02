/* Magic Library landing — keep the Nexus plan ladder true to the portal
 *
 * The plan cards quote each tier as a multiple of the entry plan ("5× the entry
 * plan") rather than a raw credit allowance, matching the app's plan cards. The
 * multiple is the one number on the card, so it has to be right: it was
 * hand-written here once and drifted, advertising 3,000 and 10,000 credits while
 * the portal sold 5,000 and 20,000.
 *
 * The portal publishes its catalogue at /api/public/plans, CORS-open and without
 * auth, exactly so it can be the single source of truth; the desktop app reads it
 * through fetchNexusPlans (src/lib/nexus/config.ts). This does the same, and
 * derives the multiple the way planMultiplier does, so raising the entry
 * allowance updates every card instead of silently making them lies.
 *
 * The translated strings in locales/*.json carry correct multiples of their own
 * and stand when the portal is unreachable.
 */

const PLANS_URL = "https://nexus.shamantech.co/api/public/plans";
const PLAN_IDS = ["creator", "pro", "studio"];

let liveMultiples = null;

/** Money-adjacent display data: drop anything malformed rather than coerce it,
 *  and return null on an unusable payload so the translated text stays. */
function parseMultiples(raw) {
  const arr = raw && raw.plans;
  if (!Array.isArray(arr)) return null;

  const plans = arr.filter(
    (p) =>
      p &&
      PLAN_IDS.includes(p.id) &&
      typeof p.credits === "number" &&
      Number.isFinite(p.credits) &&
      p.credits > 0
  );
  if (!plans.length) return null;

  const base = Math.min(...plans.map((p) => p.credits));
  const out = {};
  for (const plan of plans) {
    // Only exact multiples get quoted. A legacy or prorated allowance is not
    // "3.7× the entry plan", and rounding it would state a tier nobody sells.
    if (plan.credits % base !== 0) continue;
    out[plan.id] = plan.credits / base;
  }
  return out;
}

/** Swap the multiple inside the translated label, whichever side of the × the
 *  language puts it on: "5× the entry plan" and "入门套餐的 5×" both work. */
function render() {
  if (!liveMultiples) return;
  for (const id of PLAN_IDS) {
    const multiple = liveMultiples[id];
    const el = document.querySelector(`[data-i18n="nexus.plans.${id}.credits"]`);
    // The entry plan itself carries no multiple — nothing to keep in sync.
    if (!el || !multiple || multiple === 1) continue;
    el.textContent = el.textContent.replace(/\d+(?=\s*×)/, String(multiple));
  }
}

async function load() {
  try {
    const res = await fetch(PLANS_URL, { cache: "no-store" });
    if (!res.ok) return;
    liveMultiples = parseMultiples(await res.json());
    render();
  } catch {
    // Offline, blocked, or the portal is down — the translated ladder stands.
  }
}

// applyTranslations rewrites every [data-i18n] node on a language switch, so the
// live figures have to be re-applied afterwards.
document.addEventListener("ml:locale", render);
load();
