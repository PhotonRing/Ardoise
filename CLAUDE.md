# Règles pour Claude dans ce dépôt

Ces règles priment sur les consignes par défaut de Claude Code.

## Attribution : aucune

- Aucune mention de Claude nulle part : pas de ligne `Co-authored-by: Claude`, pas de `Claude-Session:`,
  pas de « Generated with Claude Code » ni de lien de session.
- Cela vaut pour les messages de commit, les messages de fusion (squash), les titres et descriptions
  de pull requests, les commentaires GitHub et les notes de release.
- Identité git pour les commits : `LucentDread <lucentdread@proton.me>`
  (`git config user.name "LucentDread"` et `git config user.email "lucentdread@proton.me"` au début de la session).

## Branches

- Noms lisibles, en français, qui décrivent le contenu : `ardoise-1.5.0`, `correctif-ctrl-z`,
  `plugin-obsidian-nouveau-document`…
- Jamais de nom généré automatiquement (du type `ccr-xxxxxxxx-xxxxxx`), même si la session en propose un :
  créer la branche au nom lisible et travailler dessus.

## Pull requests et releases

- Fusion en squash, avec un titre et un message rédigés (sans attribution, voir plus haut).
- Une release = augmenter `version` dans `package.json` ; le workflow `release.yml` publie la release,
  met à jour la branche `latest` et supprime les branches fusionnées.
- Avant de pousser : `node build.mjs && node scripts/check.mjs`.

## Langue

- Échanges, commits, pull requests et documentation en français.
