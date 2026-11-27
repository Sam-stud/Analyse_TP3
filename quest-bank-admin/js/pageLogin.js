// pageLogin.js (socle) : connexion simulée.

document.addEventListener("DOMContentLoaded", () => {
  UI.barreOutils({ connecte: false });
  const cible = new URLSearchParams(window.location.search).get("cible");

  // Identité visuelle : la connexion à l'espace joueur prend le thème « Aventure ».
  if (cible === "joueur.html") {
    document.body.classList.replace("theme-admin", "theme-joueur");
    const sousMarque = document.querySelector(".marque-texte small");
    if (sousMarque) sousMarque.textContent = "Espace joueur";
    const blason = document.querySelector(".blason");
    if (blason) blason.classList.add("blason-joueur");
    const champ = document.getElementById("nom");
    if (champ) champ.placeholder = "Ex. : Gobelin42";
    const aide = document.querySelector("#form-login .aide");
    if (aide) aide.textContent = "Démo : « Gobelin42 », « Elfe07 » et « Nain99 » sont des joueurs. Un compte banni ne peut plus se connecter.";
    document.querySelectorAll(".menu-lateral a").forEach((a) => a.classList.toggle("actif", a.classList.contains("lien-joueur")));
  } else {
    document.querySelectorAll(".menu-lateral a").forEach((a) => a.classList.toggle("actif", a.classList.contains("lien-admin")));
  }

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
