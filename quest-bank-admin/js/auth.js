// auth.js (socle) : connexion simulée, jeton, expiration et verifierAcces().
// Le jeton simulé n'est PAS une vraie sécurité : acceptable pour le TP, à préciser lors de la démo.

const DUREE_JETON_MS = 5 * 60 * 1000; // 5 minutes, modifiable ici
const CLE_JETON = "qb_jeton";

const Auth = {
  async connecter(nom) {
    const saisie = (nom || "").trim();
    if (!saisie) {
      return { ok: false, message: "Veuillez entrer un nom d'utilisateur." };
    }
    const { users } = await DataAccess.charger();
    const user = users.find((u) => u.nom.toLowerCase() === saisie.toLowerCase());
    if (!user) {
      return { ok: false, message: "Utilisateur introuvable." };
    }
    if (user.statut === "inactif") {
      return { ok: false, message: "Compte suspendu : vous ne pouvez plus accéder au jeu." };
    }
    sessionStorage.setItem(
      CLE_JETON,
      JSON.stringify({
        userId: user.id,
        nom: user.nom,
        role: user.role,
        expiresAt: Date.now() + DUREE_JETON_MS,
      })
    );
    return { ok: true, user };
  },

  jeton() {
    try {
      return JSON.parse(sessionStorage.getItem(CLE_JETON));
    } catch (e) {
      return null;
    }
  },

  deconnecter() {
    sessionStorage.removeItem(CLE_JETON);
  },

  // Pour les démos et les tests : évite d'attendre 5 minutes.
  simulerExpiration() {
    const j = this.jeton();
    if (j) {
      j.expiresAt = Date.now() - 1000;
      sessionStorage.setItem(CLE_JETON, JSON.stringify(j));
    }
  },

  // À appeler au début de chaque action (pas seulement un bouton caché).
  // Retourne { ok: true, jeton } ou { ok: false, raison: "absent" | "expire" | "role" }.
  verifierAcces() {
    const j = this.jeton();
    if (!j) return { ok: false, raison: "absent" };
    if (j.expiresAt <= Date.now()) return { ok: false, raison: "expire" };
    if (j.role !== "admin") return { ok: false, raison: "role" };
    return { ok: true, jeton: j };
  },
};
