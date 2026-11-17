// pageIndex.js (socle) : page d'accueil. Vérifie l'accès AU CLIC avant de naviguer (scénarios « jeton expiré »).

document.addEventListener("DOMContentLoaded", () => {
  if (!Auth.jeton()) {
    window.location.href = "login.html";
    return;
  }
  UI.barreOutils();

  document.querySelectorAll("[data-page]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const acces = Auth.verifierAcces();
      if (!acces.ok) {
        UI.messageAcces("consulter ces informations");
        return;
      }
      window.location.href = bouton.dataset.page;
    });
  });
});
