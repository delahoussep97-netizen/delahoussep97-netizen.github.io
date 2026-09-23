/* Preuve publique — page unique. Données dans data/*.json, aucun framework, aucun cookie. */
(function () {
  "use strict";

  var nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  var NOMS = {
    ca: "Chiffre d'affaires",
    taux_marge_commerciale: "Marge commerciale",
    taux_marge_sur_matieres: "Marge sur consommations matières",
    marge_exploitation: "Résultat d'exploitation / CA",
    poids_masse_salariale: "Masse salariale / CA",
    bfr_jours_ca: "BFR simplifié, en jours de CA",
    bfr_simplifie: "BFR simplifié",
    delai_clients: "Délai clients",
    delai_fournisseurs: "Délai fournisseurs",
    marge_commerciale: "Marge commerciale (montant)",
    marge_sur_matieres: "Marge sur matières (montant)"
  };

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, texte) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (texte != null) n.textContent = texte;
    return n;
  }
  function charger(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); });
  }

  function formater(v, unite) {
    if (v == null) return "non publiée";
    if (unite === "%") return nf1.format(v * 100) + " %";
    if (unite === "jours") return nf0.format(v) + " j";
    if (unite === "M€") return nf1.format(v / 1e6) + " M€";
    return nf0.format(v) + " €";
  }

  /* Sources d'un ratio : pages et dépôts des postes utilisés, pour l'exercice. */
  function sourcesRatio(ent, annee, postes) {
    var ex = ent.exercices[annee] || { postes: {} };
    var pages = {};
    (postes || []).forEach(function (p) {
      var s = ex.postes[p];
      if (!s) return;
      (pages[s.source] = pages[s.source] || {})[s.page] = true;
    });
    var docs = {};
    ent.sources.forEach(function (s) { docs[s.id] = s.document; });
    return Object.keys(pages).map(function (id) {
      var ps = Object.keys(pages[id]).map(Number).sort(function (a, b) { return a - b; });
      return (docs[id] || id) + " — p. " + ps.join(", ");
    });
  }

  /* ---------- Graphe : colonnes, une série, base zéro ---------- */
  var bulle, derniere = null;
  function montrerBulle(evt, html, conteneur) {
    derniere = { html: html, conteneur: conteneur };
    bulle.innerHTML = html;
    bulle.hidden = false;
    var r = conteneur.getBoundingClientRect();
    var x = (evt.clientX || r.left + r.width / 2) + window.scrollX + 12;
    var y = (evt.clientY || r.top) + window.scrollY + 12;
    var w = bulle.offsetWidth;
    if (x + w > window.scrollX + document.documentElement.clientWidth - 8) x = window.scrollX + document.documentElement.clientWidth - w - 8;
    bulle.style.left = x + "px";
    bulle.style.top = y + "px";
  }
  function cacherBulle() { bulle.hidden = true; }

  function graphe(titre, formule, points, unite) {
    // points : [{annee, valeur, sources:[...]}]
    var boite = el("div", { "class": "graphe" });
    boite.appendChild(el("h4", null, titre));
    if (formule) boite.appendChild(el("p", { "class": "formule" }, formule));
    var W = 200, H = 128, haut = 18, bas = 20;
    var vals = points.map(function (p) { return p.valeur; }).filter(function (v) { return v != null; });
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", titre + " : " + points.map(function (p) { return p.annee + " " + formater(p.valeur, unite); }).join(", "));
    var max = Math.max(0, Math.max.apply(null, vals.concat([0])));
    var min = Math.min(0, Math.min.apply(null, vals.concat([0])));
    if (min < 0) bas += 14;   // place pour l'étiquette sous une barre négative
    if (max === min) max = 1;
    var zoneH = H - haut - bas;
    function y(v) { return haut + (max - v) / (max - min) * zoneH; }
    var y0 = y(0);
    var axe = document.createElementNS(ns, "line");
    axe.setAttribute("x1", 4); axe.setAttribute("x2", W - 4); axe.setAttribute("y1", y0); axe.setAttribute("y2", y0);
    axe.setAttribute("class", "axe");
    svg.appendChild(axe);
    var bande = (W - 8) / points.length, lb = 24;
    points.forEach(function (p, i) {
      var cx = 4 + bande * i + bande / 2;
      var an = document.createElementNS(ns, "text");
      an.setAttribute("x", cx); an.setAttribute("y", H - 4); an.setAttribute("text-anchor", "middle");
      an.setAttribute("class", "an"); an.textContent = p.annee;
      svg.appendChild(an);
      var t = document.createElementNS(ns, "text");
      t.setAttribute("x", cx); t.setAttribute("text-anchor", "middle");
      if (p.valeur == null) {
        t.setAttribute("y", y0 - 6); t.setAttribute("class", "np"); t.textContent = "non publiée";
        svg.appendChild(t);
      } else {
        var yv = y(p.valeur), neg = p.valeur < 0;
        var h = Math.max(1, Math.abs(yv - y0)), r = Math.min(4, h);
        var x0 = cx - lb / 2, x1 = cx + lb / 2;
        // extrémité arrondie côté donnée, carrée côté base
        var d = neg
          ? "M" + x0 + "," + y0 + " H" + x1 + " V" + (y0 + h - r) + " Q" + x1 + "," + (y0 + h) + " " + (x1 - r) + "," + (y0 + h) + " H" + (x0 + r) + " Q" + x0 + "," + (y0 + h) + " " + x0 + "," + (y0 + h - r) + " Z"
          : "M" + x0 + "," + y0 + " V" + (y0 - h + r) + " Q" + x0 + "," + (y0 - h) + " " + (x0 + r) + "," + (y0 - h) + " H" + (x1 - r) + " Q" + x1 + "," + (y0 - h) + " " + x1 + "," + (y0 - h + r) + " V" + y0 + " Z";
        var b = document.createElementNS(ns, "path");
        b.setAttribute("d", d); b.setAttribute("class", "barre" + (neg ? " neg" : ""));
        svg.appendChild(b);
        t.setAttribute("y", neg ? y0 + h + 12 : y0 - h - 5);
        t.setAttribute("class", "val"); t.textContent = formater(p.valeur, unite);
        svg.appendChild(t);
      }
      var cible = document.createElementNS(ns, "rect");
      cible.setAttribute("x", 4 + bande * i); cible.setAttribute("y", 0);
      cible.setAttribute("width", bande); cible.setAttribute("height", H);
      cible.setAttribute("class", "cible"); cible.setAttribute("tabindex", "0");
      var html = "<b>" + titre + " — " + p.annee + "</b><br>" + formater(p.valeur, unite) +
        (formule ? "<br><i>" + formule + "</i>" : "") +
        (p.sources && p.sources.length ? "<br>Source : " + p.sources.join(" ; ") : "");
      cible.addEventListener("mousemove", function (e) { montrerBulle(e, html, cible); });
      cible.addEventListener("mouseleave", cacherBulle);
      cible.addEventListener("focus", function (e) { montrerBulle(e, html, cible); });
      cible.addEventListener("blur", cacherBulle);
      cible.addEventListener("touchstart", function (e) { var t0 = e.touches[0]; montrerBulle(t0, html, cible); }, { passive: true });
      svg.appendChild(cible);
    });
    boite.appendChild(svg);
    return boite;
  }

  /* ---------- Fiche entreprise ---------- */
  function fiche(ent) {
    var f = $("fiche");
    f.innerHTML = "";
    var annees = Object.keys(ent.exercices).sort();
    var R = ent.ratios.par_exercice;

    var tete = el("div", { "class": "fiche-tete" });
    tete.appendChild(el("h3", null, ent.nom));
    var sous = ent.secteur + " · " + ent.ville + " · " + (ent.type === "distribution" ? "distribution" : "industrie") +
      " · exercices clos le " + annees.map(function (a) { return ent.exercices[a].date_cloture.split("-").reverse().join("/"); }).join(", ");
    tete.appendChild(el("p", { "class": "muted small" }, sous));
    f.appendChild(tete);

    var g = el("div", { "class": "graphes" });
    g.appendChild(graphe(NOMS.ca, "Chiffre d'affaires net", annees.map(function (a) {
      var p = ent.exercices[a].postes.chiffre_affaires_net;
      return { annee: a, valeur: p ? p.montant : null, sources: sourcesRatio(ent, a, ["chiffre_affaires_net"]) };
    }), "M€"));
    var metriques = ent.marges_affichees.concat(["marge_exploitation", "poids_masse_salariale", "bfr_jours_ca"]);
    metriques.forEach(function (m) {
      var r0 = R[annees[0]][m];
      g.appendChild(graphe(NOMS[m], r0.formule, annees.map(function (a) {
        var r = R[a][m];
        return { annee: a, valeur: r.valeur, sources: sourcesRatio(ent, a, r.postes) };
      }), r0.unite));
    });
    f.appendChild(g);

    var lec = el("div", { "class": "lecture" });
    [["Ce qui se voit", ent.lecture.ce_qui_se_voit], ["Ce qui ne se voit pas dans des comptes publics", ent.lecture.ce_qui_ne_se_voit_pas]].forEach(function (b) {
      var d = el("div");
      d.appendChild(el("h3", null, b[0]));
      var ul = el("ul");
      b[1].forEach(function (t) { ul.appendChild(el("li", null, t)); });
      d.appendChild(ul);
      lec.appendChild(d);
    });
    f.appendChild(lec);

    var q = el("div", { "class": "questions-bloc" });
    q.appendChild(el("h3", null, "Mes trois questions"));
    var ol = el("ol", { "class": "questions" });
    ent.lecture.questions.forEach(function (t) { ol.appendChild(el("li", null, t)); });
    q.appendChild(ol);
    f.appendChild(q);

    // Tableau de tous les ratios (vue accessible, sans graphe)
    var det = el("details");
    det.appendChild(el("summary", null, "Tous les ratios, avec leur formule"));
    var sc = el("div", { "class": "table-scroll" });
    var tab = el("table");
    var th = el("thead"), trh = el("tr");
    trh.appendChild(el("th", { scope: "col" }, "Ratio"));
    annees.forEach(function (a) { trh.appendChild(el("th", { scope: "col" }, a)); });
    th.appendChild(trh); tab.appendChild(th);
    var tb = el("tbody");
    var lignes = ["taux_marge_commerciale", "taux_marge_sur_matieres", "poids_masse_salariale", "marge_exploitation", "bfr_simplifie", "bfr_jours_ca", "delai_clients", "delai_fournisseurs"];
    var trca = el("tr");
    var tdn = el("td"); tdn.appendChild(el("span", null, "Évolution du CA"));
    trca.appendChild(tdn);
    annees.forEach(function (a) {
      var c = ent.ratios.croissance_ca[a];
      var v = c && c.valeur != null ? (c.valeur >= 0 ? "+" : "") + nf1.format(c.valeur * 100) + " %" : "—";
      trca.appendChild(el("td", null, v));
    });
    tb.appendChild(trca);
    lignes.forEach(function (m) {
      var tr = el("tr");
      var td = el("td");
      td.appendChild(el("span", null, NOMS[m]));
      td.appendChild(el("br"));
      var fs = el("span", { "class": "muted small" }, R[annees[0]][m].formule + (R[annees[0]][m].limite ? " — limite : " + R[annees[0]][m].limite : ""));
      td.appendChild(fs);
      tr.appendChild(td);
      annees.forEach(function (a) {
        var r = R[a][m];
        tr.appendChild(el("td", r.valeur == null ? { "class": "np" } : null, formater(r.valeur, r.unite)));
      });
      tb.appendChild(tr);
    });
    tab.appendChild(tb); sc.appendChild(tab); det.appendChild(sc);
    f.appendChild(det);

    // Montants saisis : chaque chiffre avec sa page
    var det2 = el("details");
    det2.appendChild(el("summary", null, "Les montants saisis, ligne par ligne, avec leur page"));
    annees.forEach(function (a) {
      det2.appendChild(el("h3", null, "Exercice " + a));
      var sc2 = el("div", { "class": "table-scroll" });
      var t2 = el("table");
      var h2 = el("thead"), r2 = el("tr");
      ["Libellé dans le document", "Montant", "Page", "Dépôt"].forEach(function (c) { r2.appendChild(el("th", { scope: "col" }, c)); });
      h2.appendChild(r2); t2.appendChild(h2);
      var b2 = el("tbody");
      Object.keys(ent.exercices[a].postes).forEach(function (k) {
        var p = ent.exercices[a].postes[k];
        var tr = el("tr");
        tr.appendChild(el("td", null, p.libelle_document));
        tr.appendChild(el("td", null, nf0.format(p.montant) + " €"));
        tr.appendChild(el("td", null, String(p.page)));
        tr.appendChild(el("td", null, p.source.replace("CA", "")));
        b2.appendChild(tr);
      });
      t2.appendChild(b2); sc2.appendChild(t2); det2.appendChild(sc2);
    });
    f.appendChild(det2);

    var src = el("details");
    src.appendChild(el("summary", null, "Sources"));
    var ul2 = el("ul", { "class": "sources" });
    ent.sources.forEach(function (s) {
      var li = el("li");
      li.appendChild(document.createTextNode(s.document + " — "));
      var a = el("a", { href: s.url, rel: "noopener" }, s.origine);
      li.appendChild(a);
      ul2.appendChild(li);
    });
    src.appendChild(ul2);
    f.appendChild(src);
  }

  /* ---------- Page ---------- */
  function initProfil(p, perso) {
    document.title = p.nom + " — " + p.role.toLowerCase();
    $("nom").textContent = p.nom;
    $("role").textContent = p.role;
    $("accroche").textContent = p.accroche;
    $("sous-accroche").textContent = p.sous_accroche;
    var ul = $("parcours");
    p.parcours.forEach(function (x) {
      var li = el("li");
      li.appendChild(el("b", null, x.poste));
      li.appendChild(document.createTextNode(" · " + x.entreprise + " · " + x.periode));
      ul.appendChild(li);
    });
    var sujet = "Contact" + (perso ? " — réf. " + perso.code : "");
    var mail = "mailto:" + p.email + "?subject=" + encodeURIComponent(sujet);
    [$("contact-haut"), $("contact-bas")].forEach(function (z) {
      z.appendChild(el("a", { href: mail }, p.email));
      if (p.telephone) {
        z.appendChild(document.createTextNode(" · "));
        z.appendChild(el("a", { href: "tel:+33" + p.telephone.replace(/\s/g, "").slice(1) }, p.telephone));
      }
      z.appendChild(document.createTextNode(" · "));
      z.appendChild(el("a", { href: p.linkedin, rel: "noopener" }, "LinkedIn"));
    });
    $("lien-cv").setAttribute("href", p.cv);
    $("certifs").textContent = "Certifications obtenues : " + p.certifications.join(" · ") + ".";
    var o = $("offres");
    ["immersion", "diagnostic_48h"].forEach(function (k) {
      var x = p.offres[k];
      if (!x || !x.afficher) return;
      var c = el("div", { "class": "carte" });
      c.appendChild(el("h3", null, x.titre));
      c.appendChild(el("p", null, x.texte));
      if (k === "diagnostic_48h") c.appendChild(el("a", { href: "mailto:" + p.email + "?subject=" + encodeURIComponent("Diagnostic 48 h" + (perso ? " — réf. " + perso.code : "")) }, "Envoyer un extrait"));
      o.appendChild(c);
    });
    if (p.mission_association && p.mission_association.afficher) {
      $("mission").hidden = false;
      $("t-mission").textContent = p.mission_association.titre;
      $("mission-texte").textContent = p.mission_association.texte;
      $("mission-attestation").textContent = p.mission_association.attestation;
    }
    if (perso && perso.phrase) {
      $("perso").hidden = false;
      $("perso").textContent = (perso.destinataire ? perso.destinataire + " — " : "") + perso.phrase;
    }
  }

  function initJournal(j) {
    var z = $("journal");
    j.entrees.filter(function (e) { return e.publie; }).forEach(function (e) {
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
  }

  function initAnalyse(data, slugInitial) {
    var ents = data.entreprises;
    var choix = $("choix");
    var boutons = [];
    function selectionner(slug) {
      var e = ents.filter(function (x) { return x.slug === slug; })[0] || ents[0];
      boutons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.slug === e.slug)); });
      fiche(e);
    }
    ents.forEach(function (e) {
      var b = el("button", { type: "button", "data-slug": e.slug, "aria-pressed": "false" }, e.nom);
      b.addEventListener("click", function () { selectionner(e.slug); cacherBulle(); });
      choix.appendChild(b);
      boutons.push(b);
    });
    selectionner(slugInitial);
  }

  /* Compteur de visites sans cookie (GoatCounter) : pages vues, code de candidature, clics utiles. */
  function compteur(codeGC, codeCandidature) {
    if (!codeGC) return;
    var marquer = function (sel, nom) {
      document.querySelectorAll(sel).forEach(function (a) { a.setAttribute("data-goatcounter-click", nom); });
    };
    marquer('a[href^="mailto:"]', "clic-email");
    marquer('a[href^="tel:"]', "clic-telephone");
    marquer('a[href*="linkedin.com"]', "clic-linkedin");
    marquer('a[href$=".pdf"], #lien-cv', "clic-cv");
    marquer('a[href="cas-pratiques.html"]', "clic-cas-pratiques");
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", "https://" + codeGC + ".goatcounter.com/count");
    s.onload = function () {
      if (codeCandidature && window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: "candidature-" + codeCandidature, title: "Candidature " + codeCandidature, event: true });
      }
    };
    document.body.appendChild(s);
  }

  bulle = $("bulle");
  // Au défilement : la bulle suit la barre qui a le focus clavier, sinon elle se ferme.
  document.addEventListener("scroll", function () {
    if (derniere && document.activeElement === derniere.conteneur) {
      montrerBulle({}, derniere.html, derniere.conteneur);
    } else {
      cacherBulle();
    }
  }, { passive: true });
  var params = new URLSearchParams(location.search);
  var code = params.get("c");
  Promise.all([charger("profil.json"), charger("entreprises.json"), charger("journal.json"), charger("candidatures.json")])
    .then(function (d) {
      var perso = code && d[3][code] ? Object.assign({ code: code }, d[3][code]) : null;
      initProfil(d[0], perso);
      initAnalyse(d[1], params.get("e") || (perso && perso.entreprise) || d[1].entreprises[0].slug);
      initJournal(d[2]);
      compteur(d[0].compteur_goatcounter, perso ? perso.code : null);
    })
    .catch(function () {
      $("fiche").textContent = "Les données n'ont pas pu être chargées. Ouvrez la page depuis un serveur web (et non en double-cliquant sur le fichier).";
    });
})();
