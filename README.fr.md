# AstraMC 3 — Terres sauvages

Un jeu d’exploration, de construction et de survie en 3D, jouable dans le navigateur. Cette version enrichit le monde de blocs avec une nature plus organique, la météo, la pêche, les campements et des besoins liés à l’environnement.

## Lancer le jeu

Il faut **Node.js 18 ou plus récent**, un navigateur récent et **WebGL 2** avec l’accélération graphique activée.

Depuis le dossier du jeu :

```bash
cd ~/Documents/AstraMC
npm start
```

Ouvrez ensuite **http://localhost:4173** et cliquez sur **Jouer**. Gardez le terminal ouvert pendant la partie ; `Ctrl+C` arrête le serveur.

Les fichiers jouables sont déjà dans `dist/` et Three.js est fourni localement. **Aucune compilation ni installation npm n’est nécessaire pour jouer.** Ouvrez le jeu par son adresse HTTP, plutôt qu’en double-cliquant sur `index.html`.

Pour utiliser un autre port :

```bash
PORT=4174 npm start
```

Les sauvegardes du navigateur étant liées à l’adresse et au port, gardez la même adresse pour retrouver votre partie.

## Explorer les terres sauvages

Le terrain se génère à mesure que vous avancez, sur une hauteur de **64 blocs**. Les mondes modernes contiennent des plaines, des forêts, des déserts, de la taïga enneigée, des grottes et des minerais.

La version 3 ajoute notamment :

- Des troncs arrondis, des feuillages animés par le vent, des herbes, des fleurs et des rochers.
- Une eau ondulante avec des reflets de ciel simulés, une lumière changeante, des ombres et de la brume.
- Un cycle jour/nuit, des nuages, des étoiles, de la pluie, de la neige et des orages avec éclairs.
- Des ambiances de vent, de pluie, d’eau et de feu, des pas et des sons d’action. Le son démarre après votre première interaction.
- Des cochons, des moutons, des cerfs qui s’éloignent à votre approche, des oiseaux et des lucioles. Des rôdeurs apparaissent la nuit et attaquent en survie.
- Des baies, des champignons et des réserves à récupérer dans les lieux découverts. Visez-les et faites un clic droit.
- Des ruines et des campements oubliés, une carte, une boussole et un journal d’exploration.

Les herbes, fleurs et constructions d’ambiance servent de décor : on peut passer au travers. Les baies, champignons et réserves indiqués à l’écran restent récupérables. Les blocs et les coffres que vous construisez font partie du monde interactif.

## Premiers pas en survie

Vous commencez avec trois pommes. Récoltez du bois, ouvrez l’inventaire avec **E**, puis fabriquez des planches, des bâtons et un établi. Posez l’établi pour accéder aux outils. Une pioche en bois permet d’obtenir des pavés et du charbon ; améliorez votre équipement pour extraire le fer puis le diamant.

Le livre de fabrication contient **31 recettes**. Il indique les quantités nécessaires et la station requise. La fabrication consomme les ressources. Les pioches, haches et épées existent en bois, pierre, fer et diamant ; les outils s’usent et certains minerais exigent une pioche suffisamment résistante.

Votre personnage doit surveiller :

- **Vie et faim** : mangez pour retrouver de la faim ; être bien nourri permet de récupérer progressivement de la vie. Les bandages soignent les blessures et ne sont consommés que lorsque vous êtes blessé.
- **Endurance** : courir et nager la dépensent. Ralentissez ou reposez-vous pour récupérer ; après épuisement, laissez la jauge remonter avant de sprinter.
- **Hydratation** : la marche, la course et la chaleur augmentent les besoins en eau. La déshydratation devient dangereuse progressivement.
- **Chaleur et humidité** : la pluie et l’immersion mouillent les vêtements. Le froid et l’humidité vous refroidissent ; un abri et un feu aident à sécher et à vous réchauffer.
- **Air** : revenez à la surface avant de manquer d’oxygène. Les chutes importantes causent également des dégâts.

À la mort, votre inventaire tombe au sol et vous perdez votre expérience. Revenez le récupérer après votre réapparition. Les objets abandonnés disparaissent après dix minutes de jeu actif. Un lit permet de définir un point de retour et de passer la nuit lorsqu’aucun ennemi n’est trop proche.

## Boire, pêcher et cuisiner

**Boire directement :** approchez de l’eau, visez sa surface et appuyez sur **R**. Avec les mains vides, le clic droit fonctionne également.

**Gourde :** fabriquez-la avec deux lingots de fer près d’un établi. Équipez-la et faites un clic droit en visant l’eau pour obtenir quatre gorgées. Visez ailleurs puis faites un clic droit pour boire. Une gorgée rend jusqu’à 35 points d’hydratation ; elle n’est pas consommée si la jauge est pleine. Vous pouvez porter une seule gourde dans votre sac.

**Pêche :** fabriquez une canne avec trois bâtons et une laine blanche près d’un établi. Équipez-la, visez la surface de l’eau et faites un clic droit. Attendez **4 à 8 secondes de jeu**, puis ferrez au clic droit lorsque le flotteur plonge et que « Ça mord ! » apparaît. La fenêtre pour ferrer dure environ **2,4 secondes**. Remonter trop tôt ou trop tard fait manquer la prise. Changer d’objet, s’éloigner ou ouvrir un menu annule la pêche. La canne s’use lorsque vous remontez la ligne.

**Feu de camp :** trois bûches, trois bâtons et un charbon suffisent pour le fabriquer à la main. Posez-le sur un support solide. Il réchauffe les alentours et permet de griller la viande ou le poisson sans ajouter de combustible à chaque portion.

