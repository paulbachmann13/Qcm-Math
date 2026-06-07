# QCM Révisions

Appli de révision multi-niveaux. **Le moteur ne bouge jamais** : pour ajouter du
contenu, tu ne touches qu'à des fichiers de données (`.json`).

## Structure

```
qcm-app/
├── index.html              ← la page (à ne pas modifier)
├── css/style.css           ← le style (à ne pas modifier)
├── js/app.js               ← le moteur (à ne pas modifier)
└── data/
    ├── manifest.json       ← le CATALOGUE (la seule chose à éditer)
    ├── premiere-spe/       ← un dossier par niveau
    │   ├── second-degre.json
    │   ├── suites.json
    │   └── ...
    └── tronc-commun/
        └── programme-complet.json
```

## Ajouter un QCM (2 étapes)

**1. Créer le fichier du QCM** dans le dossier du niveau, ex.
`data/premiere-spe/trigonometrie.json` :

```json
{
  "title": "Trigonométrie",
  "description": "Cercle trigonométrique, cosinus, sinus.",
  "questions": [
    {
      "q": "Que vaut cos(0) ?",
      "options": ["0", "1", "−1", "1/2"],
      "correct": 1,
      "e": "Sur le cercle trigonométrique, cos(0) = 1."
    }
  ]
}
```

- `q` : l'énoncé (le HTML est autorisé, ex. `<code>x²</code>` pour les formules).
- `options` : 2 à 6 réponses.
- `correct` : l'index de la bonne réponse **en commençant à 0** (donc 1 = la 2ᵉ option).
- `e` : l'explication montrée après la réponse (facultative).
- `theme` *(facultatif)* : si tu mets un thème sur chaque question, l'écran de
  résultat affiche un **bilan par thème** (utile pour un QCM « programme complet »
  qui mélange plusieurs notions).

**2. Déclarer le fichier** dans `data/manifest.json`, sous le bon niveau :

```json
{ "id": "spe-trigo", "file": "data/premiere-spe/trigonometrie.json" }
```

- `id` : un identifiant unique (il sert à enregistrer le meilleur score).
- `file` : le chemin du fichier que tu viens de créer.

C'est tout. Recharge la page, le QCM apparaît.

## Ajouter un niveau (brevet, terminale, …)

Dans `manifest.json`, ajoute un bloc dans `levels` :

```json
{
  "id": "brevet",
  "name": "Brevet · Maths",
  "icon": "π",
  "color": "#7a5cb0",
  "quizzes": [
    { "id": "brevet-calcul", "file": "data/brevet/calcul.json" }
  ]
}
```

Crée le dossier `data/brevet/` et tes fichiers `.json` dedans.

## Tester / publier

- **En local** : un double-clic sur `index.html` ne suffit pas (le navigateur
  bloque la lecture des fichiers). Lance un petit serveur depuis le dossier :
  ```
  python3 -m http.server
  ```
  puis ouvre `http://localhost:8000`.
- **En ligne** : pousse le dossier sur ton dépôt GitHub Pages. Tout marche
  directement (les scores sont gardés dans le navigateur de chaque appareil).
