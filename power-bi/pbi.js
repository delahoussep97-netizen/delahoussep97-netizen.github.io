/* Site freelance Power BI (/power-bi/) : formulaire vers la messagerie, compteur sans cookie. */
(function () {
  "use strict";
  var EMAIL = "paul.delahousse@outlook.com";
  var CODE_GC = "pauldelahousse";

  // Formulaire sans serveur : prépare un message dans la messagerie du visiteur
  var form = document.getElementById("formulaire");
  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!form.reportValidity()) return;
      var v = function (id) { return document.getElementById(id).value.trim(); };
      var sujet = "Projet Power BI" + (v("f-entreprise") ? " — " + v("f-entreprise") : "");
      var corps = "Bonjour Paul,\n\n" + v("f-besoin") + "\n\n" + v("f-nom") +
        (v("f-entreprise") ? "\n" + v("f-entreprise") : "") + "\n" + v("f-email");
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: "pbi-envoi-formulaire", title: "Formulaire Power BI", event: true });
      }
      window.location.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(sujet) + "&body=" + encodeURIComponent(corps);
    });
  }

  // Compteur GoatCounter : page vue, code de suivi (?c=P1), clics utiles
  var code = new URLSearchParams(location.search).get("c");
  if (code && !/^[A-Za-z0-9-]{1,20}$/.test(code)) code = null;
  function marquer(sel, nom) { document.querySelectorAll(sel).forEach(function (a) { a.setAttribute("data-goatcounter-click", nom); }); }
  marquer("a.cta", "pbi-clic-cta");
  marquer("#lien-email", "pbi-clic-email");
  marquer("#lien-malt", "pbi-clic-malt");
  marquer("#lien-cv", "pbi-clic-cv");
  marquer('a[href$="cas-dashboard-lubrifiants.pdf"]', "pbi-clic-cas-dashboard");
  marquer('a[href$="cas-crm-salesforce.pdf"]', "pbi-clic-cas-crm");
  marquer('a[href$="cas-modele-donnees-cdg-retail.pdf"]', "pbi-clic-cas-modele");
  window.goatcounter = { no_onload: true };
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter", "https://" + CODE_GC + ".goatcounter.com/count");
  s.onload = function () {
    if (!window.goatcounter || !window.goatcounter.count) return;
    window.goatcounter.count({ path: location.pathname });
    if (window.goatcounter.bind_events) window.goatcounter.bind_events();
    if (code) window.goatcounter.count({ path: "pbi-lien-" + code, title: "Lien Power BI " + code, event: true });
  };
  document.body.appendChild(s);
})();
