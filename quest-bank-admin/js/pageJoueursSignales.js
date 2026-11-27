// pageJoueursSignales.js : US 281 (Samuel). Affiche les joueurs signalés et gère le bouton Bannir.
// Les signalements faits par les joueurs (historique des parties) arrivent ici : la liste est relue
// à chaque affichage, au clic sur « Rafraîchir » et automatiquement quand un autre onglet ajoute un signalement.

const ACTION_BANNIR = "faire cette opération";

const STATUTS_SIGNALEMENT = [
  { valeur: "nouveau", libelle: "Nouveau" },
  { valeur: "en-examen", libelle: "En examen" },
  { valeur: "traite", libelle: "Traité" },
  { valeur: "rejete", libelle: "Rejeté" },
];

let derniersSignalements = [];

function creerCellule(texte, classe) {
  const td = document.createElement("td");
  td.textContent = texte; // textContent : les données JSON ne sont jamais interprétées comme du HTML
  if (classe) td.className = classe;
  return td;
}

function creerBadge(texte, classe) {
  const badge = document.createElement("span");
  badge.className = `badge ${classe}`;
  badge.textContent = texte;
  return badge;
}

function ligneSecondaire(texte) {
  const span = document.createElement("span");
  span.className = "cellule-secondaire";
  span.textContent = texte;
  return span;
}

function filtreCourant() {
  const select = document.getElementById("filtre-statut");
  return select ? select.value : "tous";
}

function afficherCompteurs(joueurs) {
  const nouveaux = joueurs.filter((j) => j.statutSignalement === "nouveau").length;
  const compteur = document.getElementById("compteur-signalements");
  compteur.textContent = `${joueurs.length} signalement${joueurs.length > 1 ? "s" : ""} · ${nouveaux} nouveau${nouveaux > 1 ? "x" : ""}`;
}

