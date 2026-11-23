// adminService.js : remplace AdminService / ReportsService du serveur (TP2).
// Chaque étudiant n'ajoute QUE sa propre fonction dans cet objet.

const AdminService = {
  // ---------- US 281 (Samuel) ----------

  // Liste des joueurs signalés, avec leur nom et leur statut (croisement signalements x users).
  async listerJoueursSignales() {
    const acces = Auth.verifierAcces();
    if (!acces.ok) return { ok: false, raison: acces.raison };

    const { users, signalements } = await DataAccess.charger();
    const joueurs = signalements.map((s) => {
      const user = users.find((u) => u.id === s.joueurId);
      return {
        signalementId: s.id,
        joueurId: s.joueurId,
        nom: user ? user.nom : s.joueurNom || null,
        statut: user ? user.statut : null,
        motif: s.motif,
        date: s.date,
        estCyberattaque: s.estCyberattaque === true,
        compteSupprime: !user && !!s.joueurNom,
      };
    });
    return { ok: true, joueurs };
  },

  // Bannit un joueur : le déclare inactif. La vérification d'accès est refaite à chaque action.
  async bannirUtilisateur(joueurId) {
    const acces = Auth.verifierAcces();
    if (!acces.ok) return { ok: false, raison: acces.raison };

    const { users } = await DataAccess.charger();
    const user = users.find((u) => u.id === joueurId);
    if (!user) return { ok: false, raison: "introuvable" };
    if (user.statut === "inactif") return { ok: false, raison: "deja-banni", nom: user.nom };

    DataAccess.bannirLocal(joueurId);
    return { ok: true, nom: user.nom };
  },

  // ---------- US 282 (Samithika) ----------

  // Liste des bogues signalés par les joueurs, avec le nom du joueur (croisement bugs x users).
  // La vérification d'accès est refaite ici, côté service : l'UI n'est pas la seule à décider.
  async listerBogues() {
    const acces = Auth.verifierAcces();
    if (!acces.ok) return { ok: false, raison: acces.raison };

    const { users, bugs } = await DataAccess.charger();
    const bogues = bugs.map((b) => {
      const joueur = users.find((u) => u.id === b.joueurId);
      return {
        id: b.id,
        titre: b.titre,
        description: b.description,
        joueurId: b.joueurId,
        joueurNom: joueur ? joueur.nom : b.joueurNom || null,
        statut: joueur ? joueur.statut : null,
        date: b.date,
        estAttaque: b.estAttaque === true,
        typeAttaque: b.typeAttaque || null,
        compteSupprime: !joueur && !!b.joueurNom,
      };
    });
    return { ok: true, bogues };
  },
};
