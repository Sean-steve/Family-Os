-- Family OS B0, v0001. Migration account owns schema; family_runtime must never be
-- table owner, superuser or BYPASSRLS. No demo data, user identities or passwords.
CREATE SCHEMA IF NOT EXISTS family;

CREATE OR REPLACE FUNCTION family.current_actor()
RETURNS uuid
LANGUAGE sql STABLE
AS $body$
  SELECT NULLIF(current_setting('family.actor_id', true),'')::uuid
$body$;

CREATE TABLE family.identities (
  id uuid PRIMARY KEY,
  issuer text NOT NULL CHECK(length(issuer) BETWEEN 1 AND 400),
  subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer,subject)
);

CREATE TABLE family.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 120),
  created_by uuid NOT NULL REFERENCES family.identities(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX families_created_by_idx ON family.families(created_by);

CREATE TABLE family.memberships (
  family_id uuid NOT NULL REFERENCES family.families(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES family.identities(id) ON DELETE RESTRICT,
  role varchar(24) NOT NULL CHECK(role IN ('OWNER','CO_PARENT','ADULT','TEEN','CHILD','GUEST')),
  state varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','SUSPENDED','REVOKED')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id,user_id)
);
CREATE INDEX family_memberships_user_idx ON family.memberships(user_id,state);

CREATE TABLE family.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family.families(id) ON DELETE RESTRICT,
  name varchar(120) NOT NULL,
  created_by uuid NOT NULL REFERENCES family.identities(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX households_family_idx ON family.households(family_id);

-- Consent grants are a reserved authority boundary, NOT writable by a
-- family owner or runtime service in B0. No guardian/child permission bypass.
CREATE TABLE family.consent_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family.families(id) ON DELETE RESTRICT,
  subject_user_id uuid NOT NULL REFERENCES family.identities(id),
  granted_by uuid NOT NULL REFERENCES family.identities(id),
  purpose varchar(80) NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  state varchar(16) NOT NULL CHECK(state IN ('PROPOSED','ACTIVE','REVOKED','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  CHECK (state <> 'REVOKED' OR revoked_at IS NOT NULL)
);
CREATE INDEX consent_grants_family_idx ON family.consent_grants(family_id,subject_user_id);

CREATE TABLE family.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family.families(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES family.identities(id),
  action varchar(100) NOT NULL,
  object_type varchar(60) NOT NULL,
  object_id uuid,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX family_audit_scope_idx ON family.audit_events(family_id,created_at DESC);

CREATE TABLE family.outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family.families(id) ON DELETE RESTRICT,
  event_type varchar(150) NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX family_outbox_pending_idx ON family.outbox(occurred_at) WHERE delivered_at IS NULL;

CREATE TABLE family.inbox (
  source varchar(80) NOT NULL,
  event_id uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source,event_id)
);

-- RLS is enabled and forced for all domain tables. Runtime access remains
-- restricted by GRANT; RLS is defense-in-depth, not a replacement for auth.
ALTER TABLE family.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.identities FORCE ROW LEVEL SECURITY;
ALTER TABLE family.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.families FORCE ROW LEVEL SECURITY;
ALTER TABLE family.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE family.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.households FORCE ROW LEVEL SECURITY;
ALTER TABLE family.consent_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.consent_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE family.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE family.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE family.inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.inbox FORCE ROW LEVEL SECURITY;

CREATE POLICY identity_self_select ON family.identities FOR SELECT
  TO family_runtime USING (id = family.current_actor());
CREATE POLICY identity_self_insert ON family.identities FOR INSERT
  TO family_runtime WITH CHECK (id = family.current_actor());
CREATE POLICY identity_self_update ON family.identities FOR UPDATE
  TO family_runtime USING (id = family.current_actor())
  WITH CHECK (id = family.current_actor());

-- An originator can see an unbound family row during owner bootstrap.
-- Other subjects only see families where their own active membership exists.
CREATE POLICY family_read_member ON family.families FOR SELECT
  TO family_runtime USING (
    (created_by = family.current_actor() AND NOT EXISTS (
      SELECT 1 FROM family.memberships m
      WHERE m.family_id = id AND m.user_id = family.current_actor()
    ))
    OR EXISTS (
      SELECT 1 FROM family.memberships m
      WHERE m.family_id = id AND m.user_id = family.current_actor()
        AND m.state = 'ACTIVE'
    )
  );
CREATE POLICY family_create_self ON family.families FOR INSERT
  TO family_runtime WITH CHECK (created_by = family.current_actor());

-- B0 runtime sees ONLY its own membership. No family roster endpoint yet.
-- Bootstrap INSERT is restricted to the verified family creator as OWNER;
-- family/role changes are reserved for governed B1 services.
CREATE POLICY membership_self_select ON family.memberships FOR SELECT
  TO family_runtime USING (user_id = family.current_actor());
CREATE POLICY membership_bootstrap_owner ON family.memberships FOR INSERT
  TO family_runtime WITH CHECK (
    user_id = family.current_actor() AND role = 'OWNER' AND state = 'ACTIVE'
    AND EXISTS (
      SELECT 1 FROM family.families f
      WHERE f.id = family_id AND f.created_by = family.current_actor()
    )
  );

CREATE POLICY households_active_member_read ON family.households FOR SELECT
  TO family_runtime USING (
    EXISTS (SELECT 1 FROM family.memberships m
      WHERE m.family_id = family.households.family_id
        AND m.user_id = family.current_actor() AND m.state = 'ACTIVE')
  );

-- Consent grants have zero runtime policies and zero runtime GRANTs.
-- No grant can be declared, edited or treated as verified in B0.

CREATE POLICY audit_insert_by_actor ON family.audit_events FOR INSERT
  TO family_runtime WITH CHECK (
    actor_user_id = family.current_actor()
    AND EXISTS (
      SELECT 1 FROM family.families f
      WHERE f.id = family.audit_events.family_id
    )
  );
CREATE POLICY outbox_insert_by_member ON family.outbox FOR INSERT
  TO family_runtime WITH CHECK (
    EXISTS (SELECT 1 FROM family.families f
      WHERE f.id = family.outbox.family_id)
  );
-- Inbox has no runtime write policies; reserved for a privileged worker.

REVOKE ALL ON SCHEMA family FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA family FROM PUBLIC;
GRANT USAGE ON SCHEMA family TO family_runtime;
GRANT SELECT,INSERT,UPDATE ON family.identities TO family_runtime;
GRANT SELECT,INSERT ON family.families TO family_runtime;
GRANT SELECT,INSERT ON family.memberships TO family_runtime;
GRANT SELECT ON family.households TO family_runtime;
GRANT INSERT ON family.audit_events,family.outbox TO family_runtime;
-- No runtime privileges to consent_grants, inbox, schema_migrations,
-- other users' memberships, or arbitrary family/role changes.