function afficherJoueurs(joueurs) {
  derniersSignalements = joueurs;
  const corps = document.getElementById("corps-joueurs");
  const vide = document.getElementById("liste-vide");
  const tableau = document.getElementById("tableau-joueurs");
  corps.innerHTML = "";
  afficherCompteurs(joueurs);

  const filtre = filtreCourant();
  const visibles = filtre === "tous" ? joueurs : joueurs.filter((j) => j.statutSignalement === filtre);

  if (visibles.length === 0) {
    tableau.hidden = true;
    vide.hidden = false;
    vide.textContent = joueurs.length === 0
      ? "Aucun joueur signalé pour le moment."
      : "Aucun signalement ne correspond à ce filtre.";
    return;
  }
  tableau.hidden = false;
  vide.hidden = true;

  visibles.forEach((j) => {
    const tr = document.createElement("tr");
    if (j.statutSignalement === "nouveau") tr.className = "ligne-nouvelle";
    const introuvable = j.nom === null;

    // Joueur signalé + statut de son compte
    const tdNom = creerCellule(introuvable ? `Joueur introuvable (id ${j.joueurId})` : j.nom, "nom");
    let statut = introuvable ? "inconnu" : j.statut;
    let classeStatut = statut;
    if (j.compteSupprime) {
      statut = "compte supprimé";
      classeStatut = "inconnu";
    }
    tdNom.appendChild(document.createElement("br"));
    tdNom.appendChild(creerBadge(statut, `badge-${classeStatut}`));
    tr.appendChild(tdNom);

    // Motif
    const tdMotif = creerCellule(j.motif, "motif");
    if (j.estCyberattaque) {
      tdMotif.appendChild(document.createTextNode(" "));
      tdMotif.appendChild(creerBadge("CYBERATTAQUE", "badge-inactif"));
    }
    tr.appendChild(tdMotif);

    // Signalé par
    let signaleur;
    if (j.estCyberattaque) signaleur = "Détection automatique";
    else if (j.signaleurNom) signaleur = j.signaleurSupprime ? `${j.signaleurNom} (compte supprimé)` : j.signaleurNom;
    else if (j.signaleurId !== null) signaleur = `Joueur introuvable (id ${j.signaleurId})`;
    else signaleur = "Non précisé";
    tr.appendChild(creerCellule(signaleur, j.signaleurNom ? "nom signaleur" : "texte-pale"));

    // Partie
    const tdPartie = document.createElement("td");
    tdPartie.className = "partie-cellule";
    if (j.partieId !== null) {
      tdPartie.textContent = j.partieQuete || `Partie n° ${j.partieId}`;
      tdPartie.appendChild(ligneSecondaire(`n° ${j.partieId} · ${UI.formatDate(j.partieDate)}`));
    } else {
      tdPartie.textContent = "—";
      tdPartie.classList.add("texte-pale");
    }
    tr.appendChild(tdPartie);

    // Date du signalement
    const tdDate = creerCellule(UI.formatDate(j.date), "date");
    if (j.date) tdDate.title = j.date;
    tr.appendChild(tdDate);

    // Suivi par l'administrateur
    const tdSuivi = document.createElement("td");
    const select = document.createElement("select");
    select.className = "select-statut select-statut-signalement";
    select.dataset.signalementId = j.signalementId;
    select.setAttribute("aria-label", `Suivi du signalement de ${j.nom || "joueur introuvable"}`);
    STATUTS_SIGNALEMENT.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.valeur;
      opt.textContent = s.libelle;
      if (j.statutSignalement === s.valeur) opt.selected = true;
      select.appendChild(opt);
    });
    tdSuivi.appendChild(select);
    tr.appendChild(tdSuivi);

    // Action
    const tdAction = document.createElement("td");
    if (j.compteSupprime) {
      tdAction.appendChild(creerBadge("Bannissement impossible", "badge-inconnu"));
    } else {
      // Un joueur banni peut être débanni ; sinon (actif ou introuvable) on propose « Bannir ».
      const banni = j.statut === "inactif";
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = banni ? "secondaire btn-debannir" : "danger btn-bannir";
      bouton.textContent = banni ? "Débannir" : "Bannir";
      bouton.setAttribute("aria-label", `${bouton.textContent} ${j.nom || `le joueur id ${j.joueurId}`}`);
      bouton.dataset.joueurId = j.joueurId;
      tdAction.appendChild(bouton);
    }
    tr.appendChild(tdAction);

    corps.appendChild(tr);
  });
}

async function rafraichir() {
  try {
    const resultat = await AdminService.listerJoueursSignales();
    if (!resultat.ok) {
      afficherJoueurs([]);
      document.getElementById("liste-vide").hidden = true;
      UI.messageAcces("consulter ces informations");
      return;
    }
    afficherJoueurs(resultat.joueurs);
  } catch (e) {
    console.error(e);
    afficherJoueurs([]);
    document.getElementById("liste-vide").hidden = true;
    UI.message("erreur", "Données introuvables : impossible de charger la liste des joueurs signalés.");
  }
}

async function bannir(joueurId) {
  // US 55 : confirmation avant de bannir. « Annuler » : rien n'est fait, aucun message.
  const joueur = derniersSignalements.find((j) => j.joueurId === joueurId);
  const nom = (joueur && joueur.nom) || `id ${joueurId}`;
  if (!window.confirm(`Voulez-vous vraiment bannir le joueur ${nom} ?`)) return;

  try {
    const r = await AdminService.bannirUtilisateur(joueurId);

    if (r.ok) {
      UI.message("succes", `Le joueur ${r.nom} a été banni. Il est maintenant inactif et ne peut plus accéder au jeu.`);
      await rafraichir2();
      return;
    }
    if (r.raison === "deja-banni") {
      UI.message("info", `Le joueur ${r.nom} est déjà banni.`);
    } else if (r.raison === "introuvable") {
      UI.message("erreur", "Joueur introuvable : le compte n'existe plus (supprimé par le joueur ?). Aucun bannissement n'a été effectué.");
    } else {
      // jeton expiré, absent ou rôle insuffisant : aucun bannissement n'est effectué
      UI.messageAcces(ACTION_BANNIR);
    }
  } catch (e) {
    console.error(e);
    UI.message("erreur", "Données introuvables : le bannissement n'a pas pu être effectué.");
  }
}