**Fourneau :** utilisez huit pavés et un établi. Les recettes du fourneau consomment du charbon et permettent aussi de fondre le fer, le sable ou les pavés.

Faites un clic droit sur le feu ou le fourneau, choisissez une recette et lancez la cuisson. Elle dure cinq secondes de jeu actif, y compris lorsque l’inventaire reste ouvert. Le résultat apparaît au sol près du foyer. Si le foyer est retiré pendant la cuisson, les ingrédients sont rendus au sol.

## Coffres et orientation

Fabriquez un **coffre** avec huit planches près d’un établi. Posez-le puis ouvrez-le au clic droit :

- Cliquez sur un objet de votre sac pour en déposer **un** ; cliquez dans le coffre pour en retirer un.
- Maintenez **Maj** en cliquant pour transférer **toute la pile**.
- L’usure des outils est conservée. Un sac ou un coffre peut contenir un seul outil de chaque type et une seule gourde.
- Casser le coffre fait tomber son contenu au sol.

Appuyez sur **M** pour ouvrir la carte et le journal. La carte révèle les zones explorées et conserve les lieux découverts. Cliquez sur la carte ou sur un lieu du journal pour définir un repère. Le bouton de suppression retire ce repère.

En **créatif**, la carte propose aussi de rejoindre le repère directement. En survie, utilisez la carte et la distance affichée pour vous y rendre à pied. Le journal conserve la distance parcourue, les prises de pêche et les feux de camp construits.

## Commandes

| Action | Commande |
| --- | --- |
| Avancer, gauche, reculer, droite | **ZQSD** sur AZERTY, **WASD** sur QWERTY, ou flèches |
| Regarder | Souris ; glisser si le navigateur refuse la capture du pointeur |
| Sauter / nager vers la surface | **Espace** |
| Courir | **Maj** en se déplaçant |
| Miner / attaquer | Maintenir le **clic gauche**, ou **X** |
| Poser / utiliser / récolter / manger | **Clic droit**, ou **C** |
| Boire à la rivière | **R**, en visant l’eau |
| Inventaire et fabrication | **E** |
| Carte et journal | **M** |
| Choisir un emplacement | **1–9** ou molette |
| Copier le bloc visé dans la barre | Clic molette ; en survie, le bloc doit être dans le sac |
| Jeter un objet | **Q**, en survie |
| Masquer l’interface pour une photo | **P** ; rappuyez pour la rétablir |
| Pause / réglages | **Échap** |
| Vol en créatif | **F** ou double appui sur **Espace** |
| Monter / descendre en vol | **Espace** / **Maj** |

Maj + clic droit sur une station permet de poser un bloc à côté au lieu d’ouvrir la station. Si la capture du pointeur est indisponible, glissez pour regarder et cliquez sur un bloc pour lancer son minage.

Des commandes tactiles s’affichent sur les appareils compatibles : déplacement, saut, minage, interaction et inventaire. Sur mobile, les menus et les boutons à l’écran remplacent les raccourcis du clavier.

## Créatif et réglages

Choisissez **Survie** ou **Créatif** à l’accueil, à la création d’un monde ou dans les réglages. En créatif, les objets sont disponibles sans ressources, le vol est autorisé et les besoins de survie ne causent pas de dégâts.

Le menu permet de régler la qualité graphique, la distance d’affichage, la sensibilité, le champ de vision, les sons et leur volume. Vous pouvez laisser la météo évoluer naturellement ou choisir le ciel dégagé, la pluie, l’orage ou la neige. Un curseur permet également de choisir l’heure.

La qualité **Élevée** utilise davantage de ressources graphiques pour les ombres et les détails. Si le jeu manque de fluidité, choisissez **Économe** et réduisez la distance d’affichage. Le mode photo masque l’interface ; utilisez ensuite la fonction de capture d’écran de votre appareil.

## Sauvegarde et anciennes parties

La partie est enregistrée automatiquement dans le stockage local du navigateur, ainsi qu’en quittant les écrans de jeu. Elle contient notamment les blocs modifiés, la position, l’inventaire, l’usure des outils, les coffres, les besoins de survie, la météo et l’exploration.

Les sauvegardes des **versions 1 et 2** sont lues sans remise à zéro du terrain ni des constructions. Les données d’expédition absentes reçoivent des valeurs de départ sûres. Le jeu garde le générateur d’origine de chaque monde : une ancienne partie classique reste classique, tandis qu’un nouveau monde utilise les biomes et grottes modernes. Les améliorations visuelles s’appliquent au monde chargé.

Il y a **une partie active par adresse de jeu dans chaque navigateur**. Créer un nouveau monde remplace cette partie. Effacer les données du site, changer de navigateur ou changer de port peut empêcher de retrouver la sauvegarde à l’adresse habituelle. Il n’y a pas de synchronisation en ligne.

## Code et vérification

Les sources du jeu sont les modules JavaScript de `dist/`. Le serveur local est `server.mjs`. Il n’y a pas d’étape de compilation.

Pour exécuter les vérifications automatisées :

```bash
npm test
```

Les tests portent sur la génération du terrain, les collisions, la récolte, la fabrication, la survie, la météo, la pêche, le stockage et la compatibilité des sauvegardes. Le rendu graphique et les interactions se vérifient également dans le navigateur.

## Périmètre

AstraMC est un jeu **stylisé et procédural**, avec des effets destinés à rendre l’exploration plus vivante. Il ne vise pas le photoréalisme : l’eau n’a pas une simulation de fluides avancée, et les animaux ne constituent pas un écosystème autonome complet. Les systèmes de survie et de fabrication restent simplifiés. Le jeu est solo et n’inclut pas l’ensemble du contenu de Minecraft, notamment le multijoueur, la redstone ou les autres dimensions.
