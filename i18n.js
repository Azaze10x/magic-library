/* Magic Library landing — i18n + locale switcher */

const LOCALE_LABELS = {
  th: "ไทย",
  en: "English",
  zh: "中文",
  id: "Indonesia",
  vi: "Tiếng Việt",
  ja: "日本語",
};

const DEFAULT_LOCALE = "en";
const STORAGE_KEY = "magic-library-locale";

/* CJK/Thai fonts are loaded on demand when the user selects those locales.
   Pairs with the app's design system: Maitree (body serif) + Sarabun (UI sans)
   for Thai, matching src/app/layout.tsx. */
const LOCALE_FONTS = {
  zh: "family=Noto+Sans+SC:wght@400;500;600",
  ja: "family=Noto+Sans+JP:wght@400;500;600",
  th: "family=Maitree:wght@400;500;600;700&family=Sarabun:wght@400;500;600&display=swap",
};
const loadedLocaleFonts = new Set();

function loadLocaleFont(locale) {
  const families = LOCALE_FONTS[locale];
  if (!families || loadedLocaleFonts.has(locale)) return;
  loadedLocaleFonts.add(locale);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}

/* Resolve a locale from navigator.languages → look up matching LOCALE_LABELS */
function detectLocale() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && LOCALE_LABELS[saved]) return saved;

  const supported = Object.keys(LOCALE_LABELS);
  const languages = navigator.languages || [navigator.language || ""];

  for (const lang of languages) {
    const short = lang.toLowerCase().split("-")[0];
    if (supported.includes(short)) return short;
  }
  return DEFAULT_LOCALE;
}

/* Walk the DOM and replace text by data-i18n="path.to.key" or HTML by data-i18n-html */
function applyTranslations(dict) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = lookup(dict, key);
    if (typeof value === "string") el.textContent = value;
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    const value = lookup(dict, key);
    if (typeof value === "string") el.innerHTML = value;
  });
}

function lookup(obj, path) {
  return path.split(".").reduce((acc, k) => (acc && acc[k] != null ? acc[k] : null), obj);
}

/* Update the document <title> + meta description from the locale's meta block */
function applyMeta(dict) {
  const meta = dict && dict.meta;
  if (!meta) return;
  if (meta.title) document.title = meta.title;
  const desc = document.getElementById("meta-description");
  if (desc && meta.description) desc.setAttribute("content", meta.description);
}

async function loadLocale(locale) {
  // Resolve locales/ relative to the page that included i18n.js so sub-pages
  // (pages/privacy.html) also work.
  const base = document.currentScript ? new URL(".", document.currentScript.src) : new URL(".", location.href);
  const res = await fetch(new URL(`locales/${locale}.json`, base).toString());
  if (!res.ok) throw new Error(`Failed to load locale: ${locale}`);
  return res.json();
}

function buildLanguageMenu() {
  const menu = document.getElementById("lang-menu");
  const current = document.getElementById("lang-current");
  const button = document.getElementById("lang-button");
  if (!menu || !current || !button) return;

  current.textContent = LOCALE_LABELS[getCurrentLocale()] || "English";
  menu.innerHTML = "";

  const items = [];
  for (const [code, label] of Object.entries(LOCALE_LABELS)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.role = "menuitem";
    btn.textContent = label;
    btn.dataset.locale = code;
    if (code === getCurrentLocale()) btn.classList.add("active");
    btn.addEventListener("click", () => {
      setLocale(code);
      closeMenu();
    });
    menu.appendChild(btn);
    items.push(btn);
  }

  function openMenu() {
    menu.classList.add("open");
    button.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    menu.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    const isOpen = menu.classList.toggle("open");
    button.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) items[0]?.focus();
  }

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  document.addEventListener("click", () => closeMenu());

  /* Keyboard navigation within the menu */
  menu.addEventListener("keydown", (e) => {
    const idx = items.indexOf(document.activeElement);
    if (e.key === "Escape") {
      closeMenu();
      button.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  });
}

let currentLocale = DEFAULT_LOCALE;
let currentDict = {};

function getCurrentLocale() {
  return currentLocale;
}

async function setLocale(locale) {
  if (!LOCALE_LABELS[locale]) return;
  currentLocale = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  currentDict = await loadLocale(locale);
  applyTranslations(currentDict);
  applyMeta(currentDict);
  document.documentElement.lang = locale;
  loadLocaleFont(locale);
  /* Update switcher label + active state */
  const label = document.getElementById("lang-current");
  if (label) label.textContent = LOCALE_LABELS[locale];
  document.querySelectorAll("#lang-menu button").forEach((b) => {
    b.classList.toggle("active", b.dataset.locale === locale);
  });
}

/* Initialize */
(async function init() {
  setupScrollAnimations();
  buildLanguageMenu();
  try {
    const locale = detectLocale();
    await setLocale(locale);
  } catch (err) {
    console.error("[i18n] Failed to load locale, using fallback text:", err);
  }
})();

function setupScrollAnimations() {
  /* Signals the head-script safety net that reveal logic is now in control. */
  window.__scrollAnimReady = true;
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".fade-in").forEach((el) => el.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
  );
  document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
}