async function debannir(joueurId) {
  const joueur = derniersSignalements.find((j) => j.joueurId === joueurId);
  const nom = (joueur && joueur.nom) || `id ${joueurId}`;
  if (!window.confirm(`Voulez-vous vraiment réactiver le joueur ${nom} ?`)) return;

  try {
    const r = await AdminService.debannirUtilisateur(joueurId);
    if (r.ok) {
      UI.message("succes", `Le joueur ${r.nom} a été débanni. Il est de nouveau actif et peut accéder au jeu.`);
    } else if (r.raison === "deja-actif") {
      UI.message("info", `Le joueur ${r.nom} est déjà actif.`);
    } else if (r.raison === "introuvable") {
      UI.message("erreur", "Joueur introuvable : le compte n'existe plus. Aucune réactivation n'a été effectuée.");
    } else {
      // jeton expiré, absent ou rôle insuffisant : aucune réactivation n'est effectuée
      UI.messageAcces(ACTION_BANNIR);
      return;
    }
    await rafraichir2();
  } catch (e) {
    console.error(e);
    UI.message("erreur", "Données introuvables : le débannissement n'a pas pu être effectué.");
  }
}

async function changerSuivi(select) {
  const id = Number(select.dataset.signalementId);
  const libelle = select.options[select.selectedIndex].textContent;
  try {
    const r = await AdminService.changerStatutSignalement(id, select.value);
    if (r.ok) {
      UI.message("succes", `Signalement marqué « ${libelle} ».`);
    } else if (r.raison === "introuvable") {
      UI.message("erreur", "Ce signalement n'existe plus. La liste a été mise à jour.");
    } else if (r.raison === "statut-invalide") {
      UI.message("erreur", "Statut de suivi invalide.");
    } else {
      UI.messageAcces("modifier le suivi des signalements");
    }
  } catch (e) {
    console.error(e);
    UI.message("erreur", "Données introuvables : le suivi n'a pas pu être modifié.");
  }
  await rafraichir2();
}

// Rafraîchit la liste sans effacer le message de confirmation.
async function rafraichir2() {
  try {
    const resultat = await AdminService.listerJoueursSignales();
    if (resultat.ok) afficherJoueurs(resultat.joueurs);
  } catch (e) {
    console.error(e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!Auth.jeton()) {
    window.location.href = "login.html";
    return;
  }
  UI.barreOutils({ onChange: rafraichir });

  const corps = document.getElementById("corps-joueurs");
  corps.addEventListener("click", (evt) => {
    const bouton = evt.target.closest(".btn-bannir");
    if (bouton) bannir(Number(bouton.dataset.joueurId));
    const boutonDebannir = evt.target.closest(".btn-debannir");
    if (boutonDebannir) debannir(Number(boutonDebannir.dataset.joueurId));
  });
  corps.addEventListener("change", (evt) => {
    const select = evt.target.closest(".select-statut-signalement");
    if (select) changerSuivi(select);
  });
  document.getElementById("filtre-statut").addEventListener("change", () => afficherJoueurs(derniersSignalements));
  document.getElementById("btn-rafraichir").addEventListener("click", async () => {
    await rafraichir();
    if (Auth.verifierAcces().ok) UI.message("info", "Liste des signalements mise à jour.");
  });

  // Un joueur qui envoie un signalement dans un autre onglet : la liste se met à jour toute seule.
  window.addEventListener("storage", (evt) => {
    if (evt.key === null || evt.key.startsWith("qb_")) rafraichir2();
  });

  rafraichir();
});
