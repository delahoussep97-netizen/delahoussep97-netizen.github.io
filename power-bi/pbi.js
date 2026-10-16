/* Site freelance Power BI (/power-bi/) : formulaire vers la messagerie (questions et message vocal facultatifs), compteur sans cookie. */
(function () {
  "use strict";
  var EMAIL = "paul.delahousse@outlook.com";
  var CODE_GC = "pauldelahousse";
  var DUREE_MAX = 180; // secondes

  function evenement(nom, titre) {
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: nom, title: titre, event: true });
  }
  function $(id) { return document.getElementById(id); }

  // Téléphone demandé seulement si le visiteur préfère être rappelé
  var rappel = $("q-rappel");
  if (rappel) rappel.addEventListener("change", function () { $("champ-tel").hidden = rappel.value !== "Par téléphone"; });

  // Message vocal : enregistré dans le navigateur, jamais envoyé à un serveur
  var vocal = { blob: null, ext: "webm", rec: null, flux: null, chrono: null, debut: 0 };
  var peutEnregistrer = !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  if ($("vocal") && peutEnregistrer) {
    $("vocal").hidden = false;
    var temps = $("v-temps"), audio = $("v-audio");
    var format = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0] || "";
    function mmss(s) { return Math.floor(s / 60) + ":" + ("0" + Math.floor(s % 60)).slice(-2); }
    function arreter() {
      if (vocal.rec && vocal.rec.state === "recording") vocal.rec.stop();
    }
    $("v-enreg").addEventListener("click", function () {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (flux) {
        vocal.flux = flux;
        var morceaux = [];
        vocal.rec = format ? new MediaRecorder(flux, { mimeType: format }) : new MediaRecorder(flux);
        vocal.rec.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
        vocal.rec.onstop = function () {
          clearInterval(vocal.chrono);
          flux.getTracks().forEach(function (t) { t.stop(); });
          var type = vocal.rec.mimeType || format || "audio/webm";
          vocal.ext = /mp4/.test(type) ? "m4a" : /ogg/.test(type) ? "ogg" : "webm";
          vocal.blob = new Blob(morceaux, { type: type });
          audio.src = URL.createObjectURL(vocal.blob);
          audio.hidden = false;
          $("v-suppr").hidden = false;
          $("v-stop").hidden = true;
          $("v-enreg").hidden = false;
          $("v-enreg").lastChild.textContent = "Recommencer";
          $("vocal").classList.remove("enregistre");
          temps.textContent = "Enregistré : " + mmss((Date.now() - vocal.debut) / 1000);
          evenement("pbi-message-vocal", "Message vocal enregistré");
        };
        vocal.rec.start();
        vocal.debut = Date.now();
        $("vocal").classList.add("enregistre");
        $("v-enreg").hidden = true;
        $("v-stop").hidden = false;
        audio.hidden = true;
        vocal.chrono = setInterval(function () {
          var s = (Date.now() - vocal.debut) / 1000;
          temps.textContent = "Enregistrement… " + mmss(s) + " / " + mmss(DUREE_MAX);
          if (s >= DUREE_MAX) arreter();
        }, 250);
      }).catch(function () {
        temps.textContent = "Micro indisponible ou refusé : vous pouvez décrire votre besoin par écrit.";
      });
    });
    $("v-stop").addEventListener("click", arreter);
    $("v-suppr").addEventListener("click", function () {
      vocal.blob = null;
      audio.removeAttribute("src");
      audio.hidden = true;
      $("v-suppr").hidden = true;
      $("v-enreg").lastChild.textContent = "Enregistrer";
      temps.textContent = "";
    });
  }

  // Formulaire sans serveur : prépare un message dans la messagerie du visiteur
  var form = $("formulaire");
  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!form.reportValidity()) return;
      var v = function (id) { return $(id).value.trim(); };
      var sujet = "Projet Power BI" + (v("f-entreprise") ? " — " + v("f-entreprise") : "");
      var lignes = [];
      form.querySelectorAll("[data-question]").forEach(function (q) {
        var val;
        if (q.tagName === "FIELDSET") {
          val = Array.prototype.map.call(q.querySelectorAll("input:checked"), function (c) { return c.value; }).join(", ");
        } else if (!q.closest("[hidden]")) {
          val = q.value.trim();
        }
        if (val) lignes.push("- " + q.getAttribute("data-question") + " : " + val);
      });
      var fichier = "";
      if (vocal.blob) {
        fichier = "message-vocal-" + (v("f-nom") || "contact").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "." + vocal.ext;
        var a = document.createElement("a");
        a.href = URL.createObjectURL(vocal.blob);
        a.download = fichier;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      var corps = "Bonjour Paul,\n\n" + v("f-besoin") +
        (lignes.length ? "\n\nPrécisions :\n" + lignes.join("\n") : "") +
        (fichier ? "\n\nMessage vocal : fichier « " + fichier + " » joint à ce mail." : "") +
        "\n\n" + v("f-nom") + (v("f-entreprise") ? "\n" + v("f-entreprise") : "") + "\n" + v("f-email");
      evenement("pbi-envoi-formulaire", "Formulaire Power BI");
      if (lignes.length) evenement("pbi-formulaire-precisions", "Formulaire avec précisions");
      // Laisse le téléchargement démarrer avant d'ouvrir la messagerie
      var lien = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(sujet) + "&body=" + encodeURIComponent(corps);
      form.setAttribute("data-dernier-envoi", lien); // contrôlé par les tests
      setTimeout(function () { window.location.href = lien; }, fichier ? 600 : 0);
      if (fichier) {
        var n = form.querySelector(".note");
        n.textContent = "Votre message vocal a été téléchargé (« " + fichier + " ») : joignez-le au message qui vient de s'ouvrir.";
      }
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
  var plus = $("plus");
  if (plus) plus.addEventListener("toggle", function () { if (plus.open) evenement("pbi-ouverture-precisions", "Ouverture des questions facultatives"); });
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
