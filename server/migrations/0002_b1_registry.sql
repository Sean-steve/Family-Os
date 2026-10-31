-- Family OS B1: verified adult family membership and non-sensitive household registry.
-- All routines are created by the migration administrator, never the API role.
-- This migration intentionally provides NO child/guardian enrolment or
-- access to private profiles, consent grants, messages, or personal OS data.

-- Harden role lookups against recursive membership RLS policies.
CREATE FUNCTION family.active_role(p_family uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,family
AS $$
  SELECT m.role::text FROM family.memberships AS m
  WHERE m.family_id=p_family AND m.user_id=family.current_actor()
    AND m.state='ACTIVE' LIMIT 1
$$;
CREATE FUNCTION family.is_owner(p_family uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,family
AS $$ SELECT family.active_role(p_family)='OWNER' $$;
CREATE FUNCTION family.can_manage_household(p_family uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,family
AS $$ SELECT COALESCE(family.active_role(p_family) IN ('OWNER','CO_PARENT'),false) $$;
CREATE FUNCTION family.can_read_household(p_family uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,family
AS $$ SELECT COALESCE(family.active_role(p_family) IN ('OWNER','CO_PARENT','ADULT'),false) $$;
REVOKE ALL ON FUNCTION family.active_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION family.is_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION family.can_manage_household(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION family.can_read_household(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION family.active_role(uuid),family.is_owner(uuid),
  family.can_manage_household(uuid),family.can_read_household(uuid) TO family_runtime;

-- Only adult members with an active role may read non-sensitive household
-- labels. Guests, teens and children have no access or ABAC bypass.
ALTER TABLE family.households
  ADD COLUMN kind varchar(24) NOT NULL DEFAULT 'OTHER'
    CHECK(kind IN ('PRIMARY_HOME','SECONDARY_HOME','SHARED_HOME','OTHER')),
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX household_one_primary_active_per_family
  ON family.households(family_id)
  WHERE kind='PRIMARY_HOME' AND archived_at IS NULL;
DROP POLICY households_active_member_read ON family.households;
CREATE POLICY households_adult_read ON family.households FOR SELECT TO family_runtime
  USING (family.can_read_household(family_id));
CREATE POLICY households_manager_insert ON family.households FOR INSERT TO family_runtime
  WITH CHECK (family.can_manage_household(family_id)
     AND created_by=family.current_actor());
CREATE POLICY households_manager_update ON family.households FOR UPDATE TO family_runtime
  USING (family.can_manage_household(family_id))
  WITH CHECK (family.can_manage_household(family_id));
GRANT INSERT ON family.households TO family_runtime;
GRANT UPDATE(name,kind,archived_at,updated_at) ON family.households TO family_runtime;

-- Owner-only registry administration. Member identities are verified OIDC
-- subjects; no unverified family-profile account is a membership.
CREATE POLICY memberships_owner_roster ON family.memberships FOR SELECT TO family_runtime
  USING (family.is_owner(family_id));
CREATE POLICY memberships_owner_update_nonprivileged ON family.memberships FOR UPDATE TO family_runtime
  USING (
    family.is_owner(family_id) AND user_id<>family.current_actor()
    AND role IN ('ADULT','GUEST') AND state='ACTIVE'
  )
  WITH CHECK (
    family.is_owner(family_id) AND user_id<>family.current_actor()
    AND role IN ('ADULT','GUEST') AND state IN ('ACTIVE','REVOKED')
  );
GRANT UPDATE(role,state) ON family.memberships TO family_runtime;

-- Invitation secrets are generated in Node's CSPRNG, returned ONCE, and
-- represented at rest by SHA-256. Invitation target must already be a
-- registered OIDC identity (activated via authenticated /me).
CREATE TABLE family.invitations (
  id uuid PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES family.families(id) ON DELETE RESTRICT,
  target_user_id uuid NOT NULL REFERENCES family.identities(id) ON DELETE RESTRICT,
  role varchar(16) NOT NULL CHECK(role IN ('ADULT','GUEST')),
  secret_sha256 char(64) NOT NULL CHECK(secret_sha256 ~ '^[0-9a-f]{64}$'),
  issued_by uuid NOT NULL REFERENCES family.identities(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  CHECK(expires_at > created_at AND expires_at <= created_at + interval '7 days'),
  CHECK(accepted_at IS NULL OR revoked_at IS NULL)
);
CREATE INDEX family_invitations_target_idx ON family.invitations(target_user_id,expires_at);
CREATE INDEX family_invitations_family_idx ON family.invitations(family_id,created_at);
ALTER TABLE family.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY invitations_issue_by_owner ON family.invitations FOR INSERT TO family_runtime
  WITH CHECK(family.is_owner(family_id) AND issued_by=family.current_actor()
    AND target_user_id<>family.current_actor() AND role IN ('ADULT','GUEST'));
GRANT INSERT ON family.invitations TO family_runtime;
-- No SELECT/UPDATE/DELETE on invitation secrets to the runtime role.
-- The only invitation redemption path is this tightly-scoped routine.

CREATE FUNCTION family.accept_invitation(p_invitation uuid,p_secret_sha256 text)
RETURNS TABLE(accepted_family_id uuid,accepted_role text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,family
AS $function$
DECLARE
  invitation family.invitations%ROWTYPE;
BEGIN
  IF family.current_actor() IS NULL OR p_secret_sha256 !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;
  SELECT * INTO invitation FROM family.invitations
    WHERE id=p_invitation FOR UPDATE;
  IF NOT FOUND OR invitation.target_user_id<>family.current_actor()
     OR invitation.accepted_at IS NOT NULL OR invitation.revoked_at IS NOT NULL
     OR invitation.expires_at<=now()
     OR invitation.secret_sha256<>p_secret_sha256
     OR invitation.role NOT IN ('ADULT','GUEST') THEN
    RETURN;
  END IF;
  INSERT INTO family.memberships(family_id,user_id,role,state)
    VALUES(invitation.family_id,family.current_actor(),invitation.role,'ACTIVE')
    ON CONFLICT(family_id,user_id) DO UPDATE
      SET role=EXCLUDED.role,state='ACTIVE',joined_at=now()
      WHERE family.memberships.state='REVOKED';
  IF NOT FOUND THEN
    RETURN;
  END IF;
  UPDATE family.invitations SET accepted_at=now() WHERE id=p_invitation;
  accepted_family_id:=invitation.family_id;
  accepted_role:=invitation.role;
  RETURN NEXT;
END
$function$;
REVOKE ALL ON FUNCTION family.accept_invitation(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION family.accept_invitation(uuid,text) TO family_runtime;

-- The core API appends audit/outbox in the same transaction for each
-- mutating registry operation. No runtime updates or deletions are permitted.
