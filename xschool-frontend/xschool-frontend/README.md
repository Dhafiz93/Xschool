# XSchool — Frontend

Frontend « réel » du prototype XSchool, avec séparation nette **HTML / CSS / JavaScript**.
Même rendu et mêmes fonctionnalités que le prototype d'origine (`index.html` monolithique),
mais découpé en fichiers maintenables.

## Arborescence

```
xschool-frontend/
├─ index.html                 # Markup seul (head + structure de l'app)
└─ assets/
   ├─ css/
   │  └─ styles.css            # Styles applicatifs (glass, animations, scrollbar…)
   └─ js/
      ├─ tailwind.config.js    # Config Tailwind (couleurs brand, polices, ombres)
      ├─ core.js               # Helpers, icônes, rôles, état global, UI helpers, modales mail
      ├─ api.js                # Client API (fetch + JWT Bearer) ; actif seulement si une base API est configurée
      ├─ data.js               # Structure académique, écoles, années, notes, config, DB mémoire, RBAC, logs, emploi du temps, compta + pont API
      ├─ views.js              # Tableaux de bord + écrans (élèves, notes, finance, emploi du temps, présences, bulletins, paramètres)
      ├─ admin.js              # Surveillant, comptable, alertes, enseignant, gestion/config CRUD, superadmin, import CSV/Excel
      └─ app.js                # Config écoles, routage (renderView/renderNav), tenant, login, thème/drawer, init
```

## Ordre de chargement (important)

Les modules JS sont des **scripts classiques** chargés dans l'ordre :
`core → api → data → views → admin → app`. Ils partagent une **portée globale commune**
(les déclarations `const` / `function` de haut niveau sont visibles d'un fichier à l'autre).
Ne change pas cet ordre : `api.js` doit rester juste après `core.js` (pour que `data.js`
puisse appeler `API`), et `app.js` doit rester le dernier (il déclenche l'initialisation).

## Lancer en local

Tailwind, Chart.js, SheetJS et le générateur de QR sont chargés depuis un CDN :
une connexion Internet est requise. Sers le dossier via un petit serveur statique
(les `fetch`/modules se comportent mieux qu'en `file://`) :

```bash
python3 -m http.server 8080    # puis http://127.0.0.1:8080
```

## Prototype vs production

Ce frontend reste un **prototype fonctionnel** : toutes les données (écoles, élèves,
notes, paiements…) vivent **en mémoire** dans `data.js` et disparaissent au rechargement.
En production, ces données doivent venir du **backend Flask** (dossier `xschool-backend/`) :
tables PostgreSQL + authentification (mots de passe bcrypt, superadmin `school_id` NULL).
L'étape suivante logique est de remplacer les accès à la « DB en mémoire » par des
appels à l'API REST du backend.

## Branchement sur l'API backend

Le pont est **non invasif** : par défaut aucune base API n'est configurée, donc
`API.enabled()` renvoie `false` et le prototype reste **100 % hors-ligne** (données
de démo). Dès qu'une base est renseignée, le frontend passe en mode « réel ».

**Configurer la base API** (3 façons, par priorité) :

1. Dans `index.html`, renseigne le `<meta>` :
   ```html
   <meta name="xschool-api" content="https://api.exemple.io">
   ```
2. Avant le chargement des scripts : `window.XSCHOOL_API_BASE = 'https://api.exemple.io'`.
3. En console : `localStorage.setItem('xschool-api-base', 'https://api.exemple.io')`.

Côté backend, autorise l'origine du frontend via la variable d'env `CORS_ORIGINS`.

**Ce qui est câblé quand l'API est active :**

- **Connexion réelle** : le formulaire de login envoie `email` + `mot de passe` à
  `POST /auth/login`, stocke le JWT (`localStorage['xschool-token']`) et déduit le rôle.
  Mapping des rôles backend → frontend : `superadmin→super`, `admin→admin`,
  `teacher→teacher`, `supervisor→surveillant`, `student→student`.
- **Reprise de session** : au chargement, si un token valide existe, l'app hydrate
  puis entre directement dans l'espace (plus besoin de repasser par le login).
- **Hydratation** : `GET /api/schools` (superadmin) remplit la liste des établissements
  et `GET /api/classes` remplit les classes de l'école courante, **avant** le 1er rendu.
- **Écritures write-through** (serveur d'abord, puis mémoire) :
  - créer une classe → `POST /api/classes`
  - supprimer une classe → `DELETE /api/classes/<id>`
- **Déconnexion** : efface le token (`API.logout()`).

Le client expose aussi `API.changePassword(old, new)` → `POST /auth/change-password`
(prêt à l'emploi ; aucune UI de changement de mot de passe authentifié n'existe encore)
ainsi que des verbes génériques `API.get/post/del(path)` pour les futurs endpoints.

### Endpoints backend encore à créer

Le backend n'expose aujourd'hui que **auth + schools + classes**. Pour que toutes les
vues passent en « réel », il reste à créer côté serveur (scope `school_id`) :
`students`, `teachers`, `subjects`, `programs` (programme/coefficients), `grades`
(notes), `payments` (scolarité/encaissements), `attendance` (présences/appel),
`discipline`, et `logs` (journaux superadmin). Une fois disponibles, on étend le
pont dans `data.js` (hydratation + write-through) sur le même modèle que les classes.
