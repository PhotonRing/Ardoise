# Relais de synchronisation d'Ardoise

Le relais permet à plusieurs copies d'un même document Ardoise de rester à jour entre elles : en direct quand elles sont ouvertes en même temps, et au prochain démarrage pour une copie restée hors ligne.

C'est un **relais aveugle** : tout ce qui y passe est chiffré dans le navigateur (AES-256-GCM) avec une clé rangée dans le fichier, que le relais ne reçoit jamais. Il ne voit ni le contenu, ni les noms des personnes, ni la structure du document : seulement un identifiant de salon (une empreinte de la clé), la taille et l'heure des envois, et les adresses IP.

## Installer

Il suffit de Node.js 18 ou plus. Le relais tient dans un seul fichier, sans dépendance : `relais.mjs` dans ce dossier, ou `ardoise-relais.mjs` joint à chaque [release](../../../releases/latest).

```bash
node relais.mjs
```

Il écoute sur le port 8787 et range ses données dans `./donnees`. Réglages par variables d'environnement :

| Variable | Par défaut | Rôle |
|---|---|---|
| `PORT` | `8787` | Port d'écoute |
| `HOTE` | `0.0.0.0` | Adresse d'écoute (`127.0.0.1` derrière un proxy sur la même machine) |
| `DONNEES` | `./donnees` | Dossier des données (un sous-dossier par document) |
| `MAX_TRAME` | `20` | Taille maximale d'un envoi, en Mo (un document avec beaucoup d'images peut demander plus) |
| `MAX_SALON` | `200` | Place maximale par document, en Mo |

### Avec Docker

```bash
docker build -t ardoise-relais relais/
```

```bash
docker run -d --name ardoise-relais -p 8787:8787 -v ardoise-relais:/donnees --restart unless-stopped ardoise-relais
```

### Adresse en wss:// (HTTPS)

Un document ouvert depuis un site en `https://` ne peut joindre qu'un relais en `wss://`. Placez le relais derrière un proxy HTTPS. Avec [Caddy](https://caddyserver.com), qui obtient le certificat tout seul :

```
relais.exemple.fr {
	reverse_proxy 127.0.0.1:8787
}
```

Avec nginx, transmettez les en-têtes `Upgrade` et `Connection` (WebSocket) vers `127.0.0.1:8787`.

Un fichier ouvert directement depuis le disque (`file://`) peut aussi joindre un relais en `ws://`, par exemple sur le réseau local.

## Utiliser

Dans Ardoise : *Fichier → Synchronisation…*, saisissez l'adresse du relais (`wss://relais.exemple.fr`), puis *Activer*. Enregistrez le fichier, puis partagez-en une copie : **toute copie du fichier se synchronise**. *Nouvelle clé* coupe les copies existantes ; seules celles faites ensuite se synchronisent.

Le relais garde un journal chiffré des modifications. Régulièrement, une copie à jour y dépose un instantané chiffré de tout le document, et le relais oublie les modifications qu'il contient : le journal ne grossit pas indéfiniment.

## Sauvegarde et nettoyage

Les données d'un document sont dans `DONNEES/<identifiant>/` : `cle` (empreinte de l'empreinte de la clé), `journal.jsonl` et `instantane.json`. Supprimer ce dossier (relais arrêté) efface tout ce que le relais sait de ce document. Ses copies le lui renverront à leur prochaine connexion.

## Protocole

WebSocket, messages JSON (`d` est toujours chiffré par les copies) :

| Sens | Message |
|---|---|
| copie → relais | `{t:'rejoindre', salon, auth, depuis}` : `salon` et `auth` sont deux empreintes différentes de la clé ; la première copie fixe `auth`, les suivantes doivent présenter la même |
| relais → copie | `{t:'bienvenue', v, seq, snap?, trames:[{s,d}], presents:[{de,d}]}` |
| copie → relais | `{t:'envoi', id, d}` → `{t:'recu', id, s}` à l'expéditeur, `{t:'trame', s, d}` aux autres |
| copie → relais | `{t:'instantane', jusqua, d}` : remplace les trames jusqu'à `jusqua` |
| copie → relais | `{t:'presence', d}` → `{t:'presence', de, d}` aux autres (non conservé), `{t:'depart', de}` à la déconnexion |
