// pageJoueursSignales.js : US 281 (Samuel). Affiche les joueurs signalés et gère le bouton Bannir.

const ACTION_BANNIR = "faire cette opération";

function creerCellule(texte, classe) {
  const td = document.createElement("td");
  td.textContent = texte; // textContent : les données JSON ne sont jamais interprétées comme du HTML
  if (classe) td.className = classe;
  return td;
}

function afficherJoueurs(joueurs) {
  const corps = document.getElementById("corps-joueurs");
  const vide = document.getElementById("liste-vide");
  const tableau = document.getElementById("tableau-joueurs");
  corps.innerHTML = "";

  if (joueurs.length === 0) {
    tableau.hidden = true;
    vide.hidden = false;
    return;
  }
  tableau.hidden = false;
  vide.hidden = true;

  joueurs.forEach((j) => {
    const tr = document.createElement("tr");
    const introuvable = j.nom === null;

    tr.appendChild(creerCellule(introuvable ? `Joueur introuvable (id ${j.joueurId})` : j.nom, "nom"));
    tr.appendChild(creerCellule(j.motif, "motif"));
    tr.appendChild(creerCellule(j.date));

    const tdStatut = document.createElement("td");
    const badge = document.createElement("span");
    const statut = introuvable ? "inconnu" : j.statut;
    badge.className = `badge badge-${statut}`;
    badge.textContent = statut;
    tdStatut.appendChild(badge);
    tr.appendChild(tdStatut);

    const tdAction = document.createElement("td");
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "danger btn-bannir";
    bouton.textContent = "Bannir";
    bouton.dataset.joueurId = j.joueurId;
    tdAction.appendChild(bouton);
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

// Rafraîchit la liste sans effacer le message de confirmation.
async function rafraichir2() {
  const resultat = await AdminService.listerJoueursSignales();
  if (resultat.ok) afficherJoueurs(resultat.joueurs);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!Auth.jeton()) {
    window.location.href = "login.html";
    return;
  }
  UI.barreOutils({ onChange: rafraichir });

  document.getElementById("corps-joueurs").addEventListener("click", (evt) => {
    const bouton = evt.target.closest(".btn-bannir");
    if (bouton) bannir(Number(bouton.dataset.joueurId));
  });

  rafraichir();
});
