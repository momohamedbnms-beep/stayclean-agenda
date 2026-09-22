/* StayClean - affiche l'origine Google Ads dans l'app (22/09/2026).
   Fichier separe : l'app (index.html) n'est pas modifiee, seul un <script>
   a ete ajoute a la fin. Supprimer ce fichier et cette ligne remet l'etat d'avant.
   Le marqueur "[Google Ads ...]" est colle en fin de message de la demande par
   l'extrait WPCode 1013 du site. Ici on le lit pour afficher un compteur et un
   badge lisibles, sans toucher aux donnees. */
(function () {
"use strict";
var RE = /\[Google Ads/;
function estAds(d) { return RE.test((d && d.message) || ""); }
function liste() { return (window.DB && DB.dem) ? DB.dem : []; }
function compteur() {
var tete = document.querySelector(".tdy-head");
if (!tete) return;
if ((tete.textContent || "").indexOf("Demandes du site") === -1) return;
if (document.getElementById("sc-ads-compteur")) return;
var g = liste().filter(estAds);
var d30 = g.filter(function (d) { return (Date.now() - new Date(d.cree_le || 0).getTime()) < 2592000000; });
var box = document.createElement("div");
box.id = "sc-ads-compteur";
box.className = "disclaim";
box.style.borderLeft = "3px solid #1a73e8";
box.innerHTML = "Google Ads : <b>" + g.length + "</b> demande" + (g.length > 1 ? "s" : "") + " au total, dont <b>" + d30.length + "</b> sur 30 jours.";
tete.parentNode.insertBefore(box, tete.nextSibling);
}
function badge() {
var ov = document.getElementById("ov-dem");
if (!ov) return;
if (ov.querySelector(".sc-ads-badge")) return;
var id = (window.ui && ui.demForm) ? ui.demForm.id : null;
if (!id) return;
var d = liste().filter(function (x) { return x.id === id; })[0];
if (!d || !estAds(d)) return;
var ligne = ov.querySelector(".demline");
if (!ligne) return;
var el = document.createElement("div");
el.className = "demline sc-ads-badge";
el.innerHTML = "<span>Origine</span><b style=\"color:#1a73e8\">Google Ads</b>";
ligne.parentNode.insertBefore(el, ligne);
}
function passe() { try { compteur(); badge(); } catch (e) {} }
try { new MutationObserver(passe).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
document.addEventListener("DOMContentLoaded", passe);
setInterval(passe, 1500);
passe();
})();
