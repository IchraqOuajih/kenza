CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Données métier (chargées depuis les CSV) ───

CREATE TABLE produits (
  ref                  TEXT PRIMARY KEY,
  modele               TEXT NOT NULL,
  famille              TEXT,
  genre                TEXT,
  couleur              TEXT,
  taille               TEXT,
  matiere              TEXT,
  saison               TEXT,
  prix_mad             NUMERIC(10,2) NOT NULL,
  stock                INTEGER NOT NULL DEFAULT 0,
  delai_reassort_jours INTEGER,
  code_barre           TEXT,
  poids_g              INTEGER,
  embedding            vector(512)
);

CREATE TABLE clients (
  client_id       TEXT PRIMARY KEY,
  nom             TEXT,
  telephone       TEXT UNIQUE,
  ville           TEXT,
  langue_preferee TEXT,
  premier_achat   DATE,
  nb_commandes    INTEGER,
  segment         TEXT
);

CREATE TABLE livraison (
  ville                   TEXT PRIMARY KEY,
  frais_mad               NUMERIC(10,2) NOT NULL,
  delai_heures            INTEGER,
  paiement_a_la_livraison BOOLEAN,
  retrait_boutique        BOOLEAN
);

CREATE TABLE promotions (
  id              SERIAL PRIMARY KEY,
  ref             TEXT REFERENCES produits(ref),
  prix_normal_mad NUMERIC(10,2),
  prix_promo_mad  NUMERIC(10,2),
  debut           DATE,
  fin             DATE,
  condition       TEXT
);

CREATE TABLE commandes (
  commande_id         TEXT PRIMARY KEY,
  client_id           TEXT REFERENCES clients(client_id),
  date                DATE,
  canal               TEXT,
  statut              TEXT,
  total_articles_mad  NUMERIC(10,2),
  frais_livraison_mad NUMERIC(10,2),
  total_mad           NUMERIC(10,2),
  ville_livraison     TEXT,
  paiement            TEXT,
  creee_par_agent     BOOLEAN DEFAULT FALSE
);

CREATE TABLE commande_lignes (
  id                BIGSERIAL PRIMARY KEY,
  commande_id       TEXT REFERENCES commandes(commande_id),
  ref               TEXT,
  modele            TEXT,
  taille            TEXT,
  quantite          INTEGER,
  prix_unitaire_mad NUMERIC(10,2)
);

-- ─── État de l'agent ───

CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  TEXT,
  telephone  TEXT,
  canal      TEXT NOT NULL,
  statut     TEXT DEFAULT 'ouverte',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  role            TEXT,              -- client | agent | commercant
  contenu         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paniers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  client_id       TEXT,
  lignes          JSONB NOT NULL DEFAULT '[]',
  statut          TEXT DEFAULT 'ouvert',   -- ouvert | commande | abandonne
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE traces (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id UUID,
  etape           TEXT,
  outil           TEXT,
  entree          JSONB,
  sortie          JSONB,
  decision        TEXT,
  modele          TEXT,
  duree_ms        INTEGER,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE escalades (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  motif           TEXT,
  contexte        JSONB,
  statut          TEXT DEFAULT 'ouverte',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_produits_stock    ON produits(stock);
CREATE INDEX idx_promos_ref_dates  ON promotions(ref, debut, fin);
CREATE INDEX idx_clients_tel       ON clients(telephone);
CREATE INDEX idx_traces_conv       ON traces(conversation_id);
CREATE INDEX idx_paniers_statut    ON paniers(statut, updated_at);