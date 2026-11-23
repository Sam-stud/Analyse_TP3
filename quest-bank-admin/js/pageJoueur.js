// pageJoueur.js : interface client d'un joueur.
// Sert à démontrer qu'un joueur banni par un administrateur ne peut plus se connecter (ni continuer à jouer).
// Le statut est relu dans DataAccess (JSON + bannissements locaux) à chaque connexion et à chaque action.
// La session joueur est stockée à part (qb_joueur) : elle n'écrase jamais le jeton administrateur (qb_jeton).

const CLE_SESSION_JOUEUR = "qb_joueur";
const MESSAGE_SUSPENDU = "Compte suspendu : vous ne pouvez plus accéder au jeu.";
const MOTIFS_INJECTION = [
  /<script\b/i,
  /javascript\s*:/i,
  /\bon[a-z]+\s*=/i,
  /\b(?:eval|alert|prompt|confirm|fetch|setTimeout|setInterval|Function)\s*\(/i,
  /\bdocument\s*\.\s*(?:cookie|write|location)\b/i,
  /\bwindow\s*\.\s*location\b/i,
  /innerHTML/i,
  /\bunion\s+(?:all\s+)?select\b/i,
  /\b(?:drop|truncate|alter)\s+table\b/i,
  /\bdelete\s+from\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\s+\w+\s+set\b/i,
  /\b(?:or|and)\s+['"]?\w+['"]?\s*(?:==|=|<>|!=|>=|<=)\s*['"]?\w+['"]?\b/i,
  /\b(?:or|and)\b[^\n]{0,60}(?:--|#|\/\*)/i,
  /(?:--|#|\/\*)[^\n]{0,60}\b(?:or|and|select|union)\b/i,
  /['"]\s*(?:--|#)/,
  /;\s*(?:--|#)/,
  /\/\*/,
  /\b(?:xp_cmdshell|waitfor\s+delay|sleep\s*\(|benchmark\s*\()/i,
  /%3c\s*script/i,
  /&#x?3c\s*script/i,
];

function detecterInjection(texte) {
  return MOTIFS_INJECTION.some((motif) => motif.test(String(texte)));
}

function dateDuJour() {
  const maintenant = new Date();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${maintenant.getFullYear()}-${mois}-${jour}`;
}

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

async function signalerBogue(evt) {
  evt.preventDefault();
  if (!(await revalider())) return;

  const champTitre = document.getElementById("titre-bogue");
  const titreSaisi = champTitre.value.trim();
  const champ = document.getElementById("description-bogue");
  const description = champ.value.trim();
  if (!description) {
    UI.message("erreur", "Veuillez décrire le bogue rencontré.");
    return;
  }

  const session = sessionJoueur();
  const attaque = detecterInjection(`${titreSaisi}\n${description}`);
  const date = dateDuJour();
  try {
    DataAccess.signalerBogueLocal({
      titre: titreSaisi || (attaque
        ? "Tentative de cyberattaque (injection JavaScript/SQL)"
        : "Bogue signalé par le joueur"),
      description,
      joueurId: session.userId,
      joueurNom: session.nom,
      date,
      estAttaque: attaque,
      typeAttaque: attaque ? "injection JavaScript/SQL" : null,
    });
    if (attaque) {
      DataAccess.signalerCyberattaqueLocal({
        joueurId: session.userId,
        joueurNom: session.nom,
        motif: "Tentative de cyberattaque (injection JavaScript/SQL) via le formulaire de signalement de bogue",
        date,
        estCyberattaque: true,
      });
    }
    champTitre.value = "";
    champ.value = "";
    UI.message(
      "succes",
      attaque
        ? "Signalement enregistré. La tentative d'injection a été signalée automatiquement à l'administration."
        : "Votre signalement a bien été envoyé à l'administrateur."
    );
  } catch (e) {
    console.error(e);
    UI.message("erreur", "Le signalement n'a pas pu être envoyé.");
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
  document.getElementById("form-bogue").addEventListener("submit", signalerBogue);
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
