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
    var connus = points.filter(function (p) { return p.valeur != null; });
    function ecart(v0, v1) {
      if (unite === "%") return (v1 - v0 >= 0 ? "+" : "") + nf1.format((v1 - v0) * 100) + " pt";
      if (unite === "jours") return (v1 - v0 >= 0 ? "+" : "") + nf0.format(v1 - v0) + " j";
      return v0 > 0 ? (v1 - v0 >= 0 ? "+" : "") + nf1.format((v1 / v0 - 1) * 100) + " %"
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
    var lignes = [
      ["Chiffre d'affaires", "chiffre_affaires", "= ventes de marchandises + production vendue", false, true],
      ["   dont ventes de marchandises (négoce)", "ventes_marchandises", "produits achetés et revendus en l'état", !(annees.some(function (a) { return S[a].ventes_marchandises; }) && annees.some(function (a) { return S[a].production_vendue; })), false, true],
      ["   dont production vendue (fabrication)", "production_vendue", "produits fabriqués et vendus", !(annees.some(function (a) { return S[a].ventes_marchandises; }) && annees.some(function (a) { return S[a].production_vendue; })), false, true],
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
    var a0 = annees[0], a1 = annees[annees.length - 1];
    var s0 = ent.analyse.sig[a0].structure, s1 = ent.analyse.sig[a1].structure;
    var b = bloc("Sur 100 € de chiffre d'affaires, où va l'argent ?", "Chaque poste rapporté au chiffre d'affaires, en euros pour 100 € vendus. Une valeur négative est un produit (reprises, subventions…).");
    var leg = el("p", { "class": "legende small" });
    [[a0, "c1"], [a1, "c2"]].forEach(function (x) {
      var s = el("span", { "class": "cle" }); s.appendChild(el("i", { "class": "pastille " + x[1] })); s.appendChild(document.createTextNode(x[0])); leg.appendChild(s);
    });
    b.appendChild(leg);
    var vals = s0.concat(s1).map(function (x) { return x.pour_100; });
    var max = Math.max(0, Math.max.apply(null, vals)), min = Math.min(0, Math.min.apply(null, vals));
    var W = 320, lab = 16, barH = 9, gap = 2, row = lab + 2 * barH + gap + 12, H = s0.length * row;
    var zx0 = 4, zx1 = W - 54;
    var x = function (v) { return zx0 + (v - min) / (max - min) * (zx1 - zx0); };
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Structure des charges pour 100 € de chiffre d'affaires, " + a0 + " et " + a1 });
    s0.forEach(function (p, i) {
      var y = i * row;
      svg.appendChild(svgEl("line", { x1: x(0), x2: x(0), y1: y + lab - 2, y2: y + lab + 2 * barH + gap + 2, "class": "axe" }));
      svg.appendChild(svgEl("text", { x: zx0, y: y + 12, "class": "lib" }, p.poste));
      [[s0[i], "c1", a0], [s1[i], "c2", a1]].forEach(function (q, k) {
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
      var W = 320, row = 34, H = etapes.length * row, zx0 = 4, zx1 = W - 60;
      var x = function (v) { return zx0 + (v - min) / (max - min || 1) * (zx1 - zx0); };
      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Pont du résultat d'exploitation de " + prec + " à " + an });
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
         " = " + meur(s.marge_commerciale) + (mt("ventes_marchandises") ? ", soit " + pct(s.marge_commerciale / mt("ventes_marchandises")) + " des ventes de marchandises." : "."));
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
    if (ent.lecture.synthese && ent.lecture.synthese.length) f.appendChild(riche("p", ent.lecture.synthese[0], { "class": "synthese" }));

    var g = el("div", { "class": "graphes" });
    g.appendChild(graphe(NOMS.ca, "Chiffre d'affaires net", annees.map(function (a) {
      var p = ent.exercices[a].postes.chiffre_affaires_net;
      return { annee: a, valeur: p ? p.montant : null, sources: sourcesRatio(ent, a, ["chiffre_affaires_net"]) };
    }), "M€"));
    g.appendChild(graphe("Résultat d'exploitation", "en M€, tel que publié", annees.map(function (a) {
      var p = ent.exercices[a].postes.resultat_exploitation;
      return { annee: a, valeur: p ? p.montant : null, sources: sourcesRatio(ent, a, ["resultat_exploitation"]) };
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
    if (ent.analyse) {
      f.appendChild(tableauSIG(ent, annees));
      f.appendChild(structure100(ent, annees));
      f.appendChild(pont(ent, annees));
      f.appendChild(calcul(ent, annees));
    }

    var lec = el("div", { "class": "lecture" });
    [["Ce qui se voit", ent.lecture.ce_qui_se_voit], ["Ce qui ne se voit pas dans des comptes publics", ent.lecture.ce_qui_ne_se_voit_pas]].forEach(function (b) {
      var d = el("div");
      d.appendChild(el("h3", null, b[0]));
      var ul = el("ul");
      b[1].forEach(function (t) { ul.appendChild(riche("li", t)); });
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
      initAnalyse(d[1], params.get("e") || (perso && perso.entreprise) || d[1].entreprises[0].slug);
      initJournal(d[2]);
      compteur(d[0].compteur_goatcounter, perso ? perso.code : null);
    })
    .catch(function () {
      $("fiche").textContent = "Les données n'ont pas pu être chargées. Ouvrez la page depuis un serveur web (et non en double-cliquant sur le fichier).";
    });
})();
