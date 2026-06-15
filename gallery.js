/* Magic Library landing — screenshot lightbox / slide demo.
 * Click any hero shot or gallery item to open an overlay slideshow.
 * Supports keyboard arrows/Esc, touch swipe, backdrop click, and reduced motion. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var SLIDES = [
    { id: "bookshelf", caption: getHeroCaption },
    { id: "story-plan", caption: getGalleryCaptionFn(0) },
    { id: "review", caption: getGalleryCaptionFn(1) },
    { id: "chat", caption: getGalleryCaptionFn(2) },
  ];

  var lightbox = document.getElementById("lightbox");
  var img = document.getElementById("lightbox-img");
  var captionEl = document.getElementById("lightbox-caption");
  var counterEl = document.getElementById("lightbox-counter");
  var closeBtn = document.getElementById("lightbox-close");
  var prevBtn = document.getElementById("lightbox-prev");
  var nextBtn = document.getElementById("lightbox-next");
  var current = 0;
  var isOpen = false;
  var lastFocused = null;

  function getLocale() {
    return (window.getCurrentLocale && window.getCurrentLocale()) || "en";
  }

  function getHeroCaption() {
    var el = document.querySelector(".hero-shot-caption");
    return el ? el.textContent.trim() : "";
  }

  function getGalleryCaptionFn(index) {
    return function () {
      var items = document.querySelectorAll(".gallery-item-caption");
      return items[index] ? items[index].textContent.trim() : "";
    };
  }

  function resolveSrc(id) {
    return "assets/screenshots/" + id + "-" + getLocale() + ".png";
  }

  function show(index) {
    var len = SLIDES.length;
    current = ((index % len) + len) % len;
    var slide = SLIDES[current];
    var src = resolveSrc(slide.id);

    img.alt = slide.caption() || "Magic Library screenshot";
    img.src = src;
    img.onerror = function () {
      img.onerror = null;
      var fallback = "assets/screenshots/" + slide.id + "-en.png";
      if (img.getAttribute("src") !== fallback) img.src = fallback;
    };

    captionEl.textContent = slide.caption();
    counterEl.textContent = (current + 1) + " / " + len;

    if (prevBtn) prevBtn.disabled = len <= 1;
    if (nextBtn) nextBtn.disabled = len <= 1;
  }

  function openAt(index, trigger) {
    if (!lightbox) return;
    isOpen = true;
    lastFocused = trigger || document.activeElement;
    show(index);

    lightbox.removeAttribute("hidden");
    document.body.style.overflow = "hidden";

    if (!reduceMotion) {
      requestAnimationFrame(function () {
        lightbox.classList.add("open");
      });
    } else {
      lightbox.classList.add("open");
    }

    document.addEventListener("keydown", onKeyDown);
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    if (!lightbox || !isOpen) return;
    isOpen = false;
    document.removeEventListener("keydown", onKeyDown);

    if (!reduceMotion) {
      lightbox.classList.remove("open");
      var hideTimer = setTimeout(function () {
        if (!isOpen) lightbox.setAttribute("hidden", "");
      }, 350);
      lightbox.addEventListener("transitionend", function handler(e) {
        if (e.target === lightbox && !isOpen) {
          clearTimeout(hideTimer);
          lightbox.setAttribute("hidden", "");
          lightbox.removeEventListener("transitionend", handler);
        }
      });
    } else {
      lightbox.classList.remove("open");
      lightbox.setAttribute("hidden", "");
    }

    document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowLeft") {
      show(current - 1);
    } else if (e.key === "ArrowRight") {
      show(current + 1);
    }
  }

  function onTriggerClick(index) {
    return function (e) {
      if (e) e.preventDefault();
      openAt(index, this);
    };
  }

  function onTriggerKeyDown(index) {
    return function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openAt(index, this);
      }
    };
  }

  // Bind hero shot and gallery items.
  document.querySelectorAll("[data-lightbox-index]").forEach(function (el) {
    var index = parseInt(el.getAttribute("data-lightbox-index"), 10);
    if (Number.isNaN(index)) return;
    el.addEventListener("click", onTriggerClick(index));
    el.addEventListener("keydown", onTriggerKeyDown(index));
  });

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (prevBtn) prevBtn.addEventListener("click", function (e) { e.stopPropagation(); show(current - 1); });
  if (nextBtn) nextBtn.addEventListener("click", function (e) { e.stopPropagation(); show(current + 1); });

  // Close on backdrop click (but not when tapping buttons or the stage).
  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) close();
    });
  }

  // Touch swipe support.
  var touchStartX = 0;
  var touchStartY = 0;
  if (lightbox) {
    lightbox.addEventListener("touchstart", function (e) {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    lightbox.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].screenX - touchStartX;
      var dy = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        show(dx < 0 ? current + 1 : current - 1);
      }
    }, { passive: true });
  }
})();
