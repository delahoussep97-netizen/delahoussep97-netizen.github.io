/* Page business analyst (/ba/) : journal des erreurs du cas CRM, animations discrètes, compteur sans cookie. */
(function () {
  "use strict";
  var VERSION = "20261005e";
  // Entrées du journal liées au cas CRM Salesforce, retenues pour la page BA
  var IDS = ["A3", "A4", "B2", "B4", "C3"];
  var CODE_GC = "pauldelahousse";

  function el(tag, attrs, texte) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (texte != null) n.textContent = texte;
    return n;
  }

  // Apparition au défilement (désactivée si l'utilisateur réduit les animations)
  var observateur = null;
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (x) {
        if (x.isIntersecting) { x.target.classList.add("vu"); observateur.unobserve(x.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  }
  function surveiller(n) { if (observateur) observateur.observe(n); else n.classList.add("vu"); }
  document.querySelectorAll(".rv").forEach(surveiller);

  // Barre du haut : fond opaque dès qu'on quitte le haut de page
  var nav = document.getElementById("nav");
  function majNav() { nav.classList.toggle("colle", window.scrollY > 24); }
  window.addEventListener("scroll", majNav, { passive: true });
  majNav();

  fetch("../journal.json?v=" + VERSION).then(function (r) { return r.json(); }).then(function (j) {
    var z = document.getElementById("journal");
    IDS.forEach(function (id, i) {
      var e = j.entrees.filter(function (x) { return x.id === id; })[0];
      if (!e) return;
      var d = el("article", { "class": "entree rv", "style": "--d:" + (i % 2) * 0.08 + "s" });
      var h = el("h3");
      h.appendChild(el("span", { "class": "n" }, "Erreur " + (i + 1)));
      h.appendChild(el("span", null, e.titre));
      d.appendChild(h);
      var dl = el("dl");
      [["Contexte", e.contexte, ""], ["Faux", e.faux, "faux"], ["Repéré", e.repere, ""], ["Changé", e.change, "change"]].forEach(function (x) {
        dl.appendChild(el("dt", x[2] ? { "class": x[2] } : null, x[0]));
        dl.appendChild(el("dd", null, x[1]));
      });
      d.appendChild(dl);
      z.appendChild(d);
      surveiller(d);
    });
  }).catch(function () {});

  // Compteur GoatCounter : page vue, code de candidature (?c=B1), clics utiles
  var code = new URLSearchParams(location.search).get("c");
  if (code && !/^[A-Za-z0-9-]{1,20}$/.test(code)) code = null;
  function marquer(sel, nom) { document.querySelectorAll(sel).forEach(function (a) { a.setAttribute("data-goatcounter-click", nom); }); }
  marquer('a[href^="mailto:"]', "ba-clic-email");
  marquer('a[href*="subject=User%20story"]', "ba-clic-offre-user-story");
  marquer('a[href^="tel:"]', "ba-clic-telephone");
  marquer('a[href*="linkedin.com"]', "ba-clic-linkedin");
  marquer('#lien-cv, #lien-cv-haut', "ba-clic-cv");
  marquer('a[href$="cas-ba-credit-immobilier.pdf"]', "ba-clic-cas-ba");
  marquer('a[href$="cas-crm-salesforce.pdf"]', "ba-clic-cas-crm");
  marquer('a[href$="cas-power-bi-lubrifiants.pdf"]', "ba-clic-cas-power-bi");
  window.goatcounter = { no_onload: true };
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter", "https://" + CODE_GC + ".goatcounter.com/count");
  s.onload = function () {
    if (!window.goatcounter || !window.goatcounter.count) return;
    window.goatcounter.count({ path: location.pathname });
    if (window.goatcounter.bind_events) window.goatcounter.bind_events();
    if (code) window.goatcounter.count({ path: "ba-candidature-" + code, title: "Candidature BA " + code, event: true });
  };
  document.body.appendChild(s);
})();
