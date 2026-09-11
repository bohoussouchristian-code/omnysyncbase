# OSB — Le tout-en-un

Logiciel de gestion d'entreprise : stock, ventes (caisse), achats, clients/fournisseurs (avec crédit), dépenses, caisse et rapports. Adapté aux entrepôts de boissons, quincailleries et commerces similaires, avec support multi-dépôts/boutiques.

## Démarrage

```bash
npm install
npm run dev
```

Ouvrez http://localhost:3010

Compte par défaut : `admin@entreprise.com` / `admin123`

## Base de données

SQLite via Prisma (`prisma/dev.db`). Pour réinitialiser :

```bash
npx prisma migrate reset
```

Pour ajouter un nouveau champ/modèle, modifiez `prisma/schema.prisma` puis :

```bash
npx prisma migrate dev --name votre_nom
```

## Modules

- **Produits** — catalogue, catégories, unités, codes-barres, seuils d'alerte, vente par lot (carton/casier) en plus de l'unité de base, prix pro/revendeur
- **Stock** — entrées/sorties, transferts entre dépôts, ajustements, historique
- **Ventes (POS)** — vente rapide, scan code-barres, vente à l'unité ou au carton, paiement espèces/mobile money/crédit, vente à crédit avec échéance et suivi de dette, points de fidélité, reçu imprimable
- **Achats** — commandes fournisseurs, réception de stock à l'unité ou au carton
- **Clients / Fournisseurs** — fiches, type de client (particulier/pro/revendeur), historique, gestion des dettes avec échéances, points de fidélité
- **Dépenses** — suivi des charges par catégorie
- **Caisse** — ouverture/fermeture de session avec rapprochement
- **Rapports** — chiffre d'affaires, marges, top produits, valeur du stock, évolution des ventes (graphique), export CSV
- **Utilisateurs** — rôles Administrateur / Gérant / Caissier / Magasinier
