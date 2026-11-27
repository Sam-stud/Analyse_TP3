// pageJoueur.js : interface client d'un joueur.
// Sert à démontrer qu'un joueur banni par un administrateur ne peut plus se connecter (ni continuer à jouer).
// Le statut est relu dans DataAccess (JSON + bannissements locaux) à chaque connexion et à chaque action.
// La session joueur est stockée à part (qb_joueur) : elle n'écrase jamais le jeton administrateur (qb_jeton).

const CLE_SESSION_JOUEUR = "qb_joueur";
const MESSAGE_SUSPENDU = "Compte suspendu : vous ne pouvez plus accéder au jeu.";
const MOTIFS_INJECTION = [
  /<script\b/i,
  /javascript\s*:/i,
  /\bon[a-z]+\s*=/i,
  /\b(?:eval|alert|prompt|confirm|fetch|setTimeout|setInterval|Function)\s*\(/i,
  /\bdocument\s*\.\s*(?:cookie|write|location)\b/i,
  /\bwindow\s*\.\s*location\b/i,
  /innerHTML/i,
  /\bunion\s+(?:all\s+)?select\b/i,
  /\b(?:drop|truncate|alter)\s+table\b/i,
  /\bdelete\s+from\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\s+\w+\s+set\b/i,
  /\b(?:or|and)\s+['"]?\w+['"]?\s*(?:==|=|<>|!=|>=|<=)\s*['"]?\w+['"]?\b/i,
  /\b(?:or|and)\b[^\n]{0,60}(?:--|#|\/\*)/i,
  /(?:--|#|\/\*)[^\n]{0,60}\b(?:or|and|select|union)\b/i,
  /['"]\s*(?:--|#)/,
  /;\s*(?:--|#)/,
  /\/\*/,
  /\b(?:xp_cmdshell|waitfor\s+delay|sleep\s*\(|benchmark\s*\()/i,
  /%3c\s*script/i,
  /&#x?3c\s*script/i,
];

function detecterInjection(texte) {
  return MOTIFS_INJECTION.some((motif) => motif.test(String(texte)));
}

// dateDuJour() est définie dans joueurService.js (chargé avant cette page).

function sessionJoueur() {
  try {
    return JSON.parse(sessionStorage.getItem(CLE_SESSION_JOUEUR));
  } catch (e) {
    return null;
  }
}

function afficherVue(joueur) {
  document.getElementById("vue-connexion").hidden = !!joueur;
  document.getElementById("vue-jeu").hidden = !joueur;
  if (joueur) {
    document.getElementById("bienvenue").textContent = `Bienvenue, ${joueur.nom} ! Votre compte est actif.`;
    chargerHistorique();
  } else {
    fermerMenuSignalement();
  }
}

function fermerSession() {
  sessionStorage.removeItem(CLE_SESSION_JOUEUR);
  afficherVue(null);
}

// Relit le compte dans les données : { ok: true, user } ou { ok: false, raison: "introuvable" | "suspendu" }.
async function verifierCompte({ nom, id }) {
  const { users } = await DataAccess.charger();
  const user =
    id !== undefined
      ? users.find((u) => u.id === id)
      : users.find((u) => u.nom.toLowerCase() === nom.toLowerCase());
  if (!user) return { ok: false, raison: "introuvable" };
  if (user.statut === "inactif") return { ok: false, raison: "suspendu", user };
  return { ok: true, user };
}

async function connecterJoueur(evt) {
  evt.preventDefault();
  const saisie = document.getElementById("nom-joueur").value.trim();
  if (!saisie) {
    UI.message("erreur", "Veuillez entrer un nom de joueur.");
    return;
  }
  try {
    const r = await verifierCompte({ nom: saisie });
    if (!r.ok) {
      // Aucune session créée : un joueur banni reste sur l'écran de connexion.
      UI.message("erreur", r.raison === "suspendu" ? MESSAGE_SUSPENDU : "Utilisateur introuvable.");
      return;
    }
    sessionStorage.setItem(CLE_SESSION_JOUEUR, JSON.stringify({ userId: r.user.id, nom: r.user.nom }));
    UI.message("succes", `Connexion réussie. Bon jeu, ${r.user.nom} !`);
    afficherVue(r.user);
  } catch (e) {
    console.error(e);
    UI.message("erreur", "Données introuvables : impossible de vérifier le compte.");
  }
}

// Revérifie le statut d'un joueur déjà connecté (au chargement et avant chaque action).
// Retourne true si le joueur peut continuer; sinon ferme la session et affiche pourquoi.
async function revalider() {
  const session = sessionJoueur();
  if (!session) {
    afficherVue(null);
    return false;
  }
  try {
    const r = await verifierCompte({ id: session.userId });
    if (r.ok) return true;
    fermerSession();
    UI.message("erreur", r.raison === "suspendu" ? MESSAGE_SUSPENDU : "Utilisateur introuvable.");
    return false;
  } catch (e) {
    console.error(e);
    fermerSession();
    UI.message("erreur", "Données introuvables : impossible de vérifier le compte.");
    return false;
  }
}

async function partirEnQuete() {
  if (await revalider()) {
    UI.message("info", "Votre quête commence ! (simulation)");
  }
}

async function signalerBogue(evt) {
  evt.preventDefault();
  if (!(await revalider())) return;

  const champTitre = document.getElementById("titre-bogue");
  const titreSaisi = champTitre.value.trim();
  const champ = document.getElementById("description-bogue");
  const description = champ.value.trim();
  if (!description) {
    UI.message("erreur", "Veuillez décrire le bogue rencontré.");
    return;
  }

  const session = sessionJoueur();
  const attaque = detecterInjection(`${titreSaisi}\n${description}`);
  const date = dateDuJour();
  try {
    DataAccess.signalerBogueLocal({
      titre: titreSaisi || (attaque
        ? "Tentative de cyberattaque (injection JavaScript/SQL)"
        : "Bogue signalé par le joueur"),
      description,
      joueurId: session.userId,
      joueurNom: session.nom,
      date,
      estAttaque: attaque,
      typeAttaque: attaque ? "injection JavaScript/SQL" : null,
    });
    if (attaque) {
      DataAccess.signalerCyberattaqueLocal({
        joueurId: session.userId,
        joueurNom: session.nom,
        motif: "Tentative de cyberattaque (injection JavaScript/SQL) via le formulaire de signalement de bogue",
        date,
        estCyberattaque: true,
      });
    }
    champTitre.value = "";
    champ.value = "";
    UI.message(
      "succes",
      attaque
        ? "Signalement enregistré. La tentative d'injection a été signalée automatiquement à l'administration."
        : "Votre signalement a bien été envoyé à l'administrateur."
    );
  } catch (e) {
    console.error(e);
    UI.message("erreur", "Le signalement n'a pas pu être envoyé.");
  }
}

// Suppression de son propre compte (simulation) : après confirmation, le compte n'existe plus.
async function supprimerMonCompte() {
  if (!(await revalider())) return;
  const session = sessionJoueur();
  if (!window.confirm("Voulez-vous vraiment supprimer votre compte ? Cette action est définitive.")) return;
  try {
    DataAccess.supprimerCompteLocal(session.nom); // global : touche tous les jeux de données
    fermerSession();
    UI.message("succes", "Votre compte a été supprimé. Vous ne pouvez plus vous connecter avec ce nom.");
  } catch (e) {
    console.error(e);
    UI.message("erreur", "La suppression du compte n'a pas pu être effectuée.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Barre d'outils du socle (jeu de données + réinitialisation), sans les boutons liés à l'administrateur.
  UI.barreOutils({ connecte: false, onChange: init });
  const titre = document.querySelector("#barre .titre");
  if (titre) {
    titre.textContent = "Quest Bank : Espace joueur";
    titre.href = "joueur.html";
  }

  document.getElementById("form-joueur").addEventListener("submit", connecterJoueur);
  document.getElementById("form-bogue").addEventListener("submit", signalerBogue);
  document.getElementById("btn-quete").addEventListener("click", partirEnQuete);
  document.getElementById("btn-supprimer-compte").addEventListener("click", supprimerMonCompte);
  const listeParties = document.getElementById("liste-parties");
  listeParties.addEventListener("click", gererClicHistorique);
  listeParties.addEventListener("change", (evt) => {
    if (evt.target.name !== "motif-signalement") return;
    const menu = evt.target.closest(".menu-signalement");
    menu.querySelector(".btn-envoyer-signalement").disabled = false;
    menu.querySelector(".erreur-signalement").hidden = true;
  });
  document.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape" && document.getElementById("menu-signalement")) fermerMenuSignalement(true);
  });
  document.addEventListener("click", (evt) => {
    if (!evt.target.closest(".menu-signalement, .btn-signaler")) fermerMenuSignalement();
  });
  document.getElementById("btn-deconnexion-joueur").addEventListener("click", () => {
    fermerSession();
    UI.message("info", "Vous êtes déconnecté.");
  });

  await init();
});

// Au chargement, ou après un changement de jeu de données / une réinitialisation :
// un joueur déjà connecté est revérifié (s'il a été banni entre-temps, sa session est fermée).
async function init() {
  const session = sessionJoueur();
  if (!session) {
    afficherVue(null);
    return;
  }
  if (await revalider()) afficherVue(session);
}

// ---------- Historique des parties et signalement d'un joueur ----------

const LIBELLES_RESULTAT = { victoire: "Victoire", defaite: "Défaite", abandon: "Abandon" };
const MESSAGES_SIGNALEMENT = {
  "donnees-incompletes": "Informations manquantes : le signalement n'a pas été envoyé.",
  "motif-invalide": "Veuillez choisir un motif dans la liste.",
  "soi-meme": "Vous ne pouvez pas vous signaler vous-même.",
  "partie-introuvable": "Cette partie est introuvable : le signalement n'a pas été envoyé.",
  "hors-partie": "Ce joueur n'a pas participé à cette partie avec vous.",
  "joueur-introuvable": "Ce joueur est introuvable (compte supprimé ?) : le signalement n'a pas été envoyé.",
};
let signalementEnCours = false; // empêche un double envoi (double clic, touche Entrée répétée...)

function creerElement(balise, classe, texte) {
  const el = document.createElement(balise);
  if (classe) el.className = classe;
  if (texte !== undefined && texte !== null) el.textContent = texte; // jamais interprété comme du HTML
  return el;
}

function pluriel(n, mot) {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

async function chargerHistorique() {
  const liste = document.getElementById("liste-parties");
  const vide = document.getElementById("historique-vide");
  const compteur = document.getElementById("compteur-parties");
  const session = sessionJoueur();
  fermerMenuSignalement();
  liste.innerHTML = "";
  vide.hidden = true;
  compteur.textContent = "";
  afficherRencontres([]);
  if (!session) return;

  try {
    const r = await JoueurService.historiqueParties(session.userId);
    if (!r.ok) {
      liste.appendChild(creerElement("p", "msg msg-erreur", "Historique indisponible : votre compte n'est plus accessible."));
      return;
    }
    compteur.textContent = pluriel(r.parties.length, "partie");
    afficherRencontres(r.parties);
    if (r.parties.length === 0) {
      vide.hidden = false;
      return;
    }
    r.parties.forEach((p) => liste.appendChild(creerCartePartie(p)));
  } catch (e) {
    console.error(e);
    liste.appendChild(creerElement("p", "msg msg-erreur", "Données introuvables : impossible de charger l'historique des parties."));
  }
}

// Résumé « Joueurs rencontrés » : chaque joueur une seule fois, avec le nombre de parties jouées ensemble.
function afficherRencontres(parties) {
  const zone = document.getElementById("joueurs-rencontres");
  const liste = document.getElementById("liste-rencontres");
  liste.innerHTML = "";
  const compte = new Map();
  parties.forEach((p) =>
    p.coequipiers
      .filter((c) => c.nom !== null)
      .forEach((c) => compte.set(c.nom, (compte.get(c.nom) || 0) + 1))
  );
  zone.hidden = compte.size === 0;
  [...compte.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([nom, n]) => {
      const li = creerElement("li", "rencontre");
      li.appendChild(creerElement("span", "avatar-mini", nom.charAt(0).toUpperCase()));
      li.appendChild(creerElement("span", "rencontre-nom", nom));
      li.appendChild(creerElement("span", "rencontre-nombre", pluriel(n, "partie")));
      liste.appendChild(li);
    });
}

function creerCartePartie(p) {
  const article = creerElement("article", "partie");
  article.dataset.partieId = p.id;
  article.dataset.quete = p.quete;
  article.dataset.date = p.date || "";

  const entete = creerElement("div", "partie-entete");
  const bloc = creerElement("div", "partie-infos");
  bloc.appendChild(creerElement("h3", "partie-titre", p.quete));
  const meta = creerElement("p", "partie-meta");
  const temps = creerElement("time", null, UI.formatDate(p.date));
  if (p.date) temps.dateTime = p.date;
  meta.appendChild(temps);
  if (p.duree !== null) meta.appendChild(creerElement("span", null, `${p.duree} min`));
  meta.appendChild(creerElement("span", null, `Partie n° ${p.id}`));
  bloc.appendChild(meta);
  entete.appendChild(bloc);
  if (p.resultat) {
    entete.appendChild(
      creerElement("span", `badge badge-resultat badge-${p.resultat}`, LIBELLES_RESULTAT[p.resultat] || p.resultat)
    );
  }
  article.appendChild(entete);

  if (p.coequipiers.length === 0) {
    article.appendChild(creerElement("p", "partie-solo", "Partie jouée en solitaire : aucun autre joueur."));
    return article;
  }

  article.appendChild(creerElement("p", "partie-libelle", "Joueurs de la partie"));
  const ul = creerElement("ul", "coequipiers");
  p.coequipiers.forEach((c) => ul.appendChild(creerCoequipier(c, p)));
  article.appendChild(ul);
  return article;
}

function creerCoequipier(c, partie) {
  const li = creerElement("li", "coequipier");
  li.dataset.joueurId = c.joueurId;
  const introuvable = c.nom === null;
  li.appendChild(creerElement("span", "avatar-mini", introuvable ? "?" : c.nom.charAt(0).toUpperCase()));
  li.appendChild(creerElement("span", "coequipier-nom", introuvable ? "Joueur introuvable" : c.nom));

  if (introuvable) {
    li.classList.add("indisponible");
    li.appendChild(creerElement("span", "badge badge-inconnu", "Compte indisponible"));
  } else if (c.dejaSignale) {
    li.appendChild(creerElement("span", "badge badge-signale", "Signalé"));
  } else {
    const bouton = creerElement("button", "btn-signaler");
    bouton.type = "button";
    bouton.dataset.joueurId = c.joueurId;
    bouton.dataset.nom = c.nom;
    bouton.title = `Signaler ${c.nom}`;
    bouton.setAttribute("aria-label", `Signaler ${c.nom} (partie « ${partie.quete} »)`);
    bouton.setAttribute("aria-expanded", "false");
    bouton.setAttribute("aria-haspopup", "dialog");
    li.appendChild(bouton);
  }
  return li;
}

function gererClicHistorique(evt) {
  const btnSignaler = evt.target.closest(".btn-signaler");
  if (btnSignaler) {
    const dejaOuvert = btnSignaler.getAttribute("aria-expanded") === "true";
    fermerMenuSignalement();
    if (!dejaOuvert) ouvrirMenuSignalement(btnSignaler);
    return;
  }
  if (evt.target.closest(".btn-annuler-signalement")) {
    fermerMenuSignalement(true);
    return;
  }
  const btnEnvoyer = evt.target.closest(".btn-envoyer-signalement");
  if (btnEnvoyer) envoyerSignalement(btnEnvoyer.closest(".menu-signalement"));
}

function ouvrirMenuSignalement(bouton) {
  const li = bouton.closest(".coequipier");
  const article = bouton.closest(".partie");
  const nom = bouton.dataset.nom;

  const menu = creerElement("div", "menu-signalement");
  menu.id = "menu-signalement";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", `Signaler ${nom}`);
  menu.dataset.joueurId = bouton.dataset.joueurId;
  menu.dataset.partieId = article.dataset.partieId;

  menu.appendChild(creerElement("p", "menu-titre", `Signaler ${nom}`));
  menu.appendChild(
    creerElement("p", "menu-contexte", `Partie « ${article.dataset.quete} » · ${UI.formatDate(article.dataset.date)}`)
  );

  const fieldset = creerElement("fieldset", "motifs");
  fieldset.appendChild(creerElement("legend", null, "Motif du signalement"));
  JoueurService.motifs().forEach((motif) => {
    const option = creerElement("label", "option-motif");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "motif-signalement";
    radio.value = motif;
    option.appendChild(radio);
    option.appendChild(creerElement("span", null, motif));
    fieldset.appendChild(option);
  });
  menu.appendChild(fieldset);

  const erreur = creerElement("p", "erreur-signalement");
  erreur.setAttribute("role", "alert");
  erreur.hidden = true;
  menu.appendChild(erreur);

  const actions = creerElement("div", "menu-actions");
  const annuler = creerElement("button", "secondaire btn-annuler-signalement", "Annuler");
  annuler.type = "button";
  const envoyer = creerElement("button", "btn-envoyer-signalement", "Envoyer le signalement");
  envoyer.type = "button";
  envoyer.disabled = true; // actif seulement quand un motif est choisi
  actions.appendChild(annuler);
  actions.appendChild(envoyer);
  menu.appendChild(actions);

  li.appendChild(menu);
  li.classList.add("ouvert");
  bouton.setAttribute("aria-expanded", "true");
  const premier = menu.querySelector("input");
  if (premier) premier.focus();
}

function fermerMenuSignalement(rendreFocus) {
  const menu = document.getElementById("menu-signalement");
  if (!menu || signalementEnCours) return;
  const li = menu.closest(".coequipier");
  menu.remove();
  if (!li) return;
  li.classList.remove("ouvert");
  const bouton = li.querySelector(".btn-signaler");
  if (bouton) {
    bouton.setAttribute("aria-expanded", "false");
    if (rendreFocus) bouton.focus();
  }
}

function marquerSignale(li) {
  const bouton = li.querySelector(".btn-signaler");
  if (bouton) bouton.replaceWith(creerElement("span", "badge badge-signale", "Signalé"));
}

function confirmerDansCarte(article, type, texte) {
  const ancien = article.querySelector(".retour-signalement");
  if (ancien) ancien.remove();
  const p = creerElement("p", `msg msg-${type} msg-compact retour-signalement`, texte);
  p.setAttribute("role", "status");
  article.appendChild(p);
}

async function envoyerSignalement(menu) {
  if (!menu || signalementEnCours) return;
  const choix = menu.querySelector('input[name="motif-signalement"]:checked');
  const erreur = menu.querySelector(".erreur-signalement");
  if (!choix) {
    erreur.textContent = "Veuillez choisir un motif avant d'envoyer le signalement.";
    erreur.hidden = false;
    return;
  }

  const li = menu.closest(".coequipier");
  const article = menu.closest(".partie");
  const bouton = menu.querySelector(".btn-envoyer-signalement");
  const controles = menu.querySelectorAll("input, button");
  signalementEnCours = true;
  controles.forEach((c) => (c.disabled = true));
  bouton.textContent = "Envoi en cours…";

  try {
    if (!(await revalider())) {
      // compte banni/supprimé entre-temps : la session est fermée, rien n'est enregistré
      signalementEnCours = false;
      fermerMenuSignalement();
      return;
    }
    const session = sessionJoueur();
    const r = await JoueurService.signalerJoueur({
      signaleurId: session.userId,
      joueurId: Number(menu.dataset.joueurId),
      partieId: Number(menu.dataset.partieId),
      motif: choix.value,
    });
    if (r.ok || r.raison === "deja-signale") {
      signalementEnCours = false;
      fermerMenuSignalement();
      marquerSignale(li);
      const texte = r.ok
        ? `Signalement de ${r.nom} envoyé à l'administration (motif : ${choix.value}). Merci !`
        : `Vous avez déjà signalé ${r.nom} pour cette partie.`;
      confirmerDansCarte(article, r.ok ? "succes" : "info", texte);
      UI.message(r.ok ? "succes" : "info", texte);
      return;
    }
    erreur.textContent = MESSAGES_SIGNALEMENT[r.raison] || "Le signalement n'a pas pu être envoyé.";
    erreur.hidden = false;
  } catch (e) {
    console.error(e);
    erreur.textContent = "Le signalement n'a pas pu être envoyé. Veuillez réessayer.";
    erreur.hidden = false;
  } finally {
    signalementEnCours = false;
    if (menu.isConnected) {
      controles.forEach((c) => (c.disabled = false));
      bouton.disabled = !menu.querySelector('input[name="motif-signalement"]:checked');
      bouton.textContent = "Envoyer le signalement";
    }
  }
}
