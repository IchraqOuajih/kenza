CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS produits (
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

CREATE TABLE IF NOT EXISTS clients (
  client_id       TEXT PRIMARY KEY,
  nom             TEXT,
  telephone       TEXT UNIQUE,
  ville           TEXT,
  langue_preferee TEXT,
  premier_achat   DATE,
  nb_commandes    INTEGER,
  segment         TEXT
);

CREATE TABLE IF NOT EXISTS livraison (
  ville                   TEXT PRIMARY KEY,
  frais_mad               NUMERIC(10,2) NOT NULL,
  delai_heures            INTEGER,
  paiement_a_la_livraison BOOLEAN,
  retrait_boutique        BOOLEAN
);

CREATE TABLE IF NOT EXISTS promotions (
  id              SERIAL PRIMARY KEY,
  ref             TEXT REFERENCES produits(ref),
  prix_normal_mad NUMERIC(10,2),
  prix_promo_mad  NUMERIC(10,2),
  debut           DATE,
  fin             DATE,
  condition       TEXT
);

CREATE TABLE IF NOT EXISTS commandes (
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
  creee_par_agent     BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commande_lignes (
  id                BIGSERIAL PRIMARY KEY,
  commande_id       TEXT REFERENCES commandes(commande_id),
  ref               TEXT,
  modele            TEXT,
  taille            TEXT,
  quantite          INTEGER,
  prix_unitaire_mad NUMERIC(10,2)
);

CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  TEXT,
  telephone  TEXT,
  canal      TEXT NOT NULL,
  statut     TEXT DEFAULT 'ouverte',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  role            TEXT,
  contenu         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paniers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  client_id       TEXT,
  lignes          JSONB NOT NULL DEFAULT '[]',
  statut          TEXT DEFAULT 'ouvert',
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS traces (
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

CREATE TABLE IF NOT EXISTS escalades (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  motif           TEXT,
  contexte        JSONB,
  statut          TEXT DEFAULT 'ouverte',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produits_stock   ON produits(stock);
CREATE INDEX IF NOT EXISTS idx_promos_ref_dates ON promotions(ref, debut, fin);
CREATE INDEX IF NOT EXISTS idx_clients_tel      ON clients(telephone);
CREATE INDEX IF NOT EXISTS idx_traces_conv      ON traces(conversation_id);
CREATE INDEX IF NOT EXISTS idx_paniers_statut   ON paniers(statut, updated_at);
CREATE INDEX IF NOT EXISTS idx_commandes_client ON commandes(client_id, created_at);