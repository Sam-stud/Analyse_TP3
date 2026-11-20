// pageJoueur.js : interface client d'un joueur.
// Sert à démontrer qu'un joueur banni par un administrateur ne peut plus se connecter (ni continuer à jouer).
// Le statut est relu dans DataAccess (JSON + bannissements locaux) à chaque connexion et à chaque action.
// La session joueur est stockée à part (qb_joueur) : elle n'écrase jamais le jeton administrateur (qb_jeton).

const CLE_SESSION_JOUEUR = "qb_joueur";
const MESSAGE_SUSPENDU = "Compte suspendu : vous ne pouvez plus accéder au jeu.";

function sessionJoueur() {
  try {
    return JSON.parse(sessionStorage.getItem(CLE_SESSION_JOUEUR));
  } catch (e) {
    return null;
  }
}

function afficherVue(joueur) {
  document.getElementById("vue-connexion").hidden = !!joueur;
  document.getElementById("vue-jeu").hidden = !joueur;
  if (joueur) {
    document.getElementById("bienvenue").textContent = `Bienvenue, ${joueur.nom} ! Votre compte est actif.`;
  }
}

function fermerSession() {
  sessionStorage.removeItem(CLE_SESSION_JOUEUR);
  afficherVue(null);
}

// Relit le compte dans les données : { ok: true, user } ou { ok: false, raison: "introuvable" | "suspendu" }.
async function verifierCompte({ nom, id }) {
  const { users } = await DataAccess.charger();
  const user =
    id !== undefined
      ? users.find((u) => u.id === id)
      : users.find((u) => u.nom.toLowerCase() === nom.toLowerCase());
  if (!user) return { ok: false, raison: "introuvable" };
  if (user.statut === "inactif") return { ok: false, raison: "suspendu", user };
  return { ok: true, user };
}

async function connecterJoueur(evt) {
  evt.preventDefault();
  const saisie = document.getElementById("nom-joueur").value.trim();
  if (!saisie) {
    UI.message("erreur", "Veuillez entrer un nom de joueur.");
    return;
  }
  try {
    const r = await verifierCompte({ nom: saisie });
    if (!r.ok) {
      // Aucune session créée : un joueur banni reste sur l'écran de connexion.
      UI.message("erreur", r.raison === "suspendu" ? MESSAGE_SUSPENDU : "Utilisateur introuvable.");
      return;
    }
    sessionStorage.setItem(CLE_SESSION_JOUEUR, JSON.stringify({ userId: r.user.id, nom: r.user.nom }));
    UI.message("succes", `Connexion réussie. Bon jeu, ${r.user.nom} !`);
    afficherVue(r.user);
  } catch (e) {
    console.error(e);
    UI.message("erreur", "Données introuvables : impossible de vérifier le compte.");
  }
}

// Revérifie le statut d'un joueur déjà connecté (au chargement et avant chaque action).
// Retourne true si le joueur peut continuer; sinon ferme la session et affiche pourquoi.
async function revalider() {
  const session = sessionJoueur();
  if (!session) {
    afficherVue(null);
    return false;
  }
  try {
    const r = await verifierCompte({ id: session.userId });
    if (r.ok) return true;
    fermerSession();
    UI.message("erreur", r.raison === "suspendu" ? MESSAGE_SUSPENDU : "Utilisateur introuvable.");
    return false;
  } catch (e) {
    console.error(e);
    fermerSession();
    UI.message("erreur", "Données introuvables : impossible de vérifier le compte.");
    return false;
  }
}

async function partirEnQuete() {
  if (await revalider()) {
    UI.message("info", "Votre quête commence ! (simulation)");
  }
}

// Suppression de son propre compte (simulation) : après confirmation, le compte n'existe plus.
async function supprimerMonCompte() {
  if (!(await revalider())) return;
  const session = sessionJoueur();
  if (!window.confirm("Voulez-vous vraiment supprimer votre compte ? Cette action est définitive.")) return;
  try {
    DataAccess.supprimerCompteLocal(session.nom); // global : touche tous les jeux de données
    fermerSession();
    UI.message("succes", "Votre compte a été supprimé. Vous ne pouvez plus vous connecter avec ce nom.");
  } catch (e) {
    console.error(e);
    UI.message("erreur", "La suppression du compte n'a pas pu être effectuée.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Barre d'outils du socle (jeu de données + réinitialisation), sans les boutons liés à l'administrateur.
  UI.barreOutils({ connecte: false, onChange: init });
  const titre = document.querySelector("#barre .titre");
  if (titre) {
    titre.textContent = "Quest Bank : Espace joueur";
    titre.href = "joueur.html";
  }

  document.getElementById("form-joueur").addEventListener("submit", connecterJoueur);
  document.getElementById("btn-quete").addEventListener("click", partirEnQuete);
  document.getElementById("btn-supprimer-compte").addEventListener("click", supprimerMonCompte);
  document.getElementById("btn-deconnexion-joueur").addEventListener("click", () => {
    fermerSession();
    UI.message("info", "Vous êtes déconnecté.");
  });

  await init();
});

// Au chargement, ou après un changement de jeu de données / une réinitialisation :
// un joueur déjà connecté est revérifié (s'il a été banni entre-temps, sa session est fermée).
async function init() {
  const session = sessionJoueur();
  if (!session) {
    afficherVue(null);
    return;
  }
  if (await revalider()) afficherVue(session);
}
