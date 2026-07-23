# Suivi Référencement — Telecontact / Edicom

Système complet de suivi des dossiers : réception du BC signé → référencement →
contrôle qualité → facturation → suivi de paiement → relances → suivi juridique.

**Stack :** Next.js 14 (App Router, TypeScript) + Supabase (Postgres, Auth, Realtime) + Tailwind.
**Hébergement prévu :** Vercel (gratuit pour ce volume) + Supabase (gratuit pour ce volume).

Tout le code est déjà écrit et le build a été vérifié. Il reste 4 étapes, environ
15 minutes, aucune ligne de code à écrire.

---

## Étape 1 — Créer le projet Supabase (la base de données)

1. Aller sur [supabase.com](https://supabase.com) → créer un compte gratuit → **New project**.
2. Choisir un nom (ex: `suivi-telecontact`), un mot de passe de base de données (à garder de côté), une région proche (Europe de préférence).
3. Une fois le projet créé, aller dans **SQL Editor** (menu de gauche) → **New query**.
4. Ouvrir le fichier `supabase/schema.sql` de ce projet, copier tout son contenu, le coller dans l'éditeur SQL, et cliquer **Run**.
   - Cela crée les tables (`dossiers`, `historique`, `profiles`), les règles de sécurité, et active le temps réel.
5. Aller dans **Authentication → Providers** et vérifier que **Email** est activé (c'est activé par défaut).
6. **Recommandé pour un outil interne** : dans **Authentication → Settings**, désactiver
   "Confirm email" pour que les nouveaux comptes n'aient pas besoin de cliquer un lien de
   confirmation avant de se connecter. Sinon, chaque opérateur devra confirmer son email
   à la création de son compte (ce qui fonctionne aussi, juste une étape en plus).
7. Aller dans **Project Settings → API**. Noter deux valeurs, il en faudra besoin à l'étape 3 :
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon public key** (une longue chaîne de caractères)

## Étape 2 — Mettre le code sur GitHub

Dans le dossier de ce projet (en local, ou dans l'environnement où vous avez téléchargé ce zip) :

```bash
cd suivi-telecontact
git init
git add .
git commit -m "Initial commit — système de suivi Telecontact/Edicom"
```

Puis sur [github.com](https://github.com), créer un nouveau repository (vide, sans README),
et suivre les instructions affichées pour pousser le code existant, typiquement :

```bash
git remote add origin https://github.com/VOTRE-COMPTE/suivi-telecontact.git
git branch -M main
git push -u origin main
```

## Étape 3 — Déployer sur Vercel

1. Aller sur [vercel.com](https://vercel.com) → créer un compte gratuit (avec GitHub, c'est le plus simple).
2. **Add New → Project** → sélectionner le repository `suivi-telecontact` que vous venez de pousser.
3. Dans **Environment Variables**, ajouter les deux valeurs notées à l'étape 1 :
   - `NEXT_PUBLIC_SUPABASE_URL` = votre Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = votre anon public key
4. Cliquer **Deploy**. Après ~1-2 minutes, Vercel donne une URL du type `suivi-telecontact.vercel.app`.

C'est en ligne. Toute l'équipe peut maintenant ouvrir cette URL.

## Étape 4 — Premier compte et prise en main

1. Ouvrir l'URL fournie par Vercel → **Créer un compte** (nom complet, email, mot de passe).
2. Se connecter → vous arrivez sur le tableau de bord, vide pour l'instant.
3. Cliquer **Nouveau dossier** pour créer votre premier dossier, ou inviter les autres
   opérateurs à créer leur propre compte (chacun a son compte, mais tout le monde voit
   et modifie les mêmes dossiers — comme demandé).

---

## Développement local (optionnel)

Si vous voulez tester ou modifier le code en local avant de pousser sur GitHub :

```bash
npm install
cp .env.local.example .env.local
# éditer .env.local avec vos vraies valeurs Supabase
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

---

## Comment fonctionne le système

Chaque dossier suit ce cycle :

1. **BC signé reçu** → dossier créé, statut `Contrôle qualité`
2. **Référencement** : automatique, 24h après la date du BC (juste informatif, pas d'action requise)
3. **Contrôle qualité (QC)** : un opérateur ouvre le dossier et clique soit **QC OK** (le
   dossier passe automatiquement en "validé, à facturer" — pas d'étape de validation
   client séparée), soit **Demander correction** (boucle jusqu'à correction)
4. **Facturation** : un opérateur clique **Marquer facturé**, saisit la date et le montant
5. **Paiement** : suivi automatique par alertes —
   - 15 jours sans paiement → 🟠 Relance niveau 1
   - 25 jours sans paiement → 🔴 Relance niveau 2
   - 90 jours (3 mois) sans paiement → ⚫ Suivi juridique (automatique, ou activable manuellement à tout moment)
   - **Marquer payé** à tout moment → dossier clôturé ✅

Ces seuils (2 jours pour la QC, 15/25/90 jours pour les relances) sont centralisés
dans un seul fichier : `src/lib/dossier-logic.ts`, en haut du fichier. Les modifier
là suffit à changer le comportement de tout le système.

Toutes les actions (création, QC, facturation, paiement, changements) sont enregistrées
dans un historique horodaté et attribué à l'opérateur qui l'a fait, visible sur la fiche
de chaque dossier.

Le tableau de bord et le Kanban se mettent à jour **en temps réel** : si un collègue
modifie un dossier, vous le voyez changer sans recharger la page (grâce à Supabase Realtime).

---

## Digest email quotidien (optionnel)

Une fois activé, tous les comptes reçoivent chaque matin un email listant les
dossiers en retard — QC en retard, relances, suivi juridique — avec un lien
direct vers chaque dossier. Si rien n'est en retard, un email de confirmation
("Tout est à jour ✅") est envoyé quand même, pour être sûr que le système
tourne bien.

### Mise en place (10 minutes)

1. **Créer un compte [Resend](https://resend.com)** (gratuit, envoi d'emails transactionnels).
   - Dans **API Keys**, créer une clé → copier la valeur (visible une seule fois).
   - Dans **Domains**, ajouter et vérifier votre propre domaine d'entreprise
     (quelques enregistrements DNS à ajouter chez votre registrar — Resend
     guide pas à pas). **Sans domaine vérifié, Resend n'autorisera l'envoi
     qu'à votre propre adresse de test**, pas à toute l'équipe — donc cette
     étape est nécessaire pour un vrai usage en production.

2. **Récupérer la clé "service role" de Supabase** : Project Settings → API →
   `service_role` key (⚠️ différente de la clé `anon` déjà utilisée — celle-ci
   est un secret serveur, ne jamais l'exposer côté client).

3. **Générer un secret aléatoire** pour protéger la route du cron, par exemple :
   ```bash
   openssl rand -hex 32
   ```

4. **Ajouter ces variables d'environnement dans Vercel** (Project Settings → Environment Variables) :

   | Variable | Valeur |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | la clé service_role de l'étape 2 |
   | `RESEND_API_KEY` | la clé de l'étape 1 |
   | `RESEND_FROM_EMAIL` | ex: `suivi@votreentreprise.com` (doit correspondre au domaine vérifié) |
   | `CRON_SECRET` | le secret généré à l'étape 3 |
   | `NEXT_PUBLIC_APP_URL` | l'URL de votre app, ex: `https://suivi-telecontact.vercel.app` |

5. **Redéployer** (Vercel redéploie automatiquement dès qu'une variable d'environnement change, ou déclenchez un redeploy manuel).

6. C'est tout — `vercel.json` programme déjà l'envoi automatique chaque jour à 6h30 UTC (~7h30 heure du Maroc). Modifiable dans `vercel.json` si besoin (format cron standard).

### Tester manuellement avant de faire confiance au planning automatique

```bash
curl https://votre-app.vercel.app/api/cron/digest \
  -H "Authorization: Bearer VOTRE_CRON_SECRET"
```

Réponse attendue : `{"sent":true,"alertCount":X,"recipientCount":Y}`. Vérifiez
ensuite que l'email est bien arrivé dans les boîtes de l'équipe (pensez aux
spams lors du tout premier test).

### Limites connues

- Sur le plan Vercel gratuit (Hobby), les cron jobs peuvent s'exécuter avec
  jusqu'à une heure de décalage par rapport à l'heure programmée — normal,
  pas un bug.
- Sans domaine vérifié sur Resend, les emails n'arriveront qu'à l'adresse du
  compte Resend lui-même, pas à toute l'équipe.
- Le digest est envoyé à **tous** les comptes existants, sans possibilité de
  désabonnement individuel pour l'instant.

---

## Notes et limites connues

- **Import historique** : pas d'import automatique des dossiers 2025/2026 pour l'instant,
  comme convenu — ajout manuel via "Nouveau dossier". Un import CSV pourra être ajouté
  plus tard si besoin (dites-le, c'est un ajout simple une fois le format du fichier connu).
- **Comptes** : n'importe qui avec le lien peut actuellement créer un compte via la page
  d'inscription. Pour un outil strictement interne, pensez à ne partager l'URL qu'en
  interne, ou signalez-le si vous voulez restreindre les inscriptions à des emails
  spécifiques (ex: seulement `@votreentreprise.com`) — c'est une modification simple
  côté Supabase.
- **Sécurité des dépendances** : le projet utilise Next.js 14.2.35 (dernière version
  stable de la branche 14). Des avis de sécurité existent sur la lignée Next.js 14
  concernant surtout des scénarios d'auto-hébergement avancés (serveur personnalisé,
  i18n, cache d'images) qui ne s'appliquent pas à un déploiement Vercel standard comme
  celui-ci. Une mise à niveau vers Next.js 15/16 est possible plus tard mais implique des
  changements d'API (ex: gestion asynchrone des paramètres de route) — à prévoir comme
  amélioration séparée plutôt que dans ce premier déploiement.
- **Suivi juridique** : pour l'instant, un simple indicateur + champ de notes libres.
  Si un vrai processus juridique structuré (mise en demeure, huissier, dates légales)
  est nécessaire plus tard, ce sera une extension du modèle de données existant.

---

## Structure du projet

```
supabase/schema.sql          → Schéma complet de la base de données (à exécuter une fois)
src/lib/dossier-logic.ts     → Toute la logique métier (statuts, seuils, alertes)
src/lib/types.ts             → Types TypeScript partagés
src/components/providers/    → Connexion Supabase + temps réel
src/app/(app)/dashboard/     → Tableau de bord
src/app/(app)/dossiers/      → Vue Kanban + liste + fiche détail par dossier
src/app/(app)/operateurs/    → Vue équipe
src/app/login, /signup       → Authentification
```
