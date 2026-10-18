# Repères pour travailler sur ce projet

Complément au `README.md`, qui couvre l'installation. Ce document rassemble ce qui ne se devine pas en lisant le code : le fonctionnement du déploiement, les conventions, et les pièges déjà rencontrés.

---

## Le déploiement passe par deux canaux indépendants

C'est le point le plus important, et la source de la plupart des confusions.

| Canal | Ce qu'il déploie | Déclencheur |
|---|---|---|
| **Vercel** | l'interface React | automatique, au push sur `main` |
| **Supabase** | migrations de base de données | automatique, au push sur `main` |
| **Supabase — Edge Functions** | les fonctions serveur | ⚠️ **manuel, jamais automatique** |

Production : https://holos-perf.vercel.app

### ⚠️ Les Edge Functions ne se déploient pas toutes seules

L'intégration GitHub de Supabase applique les migrations, **mais pas les fonctions**. Toute modification de `supabase/functions/` exige :

```bash
git checkout main && git pull
supabase functions deploy <nom-de-la-fonction>
```

Sans ça, la fonction continue de tourner dans sa version précédente — **sans aucune alerte**. Une PR peut être relue, mergée et « déployée » alors que le serveur exécute toujours l'ancien code.

### Vérifier qu'un déploiement a bien eu lieu

```bash
# Front : le nom du fichier change à chaque déploiement
curl -s https://holos-perf.vercel.app/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js'

# Base : rien ne doit manquer côté distant
supabase migration list

# Fonctions : vérifier le numéro de version
supabase functions list
```

---

## Processus de release

```
PR de fonctionnalité  →  develop
PR « [Release] … »    →  main      ← déclenche les déploiements
```

`main` est protégée : pas de push direct, PR obligatoire, et **fusion par commit de merge uniquement** (ni squash ni rebase, pour préserver l'historique des deux branches).

Après une release, dérouler les vérifications ci-dessus. Une release peut réussir côté front et échouer côté base, ou l'inverse, sans que rien ne le signale.

### Format des descriptions de PR

Des non-développeurs lisent ces PR. La description suit un format « ticket » :

1. **Type** (✨ Fonctionnalité · 🐛 Bug · 🔧 Maintenance · 📚 Documentation · 🔒 Sécurité) et **source de la demande**
2. **🧾 En bref** — une phrase compréhensible par tous
3. **✅ Ce que fait cette PR** — en langage clair, sans jargon
4. **📌 Impact** — par public : utilisateurs, coachs et administrateurs, production et données
5. **📸 Capture** — si l'interface change
6. **🔧 Détails techniques** — dans un bloc `<details>` repliable

Le titre porte un préfixe entre crochets et reste lisible par un non-technicien. Les PR de release sont **toujours** préfixées `[Release]`, quel que soit leur contenu.

---

## Base de données

### La confidentialité (RLS) doit rester active partout

Les 16 tables publiques ont la RLS activée. Sans elle, la clé anon — publique par conception, embarquée dans le bundle JavaScript — donne un accès complet en lecture et en écriture.

```sql
-- Doit ne renvoyer aucune ligne
select relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
```

Une policy écrite mais non activée est **inerte** : PostgreSQL ne l'évalue pas tant que `ENABLE ROW LEVEL SECURITY` n'a pas été posé sur la table. Toute nouvelle table doit donc activer la RLS **et** définir ses policies.

### Toute modification de schéma passe par une migration

```bash
supabase migration new <nom>
```

Ne jamais modifier le schéma depuis l'éditeur SQL du tableau de bord : le changement s'applique en production sans laisser de trace, la base locale diverge, et les migrations suivantes supposent un état qui n'existe pas.

### ⚠️ Ne jamais lancer `supabase config push`

`supabase/config.toml` décrit l'environnement **local**. L'appliquer écraserait `site_url` et les URLs de redirection par des adresses locales, rendant la connexion impossible en production.

Pour comparer sans rien modifier : `supabase config diff`. Pour changer un réglage en production : le tableau de bord.

---

## Notifications push

Chaîne complète : abonnement côté navigateur → stocké dans `user_preferences.preferences` → tâche planifiée toutes les 15 min → Edge Function `send-reminders` → service de push → appareil.

- **La clé publique VAPID est figée dans `src/lib/pushNotifications.js`**, pas en variable d'environnement : elle est publique par conception et permanente. En changer invaliderait tous les abonnements existants.
- La variable `VITE_VAPID_PUBLIC_KEY` reste prioritaire si elle existe, pour que le développement local utilise une paire distincte et ne puisse jamais notifier un appareil réel.
- La clé privée vit dans les secrets Supabase, jamais dans le dépôt.
- `src/lib/pushNotifications.js` vérifie l'abonnement **du navigateur courant**, pas seulement ce que dit la base : un abonnement est lié au couple (navigateur, origine), celui d'un ordinateur ne vaut pas pour un téléphone.
- Sur iOS, les notifications n'existent que si l'application est **installée sur l'écran d'accueil**. Dans un onglet Safari, l'abonnement échoue.
- L'endpoint d'abonnement est écrit par l'utilisateur : il est validé contre la liste des services de push légitimes avant tout envoi, sinon le serveur deviendrait un relais vers des adresses internes.

---

## Commandes

```bash
npm run dev          # serveur de développement
npm run build        # build de production
npm run lint         # 63 problèmes préexistants : ne pas en ajouter

supabase start       # stack locale (Docker requis, ~2,3 Go)
supabase stop        # conserve les données
supabase db reset    # rejoue migrations + seed
```

Le seed crée cinq comptes de test en `@holos.test`, mot de passe `password123`, dont un administrateur. **Il ne doit jamais être appliqué à un environnement accessible.**

---

## Pièges déjà rencontrés

- Un **« Redeploy »** depuis le tableau de bord Vercel rejoue le commit existant, **pas** le dernier. Pour déployer un commit en retard, il faut un nouvel événement.
- **Changer le dépôt de propriétaire rompt le lien Vercel** sans alerte. Symptôme : plus de check Vercel sur les PR.
- Ni Vercel ni Supabase ne **rattrapent rétroactivement** : connecter une intégration n'applique pas les merges déjà passés.
- Les aperçus Vercel sont protégés par authentification et ne sont pas consultables sans compte sur l'équipe.
- Comparer un jeton reçu à `SUPABASE_SERVICE_ROLE_KEY` par égalité de chaîne ne fonctionne pas : Supabase émet plusieurs identifiants valides pour ce rôle. Vérifier la revendication `role` du jeton, la plateforme ayant déjà validé sa signature.
