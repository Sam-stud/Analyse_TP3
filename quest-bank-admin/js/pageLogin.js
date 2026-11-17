// pageLogin.js (socle) : connexion simulée.

document.addEventListener("DOMContentLoaded", () => {
  UI.barreOutils({ connecte: false });

  document.getElementById("form-login").addEventListener("submit", async (evt) => {
    evt.preventDefault();
    try {
      const r = await Auth.connecter(document.getElementById("nom").value);
      if (r.ok) {
        window.location.href = "index.html";
      } else {
        UI.message("erreur", r.message);
      }
    } catch (e) {
      console.error(e);
      UI.message("erreur", "Données introuvables : impossible de vérifier le compte.");
    }
  });
});
