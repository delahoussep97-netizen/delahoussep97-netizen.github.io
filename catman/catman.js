/* Page category manager (/catman/) : animations discrètes, compteur sans cookie. */
(function () {
  "use strict";
  var CODE_GC = "pauldelahousse";

  // Apparition au défilement (désactivée si l'utilisateur réduit les animations)
  var observateur = null;
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (x) {
        if (x.isIntersecting) { x.target.classList.add("vu"); observateur.unobserve(x.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  }
  document.querySelectorAll(".rv").forEach(function (n) { if (observateur) observateur.observe(n); else n.classList.add("vu"); });

  // Barre du haut : fond opaque dès qu'on quitte le haut de page
  var nav = document.getElementById("nav");
  function majNav() { nav.classList.toggle("colle", window.scrollY > 24); }
  window.addEventListener("scroll", majNav, { passive: true });
  majNav();

  // Compteur GoatCounter : page vue, code de candidature (?c=C1), clics utiles
  var code = new URLSearchParams(location.search).get("c");
  if (code && !/^[A-Za-z0-9-]{1,20}$/.test(code)) code = null;
  function marquer(sel, nom) { document.querySelectorAll(sel).forEach(function (a) { a.setAttribute("data-goatcounter-click", nom); }); }
  marquer('a[href^="mailto:"]', "cm-clic-email");
  marquer('a[href^="tel:"]', "cm-clic-telephone");
  marquer('a[href*="linkedin.com"]', "cm-clic-linkedin");
  marquer('#lien-cv, #lien-cv-haut', "cm-clic-cv");
  marquer('a[href$="cas-roi-promotionnel-retail.pdf"]', "cm-clic-cas-promo");
  marquer('a[href$="cas-power-bi-lubrifiants.pdf"]', "cm-clic-cas-power-bi");
  marquer('a[href$="cas-crm-salesforce.pdf"]', "cm-clic-cas-crm");
  window.goatcounter = { no_onload: true };
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter", "https://" + CODE_GC + ".goatcounter.com/count");
  s.onload = function () {
    if (!window.goatcounter || !window.goatcounter.count) return;
    window.goatcounter.count({ path: location.pathname });
    if (window.goatcounter.bind_events) window.goatcounter.bind_events();
    if (code) window.goatcounter.count({ path: "cm-candidature-" + code, title: "Candidature category manager " + code, event: true });
  };
  document.body.appendChild(s);
})();
