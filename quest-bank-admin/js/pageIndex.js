// pageIndex.js (socle) : page d'accueil. Vérifie l'accès AU CLIC avant de naviguer (scénarios « jeton expiré »).

document.addEventListener("DOMContentLoaded", () => {
  if (!Auth.jeton()) {
    window.location.href = "login.html";
    return;
  }
  UI.barreOutils({ onChange: afficherCompteurs });

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

  afficherCompteurs();
  // Un nouveau signalement ou bogue envoyé depuis un autre onglet met les compteurs à jour.
  window.addEventListener("storage", (evt) => {
    if (evt.key === null || evt.key.startsWith("qb_")) afficherCompteurs();
  });
});

// Pastille « N nouveaux » sur chaque carte, calculée à partir des données réelles.
async function afficherCompteurs() {
  const poser = (idBouton, n) => {
    const bouton = document.getElementById(idBouton);
    if (!bouton) return;
    let pastille = bouton.querySelector(".compteur-carte");
    if (!pastille) {
      pastille = document.createElement("span");
      pastille.className = "compteur-carte";
      bouton.appendChild(pastille);
    }
    pastille.hidden = n === null;
    pastille.classList.toggle("zero", n === 0);
    pastille.textContent = n === null ? "" : `${n} nouveau${n > 1 ? "x" : ""}`;
  };
  try {
    const [sig, bog] = await Promise.all([AdminService.listerJoueursSignales(), AdminService.listerBogues()]);
    poser("btn-joueurs", sig.ok ? sig.joueurs.filter((j) => j.statutSignalement === "nouveau").length : null);
    poser("btn-bogues", bog.ok ? bog.bogues.filter((b) => b.statutBogue === "nouveau").length : null);
  } catch (e) {
    console.error(e);
    poser("btn-joueurs", null);
    poser("btn-bogues", null);
  }
}
