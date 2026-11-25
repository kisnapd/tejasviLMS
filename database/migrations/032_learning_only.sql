-- Schools and colleges can use Learning with or without EMIS. Existing ones keep EMIS.
ALTER TABLE organizations ADD COLUMN emis BOOLEAN NOT NULL DEFAULT TRUE
