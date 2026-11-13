/* ---------- Modèles ---------- */
var TEMPLATES = {
  tour: function () {
    // visite guidée : écrite au format TEMPLATES_V (05-document.js), sur plusieurs pages
    var P = function (t) { return '<span class="pill">' + t + '</span>'; }, TAB = '<span class="tab">\t</span>';
    var IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAABaCAIAAAAJsExNAAADb0lEQVR42u3SxZIUURCF4fM4vAEb1jwET3K2uA3O4O5uY4y74O7uDoPLBhYdMdHRTVvVre7KrBPxbftWZ+aPPxMUcQO/xyniBn6NUcQN/ByliBv4MUIRN/B9mCJu4NsQRdzA10GKuIEvAxRxA5/7KeIGJvso4gY+9VLEDXzsoYgb+NBNETfwvosibuBdJ0XcwNvTFHEDbzoo4gZet1PEDbxqo4gbeNlKETfwooWSHX8nJ8qzPiCen6JkQcWU89kdE89OUtyrqeYco5Pi6QmKYxFSzmduXjw5TvEqZs05tkbG42MUr4IEbWtkPDpKcSlIzTmGpsbDIxR/AtacY2VwPDhM8Sd40FYGx/1DFGeC15xjYnbcO0hxJqGgTcyOuwcoziQUtInZcWc/xZmEgjYxO27voziTUNAmZsetvRRnEgraxOy4uYfiTEJBm5gdN3ZTnEkoaBOz4/ouijMJBW1idlzbSXEmoaBNzI6rOyjOJBS0idlxZTvFn+A1Wxkcl7dR/AketJXBcWkrxaWANRuaGhe3ULwKUrOtkXFhM8WrIEHbGhnnN1Eci1mzuXlxbiPFvQgpG50UZzdQsqCmmu2OiTPrKfXBWTPii/kfKqZsfcmYWEdJSJCCy9OSC2C8mRJQHSIuRcsfbybG1lLia2DHxbJ8CIyuoUSWqo6LZfAiGFlNqVXKOy6WndNgeBWlSuY6LpCFG2FoJaUi6ykXcHwpDK6glOEs5Xwu74WB5ZRijjsu5ulw6F9GyZeplPP5OB/6mih9TdntuID1O2Jqkt6lzCZF/F9Gr4mCMXqWMDtUbUXmbopSk3QvplfKNAIrx0X5MboW0RN1GVP6T4wqJ+lcyAaaOX1arfJ/rhAjLDC1MZSHmvZyegHrJsINItxGEcdZYD17qBKiLatjPhMS8AzZLLshC0yuh1oh5vra5zGURC+RhazTsMCAPUSDUNtsm8to6nYGr2Wnc4GRe4gJSay4dQ6r0cBL+MjaygKr7CGOqW+hDntvmc0CKbmE3axNL7C4hwhKPQ5dwlbWWmB50CWsZK0FpiVoQ5dIYdnaXlqCtnuJlGStBaYlaDeXaNRVtMBUBO3yDPU8jBYYf4HQGRp+GC0w4AIR+enMniHUYbS3OAss9RS0TfFEQYuCFlHQIgpaREGLghZR0CIKWkRBi1TpH6CTzu9yeVEmAAAAAElFTkSuQmCC';
    var cours = uid();   // cartes reliées par « Dépend de… » (page Suivi de projet)
    return { title: 'Ardoise', palette: 'ambre', typo: 'display', width: 820, theme: 'auto',
      tags: { ok: { c: 0 }, ko: { c: 1 }, 'à vérifier': { c: 2 }, prod: { c: 4 }, recette: { c: 6 } },
      pages: [{ id: 'visite', title: '', blocks: [
      mk('header', { eyebrow: 'Ardoise · éditeur autonome', title: 'Votre page, dans un seul fichier', lede: 'Ce fichier HTML contient la page, son éditeur et ses données. Modifiez, enregistrez : il se réécrit lui-même. Tout ce qui suit est modifiable, cliquez pour essayer.' }),
      mk('facts', { items: [{ k: 'Format', v: 'Un seul fichier .html', alert: false }, { k: 'Enregistrement', v: 'Automatique (Chrome, Edge)', alert: false }, { k: 'Firefox, Safari', v: 'Téléchargement à chaque sauvegarde', alert: false }, { k: 'Données', v: 'JSON lisible dans le fichier', alert: false }] }),
      mk('summary', { title: 'Les autres pages de la visite', src: 'pages' }),
      mk('step', { title: 'Prendre en main' }),
      mk('check', { items: chk(['<b>Ctrl+E</b> bascule entre lecture et édition.', 'Survolez un bloc : sa barre en haut à droite le règle, le déplace, le duplique ou le supprime ; sur un bloc plus haut que l’écran, elle reste visible en haut pendant le défilement.',
        '<b>↶</b> et <b>↷</b> (<b>Ctrl+Z</b>, <b>Ctrl+Y</b>) annulent et rétablissent ; leur bulle dit ce que l’étape défait ou refait : la page, le bloc et ses premiers mots, puis le changement (« texte modifié », « bloc ajouté »…).',
        'La barre de l’en-tête, tout en haut, masque ou affiche le surtitre et le chapeau ; le texte masqué est conservé.',
        'Sur un téléphone, la barre ne garde que le nom du document et l’état de l’enregistrement ; le menu <b>☰</b> ouvre toutes les actions en plein écran.',
        'Dans un paragraphe vide, tapez <code>/</code> pour insérer un bloc.',
        'Sélectionnez du texte pour le passer en <b>gras</b>, en <code>code</code>, en lien (vers une adresse, une page ou une section) ou en pastille ' + P('OK') + ' : la couleur d’une pastille suit son nom, et un clic dedans permet de la changer.',
        '<b>Ctrl+S</b> enregistre. La première fois, choisissez l’emplacement du fichier ; ensuite chaque modification est enregistrée toute seule.',
        'Le sommaire à gauche range les pages en arborescence : <b>+</b> crée une sous-page, glissez une page pour la déplacer ou la ranger dans une autre. Sur petit écran, les pages passent en onglets.']) }),
      mk('step', { id: 'ecrire', title: 'Écrire' }),
      mk('p', { html: '<b>Entrée</b> passe à la ligne ; une seconde fois sur une ligne vide, elle crée un nouveau bloc. <b>Tab</b> met la ligne en retrait :<br>' + TAB + 'comme celle-ci,<br>' + TAB + TAB + 'ou celle-ci, sur deux niveaux, dont la suite reste alignée sur son retrait quand elle est trop longue pour tenir sur une seule ligne.' }),
      mk('h3', { html: 'Une sous-section' }),
      mk('p', { html: 'Elle apparaît dans le sommaire, contrairement au sous-titre ci-dessous.' }),
      mk('subtitle', { html: 'Un sous-titre' }),
      mk('list', { items: [{ html: 'Les listes ont des sous-niveaux :' }, { html: '<b>Tab</b> pour descendre d’un niveau,', lv: 1 }, { html: 'autant de fois que nécessaire,', lv: 2 }, { html: '<b>Maj+Tab</b> ou <b>Retour arrière</b> pour remonter.', lv: 1 }] }),
      mk('p', { html: 'Tapez <code>#</code> suivi de quelques lettres : Ardoise propose les pastilles du document, comme ' + P('Prod') + ' ou ' + P('Recette') + ', ou « Créer » pour un nouveau nom. <b>Style → Pastilles du document…</b> liste leurs usages, change leur couleur et retire celles qui ne servent plus ; copiée hors d’Ardoise, une pastille devient le texte <code>#nom</code>.' }),
      mk('divider', {}),
      mk('image', { src: IMG, alt: 'Collines au soleil couchant', caption: 'Une image se choisit dans un fichier, se colle, se dépose ou se télécharge depuis une adresse : elle est toujours intégrée au document.' }),
      mk('check', { order: 'doneLast', items: [{ html: 'Cochez cette case : elle passe à la fin de la liste.', done: false }, { html: 'La liste est réglée sur « cochées à la fin » (barre du bloc) ; l’ordre saisi est conservé.', done: false }, { html: 'Cette case est déjà cochée.', done: true }] }),
      mk('step', { title: 'Les blocs de code' }),
      mk('p', { html: 'Trois styles : sombre avec bouton copier, boîte avec nom de fichier et numéros de ligne, ou commande courte. La coloration s’adapte au langage : détecté automatiquement, ou choisi dans la barre du bloc.' }),
      mk('code', { variant: 'dark', code: '#!/usr/bin/env bash\n# Exemple : les dix plus gros dossiers du répertoire courant\ndu -sh -- */ 2>/dev/null | sort -rh | head -n 10' }),
      mk('code', { variant: 'box', name: 'exemple.py', code: '#!/usr/bin/env python3\n"""Exemple de script."""\nimport sys\n\n\ndef main():\n    # Affiche chaque argument reçu\n    for arg in sys.argv[1:]:\n        print(arg)\n\n\nif __name__ == "__main__":\n    main()' }),
      mk('code', { variant: 'cmd', code: 'python3 exemple.py un deux trois' }),
      mk('step', { title: 'Cartes et tableaux' }),
      mk('cards', { min: 340, cards: [
        { title: 'A. Première variante', text: 'Une carte peut contenir un texte, une liste à cocher, ou les deux.', checks: chk(['Première action', 'Deuxième action']) },
        { title: 'B. Seconde variante', text: '', checks: chk(['<code>commande --option</code>', 'Redémarrer le service']) }] }),
      mk('table', { rows: [['Statut', 'Signification', 'Suite'], ['<span class="pill">OK</span>', 'Conforme', 'Rien à faire'], ['<span class="pill">KO</span>', 'Non conforme', 'Corriger'], ['<span class="pill">À vérifier</span>', 'Cas particulier', 'Analyser']] }),
      mk('p', { html: 'Dans un tableau, les flèches passent d’une cellule à l’autre et <b>Entrée</b> ou <b>Tab</b> à la fin ajoutent une ligne ; les poignées au survol déplacent lignes et colonnes. Un clic droit (ou un appui long) dans une cellule ouvre son menu : insérer ou supprimer une ligne ou une colonne. La loupe au-dessus du tableau filtre ses lignes, sans tenir compte des accents ni des majuscules. Une plage copiée dans Excel, LibreOffice Calc ou Google Sheets se colle dans les cellules et agrandit le tableau au besoin. <b>Maj</b>+clic, un glisser ou <b>Maj</b>+flèches sélectionnent une plage de cellules, qui se copie vers un tableur ; <b>Suppr</b> la vide.' }),
      mk('note', { variant: 'warn', html: '<b>Bon à savoir.</b> Les cases cochées sont enregistrées dans le fichier : la page sert aussi de suivi.' }),
      mk('step', { title: 'Chronologies' }),
      mk('p', { html: 'Verticale ou horizontale avec titres inclinés : réglez l’orientation dans la barre du bloc. En édition, un clic sur le point d’un événement change sa couleur.' }),
      mk('timeline', { orient: 'h', items: [
        { date: 'Janvier', title: 'Lancement', text: 'Réunion de démarrage avec l’équipe.', color: 'accent' },
        { date: 'Février', title: 'Cadrage', text: '', color: 'info' },
        { date: 'Mars – mai', title: 'Réalisation', text: 'Travail par itérations de deux semaines.', color: 'warn' },
        { date: 'Juin', title: 'Tests', text: '', color: 'info' },
        { date: 'Juillet', title: 'Mise en service', text: 'Bilan prévu à la rentrée.', color: 'ok' }] }),
      mk('step', { title: 'Cartes géographiques' }),
      mk('p', { html: 'Le fond simplifié est intégré au fichier et fonctionne hors ligne. Le bouton en haut à droite de la carte bascule sur un plan détaillé ou une vue satellite quand la machine est connectée. Cliquez sur la carte puis utilisez la molette pour zoomer. En édition, vous pouvez aussi dessiner des zones, des cercles et des itinéraires (avec leur distance) ; dans « Éléments de la carte », <b>Coller un itinéraire…</b> le crée à partir d’une liste de points « latitude, longitude » copiée ailleurs, un libellé après une tabulation.' }),
      mk('map', { height: 420, bg: 'vector', list: true, view: { lat: 46.6, lon: 2.6, z: 5.25 },
        markers: [{ lat: 48.8566, lon: 2.3522, label: 'Paris', color: 'accent' }, { lat: 45.764, lon: 4.8357, label: 'Lyon', color: 'info' }, { lat: 44.8378, lon: -0.5792, label: 'Bordeaux', color: 'ok' }, { lat: 48.5734, lon: 7.7521, label: 'Strasbourg', color: 'warn' }],
        zones: [{ label: 'Bretagne', color: 'info', shape: 'poly', pts: [[48.6372, -1.57591], [48.63042, -1.8176], [48.66878, -1.85129], [48.70112, -1.90825], [48.63945, -1.97348], [48.58225, -2.00026], [48.65035, -2.07786], [48.6508, -2.45067], [48.53996, -2.68685], [48.59856, -2.78848], [48.79369, -3.00982], [48.83771, -3.23261], [48.81111, -3.47371], [48.77446, -3.54306], [48.71106, -3.70716], [48.68979, -3.85754], [48.71291, -4.05138], [48.62082, -4.53317], [48.53995, -4.72273], [48.45499, -4.75875], [48.40425, -4.74673], [48.35819, -4.72061], [48.3696, -4.39171], [48.34864, -4.30035], [48.29979, -4.24198], [48.2902, -4.39991], [48.31121, -4.53037], [48.28886, -4.58189], [48.22989, -4.51052], [48.21848, -4.4261], [48.16858, -4.32997], [48.13098, -4.38011], [48.09982, -4.50649], [48.09169, -4.62507], [48.03969, -4.68094], [47.97028, -4.42893], [47.87821, -4.38022], [47.81829, -4.31083], [47.80865, -4.22711], [47.84873, -4.07058], [47.83955, -3.90028], [47.74863, -3.50614], [47.70706, -3.43869], [47.71862, -3.39559], [47.68999, -3.2569], [47.68907, -3.15802], [47.61835, -3.0605], [47.59983, -2.95956], [47.60816, -2.85931], [47.62894, -2.79206], [47.60024, -2.73095], [47.53952, -2.79958], [47.50946, -2.77006], [47.52796, -2.66706], [47.52885, -2.54964], [47.50792, -2.47577], [47.48185, -2.44684], [47.47066, -2.42968], [47.45688, -2.40276], [47.46152, -2.3719], [47.46323, -2.31878], [47.50957, -2.30081], [47.51247, -2.25967], [47.50031, -2.25796], [47.4951, -2.24338], [47.51073, -2.21681], [47.51305, -2.18338], [47.4951, -2.18595], [47.4916, -2.16368], [47.52113, -2.15254], [47.53154, -2.1054], [47.65513, -2.08863], [47.69472, -1.93429], [47.71946, -1.67333], [47.81582, -1.47122], [47.82816, -1.39038], [47.7862, -1.26544], [47.86789, -1.17213], [47.98577, -1.12579], [48.00545, -1.01923], [48.25562, -1.10374], [48.32896, -1.0376], [48.4997, -1.06332], [48.54107, -1.23603], [48.488, -1.32176], [48.45722, -1.38089], [48.46282, -1.4263], [48.4852, -1.44951], [48.49077, -1.49173], [48.58022, -1.52972]] }, { label: 'Autour de Lyon', color: 'warn', shape: 'circle', c: [45.764, 4.8357], r: 60000, lp: [45.05, 6.6] }],
        routes: [{ label: 'Tournée', color: 'accent', pts: [[48.8566, 2.3522], [45.764, 4.8357], [44.8378, -0.5792]], names: ['', '', ''], lp: [46.25, 1.0] }] }),
      mk('p', { html: 'Le bouton <b>▦ Pays</b> colore les pays selon une valeur (carte choroplèthe) : échelle linéaire, logarithmique ou par classes, palettes prêtes à l’emploi ou personnalisées, légende, et valeurs affichées sur les pays. Les données se saisissent pays par pays, se collent depuis un tableur ou se lisent dans un bloc tableau du document (la carte suit alors le tableau) ; en édition, un clic sur un pays retrouve sa ligne, et ses étiquettes se déplacent à la souris. Les territoires détachés (Guyane, Réunion, Canaries, Alaska…) peuvent répéter l’étiquette de leur pays, et les territoires rattachés (Nouvelle-Calédonie, Groenland…) prendre sa couleur. Survolez un pays pour lire sa valeur.' }),
      mk('map', { height: 420, bg: 'vector', list: false, cities: false, view: { lat: 49.5, lon: 13, z: 3.3 }, markers: [], zones: [], routes: [],
        choro: { title: 'Population en 2023 (arrondie)', unit: 'M hab.', scale: 'quant', classes: 5, pal: 'bleus', labels: 'value',
          data: { FRA: 68.2, DEU: 84.5, ESP: 48.4, ITA: 58.9, GBR: 68.3, POL: 36.7, ROU: 19.1, NLD: 17.9, BEL: 11.8, PRT: 10.5, SWE: 10.5, CZE: 10.9, GRC: 10.4, HUN: 9.6, AUT: 9.1, CHE: 8.8, BGR: 6.4, DNK: 5.9, FIN: 5.6, NOR: 5.5, IRL: 5.3, HRV: 3.9, SVK: 5.4, LTU: 2.9, SVN: 2.1, LVA: 1.9, EST: 1.4, LUX: 0.66, ISL: 0.39, UKR: 37, BLR: 9.2, SRB: 6.6, TUR: 85.3 } } }),
      mk('step', { title: 'Modèle diamant' }),
      mk('p', { html: 'Pour décrire un événement d’intrusion : adversaire, capacité, infrastructure et victime, chacun en texte enrichi avec ses pastilles. Sur un écran étroit, les sommets s’empilent. Un bloc requête sur la source « Modèles diamant » les rassemble en tableau.' }),
      mk('diamond', { title: 'Campagne X', adversaire: 'Groupe ' + P('APT fictif'), capacite: 'Hameçonnage ciblé, puis vol d’identifiants', infrastructure: 'Domaine <code>exemple-portail.test</code> ' + P('à vérifier'), victime: '' }),
      mk('step', { nonum: true, title: 'Formats et limites' }),
      mk('list', { ordered: true, items: [{ html: '<b>Enregistrement direct</b> dans le fichier sur Chrome, Edge et autres navigateurs Chromium. Ailleurs, chaque enregistrement télécharge une copie à mettre à la place de l’ancienne.' }, { html: '<b>Fichier → Exporter en page statique</b> produit une version lecture seule, sans éditeur.' }, { html: '<b>Fichier → Exporter la page en Word (.docx)</b> produit un document Word (titres en styles Word, tableaux, pastilles surlignées, cartes et chronologies en images) ; le menu <b>⋯</b> d’un bloc exporte ce bloc seul.' }, { html: '<b>Copier pour Office</b>, dans le menu <b>⋯</b> d’un bloc, le copie pour le coller dans Word, LibreOffice Writer ou Google Docs avec sa mise en forme.' }, { html: '<b>Fichier → Copier le JSON</b> permet de faire rédiger la page par une IA, puis de la réimporter.' }, { html: '<b>Fichier → Importer du Markdown…</b> remplace la page courante par une note (Obsidian…) : titres, listes, tâches, tableaux, code, propriétés en fiche de faits, <code>#tag</code> en pastilles.' }, { html: '<b>Fichier → Protéger par mot de passe…</b> réserve l’édition, et peut aussi chiffrer le contenu : le mot de passe est alors demandé à l’ouverture.' }, { html: '<b>Fichier → Synchronisation</b> garde plusieurs copies du fichier à jour entre elles, en direct ou après un passage hors ligne, par un relais qui ne voit que des données chiffrées (installable chez soi).' }, { html: '<b>Les images</b> sont intégrées au fichier (redimensionnées à 1600 px) : préférez des captures légères.' }, { html: '<b>Fichier → Mettre à jour Ardoise</b> remplace l’éditeur embarqué par la dernière version, en gardant le contenu.' }, { html: '<b>Les cartes</b> : le fond simplifié (Natural Earth, avec environ 7 300 villes et 1 000 ports pour la recherche) marche hors ligne ; plan (Esri, ou CARTO avec une clé) et satellite demandent une connexion.' }] }),
      mk('details', { title: 'Où sont stockées les données ?', html: 'Dans une balise <code>&lt;script id="ardoise-doc" type="application/json"&gt;</code> au début du fichier. Un brouillon de secours est aussi gardé dans le navigateur, et proposé à la réouverture s’il est plus récent.' }),
      mk('footer', { html: 'Ce fichier est autonome : il s’ouvre dans n’importe quel navigateur, sans installation ni connexion.' })
      ] },
      { id: 'suivi', title: '', lv: 1, blocks: [
        mk('header', { eyebrow: 'Visite guidée · sous-page', title: 'Suivi de projet', lede: 'Un kanban, un tableau d’incidents, et des blocs requête qui se tiennent à jour tout seuls à partir du contenu du document.' }),
        mk('h2', { html: 'Kanban' }),
        mk('p', { html: 'Glissez une carte d’une colonne à l’autre, ou utilisez <b>⇄</b> : en lecture aussi. L’échéance, la personne responsable et la priorité (P1 à P3, avec un cadre de couleur) sont facultatives ; une échéance dépassée s’affiche en rouge. En édition, l’échéance se tape en jj/mm/aaaa ou se choisit dans le calendrier 📅, et <b>Dépend de…</b> désigne les cartes à finir avant : « Attend » et « Bloque » les affichent. <b>⇤</b> réduit une colonne en bande verticale, comme « Fait » ci-dessous ; un clic sur la bande la rouvre.' }),
        mk('kanban', { cols: [
          { id: uid(), title: 'À faire', cards: [{ id: uid(), title: 'Migrer la base ' + P('Prod'), html: 'Fenêtre de maintenance à caler', due: '2030-03-15', who: 'Alice', prio: 'p1', dep: [cours] }, { id: uid(), title: 'Rédiger le guide utilisateur', html: '', due: '', who: '', prio: 'p3' }] },
          { id: uid(), title: 'En cours', cards: [{ id: uid(), title: 'Supervision ' + P('Prod'), html: '', due: '2024-01-15', who: 'Bob', prio: 'p1' }, { id: cours, title: 'Tests de charge ' + P('Recette'), html: '', due: '2030-02-01', who: '', prio: 'p2' }] },
          { id: uid(), title: 'Fait', collapsed: true, cards: [{ id: uid(), title: 'Sauvegardes ' + P('Prod'), html: '', due: '2024-06-01', who: 'Chloé' }] }] }),
        mk('h2', { html: 'Tableau de bord' }),
        mk('p', { html: 'Ces blocs requête comptent et listent les cartes ci-dessus : changez une carte de colonne, ils suivent. En édition, une ligne de puces au-dessus du résultat résume ce qu’ils cherchent, où, avec quels filtres, et comment l’afficher : un clic sur une puce ouvre sa fenêtre pour la régler, <b>+ Filtre</b> en ajoute un.' }),
        mk('query', { src: 'kanban', scope: 'here', view: 'count', cards: [
          { label: 'Cartes terminées', tags: [], match: 'any', state: 'all', col: 'fait', total: 'all' },
          { label: 'Cartes Prod terminées', tags: ['prod'], match: 'any', state: 'all', col: 'fait', total: 'filter', ttags: ['prod'], tmatch: 'any' }] }),
        mk('p', { html: 'La puce des colonnes choisit celles à montrer : toutes, « Toutes sauf… » ou « Seulement… », dans l’ordre voulu (glissez les lignes de sa fenêtre). Ici, toutes sauf la priorité :' }),
        mk('query', { title: 'Échéances', src: 'kanban', scope: 'here', view: 'table', sortBy: 'c:échéance', sortDir: 'asc', limit: 5, colonnes: { mode: 'sauf', noms: ['priorité', '#attend'], ordre: [] }, cards: [{ label: '', tags: [], match: 'any', state: 'all', total: 'none' }] }),
        mk('p', { html: 'Une requête sur les cartes peut aussi filtrer par responsable, par priorité et par échéance (dépassée, aujourd’hui, dans les prochains jours, semaines ou mois…). Celle-ci montre les cartes P1 ou P2 en retard ou à rendre dans les 3 mois :' }),
        mk('query', { title: 'Urgences', src: 'kanban', scope: 'here', view: 'list', kbPrio: 'p12', kbDue: 'soon', kbDueN: 3, kbDueU: 'm', sortBy: 'c:échéance', sortDir: 'asc', cards: [{ label: '', tags: [], match: 'any', state: 'all', total: 'none' }] }),
        mk('p', { html: 'Le filtre <b>Bloquées</b> garde les cartes qui attendent une carte pas encore finie, et la colonne <b>Attend</b> (masquée par défaut, cochée ici) dit laquelle :' }),
        mk('query', { title: 'Cartes bloquées', src: 'kanban', scope: 'here', view: 'table', bloquees: true, colonnes: { mode: 'toutes', noms: [], ordre: [] }, cards: [{ label: '', tags: [], match: 'any', state: 'all', total: 'none' }] }),
        mk('h2', { html: 'Incidents' }),
        mk('p', { html: 'Une requête sur les lignes de tableaux peut les regrouper ou les croiser. Le tableau ci-dessous sert d’exemple : ajoutez une ligne, les deux vues suivent.' }),
        mk('table', { rows: [['Service', 'Gravité', 'Équipe', 'Durée (h)'], ['Messagerie', 'Majeure', 'Système', '4'], ['Messagerie', 'Mineure', 'Système', '1'], ['Intranet', 'Mineure', 'Web', '2'], ['Intranet', 'Critique', 'Web', '6'], ['VPN', 'Majeure', 'Réseau', '3'], ['VPN', 'Mineure', 'Réseau', '0,5'], ['Messagerie', 'Critique', 'Système', '8'], ['Intranet', 'Mineure', 'Web', '1']] }),
        mk('p', { html: 'La vue <b>regroupée</b> ⊞ réunit les lignes qui partagent une valeur (ici le service) et liste les autres valeurs de chaque groupe ; le nombre de lignes ouvre leurs sources.' }),
        mk('query', { title: 'Par service', src: 'table', scope: 'here', view: 'regroupee', regX: 'service', regY: ['équipe'], cards: [{ label: '', tags: [], match: 'any', state: 'all', total: 'none' }] }),
        mk('p', { html: 'La <b>carte de chaleur</b> ▩ croise deux colonnes : chaque case est teintée selon le nombre de lignes, ou selon la somme d’une colonne de nombres (ici la durée). En lecture, survolez une case pour voir les lignes qu’elle réunit.' }),
        mk('query', { title: 'Durée des incidents', src: 'table', scope: 'here', view: 'chaleur', chX: 'gravité', chY: 'service', chN: 'durée (h)', cards: [{ label: '', tags: [], match: 'any', state: 'all', total: 'none' }] }),
        mk('h2', { html: 'Contrôles' }),
        mk('check', { items: [{ html: 'Sauvegardes ' + P('Prod'), done: true }, { html: 'Restauration testée', lv: 1, done: true }, { html: 'Supervision ' + P('Prod'), done: false }, { html: 'Alertes reçues', lv: 1, done: false }, { html: 'Recette validée ' + P('Recette'), done: false }] }),
        mk('query', { src: 'check', scope: 'here', view: 'list', tags: ['prod'], cards: [{ label: '', tags: [], match: 'any', state: 'done', total: 'all' }] })
      ] },
      { id: 'organiser', title: '', lv: 1, blocks: [
        mk('header', { eyebrow: 'Visite guidée · sous-page', title: 'Organiser ses pages', lede: 'Arborescence, sections pliables, liens et lecture.' }),
        mk('h2', { html: 'Arborescence' }),
        mk('p', { html: 'Les pages se rangent sur autant de niveaux que nécessaire : celle-ci est une sous-page de la visite, et elle a elle-même une sous-page. Glissez une page dans le sommaire, avant, après ou dans une autre ; ses sous-pages la suivent. <b>Précédent</b> et <b>Suivant</b> du navigateur (ou le geste retour d’Android) ramènent à la page ou à la section vue avant, à la même position. Le bouton <b>⇥</b> de la barre d’un bloc, « Déplacer vers la page… », le range dans une autre page (un titre de section emmène sa section), et les liens vers lui le suivent.' }),
        mk('h2', { html: 'Sections pliables', folded: true }),
        mk('p', { html: 'Cette section est pliée par défaut : en édition, l’état plié est enregistré. En lecture, chacun plie et déplie librement (chevron au survol du titre) sans modifier le document.' }),
        mk('h3', { html: 'Une sous-section' }),
        mk('p', { html: 'Les sous-sections se plient aussi.' }),
        mk('h2', { html: 'Liens' }),
        mk('p', { html: 'Le bouton <b>Lien</b> de la barre de mise en forme pointe vers une adresse, le bouton <b>Page</b> vers une page ou une section du document : par exemple <a href="#pg-suivi">Suivi de projet</a>, ou la section <a href="#pg-visite/ecrire">Écrire</a> de la visite. Le curseur dans un lien affiche une bulle pour l’ouvrir, le modifier ou le retirer.' }),
        mk('h2', { html: 'Lire et imprimer' }),
        mk('p', { html: 'En lecture, la barre en bas à droite imprime ou enregistre en PDF (les blocs qui doivent rester entiers ne sont pas coupés entre deux pages), exporte une page statique, plie ou déplie toutes les sections, et choisit un thème clair ou sombre pour soi seulement.' }),
        mk('group', { title: 'Un groupe repliable', blocks: [
          mk('p', { html: 'Un groupe plie quelques blocs sans ouvrir de section : il n’entre pas dans le sommaire. Insérez-le avec <b>+</b> ou <code>/</code> ; dans un de ses blocs, <b>+</b>, <code>/</code> et <b>Entrée</b> ajoutent au groupe. Le menu <b>⋯</b> d’un bloc propose « Mettre dans un groupe » ou « Sortir du groupe », et celui du groupe « Dégrouper ».' }),
          mk('check', { items: chk(['En édition, le chevron plie le groupe et cet état est enregistré.', 'En lecture, chacun l’ouvre et le ferme pour soi ; à l’impression, il est ouvert.']) })] })
      ] },
      { id: 'niveau2', title: '', lv: 2, blocks: [
        mk('header', { eyebrow: 'Visite guidée · deuxième niveau', title: 'Une sous-page de sous-page', lede: '' }),
        mk('p', { html: 'Dans le sommaire, le chevron devant une page déplie ou replie ses sous-pages.' })
      ] }] };
  },
  runbook: function () {
    return { title: 'Procédure', palette: 'ambre', typo: 'display', width: 820, theme: 'auto', tags: { ok: { c: 0 }, ko: { c: 1 }, 'à vérifier': { c: 2 } }, blocks: [
      mk('header', { eyebrow: 'Procédure · Périmètre', title: 'Titre de la procédure', lede: 'Objectif en une ou deux phrases : ce que fait la procédure, sur quel périmètre, et à quoi on reconnaît qu’elle a réussi.' }),
      mk('facts', { items: [{ k: 'Responsable', v: 'Équipe ou personne', alert: false }, { k: 'Durée estimée', v: 'À compléter', alert: false }, { k: 'Impact', v: 'Interruption, aucun…', alert: false }, { k: 'Dernière revue', v: 'Date', alert: false }] }),
      mk('step', { num: '1', title: 'Prérequis' }),
      mk('check', { items: chk(['Accès et droits nécessaires obtenus.', 'Fenêtre d’intervention validée, personnes concernées prévenues.', 'Sauvegarde ou point de retour disponible.']) }),
      mk('step', { title: 'Relever l’état initial' }),
      mk('p', { html: 'Lancer sur chaque système concerné : <code>bash controle.sh</code>. Le script ne fait que lire, il ne modifie rien.' }),
      mk('code', { variant: 'dark', tall: true, code: '#!/usr/bin/env bash\n# Contrôle de l’état initial (lecture seule)\n' }),
      mk('table', { rows: [['Résultat', 'Signification', 'Suite'], ['<span class="pill">OK</span>', '', ''], ['<span class="pill">KO</span>', '', ''], ['<span class="pill">À VÉRIFIER</span>', '', '']] }),
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

