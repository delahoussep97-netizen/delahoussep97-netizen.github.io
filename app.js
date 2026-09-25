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
  function echapper(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /* Met en gras les chiffres avec unité (M€, k€, %, pt, j, €) et les passages **entre doubles astérisques**. */
  function riche(tag, texte, attrs) {
    var n = el(tag, attrs);
    n.innerHTML = echapper(texte)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/([+\-−]?\d[\d\u202f\u00a0 ]*(?:,\d+)?\s?(?:M€|k€|%|pt|jours|j\b|€))/g, "<strong>$1</strong>");
    return n;
  }
  var VERSION = "20260925e";
  function charger(url) {
    return fetch(url + "?v=" + VERSION).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); });
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

  function graphe(titre, formule, points, unite, couleur) {
    // points : [{annee, valeur, sources:[...]}]
    var boite = el("div", { "class": "graphe " + (couleur || "k1") });
    boite.appendChild(el("h4", null, titre));
    var connus = points.filter(function (p) { return p.valeur != null; });
    function ecart(v0, v1) {
      if (unite === "%") return (v1 - v0 >= 0 ? "+" : "") + nf1.format((v1 - v0) * 100) + " pt";
      if (unite === "jours") return (v1 - v0 >= 0 ? "+" : "") + nf0.format(v1 - v0) + " j";
      return v0 > 0 && v0 >= 0.2 * Math.abs(v1) ? (v1 - v0 >= 0 ? "+" : "") + nf1.format((v1 / v0 - 1) * 100) + " %"
                    : (v1 - v0 >= 0 ? "+" : "") + nf1.format((v1 - v0) / 1e6) + " M€";
    }
    if (connus.length >= 2) {
      var n = connus.length, a1 = connus[n - 1], a0 = connus[n - 2];
      var tend = el("p", { "class": "tendance" });
      tend.appendChild(el("strong", null, (a1.valeur >= a0.valeur ? "▲ " : "▼ ") + ecart(a0.valeur, a1.valeur)));
      tend.appendChild(document.createTextNode(" sur un an"));
      if (n >= 3) tend.appendChild(el("span", { "class": "muted" }, " · " + ecart(connus[0].valeur, a1.valeur) + " depuis " + connus[0].annee));
      boite.appendChild(tend);
    }
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
        var dernier = i === points.length - 1;
        b.setAttribute("d", d); b.setAttribute("class", "barre" + (neg ? " neg" : "") + (dernier ? "" : " passe"));
        svg.appendChild(b);
        t.setAttribute("y", neg ? y0 + h + 12 : y0 - h - 5);
        t.setAttribute("class", "val" + (dernier ? " fort" : "")); t.textContent = formater(p.valeur, unite);
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


  /* ---------- Analyse approfondie : SIG, structure, pont, calcul ---------- */
  var NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, texte) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (texte != null) n.textContent = texte;
    return n;
  }
  function meur(v, signe) {
    var s = signe && v > 0 ? "+" : "";
    return Math.abs(v) < 1e6 ? s + nf0.format(v / 1e3) + " k€" : s + nf1.format(v / 1e6) + " M€";
  }
  function pct(v) { return v == null ? "—" : nf1.format(v * 100) + " %"; }
  function surBulle(cible, html) {
    cible.setAttribute("tabindex", "0");
    cible.addEventListener("mousemove", function (e) { montrerBulle(e, html, cible); });
    cible.addEventListener("mouseleave", cacherBulle);
    cible.addEventListener("focus", function (e) { montrerBulle(e, html, cible); });
    cible.addEventListener("blur", cacherBulle);
    cible.addEventListener("touchstart", function (e) { montrerBulle(e.touches[0], html, cible); }, { passive: true });
  }
  function bloc(titre, sousTitre) {
    var b = el("div", { "class": "bloc-analyse" });
    b.appendChild(el("h3", null, titre));
    if (sousTitre) b.appendChild(el("p", { "class": "muted small" }, sousTitre));
    return b;
  }

  // A. Cascade des soldes intermédiaires de gestion
  function tableauSIG(ent, annees) {
    var S = ent.analyse.sig;
    var b = bloc("Le compte de résultat en cascade", "Soldes intermédiaires de gestion (plan comptable général), recalculés à partir des montants saisis. Entre parenthèses : en % du chiffre d'affaires.");
    var distri = ent.type === "distribution";
    var mixte = annees.some(function (a) { return S[a].chiffre_affaires && S[a].ventes_marchandises / S[a].chiffre_affaires > 0.02; }) &&
                annees.some(function (a) { return S[a].chiffre_affaires && S[a].production_vendue / S[a].chiffre_affaires > 0.02; });
    var lignes = [
      ["Chiffre d'affaires", "chiffre_affaires", "= ventes de marchandises + production vendue", false, true],
      ["   dont ventes de marchandises (négoce)", "ventes_marchandises", "produits achetés et revendus en l'état", !mixte, false, true],
      ["   dont production vendue (fabrication)", "production_vendue", "produits fabriqués et vendus", !mixte, false, true],
      ["Marge commerciale (négoce)", "marge_commerciale", "= ventes de marchandises − coût d'achat des marchandises vendues", !annees.some(function (a) { return S[a].marge_commerciale; })],
      ["+ Production de l'exercice (fabrication)", "production", "= production vendue + production stockée (fabriquée, pas encore vendue) + immobilisée", distri && !annees.some(function (a) { return S[a].production; })],
      ["− Consommations en provenance des tiers", "consommations_tiers", "= matières premières consommées + charges externes", false],
      ["= Valeur ajoutée", "valeur_ajoutee", "= marge commerciale + production − consommations", false, true],
      ["− Impôts et taxes", "impots_taxes", "", false],
      ["− Charges de personnel", "charges_personnel", "", false],
      ["= Excédent brut d'exploitation", "ebe", "+ subventions d'exploitation", false, true],
      ["− Dotations", "dotations", "amortissements et provisions", false],
      ["+ Autres produits et charges", "autres_nets", "reprises, transferts, cessions", false],
      ["= Résultat d'exploitation", "rex_publie", "tel que publié", false, true]
    ];
    var sc = el("div", { "class": "table-scroll" });
    var t = el("table", { "class": "sig" });
    var trh = el("tr"); trh.appendChild(el("th", { scope: "col" }, "En M€"));
    annees.forEach(function (a) { trh.appendChild(el("th", { scope: "col" }, a)); });
    var th = el("thead"); th.appendChild(trh); t.appendChild(th);
    var tb = el("tbody");
    lignes.forEach(function (l) {
      if (l[3]) return;
      var tr = el("tr", l[4] ? { "class": "solde" } : (l[5] ? { "class": "dont" } : null));
      var td = el("td"); td.appendChild(el("span", null, l[0]));
      if (l[2]) { td.appendChild(el("br")); td.appendChild(el("span", { "class": "muted small" }, l[2])); }
      tr.appendChild(td);
      annees.forEach(function (a) {
        var v = S[a][l[1]], ca = S[a].chiffre_affaires;
        var c = el("td");
        c.appendChild(document.createTextNode(nf1.format(v / 1e6)));
        if (l[1] !== "chiffre_affaires" && ca) c.appendChild(el("span", { "class": "pct" }, " (" + nf1.format(v / ca * 100) + " %)"));
        tr.appendChild(c);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb); sc.appendChild(t); b.appendChild(sc);
    b.appendChild(el("p", { "class": "small muted" }, "Lecture : le chiffre d'affaires réunit le négoce (ventes de marchandises) et la fabrication (production vendue). La marge commerciale mesure le négoce ; la production de l'exercice mesure la fabrication, y compris ce qui a été produit sans être encore vendu (production stockée). C'est pourquoi « chiffre d'affaires − marge commerciale » n'est pas égal à la production."));
    var ok = annees.every(function (a) { return S[a].rex_coherent; });
    b.appendChild(el("p", { "class": "controle small" }, ok
      ? "✓ Contrôle : pour chaque exercice, le résultat d'exploitation recalculé par cette cascade est égal, à l'euro près, au résultat publié."
      : "⚠ Contrôle : écart entre le résultat recalculé et le résultat publié, voir les notes."));
    return b;
  }

  // B. Sur 100 € de chiffre d'affaires : première et dernière année
  function structure100(ent, annees) {
    var a1 = annees[annees.length - 1], a0 = annees[annees.length - 2];
    var s1 = ent.analyse.sig[a0].structure, s0 = ent.analyse.sig[a1].structure;   // s0 = année N (bleu), s1 = N-1 (jaune)
    var b = bloc("Sur 100 € de chiffre d'affaires, où va l'argent ?", "Chaque poste rapporté au chiffre d'affaires, en euros pour 100 € vendus : " + a1 + " comparé à " + a0 + ". Une valeur négative est un produit (reprises, subventions…).");
    var leg = el("p", { "class": "legende small" });
    [[a1, "c1"], [a0, "c3"]].forEach(function (x) {
      var s = el("span", { "class": "cle" }); s.appendChild(el("i", { "class": "pastille " + x[1] })); s.appendChild(document.createTextNode(x[0])); leg.appendChild(s);
    });
    b.appendChild(leg);
    var vals = s0.concat(s1).map(function (x) { return x.pour_100; });
    var max = Math.max(0, Math.max.apply(null, vals)), min = Math.min(0, Math.min.apply(null, vals));
    var W = 320, lab = 16, barH = 9, gap = 2, row = lab + 2 * barH + gap + 12, H = s0.length * row;
    var zx0 = 4, zx1 = W - 54;
    var x = function (v) { return zx0 + (v - min) / (max - min) * (zx1 - zx0); };
    var svg = svgEl("svg", { style: "max-width:" + Math.round(W * 1.45) + "px", viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Structure des charges pour 100 € de chiffre d'affaires, " + a0 + " et " + a1 });
    s0.forEach(function (p, i) {
      var y = i * row;
      svg.appendChild(svgEl("line", { x1: x(0), x2: x(0), y1: y + lab - 2, y2: y + lab + 2 * barH + gap + 2, "class": "axe" }));
      svg.appendChild(svgEl("text", { x: zx0, y: y + 12, "class": "lib" }, p.poste));
      [[s0[i], "c1", a1], [s1[i], "c3", a0]].forEach(function (q, k) {
        var v = q[0].pour_100, yb = y + lab + k * (barH + gap);
        var xa = Math.min(x(0), x(v)), w = Math.max(1, Math.abs(x(v) - x(0)));
        svg.appendChild(svgEl("rect", { x: xa, y: yb, width: w, height: barH, rx: 2, "class": "barre-s " + q[1] }));
        svg.appendChild(svgEl("text", { x: Math.max(x(0), x(v)) + 4, y: yb + barH - 1, "class": "val-s" }, nf1.format(v) + " €"));
        var cible = svgEl("rect", { x: 0, y: yb - 1, width: W, height: barH + 2, "class": "cible" });
        surBulle(cible, "<b>" + p.poste + " — " + q[2] + "</b><br>" + nf1.format(v) + " € pour 100 € de CA<br>soit " + meur(q[0].montant));
        svg.appendChild(cible);
      });
    });
    var boite = el("div", { "class": "graphe-large" }); boite.appendChild(svg); b.appendChild(boite);
    return b;
  }

  // C. Pont du résultat d'exploitation (cascade horizontale)
  function pont(ent, annees) {
    var b = bloc("D'où vient la variation du résultat d'exploitation ?", "Chaque barre montre ce qu'un poste a ajouté (bleu) ou retiré (rouge) au résultat d'exploitation d'un exercice à l'autre.");
    var transitions = annees.slice(1);
    var choix = el("div", { "class": "choix petit", role: "group", "aria-label": "Choisir la période" });
    var zone = el("div", { "class": "graphe-large" });
    function dessiner(an) {
      zone.innerHTML = "";
      var P = ent.analyse.ponts[an], prec = annees[annees.indexOf(an) - 1];
      var etapes = [{ l: "Résultat d'exploitation " + prec, v: P.depart, tot: true }]
        .concat(P.etapes.map(function (e) { return { l: e.libelle, v: e.variation }; }))
        .concat([{ l: "Résultat d'exploitation " + an, v: P.arrivee, tot: true }]);
      var cum = 0, pts = [];
      etapes.forEach(function (e) {
        if (e.tot) { pts.push([0, e.v]); cum = e.v; } else { pts.push([cum, cum + e.v]); cum += e.v; }
      });
      var all = [0].concat([].concat.apply([], pts));
      var min = Math.min.apply(null, all), max = Math.max.apply(null, all);
      var W = 460, row = 34, H = etapes.length * row, zx0 = 4, zx1 = W - 70;
      var x = function (v) { return zx0 + (v - min) / (max - min || 1) * (zx1 - zx0); };
      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Pont du résultat d'exploitation de " + prec + " à " + an, style: "max-width:" + Math.round(W * 1.3) + "px" });
      etapes.forEach(function (e, i) {
        var y = i * row, a = pts[i][0], z = pts[i][1];
        svg.appendChild(svgEl("line", { x1: x(0), x2: x(0), y1: y + 13, y2: y + 29, "class": "axe" }));
        var cls = e.tot ? "tot" : (e.v >= 0 ? "hausse" : "baisse");
        svg.appendChild(svgEl("text", { x: zx0, y: y + 11, "class": "lib" + (e.tot ? " fort" : "") }, e.l));
        var xa = Math.min(x(a), x(z)), w = Math.max(1.5, Math.abs(x(z) - x(a)));
        svg.appendChild(svgEl("rect", { x: xa, y: y + 15, width: w, height: 12, rx: 2, "class": "pont " + cls }));
        svg.appendChild(svgEl("text", { x: Math.max(x(a), x(z)) + 4, y: y + 25, "class": "val-s" }, e.tot ? meur(e.v) : meur(e.v, true)));
        var cible = svgEl("rect", { x: 0, y: y, width: W, height: row, "class": "cible" });
        surBulle(cible, "<b>" + e.l + "</b><br>" + (e.tot ? meur(e.v) : meur(e.v, true) + " sur le résultat"));
        svg.appendChild(cible);
      });
      zone.appendChild(svg);
    }
    var boutons = [];
    transitions.forEach(function (an) {
      var prec = annees[annees.indexOf(an) - 1];
      var bt = el("button", { type: "button", "aria-pressed": "false" }, prec + " → " + an);
      bt.addEventListener("click", function () {
        boutons.forEach(function (x) { x.setAttribute("aria-pressed", String(x === bt)); });
        dessiner(an); cacherBulle();
      });
      boutons.push(bt); choix.appendChild(bt);
    });
    b.appendChild(choix); b.appendChild(zone);
    boutons[boutons.length - 1].setAttribute("aria-pressed", "true");
    dessiner(transitions[transitions.length - 1]);
    return b;
  }

  // D. Le calcul, pas à pas (dernier exercice)
  function calcul(ent, annees) {
    var a1 = annees[annees.length - 1], a0 = annees[annees.length - 2];
    var s = ent.analyse.sig[a1], e = ent.analyse.effets[a1];
    var b = bloc("Le calcul, pas à pas (" + a1 + ")", "Pour vérifier chaque chiffre : les montants viennent du tableau « Les montants saisis » plus bas.");
    var ol = el("ol", { "class": "etapes" });
    function li(t) { ol.appendChild(riche("li", t)); }
    if (s.marge_commerciale) {
      var P = ent.exercices[a1].postes, mt = function (k) { return P[k] ? P[k].montant : 0; };
      li("Marge commerciale = ventes de marchandises " + meur(mt("ventes_marchandises")) + " − achats de marchandises " +
         meur(mt("achats_marchandises")) + " − variation de stock " + meur(mt("variation_stock_marchandises")) +
         " = " + meur(s.marge_commerciale) + (mt("ventes_marchandises") > 0.02 * s.chiffre_affaires ? ", soit " + pct(s.marge_commerciale / mt("ventes_marchandises")) + " des ventes de marchandises." : "."));
    }
    li("Valeur ajoutée = marge commerciale " + meur(s.marge_commerciale) + " + production " + meur(s.production) +
       " − consommations en provenance des tiers " + meur(s.consommations_tiers) + " = " + meur(s.valeur_ajoutee) +
       ", soit " + pct(s.taux.valeur_ajoutee) + " du chiffre d'affaires.");
    li("EBE = valeur ajoutée " + meur(s.valeur_ajoutee) + (s.subventions ? " + subventions " + meur(s.subventions) : "") +
       " − impôts et taxes " + meur(s.impots_taxes) + " − personnel " + meur(s.charges_personnel) + " = " + meur(s.ebe) + ".");
    li("Résultat d'exploitation = EBE " + meur(s.ebe) + " − dotations " + meur(s.dotations) + (s.autres_nets >= 0 ? " + " : " − ") +
       "autres produits et charges " + meur(Math.abs(s.autres_nets)) + " = " + meur(s.rex_calcule) + " (publié : " + meur(s.rex_publie) + ").");
    if (e) {
      li("Variation de la " + e.indicateur + " entre " + a0 + " et " + a1 + " : " + meur(e.marge_cour - e.marge_prec, true) + ". " +
         "Effet activité = variation " + (e.base === "chiffre d'affaires" ? "du CA" : "des ventes de marchandises") + " (" + meur(e.base_cour - e.base_prec, true) +
         ") × taux " + a0 + " (" + pct(e.taux_prec) + ") = " + meur(e.effet_activite, true) + ". Effet taux = " +
         (e.base === "chiffre d'affaires" ? "CA " : "ventes ") + a1 + " (" + meur(e.base_cour) + ") × variation du taux (" +
         nf1.format((e.taux_cour - e.taux_prec) * 100) + " pt) = " + meur(e.effet_taux, true) + ".");
    }
    b.appendChild(ol);
    return b;
  }

  /* ---------- Cartes d'indicateurs (façon Power BI) ---------- */
  function sparkline(vals) {
    var W = 160, H = 34, v = vals.filter(function (x) { return x != null; });
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, "class": "spark", "aria-hidden": "true" });
    if (v.length < 2) return svg;
    var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), d = mx - mn || 1;
    var pts = v.map(function (x, i) { return [6 + i * (W - 12) / (v.length - 1), H - 6 - (x - mn) / d * (H - 12)]; });
    var ligne = pts.map(function (p) { return p.join(","); }).join(" ");
    svg.appendChild(svgEl("polygon", { points: "6," + H + " " + ligne + " " + (W - 6) + "," + H, "class": "spark-aire" }));
    svg.appendChild(svgEl("polyline", { points: ligne, "class": "spark-ligne" }));
    pts.forEach(function (p, i) { svg.appendChild(svgEl("circle", { cx: p[0], cy: p[1], r: i === pts.length - 1 ? 4 : 2.5, "class": "spark-point" + (i === pts.length - 1 ? " dernier" : "") })); });
    return svg;
  }
  function ecartKpi(x0, x1, unite) {
    var s = x1 - x0 >= 0 ? "+" : "−", d = Math.abs(x1 - x0);
    if (unite === "%") return s + nf1.format(d * 100) + " pt";
    if (unite === "j") return s + nf0.format(d) + " j";
    return x0 > 0 && x0 >= 0.2 * Math.abs(x1) ? s + nf1.format(Math.abs(x1 / x0 - 1) * 100) + " %" : s + nf1.format(d / 1e6) + " M€";
  }
  function valeurKpi(x, unite) {
    if (x == null) return ["n.p.", ""];
    if (unite === "M€") return [nf1.format(x / 1e6), " M€"];
    if (unite === "%") return [nf1.format(x * 100), " %"];
    return [nf0.format(x), " j"];
  }
  function carteKpi(titre, vals, annees, unite, sens, couleur, aide) {
    var x1 = vals[vals.length - 1], x0 = vals[vals.length - 2];
    var c = el("div", { "class": "kpi tuile " + couleur });
    c.appendChild(el("p", { "class": "kpi-titre" }, titre));
    var v = valeurKpi(x1, unite), pv = el("p", { "class": "kpi-valeur" }, v[0]);
    pv.appendChild(el("span", { "class": "kpi-unite" }, v[1]));
    c.appendChild(pv);
    if (aide) c.appendChild(el("p", { "class": "kpi-aide" }, aide));
    if (x1 != null && x0 != null) {
      var sensReel = x1 === x0 ? 0 : (x1 > x0 ? 1 : -1), cls = sensReel === 0 ? "neutre" : (sensReel === sens ? "bon" : "mauvais");
      var dl = el("p", { "class": "kpi-delta" });
      dl.appendChild(el("span", { "class": "kpi-pill " + cls, title: cls === "bon" ? "évolution favorable" : cls === "mauvais" ? "évolution défavorable" : "stable" },
        (sensReel > 0 ? "▲ " : sensReel < 0 ? "▼ " : "= ") + ecartKpi(x0, x1, unite)));
      dl.appendChild(el("span", { "class": "kpi-vs" }, "vs " + annees[annees.length - 2]));
      c.appendChild(dl);
    }
    c.appendChild(sparkline(vals));
    var ans = el("p", { "class": "kpi-ans" });
    ans.appendChild(el("span", null, annees[0])); ans.appendChild(el("span", null, annees[annees.length - 1]));
    c.appendChild(ans);
    c.setAttribute("title", titre + " — " + annees.map(function (a, i) { var w = valeurKpi(vals[i], unite); return a + " : " + w[0] + w[1]; }).join(" · "));
    return c;
  }
  function kpis(ent, annees) {
    var S = ent.analyse.sig, R = ent.ratios.par_exercice;
    var marge = ent.type === "distribution" ? "taux_marge_commerciale" : "taux_marge_sur_matieres";
    var defs = [
      ["Chiffre d'affaires", annees.map(function (a) { return S[a].chiffre_affaires; }), "M€", 1, "k1"],
      [ent.type === "distribution" ? "Marge commerciale" : "Marge sur matières", annees.map(function (a) { return R[a][marge].valeur; }), "%", 1, "k2"],
      ["Valeur ajoutée / CA", annees.map(function (a) { return S[a].taux.valeur_ajoutee; }), "%", 1, "k3"],
      ["EBE / CA", annees.map(function (a) { return S[a].taux.ebe; }), "%", 1, "k4"],
      ["Résultat d'exploitation", annees.map(function (a) { return S[a].rex_publie; }), "M€", 1, "k5"],
      ["BFR en jours de CA", annees.map(function (a) { return R[a].bfr_jours_ca.valeur; }), "j", -1, "k6"]
    ];
    var row = el("div", { "class": "kpis t12" });
    defs.forEach(function (d) { row.appendChild(carteKpi(d[0], d[1], annees, d[2], d[3], d[4], d[5])); });
    return row;
  }

  /* ---------- Fiche entreprise ---------- */

  /* ---------- Visuels « dashboard » ---------- */
  // Jauge semi-circulaire : valeur N (arc bleu), repère N-1 (trait jaune)
  function jauge(titre, v, vPrec, mini, maxi, aN, aP, formule, couleur) {
    var b = el("div", { "class": "bloc-analyse jauge-bloc" });
    b.appendChild(el("h3", null, titre));
    var W = 200, H = 122, cx = 100, cy = 104, R = 78, ep = 22;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": titre + " : " + pct(v) + " en " + aN + ", " + pct(vPrec) + " en " + aP });
    function ang(x) { var t = Math.max(0, Math.min(1, (x - mini) / (maxi - mini))); return Math.PI * (1 - t); }
    function pt(r, t) { return [cx + r * Math.cos(t), cy - r * Math.sin(t)]; }
    function arc(t0, t1, cls) {
      var r = R - ep / 2, p0 = pt(r, t0), p1 = pt(r, t1);
      return svgEl("path", { d: "M" + p0[0] + "," + p0[1] + " A" + r + "," + r + " 0 0 1 " + p1[0] + "," + p1[1], "class": cls, "stroke-width": ep, fill: "none" });
    }
    svg.appendChild(arc(Math.PI, 0, "jauge-fond"));
    if (v != null) svg.appendChild(arc(Math.PI, ang(Math.max(v, mini)), "jauge-val " + (couleur || "k1")));
    if (vPrec != null) {
      var t = ang(vPrec), a1 = pt(R - ep - 3, t), a2 = pt(R + 3, t);
      svg.appendChild(svgEl("line", { x1: a1[0], y1: a1[1], x2: a2[0], y2: a2[1], "class": "jauge-repere" }));
    }
    svg.appendChild(svgEl("text", { x: cx, y: cy - 8, "text-anchor": "middle", "class": "jauge-chiffre" }, v == null ? "n.p." : nf1.format(v * 100) + " %"));
    svg.appendChild(svgEl("text", { x: cx - R + ep / 2, y: cy + 14, "text-anchor": "middle", "class": "jauge-borne" }, nf0.format(mini * 100) + " %"));
    svg.appendChild(svgEl("text", { x: cx + R - ep / 2, y: cy + 14, "text-anchor": "middle", "class": "jauge-borne" }, nf0.format(maxi * 100) + " %"));
    var zone = el("div", { "class": "jauge-zone" }); zone.appendChild(svg); b.appendChild(zone);
    var leg = el("p", { "class": "jauge-leg" });
    leg.appendChild(el("span", { "class": "cle" }, "")); leg.firstChild.appendChild(el("i", { "class": "pastille " + (couleur || "k1") })); leg.firstChild.appendChild(document.createTextNode(aN));
    var s2 = el("span", { "class": "cle" }); s2.appendChild(el("i", { "class": "pastille repere" })); s2.appendChild(document.createTextNode(aP + " : " + pct(vPrec))); leg.appendChild(s2);
    b.appendChild(leg);
    surBulle(zone, "<b>" + titre + "</b><br>" + aN + " : " + pct(v) + "<br>" + aP + " : " + pct(vPrec) + (formule ? "<br><i>" + formule + "</i>" : ""));
    return b;
  }

  // Entonnoir : du chiffre d'affaires au résultat d'exploitation
  function entonnoir(ent, a1) {
    var s = ent.analyse.sig[a1], ca = s.chiffre_affaires;
    var b = bloc("Du chiffre d'affaires au résultat (" + a1 + ")");
    var etapes = [["Chiffre d'affaires", ca], ["Valeur ajoutée", s.valeur_ajoutee], ["EBE", s.ebe], ["Résultat d'exploitation", s.rex_publie]];
    var petit = window.innerWidth < 600, W = petit ? 340 : 460, row = 62, H = etapes.length * row, lab = petit ? 112 : 150, zone = W - lab - 8;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Du chiffre d'affaires au résultat d'exploitation en " + a1 });
    etapes.forEach(function (e, i) {
      var y = i * row + 6, v = e[1], w = Math.max(v > 0 ? 3 : 0, v / ca * zone), x = lab + (zone - w) / 2;
      svg.appendChild(svgEl("text", { x: 0, y: y + 30, "class": "lib fort" }, e[0]));
      svg.appendChild(svgEl("rect", { x: x, y: y, width: Math.max(w, 0.1), height: row - 10, "class": "entonnoir e" + (i + 1) + (v < 0 ? " neg" : "") }));
      var txt = meur(v) + " · " + nf1.format(v / ca * 100) + " %";
      var dansBarre = w > 150;
      svg.appendChild(svgEl("text", { x: dansBarre ? lab + zone / 2 : lab + zone / 2 + w / 2 + 6, y: y + 30, "text-anchor": dansBarre ? "middle" : "start", "class": dansBarre ? "val-inv" : "val-s fort" }, txt));
      var cible = svgEl("rect", { x: 0, y: y - 4, width: W, height: row, "class": "cible" });
      surBulle(cible, "<b>" + e[0] + " " + a1 + "</b><br>" + meur(v) + " soit " + nf1.format(v / ca * 100) + " % du CA");
      svg.appendChild(cible);
    });
    var zoneEl = el("div", { "class": "graphe-large" }); zoneEl.appendChild(svg); b.appendChild(zoneEl);
    b.appendChild(el("p", { "class": "small muted" }, "Chaque barre est proportionnelle au chiffre d'affaires. Un EBE ou un résultat négatif n'a pas de barre et s'affiche en rouge."));
    return b;
  }

  /* ---------- Simulation : et si un facteur changeait ? ---------- */
  // Base : dernier exercice publié. Écart de résultat = effet volume + prix + coût des achats + charges externes + personnel.
  function simBase(ent, a1) {
    var s = ent.analyse.sig[a1];
    function poste(debut) { var x = s.structure.filter(function (p) { return p.poste.indexOf(debut) === 0; })[0]; return x ? x.montant : 0; }
    return { ca: s.chiffre_affaires, achats: poste("Achats"), externes: poste("Charges externes"), personnel: poste("Personnel"),
             va: s.valeur_ajoutee, ebe: s.ebe, rex: s.rex_calcule };
  }
  function simCalcul(B, x) {
    var v = x.v / 100, p = x.p / 100, c = x.c / 100, e = x.e / 100, sa = x.s / 100;
    var eff = [
      ["Volume vendu", v * (B.ca - B.achats)],
      ["Prix de vente", B.ca * (1 + v) * p],
      ["Coût des achats", -B.achats * (1 + v) * c],
      ["Charges externes", -B.externes * e],
      ["Charges de personnel", -B.personnel * sa]
    ];
    var ca = B.ca * (1 + v) * (1 + p), achats = B.achats * (1 + v) * (1 + c);
    var dVA = (ca - B.ca) - (achats - B.achats) - B.externes * e;
    var dRex = eff.reduce(function (t, f) { return t + f[1]; }, 0);
    return { ca: ca, marge: ca ? (ca - achats) / ca : null, va: B.va + dVA, ebe: B.ebe + dVA - B.personnel * sa, rex: B.rex + dRex, eff: eff };
  }
  // Cascade horizontale générique : [{l, v, tot}]
  function cascade(etapes, label, W) {
    var cum = 0, pts = [];
    etapes.forEach(function (e) { if (e.tot) { pts.push([0, e.v]); cum = e.v; } else { pts.push([cum, cum + e.v]); cum += e.v; } });
    var all = [0].concat([].concat.apply([], pts));
    var min = Math.min.apply(null, all), max = Math.max.apply(null, all);
    W = W || 460;
    var row = 32, H = etapes.length * row, zx0 = 4, zx1 = W - 78;
    var x = function (v) { return zx0 + (v - min) / (max - min || 1) * (zx1 - zx0); };
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": label, style: "max-width:" + Math.round(W * 1.3) + "px" });
    etapes.forEach(function (e, i) {
      var y = i * row, a = pts[i][0], z = pts[i][1];
      svg.appendChild(svgEl("line", { x1: x(0), x2: x(0), y1: y + 13, y2: y + 29, "class": "axe" }));
      svg.appendChild(svgEl("text", { x: zx0, y: y + 11, "class": "lib" + (e.tot ? " fort" : "") }, e.l));
      var cls = e.tot ? (e.sim ? "sim" : "tot") : (e.v > 0 ? "hausse" : e.v < 0 ? "baisse" : "nul");
      var xa = Math.min(x(a), x(z)), w = Math.max(1.5, Math.abs(x(z) - x(a)));
      svg.appendChild(svgEl("rect", { x: xa, y: y + 15, width: w, height: 12, rx: 2, "class": "pont " + cls }));
      svg.appendChild(svgEl("text", { x: Math.max(x(a), x(z)) + 4, y: y + 25, "class": "val-s" + (e.tot ? " fort" : "") }, e.tot ? meur(e.v) : (e.v === 0 ? "0" : meur(e.v, true))));
    });
    return svg;
  }
  function pctSigne(v, dec) { return (v > 0 ? "+" : v < 0 ? "−" : "") + (dec ? nf1 : nf0).format(Math.abs(v)) + " %"; }

  function simulation(ent, annees, page) {
    var a1 = annees[annees.length - 1], B = simBase(ent, a1);
    var LEV = [
      { k: "v", nom: "Volume vendu", min: -20, max: 20, pas: 1, aide: "Le chiffre d'affaires et les achats consommés suivent le volume." },
      { k: "p", nom: "Prix de vente", min: -10, max: 10, pas: 0.5, aide: "Le chiffre d'affaires change, les coûts ne bougent pas." },
      { k: "c", nom: "Coût des achats", min: -10, max: 10, pas: 0.5, aide: "Prix des matières premières et des marchandises achetées." },
      { k: "e", nom: "Charges externes", min: -10, max: 10, pas: 0.5, aide: "Transport, énergie, loyers, sous-traitance…" },
      { k: "s", nom: "Charges de personnel", min: -10, max: 10, pas: 0.5, aide: "Salaires et charges sociales." }
    ];
    var etat = { v: 0, p: 0, c: 0, e: 0, s: 0 }, entrees = {}, sorties = {}, compte = false;

    // Leviers
    var tl = el("div", { "class": "tuile sim-leviers t4" });
    tl.appendChild(el("h3", null, "Les leviers"));
    tl.appendChild(el("p", { "class": "small muted" }, "Base : l'exercice " + a1 + " publié. Faites varier un facteur, le compte de résultat se recalcule."));
    var sc = el("div", { "class": "sim-scenarios", role: "group", "aria-label": "Scénarios prêts à l'emploi" });
    [["Prix +2 %", { p: 2 }], ["Volumes −5 %", { v: -5 }], ["Matières +5 % non répercutées", { c: 5 }], ["Salaires +3 %", { s: 3 }]].forEach(function (x) {
      var b = el("button", { type: "button" }, x[0]);
      b.addEventListener("click", function () { LEV.forEach(function (l) { etat[l.k] = x[1][l.k] || 0; }); maj(); });
      sc.appendChild(b);
    });
    tl.appendChild(sc);
    LEV.forEach(function (l) {
      var id = "sim-" + l.k + "-" + ent.slug;
      var d = el("div", { "class": "sim-levier" });
      var lab = el("label", { "for": id });
      lab.appendChild(el("span", null, l.nom));
      var o = el("output", { "for": id, "class": "sim-val" }, "0 %");
      lab.appendChild(o);
      d.appendChild(lab);
      var r = el("input", { type: "range", id: id, min: String(l.min), max: String(l.max), step: String(l.pas), value: "0" });
      r.addEventListener("input", function () { etat[l.k] = +r.value; maj(); });
      d.appendChild(r);
      var bornes = el("p", { "class": "sim-bornes" });
      bornes.appendChild(el("span", null, l.min + " %")); bornes.appendChild(el("span", null, "+" + l.max + " %"));
      d.appendChild(bornes);
      d.appendChild(el("p", { "class": "small muted sim-aide" }, l.aide));
      tl.appendChild(d);
      entrees[l.k] = r; sorties[l.k] = o;
    });
    var raz = el("button", { type: "button", "class": "bouton secondaire" }, "Remettre à zéro");
    raz.addEventListener("click", function () { LEV.forEach(function (l) { etat[l.k] = 0; }); maj(); });
    tl.appendChild(raz);
    page.appendChild(tl);

    // Résultats
    var tr = el("div", { "class": "tuile sim-resultats t8" });
    tr.appendChild(el("h3", null, "Réel " + a1 + " et simulé"));
    var cartes = el("div", { "class": "sim-cartes" });
    var IND = [
      ["ca", "Chiffre d'affaires", "M€", "k1"],
      ["marge", "Marge sur achats", "%", "k2", "(CA − achats consommés) / CA"],
      ["va", "Valeur ajoutée", "M€", "k3"],
      ["ebe", "EBE", "M€", "k4"],
      ["rex", "Résultat d'exploitation", "M€", "k5"],
      ["taux", "Résultat d'exploitation / CA", "%", "k6"]
    ];
    var zones = {};
    IND.forEach(function (d) {
      var c = el("div", { "class": "sim-carte " + d[3] });
      c.appendChild(el("p", { "class": "kpi-titre" }, d[1]));
      var v = el("p", { "class": "sim-simule" }); c.appendChild(v);
      var r = el("p", { "class": "sim-reel" }); c.appendChild(r);
      if (d[4]) c.appendChild(el("p", { "class": "kpi-aide" }, d[4]));
      cartes.appendChild(c);
      zones[d[0]] = { v: v, r: r, unite: d[2] };
    });
    tr.appendChild(cartes);
    var phrase = el("p", { "class": "sim-phrase", "aria-live": "polite" });
    tr.appendChild(phrase);
    tr.appendChild(el("h4", { "class": "sim-sous" }, "Du résultat d'exploitation réel au résultat simulé"));
    var zc = el("div", { "class": "graphe-large" });
    tr.appendChild(zc);
    page.appendChild(tr);

    // Sensibilité : effet de 1 % sur le résultat d'exploitation
    var ts = el("div", { "class": "tuile t6" });
    ts.appendChild(el("h3", null, "Sensibilité du résultat à 1 % de variation"));
    var sens = LEV.map(function (l) { var x = { v: 0, p: 0, c: 0, e: 0, s: 0 }; x[l.k] = 1; return [l.nom, simCalcul(B, x).rex - B.rex]; })
      .sort(function (a, b) { return Math.abs(b[1]) - Math.abs(a[1]); });
    var mx = Math.max.apply(null, sens.map(function (x) { return Math.abs(x[1]); })) || 1;
    var W = window.innerWidth < 600 ? 360 : 460, row = 30, lab = 150, mid = lab + (W - lab - 70) / 2, demi = (W - lab - 70) / 2;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + sens.length * row, role: "img", "aria-label": "Effet d'une hausse de 1 % de chaque facteur sur le résultat d'exploitation " + a1 });
    sens.forEach(function (x, i) {
      var y = i * row, w = Math.max(1.5, Math.abs(x[1]) / mx * demi);
      svg.appendChild(svgEl("text", { x: 0, y: y + 19, "class": "lib fort" }, "+1 % " + x[0].toLowerCase()));
      svg.appendChild(svgEl("line", { x1: mid, x2: mid, y1: y + 4, y2: y + 28, "class": "axe" }));
      svg.appendChild(svgEl("rect", { x: x[1] >= 0 ? mid : mid - w, y: y + 8, width: w, height: 14, rx: 2, "class": "pont " + (x[1] >= 0 ? "hausse" : "baisse") }));
      svg.appendChild(svgEl("text", { x: x[1] >= 0 ? mid + w + 4 : mid - w - 4, y: y + 19, "text-anchor": x[1] >= 0 ? "start" : "end", "class": "val-s fort" }, meur(x[1], true)));
    });
    var zs = el("div", { "class": "graphe-large" }); zs.appendChild(svg); ts.appendChild(zs);
    var prix = sens.filter(function (x) { return x[0] === "Prix de vente"; })[0][1];
    ts.appendChild(riche("p", "Lecture : **1 % de prix de vente** en plus, à volume égal, ajoute " + meur(prix) + " au résultat d'exploitation " + a1 +
      (B.rex > 0 ? ", soit " + pctSigne(prix / B.rex * 100, true) + " du résultat." : "."), { "class": "small" }));
    page.appendChild(ts);

    // Hypothèses
    var th = el("div", { "class": "tuile sim-hyp t6" });
    th.appendChild(el("h3", null, "Hypothèses du calcul"));
    var ul = el("ul");
    ["Calcul théorique sur les comptes " + a1 + " publiés, toutes choses égales par ailleurs. **Pas une prévision**, pas un avis sur l'entreprise.",
     "Achats consommés proportionnels au volume. Charges externes, personnel, impôts et dotations fixes, sauf si vous les faites varier.",
     "Effet volume = variation de volume × (CA − achats consommés). Effet prix = CA à nouveau volume × variation de prix. Effet coût = achats à nouveau volume × variation de coût.",
     "Avec tous les leviers à zéro, le résultat simulé est égal au résultat publié : " + meur(B.rex) + "."
    ].forEach(function (t) { ul.appendChild(riche("li", t)); });
    th.appendChild(ul);
    var mcv = B.ca - B.achats;
    if (B.rex > 0 && mcv > 0) {
      th.appendChild(riche("p", "Seuil théorique : avec cette structure de coûts, une baisse de volume de **" + nf1.format(B.rex / mcv * 100) + " %** ramènerait le résultat d'exploitation à zéro.", { "class": "small sim-seuil" }));
    }
    page.appendChild(th);

    function fmt(v, u) { return v == null ? "n.p." : u === "%" ? nf1.format(v * 100) + " %" : nf1.format(v / 1e6) + " M€"; }
    function maj() {
      var r = simCalcul(B, etat);
      LEV.forEach(function (l) {
        entrees[l.k].value = String(etat[l.k]);
        var t = pctSigne(etat[l.k], l.pas < 1);
        sorties[l.k].textContent = t;
        entrees[l.k].setAttribute("aria-valuetext", t);
        sorties[l.k].className = "sim-val" + (etat[l.k] ? " actif" : "");
      });
      var reel = { ca: B.ca, marge: (B.ca - B.achats) / B.ca, va: B.va, ebe: B.ebe, rex: B.rex, taux: B.rex / B.ca };
      var sim = { ca: r.ca, marge: r.marge, va: r.va, ebe: r.ebe, rex: r.rex, taux: r.ca ? r.rex / r.ca : null };
      Object.keys(zones).forEach(function (k) {
        var z = zones[k], d = sim[k] - reel[k], eps = z.unite === "%" ? 5e-5 : 500;
        z.v.textContent = fmt(sim[k], z.unite);
        z.r.textContent = "";
        if (Math.abs(d) < eps) { z.r.appendChild(document.createTextNode("= réel " + a1)); return; }
        var ec = z.unite === "%" ? (d > 0 ? "+" : "−") + nf1.format(Math.abs(d) * 100) + " pt" : meur(d, true).replace("-", "−");
        z.r.appendChild(el("span", { "class": "kpi-pill " + (d > 0 ? "bon" : "mauvais") }, (d > 0 ? "▲ " : "▼ ") + ec));
        z.r.appendChild(document.createTextNode(" réel : " + fmt(reel[k], z.unite)));
      });
      var actifs = LEV.filter(function (l) { return etat[l.k]; });
      phrase.textContent = "";
      if (!actifs.length) {
        phrase.appendChild(riche("span", "Tous les leviers sont à zéro : le résultat simulé est le résultat publié, **" + meur(B.rex) + "**. Choisissez un scénario ou déplacez un curseur."));
      } else {
        var dr = r.rex - B.rex;
        var txt = actifs.map(function (l) { return l.nom.toLowerCase() + " " + pctSigne(etat[l.k], l.pas < 1); }).join(", ");
        phrase.appendChild(riche("span", txt.charAt(0).toUpperCase() + txt.slice(1) +
          " : le résultat d'exploitation passe de " + meur(B.rex) + " à **" + meur(r.rex) + "**" +
          (B.rex > 0 ? " (" + pctSigne(dr / B.rex * 100, true) + ")." : ".")));
      }
      zc.innerHTML = "";
      zc.appendChild(cascade([{ l: "Résultat d'exploitation " + a1 + " (réel)", v: B.rex, tot: true }]
        .concat(r.eff.filter(function (f) { return Math.round(f[1]) !== 0; }).map(function (f) { return { l: "Effet " + f[0].toLowerCase(), v: Math.round(f[1]) }; }))
        .concat([{ l: "Résultat d'exploitation simulé", v: r.rex, tot: true, sim: true }]), "Passage du résultat réel au résultat simulé",
        Math.max(320, Math.min(460, zc.clientWidth || 460))));
      if (actifs.length && !compte && window.goatcounter && window.goatcounter.count) {
        compte = true;
        window.goatcounter.count({ path: "simulation-utilisee", title: "Simulation utilisée", event: true });
      }
    }
    maj();
  }

  /* ---------- Fiche entreprise : rapport en 5 pages ---------- */
  var pageActive = 0;
  function fiche(ent, ents, choisir) {
    var f = $("fiche");
    f.innerHTML = "";
    f.className = "dash";
    var annees = Object.keys(ent.exercices).sort();
    var R = ent.ratios.par_exercice, S = ent.analyse.sig;
    var a1 = annees[annees.length - 1], a0 = annees[annees.length - 2];

    // Bandeau bleu : titre, onglets, segment
    var tete = el("div", { "class": "dash-tete" });
    var titre = el("div", { "class": "dash-titre" });
    titre.appendChild(el("p", { "class": "dash-surtitre" }, "Analyse financière · comptes publics"));
    titre.appendChild(el("h3", null, ent.nom));
    titre.appendChild(el("p", { "class": "dash-sous" }, ent.secteur + " · " + ent.ville + " · exercices " + annees.join(", ")));
    tete.appendChild(titre);
    var onglets = el("div", { "class": "dash-onglets", role: "tablist", "aria-label": "Pages du rapport" });
    var noms = ["Vue d'ensemble", "Compte de résultat", "Analyse des écarts", "Simulation", "Lecture et questions"];
    tete.appendChild(onglets);
    var seg = el("label", { "class": "dash-segment" });
    seg.appendChild(el("span", null, "Sélectionner l'entreprise"));
    var sel = el("select", { "aria-label": "Sélectionner l'entreprise" });
    ents.forEach(function (x) { var o = el("option", { value: x.slug }, x.nom); if (x.slug === ent.slug) o.selected = true; sel.appendChild(o); });
    sel.addEventListener("change", function () { choisir(sel.value); });
    seg.appendChild(sel);
    tete.appendChild(seg);
    f.appendChild(tete);

    var pages = noms.map(function (n, i) {
      var p = el("div", { "class": "rapport dash-page", role: "tabpanel", id: "page-" + i, "aria-label": n });
      f.appendChild(p);
      return p;
    });
    var tabs = noms.map(function (n, i) {
      var t = el("button", { type: "button", role: "tab", "aria-controls": "page-" + i, id: "onglet-" + i }, n);
      t.addEventListener("click", function () { montrer(i); t.focus(); });
      t.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); var k = (i + (e.key === "ArrowRight" ? 1 : noms.length - 1)) % noms.length; montrer(k); tabs[k].focus(); }
      });
      onglets.appendChild(t);
      return t;
    });
    function montrer(i) {
      pageActive = i; cacherBulle();
      tabs.forEach(function (t, k) { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
      pages.forEach(function (p, k) { p.hidden = k !== i; });
    }

    // Page 1 : vue d'ensemble
    var p1 = pages[0];
    if (ent.lecture.synthese && ent.lecture.synthese.length) {
      var syn = el("div", { "class": "synthese tuile t12" });
      syn.appendChild(riche("p", ent.lecture.synthese[0]));
      var go = el("button", { type: "button", "class": "bouton-sim" }, "Et si la marge changeait ? Simuler →");
      go.addEventListener("click", function () { montrer(3); tabs[3].focus(); });
      syn.appendChild(go);
      p1.appendChild(syn);
    }
    p1.appendChild(kpis(ent, annees));
    var ent1 = entonnoir(ent, a1); ent1.classList.add("t6"); p1.appendChild(ent1);
    var jg = el("div", { "class": "jauges t6" });
    var mKey = ent.type === "distribution" ? "taux_marge_commerciale" : "taux_marge_sur_matieres";
    jg.appendChild(jauge(ent.type === "distribution" ? "Marge commerciale" : "Marge sur matières", R[a1][mKey].valeur, R[a0][mKey].valeur, 0, 1, a1, a0, R[a1][mKey].formule, "k2"));
    jg.appendChild(jauge("Valeur ajoutée / CA", S[a1].taux.valeur_ajoutee, S[a0].taux.valeur_ajoutee, 0, 0.4, a1, a0, "Valeur ajoutée / chiffre d'affaires", "k3"));
    jg.appendChild(jauge("Masse salariale / CA", R[a1].poids_masse_salariale.valeur, R[a0].poids_masse_salariale.valeur, 0, 0.3, a1, a0, R[a1].poids_masse_salariale.formule, "k4"));
    jg.appendChild(jauge("Résultat d'exploitation / CA", R[a1].marge_exploitation.valeur, R[a0].marge_exploitation.valeur, -0.05, 0.1, a1, a0, R[a1].marge_exploitation.formule, "k5"));
    p1.appendChild(jg);
    var g = el("div", { "class": "graphes t12" });
    g.appendChild(graphe(NOMS.ca, "Chiffre d'affaires net", annees.map(function (a) {
      var p = ent.exercices[a].postes.chiffre_affaires_net;
      return { annee: a, valeur: p ? p.montant : null, sources: sourcesRatio(ent, a, ["chiffre_affaires_net"]) };
    }), "M€", "k1"));
    g.appendChild(graphe("Résultat d'exploitation", "en M€, tel que publié", annees.map(function (a) {
      var p = ent.exercices[a].postes.resultat_exploitation;
      return { annee: a, valeur: p ? p.montant : null, sources: sourcesRatio(ent, a, ["resultat_exploitation"]) };
    }), "M€", "k5"));
    var COUL = { marge_exploitation: "k4", poids_masse_salariale: "k3", bfr_jours_ca: "k6" };
    ent.marges_affichees.concat(["marge_exploitation", "poids_masse_salariale", "bfr_jours_ca"]).forEach(function (m) {
      var r0 = R[annees[0]][m];
      g.appendChild(graphe(NOMS[m], r0.formule, annees.map(function (a) {
        var r = R[a][m];
        return { annee: a, valeur: r.valeur, sources: sourcesRatio(ent, a, r.postes) };
      }), r0.unite, COUL[m] || "k2"));
    });
    p1.appendChild(g);

    // Page 2 : compte de résultat
    var p2 = pages[1];
    var t1 = tableauSIG(ent, annees); t1.classList.add("t7"); p2.appendChild(t1);
    var t2 = structure100(ent, annees); t2.classList.add("t5"); p2.appendChild(t2);

    // Page 3 : analyse des écarts
    var p3 = pages[2];
    var t3 = pont(ent, annees); t3.classList.add("t7"); p3.appendChild(t3);
    var t4 = calcul(ent, annees); t4.classList.add("t5"); p3.appendChild(t4);

    // Page 4 : simulation
    simulation(ent, annees, pages[3]);

    // Page 5 : lecture, questions, données
    var f0 = f;
    f = pages[4];
    var lec = el("div", { "class": "lecture t8" });
    [["Ce qui se voit", ent.lecture.ce_qui_se_voit], ["Ce qui ne se voit pas dans des comptes publics", ent.lecture.ce_qui_ne_se_voit_pas]].forEach(function (b) {
      var d = el("div", { "class": "tuile" });
      d.appendChild(el("h3", null, b[0]));
      var ul = el("ul");
      b[1].forEach(function (t) { ul.appendChild(riche("li", t)); });
      d.appendChild(ul);
      lec.appendChild(d);
    });
    f.appendChild(lec);

    var q = el("div", { "class": "questions-bloc tuile t4" });
    q.appendChild(el("h3", null, "Mes trois questions"));
    var ol = el("ol", { "class": "questions" });
    ent.lecture.questions.forEach(function (t) { ol.appendChild(el("li", null, t)); });
    q.appendChild(ol);
    f.appendChild(q);

    // Tableau de tous les ratios (vue accessible, sans graphe)
    var det = el("details", { "class": "tuile t12" });
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
    var det2 = el("details", { "class": "tuile t12" });
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

    var src = el("details", { "class": "tuile t12" });
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

    // les ratios détaillés vont aussi sur la page « Analyse des écarts »
    f = f0;
    montrer(pageActive);
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
    if ($("lien-cv-haut")) $("lien-cv-haut").setAttribute("href", p.cv);
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

  /* ---------- Formations 2026 : chiffres, cours par mois, frise ---------- */
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var MOIS_C = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function dateFr(d) { var x = d.split("-"); return +x[2] + " " + MOIS[+x[1] - 1]; }
  function initFormations(f) {
    var z = $("formations-contenu");
    if (!f || !z) { if ($("formations")) $("formations").hidden = true; return; }
    $("t-formations").textContent = f.titre;
    $("formations-intro").textContent = f.intro;
    var nom = {}; f.domaines.forEach(function (d) { nom[d.cle] = d.nom; });
    var metier = f.parcours.filter(function (p) { return p.type === "parcours métier"; }).length;
    var nPbi = f.cours.filter(function (c) { return c.domaine === "pbi"; }).length;

    // 1. Chiffres clés
    var st = el("div", { "class": "f-stats" });
    [[f.cours.length, "cours de données terminés en 2026"], [f.parcours.length, "parcours validés, dont " + metier + " parcours métier"],
     [nPbi, "cours Power BI : DAX, modélisation, rapports"], [2, "cas pratiques construits de bout en bout"]].forEach(function (x) {
      var c = el("div", { "class": "chiffre" });
      c.appendChild(el("span", { "class": "chiffre-n" }, nf0.format(x[0])));
      c.appendChild(el("span", { "class": "chiffre-l" }, x[1]));
      st.appendChild(c);
    });
    z.appendChild(st);

    // 2. Cours terminés par mois, empilés par domaine
    var mois = f.cours.map(function (c) { return +c.date.slice(5, 7); });
    var m0 = Math.min.apply(null, mois), m1 = Math.max.apply(null, mois), liste = [];
    for (var m = m0; m <= m1; m++) liste.push(m);
    var par = {};
    f.cours.forEach(function (c) { var k = +c.date.slice(5, 7); (par[k] = par[k] || {}); (par[k][c.domaine] = par[k][c.domaine] || []).push(c); });
    var tg = el("div", { "class": "tuile f-graphe" });
    tg.appendChild(el("h3", null, "Cours terminés par mois, " + MOIS[m0 - 1] + " à " + MOIS[m1 - 1] + " 2026"));
    var leg = el("p", { "class": "legende small" });
    f.domaines.forEach(function (d) {
      var n = f.cours.filter(function (c) { return c.domaine === d.cle; }).length;
      var s = el("span", { "class": "cle" }); s.appendChild(el("i", { "class": "pastille d-" + d.cle })); s.appendChild(document.createTextNode(d.nom + " (" + n + ")")); leg.appendChild(s);
    });
    tg.appendChild(leg);
    var tot = liste.map(function (k) { return f.domaines.reduce(function (t, d) { return t + ((par[k] || {})[d.cle] || []).length; }, 0); });
    var mx = Math.max.apply(null, tot), W = 420, H = 210, haut = 20, bas = 22, bande = (W - 8) / liste.length, lb = Math.min(44, bande * 0.62);
    var y = function (v) { return H - bas - v / mx * (H - haut - bas); };
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Cours terminés par mois : " + liste.map(function (k, i) { return MOIS[k - 1] + " " + tot[i]; }).join(", ") });
    svg.appendChild(svgEl("line", { x1: 4, x2: W - 4, y1: y(0), y2: y(0), "class": "axe" }));
    liste.forEach(function (k, i) {
      var cx = 4 + bande * i + bande / 2, cum = 0;
      f.domaines.forEach(function (d) {
        var cs = (par[k] || {})[d.cle] || [];
        if (!cs.length) return;
        var y1 = y(cum), y2 = y(cum + cs.length);
        svg.appendChild(svgEl("rect", { x: cx - lb / 2, y: y2 + 1, width: lb, height: Math.max(1, y1 - y2 - 1), "class": "seg d-" + d.cle }));
        if (y1 - y2 >= 14) svg.appendChild(svgEl("text", { x: cx, y: (y1 + y2) / 2 + 4, "text-anchor": "middle", "class": "seg-n d-" + d.cle }, String(cs.length)));
        var cible = svgEl("rect", { x: cx - bande / 2, y: y2, width: bande, height: y1 - y2, "class": "cible" });
        surBulle(cible, "<b>" + MOIS[k - 1] + " — " + echapper(d.nom) + "</b><br>" + cs.map(function (c) { return echapper(c.titre); }).join("<br>"));
        svg.appendChild(cible);
        cum += cs.length;
      });
      svg.appendChild(svgEl("text", { x: cx, y: y(cum) - 5, "text-anchor": "middle", "class": "val fort" }, String(cum)));
      svg.appendChild(svgEl("text", { x: cx, y: H - 5, "text-anchor": "middle", "class": "an" }, MOIS_C[k - 1]));
    });
    var gz = el("div", { "class": "graphe-large" }); gz.appendChild(svg); tg.appendChild(gz);
    tg.appendChild(el("p", { "class": "small muted" }, "Survolez une barre pour voir les cours. Source : historique du compte DataCamp, attestations en lien plus bas."));

    // 3. Frise
    var tf = el("div", { "class": "tuile f-frise" });
    tf.appendChild(el("h3", null, "L'année, mois par mois"));
    var ol = el("ol", { "class": "frise" });
    f.etapes.forEach(function (e) {
      var li = el("li", { "class": "d-" + e.domaine });
      li.appendChild(el("p", { "class": "frise-mois" }, e.mois));
      li.appendChild(el("p", { "class": "frise-titre" }, e.titre));
      li.appendChild(el("p", { "class": "frise-texte" }, e.texte));
      var n = MOIS.indexOf(e.mois.toLowerCase()) + 1;
      var liens = el("p", { "class": "frise-liens" });
      f.parcours.filter(function (p) { return +p.date.slice(5, 7) === n; }).forEach(function (p) {
        liens.appendChild(el("a", { href: p.attestation, rel: "noopener" }, "Attestation « " + p.titre + " »"));
      });
      if (e.lien) liens.appendChild(el("a", { href: e.lien.url }, e.lien.texte));
      if (liens.childNodes.length) li.appendChild(liens);
      ol.appendChild(li);
    });
    tf.appendChild(ol);
    var gauche = el("div", { "class": "f-gauche" });
    gauche.appendChild(tg);
    if (f.usages && f.usages.length) {
      var tu = el("div", { "class": "tuile f-usages" });
      tu.appendChild(el("h3", null, "À quoi ça sert en contrôle de gestion"));
      var ul = el("ul");
      f.usages.forEach(function (u) { ul.appendChild(riche("li", u.texte, { "class": "d-" + u.domaine })); });
      tu.appendChild(ul);
      gauche.appendChild(tu);
    }
    var grille = el("div", { "class": "f-grille" });
    grille.appendChild(gauche); grille.appendChild(tf);
    z.appendChild(grille);

    // 4. Liste complète, avec attestations
    var det = el("details", { "class": "tuile" });
    det.appendChild(el("summary", null, "Les " + f.cours.length + " cours et " + f.parcours.length + " parcours, avec leur attestation"));
    var sc = el("div", { "class": "table-scroll" });
    var t = el("table", { "class": "f-table" });
    var th = el("thead"), trh = el("tr");
    ["Terminé le", "Cours ou parcours", "Domaine", "Preuve"].forEach(function (c) { trh.appendChild(el("th", { scope: "col" }, c)); });
    th.appendChild(trh); t.appendChild(th);
    var tb = el("tbody");
    f.parcours.map(function (p) { return { date: p.date, titre: "Parcours : " + p.titre + " (" + p.type + ")", domaine: "", attestation: p.attestation, fort: true }; })
      .concat(f.cours).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; })
      .forEach(function (c) {
        var tr = el("tr", c.fort ? { "class": "fort" } : null);
        tr.appendChild(el("td", null, dateFr(c.date)));
        tr.appendChild(el("td", null, c.titre));
        tr.appendChild(el("td", null, c.domaine ? nom[c.domaine] : "—"));
        var td = el("td"); td.appendChild(el("a", { href: c.attestation, rel: "noopener" }, "attestation")); tr.appendChild(td);
        tb.appendChild(tr);
      });
    t.appendChild(tb); sc.appendChild(t); det.appendChild(sc);
    z.appendChild(det);
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

  function initChiffres(data) {
    var ents = data.entreprises, ex = 0, montants = 0, coherents = 0;
    ents.forEach(function (e) {
      Object.keys(e.exercices).forEach(function (a) { ex++; montants += Object.keys(e.exercices[a].postes).length; });
      Object.keys(e.analyse.sig).forEach(function (a) { if (e.analyse.sig[a].rex_coherent) coherents++; });
    });
    var defs = [[ents.length, "entreprises du Loiret analysées"], [ex, "exercices comptables lus"], [montants, "montants saisis, chacun avec sa page"], [Math.round(coherents / ex * 100), "des résultats recalculés à l'euro près", "%"]];
    var z = $("chiffres");
    defs.forEach(function (d) {
      var c = el("div", { "class": "chiffre" });
      var n = el("span", { "class": "chiffre-n", "data-cible": String(d[0]) }, nf0.format(d[0]));
      c.appendChild(n);
      if (d[2]) c.appendChild(el("span", { "class": "chiffre-n" }, " " + d[2]));
      c.appendChild(el("span", { "class": "chiffre-l" }, d[1]));
      z.appendChild(c);
    });
    // Compteur animé, une seule fois, et seulement si l'utilisateur accepte les animations
    var reduit = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var nums = z.querySelectorAll("[data-cible]");
    function finir() { nums.forEach(function (n) { n.textContent = nf0.format(+n.dataset.cible); }); }
    if (reduit || !("IntersectionObserver" in window)) { finir(); return; }
    var obs = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      obs.disconnect();
      var t0 = performance.now();
      (function pas(t) {
        var k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3);
        nums.forEach(function (n) { n.textContent = nf0.format(Math.round(+n.dataset.cible * e)); });
        if (k < 1) requestAnimationFrame(pas);
      })(t0);
    });
    obs.observe(z);
  }

  function initAnalyse(data, slugInitial) {
    var ents = data.entreprises;
    $("choix").hidden = true;
    function selectionner(slug) {
      var e = ents.filter(function (x) { return x.slug === slug; })[0] || ents[0];
      fiche(e, ents, selectionner);
    }
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
    window.goatcounter = { no_onload: true };   // la visite est comptée explicitement ci-dessous
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", "https://" + codeGC + ".goatcounter.com/count");
    s.onload = function () {
      if (!window.goatcounter || !window.goatcounter.count) return;
      window.goatcounter.count({ path: location.pathname });
      if (window.goatcounter.bind_events) window.goatcounter.bind_events();   // clics CV, email, téléphone…
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
      initChiffres(d[1]);
      initAnalyse(d[1], params.get("e") || (perso && perso.entreprise) || d[1].entreprises[0].slug);
      initFormations(d[0].formations_2026);
      initJournal(d[2]);
      compteur(d[0].compteur_goatcounter, perso ? perso.code : null);
    })
    .catch(function () {
      $("fiche").textContent = "Les données n'ont pas pu être chargées. Ouvrez la page depuis un serveur web (et non en double-cliquant sur le fichier).";
    });
})();
