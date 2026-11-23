// pageLogin.js (socle) : connexion simulée.

document.addEventListener("DOMContentLoaded", () => {
  UI.barreOutils({ connecte: false });
  const cible = new URLSearchParams(window.location.search).get("cible");

  const titre = document.querySelector("main h1");
  if (titre && cible === "joueur.html") titre.textContent = "Connexion à l'espace joueur";
  if (titre && cible === "index.html") titre.textContent = "Connexion à l'administration";

  document.getElementById("form-login").addEventListener("submit", async (evt) => {
    evt.preventDefault();
    try {
      const r = await Auth.connecter(document.getElementById("nom").value);
      if (r.ok) {
        if (cible === "index.html" && r.user.role !== "admin") {
          Auth.deconnecter();
          UI.message("erreur", "Seul un administrateur peut accéder à l'interface administrateur.");
          return;
        }
        if (cible === "joueur.html" && r.user.role !== "joueur") {
          Auth.deconnecter();
          sessionStorage.removeItem("qb_joueur");
          UI.message("erreur", "Seul un joueur peut accéder à l'interface joueur.");
          return;
        }
        if (r.user.role === "admin") {
          sessionStorage.removeItem("qb_joueur");
        } else {
          if (cible === "joueur.html") {
            sessionStorage.setItem(
              "qb_joueur",
              JSON.stringify({ userId: r.user.id, nom: r.user.nom })
            );
          }
          Auth.deconnecter();
        }
        window.location.href = cible || "index.html";
      } else {
        UI.message("erreur", r.message);
      }
    } catch (e) {
      console.error(e);
      UI.message("erreur", "Données introuvables : impossible de vérifier le compte.");
    }
  });
});
