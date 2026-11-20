// pageBogues.js : US 282 (Samithika). Affiche les bogues rapportés par les joueurs.

function creerCelluleBogue(texte, classe) {
  const td = document.createElement("td");
  td.textContent = texte; // textContent : les données JSON ne sont jamais interprétées comme du HTML
  if (classe) td.className = classe; // classes CSS existantes "nom" / "motif" = retour à la ligne des textes longs
  return td;
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
    const tr = document.createElement("tr");
    tr.appendChild(creerCelluleBogue(b.titre, "motif"));
    tr.appendChild(creerCelluleBogue(b.description, "motif"));
    tr.appendChild(
      creerCelluleBogue(
        b.joueurNom === null ? `Joueur introuvable (id ${b.joueurId})` : b.joueurNom,
        "nom"
      )
    );
    tr.appendChild(creerCelluleBogue(b.date));
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
  rafraichir();
});
