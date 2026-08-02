/* Magic Library landing — keep the Nexus plan cards true to the portal
 *
 * The cards quote each tier as a multiple of the entry plan ("5× the entry
 * plan") and a monthly price, matching the app's plan cards. Both were
 * hand-written here once and the allowances drifted: the page advertised 3,000
 * and 10,000 credits while the portal sold 5,000 and 20,000. Prices matched, so
 * nothing looked broken — the page simply promised less than a buyer received,
 * in six languages, for as long as the numbers sat here uncorrected.
 *
 * The portal publishes its catalogue at /api/public/plans, CORS-open and without
 * auth, described in its own source as existing so ecosystem apps fetch the
 * numbers instead of keeping a copy. The desktop app reads it through
 * fetchNexusPlans (src/lib/nexus/config.ts); this reads the same list.
 *
 * Why the multiple rather than the credit count: the portal stores each plan's
 * grant as MONEY (PLAN_ALLOWANCE_MICROUSD) and renders credits from it at the
 * current credit value. "5,000 credits" is therefore only true at today's
 * valuation — halve what a credit is worth and the same grant renders as 10,000
 * — while "5×" is a ratio between grants and holds at any valuation.
 *
 * The price is synced for a blunter reason: the portal is the till. A page that
 * advertises one figure while checkout charges another is not a stale number,
 * it is a broken promise.
 *
 * The translated strings carry correct values of their own and stand when the
 * portal is unreachable.
 */

const PLANS_URL = "https://nexus.shamantech.co/api/public/plans";
const PLAN_IDS = ["creator", "pro", "studio"];

let livePlans = null;

/** Money-adjacent display data: drop anything malformed rather than coerce it,
 *  and return null on an unusable payload so the translated text stays. */
function parse(raw) {
  const arr = raw && raw.plans;
  if (!Array.isArray(arr)) return null;

  const plans = arr.filter(
    (p) =>
      p &&
      PLAN_IDS.includes(p.id) &&
      [p.credits, p.thb].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0)
  );
  if (!plans.length) return null;

  const base = Math.min(...plans.map((p) => p.credits));
  const out = {};
  for (const plan of plans) {
    // Only exact multiples get quoted. A legacy or prorated allowance is not
    // "3.7× the entry plan", and rounding it would state a tier nobody sells.
    const multiple = plan.credits % base === 0 ? plan.credits / base : null;
    out[plan.id] = { multiple, thb: plan.thb };
  }
  return out;
}

/** Replace a number inside a translated string without disturbing the rest of
 *  it — each locale has its own grouping and its own word order. */
function swapNumber(text, pattern, value, locale) {
  const formatted = new Intl.NumberFormat(locale || "en").format(value);
  return text.replace(pattern, (match) => match.replace(/[\d.,]+/, formatted));
}

function render(event) {
  if (!livePlans) return;
  // The event carries the locale it just applied; the document attribute is the
  // fallback for the initial load, when nothing dispatched.
  const locale = event?.detail?.locale || document.documentElement.lang || "en";

  for (const id of PLAN_IDS) {
    const plan = livePlans[id];
    if (!plan) continue;

    // The entry plan carries no multiple — there is nothing to keep in sync.
    if (plan.multiple && plan.multiple !== 1) {
      const el = document.querySelector(`[data-i18n="nexus.plans.${id}.credits"]`);
      // Matched against the × so it works whichever side the language puts the
      // figure on: "5× the entry plan" and "入门套餐的 5×".
      if (el) el.textContent = el.textContent.replace(/\d+(?=\s*×)/, String(plan.multiple));
    }

    const priceEl = document.querySelector(`[data-i18n="nexus.plans.${id}.price"]`);
    // Anchored on ฿ so the locale's own suffix — "/ mo", "/ bln", "/ เดือน" —
    // survives untouched.
    if (priceEl) priceEl.textContent = swapNumber(priceEl.textContent, /฿\s*[\d.,]+/, plan.thb, locale);
  }
}

async function load() {
  try {
    const res = await fetch(PLANS_URL, { cache: "no-store" });
    if (!res.ok) return;
    livePlans = parse(await res.json());
    render();
  } catch {
    // Offline, blocked, or the portal is down — the translated figures stand.
  }
}

// applyTranslations rewrites every [data-i18n] node on a language switch, so the
// live figures have to be re-applied afterwards.
document.addEventListener("ml:locale", render);
load();
