// adminService.js : remplace AdminService / ReportsService du serveur (TP2).
// Chaque étudiant n'ajoute QUE sa propre fonction dans cet objet.

const AdminService = {
  // ---------- US 281 (Samuel) ----------

  // Liste des joueurs signalés (plus récents d'abord), avec leur nom et leur statut,
  // le joueur qui a fait le signalement et la partie concernée (croisement signalements x users x parties).
  async listerJoueursSignales() {
    const acces = Auth.verifierAcces();
    if (!acces.ok) return { ok: false, raison: acces.raison };

    const { users, signalements, parties } = await DataAccess.charger();
    const joueurs = signalements
      .map((s) => {
        const user = users.find((u) => u.id === s.joueurId);
        const aSignaleur = s.signaleurId !== undefined && s.signaleurId !== null;
        const signaleur = aSignaleur ? users.find((u) => u.id === s.signaleurId) : null;
        const aPartie = s.partieId !== undefined && s.partieId !== null;
        const partie = aPartie ? parties.find((p) => p.id === s.partieId) : null;
        return {
          signalementId: s.id,
          joueurId: s.joueurId,
          nom: user ? user.nom : s.joueurNom || null,
          statut: user ? user.statut : null,
          motif: s.motif,
          date: s.date,
          estCyberattaque: s.estCyberattaque === true,
          compteSupprime: !user && !!s.joueurNom,
          signaleurId: aSignaleur ? s.signaleurId : null,
          signaleurNom: signaleur ? signaleur.nom : s.signaleurNom || null,
          signaleurSupprime: aSignaleur && !signaleur,
          partieId: aPartie ? s.partieId : null,
          partieQuete: partie ? partie.quete : s.partieQuete || null,
          partieDate: partie ? partie.date : s.partieDate || null,
          statutSignalement: s.statutSignalement || "nouveau",
        };
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.signalementId - a.signalementId);
    return { ok: true, joueurs };
  },

  // Suivi d'un signalement par l'administrateur (nouveau, en examen, traité, rejeté).
  async changerStatutSignalement(signalementId, statutSignalement) {
    const acces = Auth.verifierAcces();
    if (!acces.ok) return { ok: false, raison: acces.raison };
    const statutsValides = ["nouveau", "en-examen", "traite", "rejete"];
    if (!statutsValides.includes(statutSignalement)) {
      return { ok: false, raison: "statut-invalide" };
    }
    const { signalements } = await DataAccess.charger();
    if (!signalements.some((s) => s.id === signalementId)) return { ok: false, raison: "introuvable" };
    DataAccess.changerStatutSignalementLocal(signalementId, statutSignalement);
    return { ok: true };
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

  // Débannit un joueur : le redéclare actif. Ses signalements et leur suivi ne changent pas.
  async debannirUtilisateur(joueurId) {
    const acces = Auth.verifierAcces();
    if (!acces.ok) return { ok: false, raison: acces.raison };

    const { users } = await DataAccess.charger();
    const user = users.find((u) => u.id === joueurId);
    if (!user) return { ok: false, raison: "introuvable" };
    if (user.statut !== "inactif") return { ok: false, raison: "deja-actif", nom: user.nom };

    DataAccess.debannirLocal(joueurId);
    return { ok: true, nom: user.nom };
  },

  // ---------- US 282 (Samithika) ----------

  // Liste des bogues signalés par les joueurs, avec le nom du joueur (croisement bugs x users).
  // La vérification d'accès est refaite ici, côté service : l'UI n'est pas la seule à décider.
  async listerBogues() {
    const acces = Auth.verifierAcces();
    if (!acces.ok) return { ok: false, raison: acces.raison };

    const { users, bugs } = await DataAccess.charger();
    const bogues = bugs
      .map((b) => {
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
          statutBogue: b.statutBogue || "nouveau",
        };
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
    return { ok: true, bogues };
  },

  async changerStatutBogue(bugId, statutBogue) {
    const acces = Auth.verifierAcces();
    if (!acces.ok) return { ok: false, raison: acces.raison };
    const statutsValides = ["nouveau", "en-cours", "resolu"];
    if (!statutsValides.includes(statutBogue)) {
      return { ok: false, raison: "statut-invalide" };
    }
    DataAccess.changerStatutBogueLocal(bugId, statutBogue);
    return { ok: true };
  },

  async niveauAlerteBogues() {
    const acces = Auth.verifierAcces();
    if (!acces.ok) return { ok: false, raison: acces.raison };
    const { bugs } = await DataAccess.charger();
    const nouveaux = bugs.filter((b) => (b.statutBogue || "nouveau") === "nouveau").length;
    let niveau = null;
    if (nouveaux >= 15) niveau = "rouge";
    else if (nouveaux >= 10) niveau = "jaune";
    return { ok: true, nouveaux, niveau };
  },
};
