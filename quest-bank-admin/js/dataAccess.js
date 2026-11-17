// dataAccess.js (socle) : remplace la base de données et les interfaces IUserAccess / IAdminDataAccess / IReportsLogAccess.
// Les données viennent de data/<jeu>.json (fetch). Les modifications (bannir) sont gardées dans localStorage par-dessus le JSON.

const JEUX_DE_DONNEES = {
  normal: "Normal",
  limites: "Limites",
  vide: "Limites : listes vides",
  erreurs: "Erreurs",
};

const DataAccess = {
  jeuCourant() {
    const j = sessionStorage.getItem("qb_jeu");
    return JEUX_DE_DONNEES[j] ? j : "normal";
  },

  choisirJeu(nom) {
    sessionStorage.setItem("qb_jeu", nom);
  },

  async lireJSON(nom) {
    const reponse = await fetch(`data/${nom}.json`);
    if (!reponse.ok) {
      throw new Error(`Fichier data/${nom}.json introuvable (HTTP ${reponse.status})`);
    }
    return reponse.json();
  },

  _cleBans() {
    return `qb_bans_${this.jeuCourant()}`;
  },

  bansLocaux() {
    try {
      return JSON.parse(localStorage.getItem(this._cleBans()) || "[]");
    } catch (e) {
      return [];
    }
  },

  // Retourne { users, signalements, bugs } avec les bannissements locaux appliqués.
  async charger() {
    const donnees = await this.lireJSON(this.jeuCourant());
    const bans = this.bansLocaux();
    const users = (donnees.users || []).map((u) =>
      bans.includes(u.id) ? { ...u, statut: "inactif" } : u
    );
    return {
      users,
      signalements: donnees.signalements || [],
      bugs: donnees.bugs || [],
    };
  },

  bannirLocal(userId) {
    const bans = this.bansLocaux();
    if (!bans.includes(userId)) {
      bans.push(userId);
    }
    localStorage.setItem(this._cleBans(), JSON.stringify(bans));
  },

  // Utile pour rejouer les tests (retests et régression).
  reinitialiser() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("qb_"))
      .forEach((k) => localStorage.removeItem(k));
  },
};
