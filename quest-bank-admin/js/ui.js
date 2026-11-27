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

  // "2026-11-24" -> "24 nov. 2026". Une date absente ou illisible est affichée telle quelle.
  formatDate(iso) {
    if (!iso) return "Date inconnue";
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
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
    select.addEventListener("change", async () => {
      DataAccess.choisirJeu(select.value);
      UI.message("info", `Jeu de données « ${JEUX_DE_DONNEES[select.value]} » chargé.`);
      if (options.onChange) await options.onChange();
      UI.rafraichirAlerteBogues();
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
    btnReset.addEventListener("click", async () => {
      DataAccess.reinitialiser();
      UI.message("info", "Données de démo réinitialisées.");
      if (options.onChange) await options.onChange();
      UI.rafraichirAlerteBogues();
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
    this.rafraichirAlerteBogues();
  },

  async rafraichirAlerteBogues() {
    let alerte = document.getElementById("alerte-bogues");
    if (!alerte) {
      alerte = document.createElement("div");
      alerte.id = "alerte-bogues";
      const barre = document.getElementById("barre");
      if (barre && barre.parentNode) barre.insertAdjacentElement("afterend", alerte);
    }
    alerte.hidden = true;
    alerte.className = "alerte-bogues";
    alerte.textContent = "";

    const jeton = Auth.jeton();
    if (!jeton || jeton.role !== "admin" || jeton.expiresAt <= Date.now()) return;

    try {
      let nouveaux = 0;
      if (typeof AdminService !== "undefined" && AdminService.niveauAlerteBogues) {
        const r = await AdminService.niveauAlerteBogues();
        if (!r.ok || !r.niveau) return;
        nouveaux = r.nouveaux;
      } else {
        const { bugs } = await DataAccess.charger();
        nouveaux = bugs.filter((b) => (b.statutBogue || "nouveau") === "nouveau").length;
      }
      let niveau = null;
      if (nouveaux >= 15) niveau = "rouge";
      else if (nouveaux >= 10) niveau = "jaune";
      if (!niveau) return;
      alerte.hidden = false;
      alerte.classList.add(`alerte-bogues-${niveau}`);
      const prefixe = niveau === "rouge" ? "Alerte rouge" : "Alerte jaune";
      const urgence = niveau === "rouge"
        ? " Les bogues rapportés sont une priorité absolue."
        : " Il faut s'y mettre pour libérer la liste de billets.";
      alerte.textContent = `${prefixe} : ${nouveaux} nouveaux rapports de bogues non gérés.${urgence}`;
    } catch (e) {
      alerte.hidden = true;
    }
  },
};
