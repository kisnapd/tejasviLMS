-- Registration keys: every school and college needs an unrevoked key whose expiry date has not passed.
-- A renewal revokes the previous key, so each organization has at most one current key.
CREATE TABLE organization_registrations (
 id CHAR(36) PRIMARY KEY,
 org_id CHAR(36) NOT NULL,
 registration_key VARCHAR(32) NOT NULL,
 academic_year VARCHAR(40) NOT NULL,
 valid_from DATE NOT NULL,
 expires_on DATE NOT NULL,
 issued_by CHAR(36) NOT NULL,
 issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 revoked_at DATETIME(3) NULL,
 revoked_by CHAR(36) NULL,
 UNIQUE KEY uq_registration_key(registration_key),
 INDEX idx_registration_current(org_id,revoked_at,expires_on),
 FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
 FOREIGN KEY(issued_by) REFERENCES users(id),
 FOREIGN KEY(revoked_by) REFERENCES users(id)
) ENGINE=InnoDB
