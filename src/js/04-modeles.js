/* ---------- Modèles ---------- */
var TEMPLATES = {
  tour: function () {
    return { title: 'Ardoise', palette: 'ambre', typo: 'display', width: 820, theme: 'auto', blocks: [
      mk('header', { eyebrow: 'Ardoise · éditeur autonome', title: 'Votre page, dans un seul fichier', lede: 'Ce fichier HTML contient la page, son éditeur et ses données. Modifiez, enregistrez : il se réécrit lui-même. Tout ce qui suit est modifiable, cliquez pour essayer.' }),
      mk('facts', { items: [{ k: 'Format', v: 'Un seul fichier .html', alert: false }, { k: 'Enregistrement', v: 'Automatique (Chrome, Edge)', alert: false }, { k: 'Firefox, Safari', v: 'Téléchargement à chaque sauvegarde', alert: false }, { k: 'Données', v: 'JSON lisible dans le fichier', alert: false }] }),
      mk('step', { title: 'Prendre en main' }),
      mk('check', { items: chk(['<b>Ctrl+E</b> bascule entre lecture et édition.', 'Survolez un bloc : sa barre en haut à droite le règle, le déplace, le duplique ou le supprime.', 'Dans un paragraphe vide, tapez <code>/</code> pour insérer un bloc. <b>Entrée</b> crée un nouveau paragraphe.', 'Sélectionnez du texte pour le passer en <b>gras</b>, en <code>code</code>, en lien ou en pastille <span class="pill p-ok">OK</span>.', '<b>Ctrl+S</b> enregistre. La première fois, choisissez l’emplacement du fichier ; ensuite chaque modification est enregistrée toute seule.', '<b>+ Page</b> ajoute une page au document : onglets en haut, ou sommaire à gauche quand la place le permet (réglable dans Style). Double-cliquez sur un nom de page pour le renommer.']) }),
      mk('step', { title: 'Les blocs de code' }),
      mk('p', { html: 'Trois styles : sombre avec bouton copier, boîte avec nom de fichier et numéros de ligne, ou commande courte. La coloration s’adapte au langage : détecté automatiquement, ou choisi dans la barre du bloc.' }),
      mk('code', { variant: 'dark', code: '#!/usr/bin/env bash\n# Exemple : les dix plus gros dossiers du répertoire courant\ndu -sh -- */ 2>/dev/null | sort -rh | head -n 10' }),
      mk('code', { variant: 'box', name: 'exemple.py', code: '#!/usr/bin/env python3\n"""Exemple de script."""\nimport sys\n\n\ndef main():\n    # Affiche chaque argument reçu\n    for arg in sys.argv[1:]:\n        print(arg)\n\n\nif __name__ == "__main__":\n    main()' }),
      mk('code', { variant: 'cmd', code: 'python3 exemple.py un deux trois' }),
      mk('step', { title: 'Cartes et tableaux' }),
      mk('cards', { min: 340, cards: [
        { title: 'A. Première variante', text: 'Une carte peut contenir un texte, une liste à cocher, ou les deux.', checks: chk(['Première action', 'Deuxième action']) },
        { title: 'B. Seconde variante', text: '', checks: chk(['<code>commande --option</code>', 'Redémarrer le service']) }] }),
      mk('table', { rows: [['Statut', 'Signification', 'Suite'], ['<span class="pill p-ok">OK</span>', 'Conforme', 'Rien à faire'], ['<span class="pill p-bad">KO</span>', 'Non conforme', 'Corriger'], ['<span class="pill p-warn">À vérifier</span>', 'Cas particulier', 'Analyser']] }),
      mk('note', { variant: 'warn', html: '<b>Bon à savoir.</b> Les cases cochées sont enregistrées dans le fichier : la page sert aussi de suivi.' }),
      mk('step', { title: 'Chronologies' }),
      mk('p', { html: 'Verticale ou horizontale avec titres inclinés : réglez l’orientation dans la barre du bloc. Un clic sur une pastille change sa couleur en édition.' }),
      mk('timeline', { orient: 'h', items: [
        { date: 'Janvier', title: 'Lancement', text: 'Réunion de démarrage avec l’équipe.', color: 'accent' },
        { date: 'Février', title: 'Cadrage', text: '', color: 'info' },
        { date: 'Mars – mai', title: 'Réalisation', text: 'Travail par itérations de deux semaines.', color: 'warn' },
        { date: 'Juin', title: 'Tests', text: '', color: 'info' },
        { date: 'Juillet', title: 'Mise en service', text: 'Bilan prévu à la rentrée.', color: 'ok' }] }),
      mk('step', { title: 'Cartes géographiques' }),
      mk('p', { html: 'Le fond simplifié est intégré au fichier et fonctionne hors ligne. Le bouton en haut à droite de la carte bascule sur un plan détaillé ou une vue satellite quand la machine est connectée. Cliquez sur la carte puis utilisez la molette pour zoomer. En édition, vous pouvez aussi dessiner des zones, des cercles et des itinéraires (avec leur distance).' }),
      mk('map', { height: 420, bg: 'vector', list: true, view: { lat: 46.6, lon: 2.6, z: 5.25 },
        markers: [{ lat: 48.8566, lon: 2.3522, label: 'Paris', color: 'accent' }, { lat: 45.764, lon: 4.8357, label: 'Lyon', color: 'info' }, { lat: 44.8378, lon: -0.5792, label: 'Bordeaux', color: 'ok' }, { lat: 48.5734, lon: 7.7521, label: 'Strasbourg', color: 'warn' }],
        zones: [{ label: 'Bretagne', color: 'info', shape: 'poly', pts: [[48.6372, -1.57591], [48.63042, -1.8176], [48.66878, -1.85129], [48.70112, -1.90825], [48.63945, -1.97348], [48.58225, -2.00026], [48.65035, -2.07786], [48.6508, -2.45067], [48.53996, -2.68685], [48.59856, -2.78848], [48.79369, -3.00982], [48.83771, -3.23261], [48.81111, -3.47371], [48.77446, -3.54306], [48.71106, -3.70716], [48.68979, -3.85754], [48.71291, -4.05138], [48.62082, -4.53317], [48.53995, -4.72273], [48.45499, -4.75875], [48.40425, -4.74673], [48.35819, -4.72061], [48.3696, -4.39171], [48.34864, -4.30035], [48.29979, -4.24198], [48.2902, -4.39991], [48.31121, -4.53037], [48.28886, -4.58189], [48.22989, -4.51052], [48.21848, -4.4261], [48.16858, -4.32997], [48.13098, -4.38011], [48.09982, -4.50649], [48.09169, -4.62507], [48.03969, -4.68094], [47.97028, -4.42893], [47.87821, -4.38022], [47.81829, -4.31083], [47.80865, -4.22711], [47.84873, -4.07058], [47.83955, -3.90028], [47.74863, -3.50614], [47.70706, -3.43869], [47.71862, -3.39559], [47.68999, -3.2569], [47.68907, -3.15802], [47.61835, -3.0605], [47.59983, -2.95956], [47.60816, -2.85931], [47.62894, -2.79206], [47.60024, -2.73095], [47.53952, -2.79958], [47.50946, -2.77006], [47.52796, -2.66706], [47.52885, -2.54964], [47.50792, -2.47577], [47.48185, -2.44684], [47.47066, -2.42968], [47.45688, -2.40276], [47.46152, -2.3719], [47.46323, -2.31878], [47.50957, -2.30081], [47.51247, -2.25967], [47.50031, -2.25796], [47.4951, -2.24338], [47.51073, -2.21681], [47.51305, -2.18338], [47.4951, -2.18595], [47.4916, -2.16368], [47.52113, -2.15254], [47.53154, -2.1054], [47.65513, -2.08863], [47.69472, -1.93429], [47.71946, -1.67333], [47.81582, -1.47122], [47.82816, -1.39038], [47.7862, -1.26544], [47.86789, -1.17213], [47.98577, -1.12579], [48.00545, -1.01923], [48.25562, -1.10374], [48.32896, -1.0376], [48.4997, -1.06332], [48.54107, -1.23603], [48.488, -1.32176], [48.45722, -1.38089], [48.46282, -1.4263], [48.4852, -1.44951], [48.49077, -1.49173], [48.58022, -1.52972]] }, { label: 'Autour de Lyon', color: 'warn', shape: 'circle', c: [45.764, 4.8357], r: 60000, lp: [45.05, 6.6] }],
        routes: [{ label: 'Tournée', color: 'accent', pts: [[48.8566, 2.3522], [45.764, 4.8357], [44.8378, -0.5792]], names: ['', '', ''], lp: [46.25, 1.0] }] }),
      mk('step', { nonum: true, title: 'Formats et limites' }),
      mk('list', { ordered: true, items: ['<b>Enregistrement direct</b> dans le fichier sur Chrome, Edge et autres navigateurs Chromium. Ailleurs, chaque enregistrement télécharge une copie à mettre à la place de l’ancienne.', '<b>Fichier → Exporter en page statique</b> produit une version lecture seule, sans éditeur.', '<b>Fichier → Copier le JSON</b> permet de faire rédiger la page par une IA, puis de la réimporter.', '<b>Les images</b> sont intégrées au fichier (redimensionnées à 1600 px) : préférez des captures légères.', '<b>Les cartes</b> : le fond simplifié (Natural Earth, avec environ 7 300 villes et 1 000 ports pour la recherche) marche hors ligne ; plan (Esri, ou CARTO avec une clé) et satellite demandent une connexion.'] }),
      mk('details', { title: 'Où sont stockées les données ?', html: 'Dans une balise <code>&lt;script id="ardoise-doc" type="application/json"&gt;</code> au début du fichier. Un brouillon de secours est aussi gardé dans le navigateur, et proposé à la réouverture s’il est plus récent.' }),
      mk('footer', { html: 'Ce fichier est autonome : il s’ouvre dans n’importe quel navigateur, sans installation ni connexion.' })
    ] };
  },
  runbook: function () {
    return { title: 'Procédure', palette: 'ambre', typo: 'display', width: 820, theme: 'auto', blocks: [
      mk('header', { eyebrow: 'Procédure · Périmètre', title: 'Titre de la procédure', lede: 'Objectif en une ou deux phrases : ce que fait la procédure, sur quel périmètre, et à quoi on reconnaît qu’elle a réussi.' }),
      mk('facts', { items: [{ k: 'Responsable', v: 'Équipe ou personne', alert: false }, { k: 'Durée estimée', v: 'À compléter', alert: false }, { k: 'Impact', v: 'Interruption, aucun…', alert: false }, { k: 'Dernière revue', v: 'Date', alert: false }] }),
      mk('step', { num: '1', title: 'Prérequis' }),
      mk('check', { items: chk(['Accès et droits nécessaires obtenus.', 'Fenêtre d’intervention validée, personnes concernées prévenues.', 'Sauvegarde ou point de retour disponible.']) }),
      mk('step', { title: 'Relever l’état initial' }),
      mk('p', { html: 'Lancer sur chaque système concerné : <code>bash controle.sh</code>. Le script ne fait que lire, il ne modifie rien.' }),
      mk('code', { variant: 'dark', tall: true, code: '#!/usr/bin/env bash\n# Contrôle de l’état initial (lecture seule)\n' }),
      mk('table', { rows: [['Résultat', 'Signification', 'Suite'], ['<span class="pill p-ok">OK</span>', '', ''], ['<span class="pill p-bad">KO</span>', '', ''], ['<span class="pill p-warn">À VÉRIFIER</span>', '', '']] }),
      mk('step', { title: 'Exécuter, par environnement' }),
      mk('cards', { min: 340, cards: [
        { title: 'A. Environnement ou variante', text: '', checks: chk(['<code>commande</code>', 'Action']) },
        { title: 'B. Environnement ou variante', text: '', checks: chk(['<code>commande</code>', 'Action']) },
        { title: 'C. Environnement ou variante', text: '', checks: chk(['Action', 'Action']) },
        { title: 'D. Environnement ou variante', text: '', checks: chk(['Action', 'Action']) }] }),
      mk('step', { title: 'Vérifier' }),
      mk('check', { items: chk(['Relancer le contrôle : chaque ligne doit être OK.', 'Contrôle complémentaire.']) }),
      mk('step', { title: 'Revenir en arrière si besoin' }),
      mk('p', { html: 'À déclencher si la vérification échoue ou si un effet inattendu apparaît.' }),
      mk('check', { items: chk(['Action de retour arrière.', 'Vérifier le retour à l’état initial.']) }),
      mk('step', { title: 'Clôturer' }),
      mk('check', { items: chk(['Informer les personnes concernées.', 'Mettre à jour la documentation ou le ticket.']) }),
      mk('step', { nonum: true, title: 'Points d’attention' }),
      mk('list', { ordered: true, items: ['<b>Point d’attention.</b> Explication.', '<b>Point d’attention.</b> Explication.'] }),
      mk('note', { variant: 'warn', html: 'Ce qu’il faut faire si l’un de ces cas se présente.' }),
      mk('table', { rows: [['Rôle', 'Nom', 'Contact'], ['Escalade', '', ''], ['Validation', '', '']] }),
      mk('footer', { html: 'Références : <a href="https://exemple.org">Document de référence</a>' })
    ] };
  },
  outil: function () {
    return { title: 'Fiche outil', palette: 'petrole', typo: 'sobre', width: 960, theme: 'auto', blocks: [
      mk('header', { eyebrow: 'Script Python · Domaine', title: 'nom_du_script.py', lede: 'Ce que fait le script, en une phrase.' }),
      mk('h2', { html: 'Utilisation' }),
      mk('code', { variant: 'cmd', code: 'python3 nom_du_script.py entree.json --option valeur\npython3 nom_du_script.py -h   # aide complète' }),
      mk('h2', { html: 'Procédure' }),
      mk('list', { ordered: true, items: ['Première étape.', 'Deuxième étape.', 'Troisième étape.'] }),
      mk('note', { variant: 'line', html: '<b>Point d’attention.</b> Contrainte importante à respecter.' }),
      mk('code', { variant: 'box', name: 'nom_du_script.py', code: '#!/usr/bin/env python3\n"""Description du script."""\n\nimport argparse\n\n\ndef main():\n    ap = argparse.ArgumentParser()\n    ap.parse_args()\n\n\nif __name__ == "__main__":\n    main()' })
    ] };
  },
  vide: function () {
    return { title: 'Sans titre', palette: 'ambre', typo: 'display', width: 820, theme: 'auto', blocks: [mk('header', {}), mk('p', {})] };
  }
};

