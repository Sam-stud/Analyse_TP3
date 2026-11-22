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

  _cleBugs() {
    return `qb_bugs_${this.jeuCourant()}`;
  },

  bugsLocaux() {
    try {
      return JSON.parse(localStorage.getItem(this._cleBugs()) || "[]");
    } catch (e) {
      return [];
    }
  },

  // Les suppressions de compte sont GLOBALES (une seule clé, pas une par jeu de données) :
  // un joueur qui supprime son compte disparaît de tous les jeux (Normal, Limites, Erreurs...).
  // On les identifie par le nom (insensible à la casse), car les ids ne sont pas stables d'un jeu à l'autre
  // (ex. l'id 2 est Gobelin42 dans « normal » mais Troll13 dans « limites »).
  _CLE_SUPPRIMES: "qb_supprimes",

  _normaliserNom(nom) {
    return String(nom).trim().toLowerCase();
  },

  // Noms (en minuscules) des comptes supprimés par leur propriétaire (simulation, gardée dans localStorage).
  comptesSupprimes() {
    try {
      return JSON.parse(localStorage.getItem(this._CLE_SUPPRIMES) || "[]");
    } catch (e) {
      return [];
    }
  },

  // Ancien format : suppressions par jeu, par id (clé qb_supprimes_<jeu>). On les convertit en noms
  // (via le jeu courant) dans la liste globale, puis on retire l'ancienne clé.
  _migrerAnciennesSuppressions(donnees) {
    const cleAncienne = `qb_supprimes_${this.jeuCourant()}`;
    const brut = localStorage.getItem(cleAncienne);
    if (brut === null) return;
    try {
      const ids = JSON.parse(brut);
      (donnees.users || [])
        .filter((u) => ids.includes(u.id))
        .forEach((u) => this.supprimerCompteLocal(u.nom));
    } catch (e) {
      // ancienne valeur illisible : on l'abandonne
    }
    localStorage.removeItem(cleAncienne);
  },

  // Retourne { users, signalements, bugs } avec les bannissements locaux appliqués,
  // les bogues signalés localement ajoutés, et sans les comptes supprimés (introuvables pour tous).
  async charger() {
    const donnees = await this.lireJSON(this.jeuCourant());
    this._migrerAnciennesSuppressions(donnees);
    const bans = this.bansLocaux();
    const supprimes = this.comptesSupprimes();
    const users = (donnees.users || [])
      .filter((u) => !supprimes.includes(this._normaliserNom(u.nom)))
      .map((u) => (bans.includes(u.id) ? { ...u, statut: "inactif" } : u));
    return {
      users,
      signalements: donnees.signalements || [],
      bugs: [...(donnees.bugs || []), ...this.bugsLocaux()],
    };
  },

  bannirLocal(userId) {
    const bans = this.bansLocaux();
    if (!bans.includes(userId)) {
      bans.push(userId);
    }
    localStorage.setItem(this._cleBans(), JSON.stringify(bans));
  },

  signalerBogueLocal(bogue) {
    const bugs = this.bugsLocaux();
    let id = Date.now();
    while (bugs.some((b) => b.id === id)) {
      id += 1;
    }
    bugs.push({ id, ...bogue });
    localStorage.setItem(this._cleBugs(), JSON.stringify(bugs));
  },

  // Supprime le compte du joueur (par son nom) dans tous les jeux de données.
  supprimerCompteLocal(nom) {
    const cle = this._normaliserNom(nom);
    const supprimes = this.comptesSupprimes();
    if (!supprimes.includes(cle)) {
      supprimes.push(cle);
    }
    localStorage.setItem(this._CLE_SUPPRIMES, JSON.stringify(supprimes));
  },

  // Utile pour rejouer les tests (retests et régression).
  reinitialiser() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("qb_"))
      .forEach((k) => localStorage.removeItem(k));
  },
};
