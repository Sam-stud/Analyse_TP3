// joueurService.js : historique des parties d'un joueur et signalement d'un autre joueur.
// Les données viennent de DataAccess (mêmes tables que l'administration : users, parties, signalements).
// Toutes les validations sont refaites ici : l'interface n'est pas la seule à décider.

// Motifs prédéfinis : le joueur choisit dans cette liste, aucun texte libre n'est accepté.
const MOTIFS_SIGNALEMENT = [
  "Propos inappropriés dans le chat",
  "Harcèlement ou intimidation",
  "Triche ou exploitation d'un bogue",
  "Pseudonyme offensant",
  "Comportement antisportif (abandon, sabotage)",
  "Arnaque ou tentative de fraude",
];

function dateDuJour() {
  const maintenant = new Date();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${maintenant.getFullYear()}-${mois}-${jour}`;
}

const JoueurService = {
  motifs() {
    return MOTIFS_SIGNALEMENT.slice();
  },

  // Un joueur ne peut signaler qu'une fois le même joueur pour la même partie.
  _dejaSignale(signalements, signaleurId, joueurId, partieId) {
    return signalements.some(
      (s) => s.signaleurId === signaleurId && s.joueurId === joueurId && s.partieId === partieId
    );
  },

  // Parties auxquelles le joueur a participé (plus récentes d'abord), avec les autres participants.
  // Retourne { ok: true, parties } ou { ok: false, raison: "introuvable" | "suspendu" }.
  async historiqueParties(joueurId) {
    const { users, parties, signalements } = await DataAccess.charger();
    const moi = users.find((u) => u.id === joueurId);
    if (!moi) return { ok: false, raison: "introuvable" };
    if (moi.statut === "inactif") return { ok: false, raison: "suspendu" };

    const liste = parties
      .filter((p) => Array.isArray(p.joueurs) && p.joueurs.includes(joueurId))
      .map((p) => {
        const autresIds = [...new Set(p.joueurs)].filter((id) => id !== joueurId);
        return {
          id: p.id,
          quete: p.quete || "Partie sans nom",
          date: p.date || null,
          duree: Number.isFinite(p.duree) ? p.duree : null,
          resultat: p.resultat || null,
          coequipiers: autresIds.map((id) => {
            const u = users.find((x) => x.id === id);
            return {
              joueurId: id,
              nom: u ? u.nom : null, // null : compte supprimé ou introuvable
              dejaSignale: this._dejaSignale(signalements, joueurId, id, p.id),
            };
          }),
        };
      })
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || b.id - a.id);

    return { ok: true, parties: liste };
  },

  // Enregistre le signalement d'un joueur par un autre, pour une partie jouée ensemble.
  // Retourne { ok: true, nom } ou { ok: false, raison }.
  async signalerJoueur({ signaleurId, joueurId, partieId, motif }) {
    if (![signaleurId, joueurId, partieId].every(Number.isInteger)) {
      return { ok: false, raison: "donnees-incompletes" };
    }
    if (!MOTIFS_SIGNALEMENT.includes(motif)) return { ok: false, raison: "motif-invalide" };
    if (signaleurId === joueurId) return { ok: false, raison: "soi-meme" };

    const { users, parties, signalements } = await DataAccess.charger();
    const signaleur = users.find((u) => u.id === signaleurId);
    if (!signaleur) return { ok: false, raison: "introuvable" };
    if (signaleur.statut === "inactif") return { ok: false, raison: "suspendu" };

    const partie = parties.find((p) => p.id === partieId);
    if (!partie || !Array.isArray(partie.joueurs)) return { ok: false, raison: "partie-introuvable" };
    if (!partie.joueurs.includes(signaleurId) || !partie.joueurs.includes(joueurId)) {
      return { ok: false, raison: "hors-partie" };
    }

    const cible = users.find((u) => u.id === joueurId);
    if (!cible) return { ok: false, raison: "joueur-introuvable" };

    if (this._dejaSignale(signalements, signaleurId, joueurId, partieId)) {
      return { ok: false, raison: "deja-signale", nom: cible.nom };
    }

    DataAccess.ajouterSignalementLocal({
      joueurId,
      joueurNom: cible.nom, // gardés au cas où un compte serait supprimé plus tard
      signaleurId,
      signaleurNom: signaleur.nom,
      partieId,
      partieQuete: partie.quete || null,
      partieDate: partie.date || null,
      motif,
      date: dateDuJour(),
      statutSignalement: "nouveau",
    });
    return { ok: true, nom: cible.nom };
  },
};
