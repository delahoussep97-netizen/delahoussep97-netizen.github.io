/* Page business analyst (/ba/) : journal des erreurs du cas CRM, compteur sans cookie. */
(function () {
  "use strict";
  var VERSION = "20261005a";
  // Entrées du journal liées au cas CRM Salesforce, retenues pour la page BA
  var IDS = ["A3", "A4", "B2", "B4", "C3"];
  var CODE_GC = "pauldelahousse";

  function el(tag, attrs, texte) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (texte != null) n.textContent = texte;
    return n;
  }

  fetch("../journal.json?v=" + VERSION).then(function (r) { return r.json(); }).then(function (j) {
    var z = document.getElementById("journal");
    IDS.forEach(function (id) {
      var e = j.entrees.filter(function (x) { return x.id === id; })[0];
      if (!e) return;
      var d = el("article", { "class": "entree" });
      d.appendChild(el("h3", null, e.titre));
      var dl = el("dl");
      [["Contexte", e.contexte], ["Faux", e.faux], ["Repéré", e.repere], ["Changé", e.change]].forEach(function (x) {
        dl.appendChild(el("dt", null, x[0]));
        dl.appendChild(el("dd", null, x[1]));
      });
      d.appendChild(dl);
      z.appendChild(d);
    });
  }).catch(function () {});

  // Compteur GoatCounter : page vue, code de candidature (?c=B1), clics utiles
  var code = new URLSearchParams(location.search).get("c");
  if (code && !/^[A-Za-z0-9-]{1,20}$/.test(code)) code = null;
  function marquer(sel, nom) { document.querySelectorAll(sel).forEach(function (a) { a.setAttribute("data-goatcounter-click", nom); }); }
  marquer('a[href^="mailto:"]', "ba-clic-email");
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
