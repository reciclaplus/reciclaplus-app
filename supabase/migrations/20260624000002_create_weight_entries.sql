-- Weight entries: logs of weighed plastic bags by type.
CREATE TABLE weight_entries (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date        date NOT NULL DEFAULT CURRENT_DATE,
    plastic_type text NOT NULL CHECK (plastic_type IN ('pet', 'hdpe', 'pp', 'trash')),
    weight_lbs  numeric(10, 2) NOT NULL CHECK (weight_lbs > 0),
    created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_weight_entries_date ON weight_entries (date DESC);
