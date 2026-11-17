// ui.js (socle) : tous les messages (confirmation, erreur) et la barre d'outils passent par ici.

const UI = {
  message(type, texte) {
    // type : "succes" | "erreur" | "info"
    const zone = document.getElementById("messages");
    if (!zone) return;
    zone.innerHTML = "";
    const div = document.createElement("div");
    div.className = `msg msg-${type}`;
    div.setAttribute("role", type === "erreur" ? "alert" : "status");
    div.textContent = texte;
    zone.appendChild(div);
    return div;
  },

  effacer() {
    const zone = document.getElementById("messages");
    if (zone) zone.innerHTML = "";
  },

  // Message standard d'accès refusé (jeton expiré, rôle insuffisant ou absent).
  messageAcces(action) {
    const div = this.message(
      "erreur",
      `Vous ne possédez pas les autorisations requises pour ${action}. Vous devez vous réauthentifier. `
    );
    if (div) {
      const lien = document.createElement("a");
      lien.href = "login.html";
      lien.textContent = "Se réauthentifier";
      div.appendChild(lien);
    }
  },

  // Barre d'outils : jeu de données, simulation d'expiration, réinitialisation, déconnexion.
  // options.connecte : false sur la page de connexion. options.onChange : appelée après un changement.
  barreOutils(options = {}) {
    const barre = document.getElementById("barre");
    if (!barre) return;
    const connecte = options.connecte !== false;
    const jeton = Auth.jeton();

    barre.innerHTML = "";

    const titre = document.createElement("a");
    titre.href = "index.html";
    titre.className = "titre";
    titre.textContent = "Quest Bank : Administration";
    barre.appendChild(titre);

    const outils = document.createElement("div");
    outils.className = "outils";

    if (connecte && jeton) {
      const qui = document.createElement("span");
      qui.className = "qui";
      qui.textContent = `Connecté : ${jeton.nom} (${jeton.role})`;
      outils.appendChild(qui);
    }

    const label = document.createElement("label");
    label.textContent = "Jeu de données ";
    const select = document.createElement("select");
    select.id = "jeu-donnees";
    Object.entries(JEUX_DE_DONNEES).forEach(([valeur, texte]) => {
      const opt = document.createElement("option");
      opt.value = valeur;
      opt.textContent = texte;
      if (valeur === DataAccess.jeuCourant()) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      DataAccess.choisirJeu(select.value);
      UI.message("info", `Jeu de données « ${JEUX_DE_DONNEES[select.value]} » chargé.`);
      if (options.onChange) options.onChange();
    });
    label.appendChild(select);
    outils.appendChild(label);

    if (connecte) {
      const btnExp = document.createElement("button");
      btnExp.type = "button";
      btnExp.id = "btn-expirer";
      btnExp.className = "secondaire";
      btnExp.textContent = "Simuler l'expiration du jeton";
      btnExp.addEventListener("click", () => {
        Auth.simulerExpiration();
        UI.message("info", "Le jeton d'authentification est maintenant expiré (simulation).");
      });
      outils.appendChild(btnExp);
    }

    const btnReset = document.createElement("button");
    btnReset.type = "button";
    btnReset.id = "btn-reset";
    btnReset.className = "secondaire";
    btnReset.textContent = "Réinitialiser les données de démo";
    btnReset.addEventListener("click", () => {
      DataAccess.reinitialiser();
      UI.message("info", "Données de démo réinitialisées.");
      if (options.onChange) options.onChange();
    });
    outils.appendChild(btnReset);

    if (connecte) {
      const btnOut = document.createElement("button");
      btnOut.type = "button";
      btnOut.className = "secondaire";
      btnOut.textContent = "Déconnexion";
      btnOut.addEventListener("click", () => {
        Auth.deconnecter();
        window.location.href = "login.html";
      });
      outils.appendChild(btnOut);
    }

    barre.appendChild(outils);
  },
};
