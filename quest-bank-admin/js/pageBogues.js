// pageBogues.js : US 282 (Samithika). Affiche les bogues rapportés par les joueurs.

const STATUTS_BOGUE = [
  { valeur: "nouveau", libelle: "Nouveau" },
  { valeur: "en-cours", libelle: "En cours" },
  { valeur: "resolu", libelle: "Résolu" },
];

function creerCelluleBogue(texte, classe) {
  const td = document.createElement("td");
  td.textContent = texte; // textContent : les données JSON ne sont jamais interprétées comme du HTML
  if (classe) td.className = classe; // classes CSS existantes "nom" / "motif" = retour à la ligne des textes longs
  return td;
}

function ajouterBadge(cellule, texte, classe) {
  const badge = document.createElement("span");
  badge.className = `badge ${classe}`;
  badge.textContent = texte;
  cellule.appendChild(document.createTextNode(" "));
  cellule.appendChild(badge);
}

function afficherBogues(bogues) {
  const corps = document.getElementById("corps-bogues");
  const tableau = document.getElementById("tableau-bogues");
  const vide = document.getElementById("liste-vide");
  corps.innerHTML = "";

  if (bogues.length === 0) {
    tableau.hidden = true;
    vide.hidden = false;
    return;
  }
  tableau.hidden = false;
  vide.hidden = true;

  bogues.forEach((b) => {
    const attaque = b.estAttaque === true;
    const compteSupprime = b.compteSupprime === true;
    const dejaBanni = b.statut === "inactif";
    const nomJoueur = b.joueurNom;
    const tr = document.createElement("tr");

    const tdTitre = creerCelluleBogue(
      attaque ? "Tentative de cyberattaque (pas un bogue typique)" : b.titre,
      "motif"
    );
    if (attaque) {
      ajouterBadge(tdTitre, "CYBERATTAQUE – TEXTE BRUT NON EXÉCUTÉ", "badge-inactif");
      ajouterBadge(
        tdTitre,
        compteSupprime
          ? "COMPTE SUPPRIMÉ – BANNISSEMENT IMPOSSIBLE"
          : dejaBanni
            ? "JOUEUR DÉJÀ BANNI"
            : "JOUEUR À BANNIR",
        compteSupprime ? "badge-inconnu" : "badge-inactif"
      );
    }
    tr.appendChild(tdTitre);

    const description = attaque
      ? `Titre brut : ${b.titre || "(sans titre)"} – ${b.typeAttaque || "Injection détectée"} – texte brut : ${b.description}`
      : b.description;
    tr.appendChild(creerCelluleBogue(description, "motif"));

    const libelleJoueur = nomJoueur
      ? compteSupprime
        ? `${nomJoueur} (compte supprimé – bannissement impossible)`
        : nomJoueur
      : `Joueur introuvable (id ${b.joueurId})`;
    const tdJoueur = creerCelluleBogue(libelleJoueur, "nom");
    if (dejaBanni) ajouterBadge(tdJoueur, "DÉJÀ BANNI", "badge-inactif");
    tr.appendChild(tdJoueur);
    tr.appendChild(creerCelluleBogue(UI.formatDate(b.date)));

    const tdStatut = document.createElement("td");
    const select = document.createElement("select");
    select.className = "select-statut-bogue";
    select.dataset.bugId = b.id;
    STATUTS_BOGUE.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.valeur;
      opt.textContent = s.libelle;
      if ((b.statutBogue || "nouveau") === s.valeur) opt.selected = true;
      select.appendChild(opt);
    });
    tdStatut.appendChild(select);
    tr.appendChild(tdStatut);

    corps.appendChild(tr);
  });
}

async function rafraichir() {
  const vide = document.getElementById("liste-vide");
  try {
    const resultat = await AdminService.listerBogues();
    if (!resultat.ok) {
      // Jeton absent, expiré ou rôle insuffisant : on n'affiche aucune donnée.
      afficherBogues([]);
      vide.hidden = true;
      UI.messageAcces("consulter la liste des bogues");
      return;
    }
    afficherBogues(resultat.bogues);
    UI.rafraichirAlerteBogues();
  } catch (e) {
    console.error(e);
    afficherBogues([]);
    vide.hidden = true;
    // data/<jeu>.json introuvable (HTTP 404) = données introuvables ; échec du fetch = erreur serveur.
    const message =
      e && e.message && e.message.includes("introuvable")
        ? "Données introuvables : impossible de charger la liste des bogues rapportés."
        : "Erreur serveur : impossible de charger la liste des bogues rapportés.";
    UI.message("erreur", message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!Auth.jeton()) {
    window.location.href = "login.html";
    return;
  }
  UI.barreOutils({ onChange: rafraichir });
  document.getElementById("btn-rafraichir").addEventListener("click", rafraichir);
  document.getElementById("corps-bogues").addEventListener("change", async (evt) => {
    const select = evt.target.closest(".select-statut-bogue");
    if (!select) return;
    const bugId = Number(select.dataset.bugId);
    const statutBogue = select.value;
    const r = await AdminService.changerStatutBogue(bugId, statutBogue);
    if (!r.ok) {
      UI.messageAcces("modifier le statut des bogues");
      await rafraichir();
      return;
    }
    await rafraichir();
    UI.rafraichirAlerteBogues();
  });
  rafraichir();
});
