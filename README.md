# Archipel

Jeu de survie en blocs, jouable dans le navigateur, seul ou à plusieurs. On démarre sur une île flottante avec un planeur, on mine, on fabrique, on automatise, et on finit par construire une fusée pour changer de monde.

Tout est fait maison : textures dessinées par le code, sons synthétisés, aucun fichier d'image ou de son.

## Ce qu'on y trouve

- **Trois mondes** : le Ciel (îles flottantes, villages), la Braise (lave, boss) et l'Éther (faible pesanteur, oxygène à emporter).
- **Survie** : vie, faim, outils à paliers, armures, créatures, agriculture, élevage, troc avec les villageois.
- **Machines et énergie** : éoliennes, panneaux solaires, réacteur nucléaire, fours, fonderie d'alliages, raffinerie, imprimante 3D.
- **Logistique** : tuyaux à objets et à liquides réglables face par face à la clé à molette, filtres, tiroirs, terminal de stockage, téléporteurs.
- **Chimie** : séchoir, décomposeur, extracteur, synthétiseur, substances à effets passagers.
- **Multijoueur** : serveur autoritaire, chat, repères, mode créatif.

## Lancer le jeu

Il faut Node 22.18 ou plus récent.

```bash
npm install
npm run dev
```

Le jeu est alors sur http://localhost:5180. Le même serveur sert la partie solo et la partie en ligne, et s'annonce sur le réseau local.

Pour une version de production :

```bash
npm run build
npm start
```

## Commandes

Touches principales : `E` sac, `T` chat, `J` journal, `B` repères, `Maj` s'accroupir, `Ctrl` courir, `Échap` pause.

Dans le chat : `/gamemode creative`, `/gamemode survival`, `/give`, `/time`, `/tp`. En ligne, ces commandes sont réservées aux administrateurs.

## Sauvegarde

- **Solo** : dans le navigateur (`localStorage`), avec export et import depuis le menu.
- **En ligne** : dans `world.json`, qui contient le monde et les personnages. Son dossier se règle avec `DATA_DIR`.

## Déploiement

Le dépôt fournit un `Dockerfile` (un seul conteneur, port 3000) et un `compose.yaml` prévu pour Traefik.

| Variable | Rôle |
| --- | --- |
| `PORT` | Port d'écoute |
| `DATA_DIR` | Dossier de `world.json` |
| `ARCHIPEL_NAME` | Nom du serveur affiché aux joueurs |
| `AUTH_INTERNAL_URL` | Adresse du service de connexion ; sans elle, le serveur est ouvert à tous |
| `AUTH_PUBLIC_URL` | Adresse publique de la page de connexion |
| `AUTH_APP_SLUG` | Nom de l'application côté service de connexion |
| `PUBLIC_ORIGIN` | Adresse publique du jeu |

La connexion s'appuie sur [limperiam-auth-client](https://github.com/nathan71370/limperiam-auth-client). Elle est facultative : sans `AUTH_INTERNAL_URL`, chacun choisit son pseudo et tout le monde est administrateur, ce qui convient à une partie entre amis sur un réseau local.

## Organisation du code

- `src/` : le jeu côté navigateur (rendu Three.js, interface, sons).
- `src/sim.js`, `src/mobsim.js`, `src/fluids.js`, `src/world.js` : la simulation, partagée entre le navigateur en solo et le serveur en ligne.
- `server/index.js` : serveur HTTP et WebSocket.

## Licence

MIT, voir [LICENSE](LICENSE).
