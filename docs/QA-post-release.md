# Checklist QA — après une mise en production

À dérouler après chaque fusion de `develop` vers `main`.

Le déploiement passe par **deux canaux indépendants** : Vercel pour l'interface, Supabase pour la base de données et les fonctions serveur. L'un peut réussir et l'autre échouer sans que rien ne le signale — d'où les deux sections distinctes ci-dessous.

---

## 1. Interface (Vercel)

### 1.1 Le déploiement a bien eu lieu

Le nom du fichier JavaScript change à chaque déploiement. S'il est identique à celui d'avant la mise en production, **rien n'a été déployé** :

```bash
curl -s https://holos-perf.vercel.app/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js'
```

> ⚠️ Vercel bloque les déploiements dont l'auteur du commit n'est pas membre de l'équipe. Un déploiement absent vient souvent de là, pas d'une erreur de code. Vérifier l'onglet Deployments du tableau de bord Vercel.

### 1.2 L'application démarre

- [ ] `https://holos-perf.vercel.app` s'affiche (pas de page blanche)
- [ ] La console du navigateur ne montre pas d'erreur bloquante
- [ ] La connexion fonctionne

> Une page blanche vient presque toujours d'une exception levée avant le rendu React. Regarder la console en premier.

### 1.3 Parcours par rôle

À faire avec un compte de chaque type, l'accès étant filtré par rôle :

- [ ] **Athlète** — accueil, questionnaire du jour, envoi d'une réponse
- [ ] **Coach** — tableau de bord, lecture des réponses de ses athlètes
- [ ] **Admin** — gestion des utilisateurs, approbation d'un compte

---

## 2. Base de données et fonctions (Supabase)

### 2.1 Les migrations sont passées

```bash
supabase migration list
```

- [ ] Aucune migration présente en local et absente en production

> Avant la toute première synchronisation, marquer la migration de référence comme déjà appliquée, faute de quoi Supabase tentera de recréer le schéma existant :
> `supabase migration repair --status applied <version>`

### 2.2 La confidentialité des données est active

```sql
select relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
```

- [ ] La requête ne renvoie **aucune ligne**

> Une table sans RLS est lisible et modifiable par n'importe qui avec la clé publique, laquelle est visible dans le code du site. Ce contrôle est le plus important de la liste.

Vérification complémentaire, sans authentification :

```bash
curl -s "https://<projet>.supabase.co/rest/v1/user_preferences?select=*" -H "apikey: <clé anon>"
```

- [ ] La réponse est `[]`, et non des données

### 2.3 Les fonctions serveur sont déployées

- [ ] Les fonctions attendues apparaissent dans Edge Functions du tableau de bord
- [ ] Leurs secrets sont présents (Edge Functions → Secrets)

### 2.4 Les tâches planifiées tournent

```sql
select jobname, schedule, active from cron.job;
```

- [ ] Les tâches attendues sont présentes et `active = true`

---

## 3. Réglages d'authentification

Ces réglages vivent dans `supabase/config.toml`, mais **ne partent en production que si quelqu'un exécute `supabase config push`**. Ils peuvent donc diverger silencieusement entre le dépôt et la production.

Dans **Authentication → Sign In / Providers** et **Authentication → Policies** du tableau de bord :

- [ ] Longueur minimale du mot de passe conforme à `config.toml`
- [ ] Confirmation d'e-mail dans l'état attendu
- [ ] Inscription ouverte ou fermée, conformément à la décision en vigueur

> Si l'un de ces réglages a changé sans décision explicite, il est possible qu'une synchronisation de configuration soit passée par inadvertance.

---

## 4. Stockage

Dans **Storage** du tableau de bord :

- [ ] Les espaces destinés à rester privés le sont toujours
- [ ] Les restrictions de type de fichier sont conformes
- [ ] Un fichier existant reste téléchargeable depuis l'application

---

## 5. En cas de problème

| Symptôme | Piste la plus probable |
|---|---|
| Page blanche | Exception levée avant le rendu React — voir la console |
| Interface non mise à jour | Déploiement Vercel bloqué (auteur du commit hors équipe) |
| Données inaccessibles alors qu'elles existent | RLS active mais policy manquante pour ce rôle |
| Données accessibles sans être connecté | RLS non activée sur la table |
| Fonction serveur en échec | Secret absent côté Edge Functions |
| Notification jamais reçue | Clé VAPID absente au build, ou tâche planifiée inactive |

Une migration appliquée en production ne se défait pas automatiquement : en cas d'erreur, écrire une migration corrective plutôt que tenter un retour arrière.
