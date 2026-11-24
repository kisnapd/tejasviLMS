-- Learning batches created from EMIS: a school class-section, or a college program semester, in one academic year.
-- Batches listed here are managed by the sync. Their members, subjects and teachers mirror EMIS.
CREATE TABLE emis_cohort_links (
 org_id CHAR(36) NOT NULL,
 cohort_key VARCHAR(200) NOT NULL,
 batch_id CHAR(36) NOT NULL,
 PRIMARY KEY(org_id,cohort_key),
 UNIQUE KEY uq_cohort_batch(batch_id),
 FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
 FOREIGN KEY(batch_id) REFERENCES batches(id) ON DELETE CASCADE
) ENGINE=InnoDB
