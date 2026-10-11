-- Migration: 20261011_worker_access_links.sql
--
-- Goal:
--   Let each worker (personnel) open his/her own read-only profile directly from a
--   personal link / QR code, WITHOUT a login page and WITHOUT username, password or
--   workspace code.
--
-- Why the old flow failed:
--   * worker credentials only lived in the ADMIN's browser (localStorage), so the
--     worker's phone could never verify them;
--   * the workspace lookup was done with the anon key and relied on an RLS policy;
--   * the password was embedded in the URL.
--
-- Design:
--   * Admin (Supabase Auth) calls create_worker_access_link(worker_id). The server
--     generates a long random token (~244 bits), stores ONLY its SHA-256 hash, and
--     returns the raw token once. The app puts it in the URL fragment (#t=<token>).
--   * The worker's device calls worker_portal_login(token) (anon allowed). The RPC
--     validates the token and returns ONLY that worker's own data (plus the group
--     members when the worker is a supervisor). Nothing else is readable.
--   * Revoking / regenerating a link instantly invalidates the old one.
--   * worker_access_tokens has RLS enabled and NO policies: it is unreachable
--     except through the SECURITY DEFINER functions below.

-- ---------------------------------------------------------------------------
-- 1. Token table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_access_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id     TEXT NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,            -- NULL = never expires (until revoked)
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS worker_access_tokens_worker_idx
  ON public.worker_access_tokens (worker_id);

ALTER TABLE public.worker_access_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.worker_access_tokens FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Internal helper: read a JSON document stored in the key/value `settings`
--    table (works whether setting_value is TEXT or JSONB).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._karsync_setting_json(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v JSONB;
BEGIN
  SELECT to_jsonb(s.setting_value)
    INTO v
    FROM public.settings s
   WHERE s.setting_key = p_key
   ORDER BY s.updated_at DESC NULLS LAST
   LIMIT 1;

  IF v IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(v) = 'string' THEN
    BEGIN
      RETURN (v #>> '{}')::jsonb;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
  END IF;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public._karsync_setting_json(TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Admin: create (or regenerate) a worker's link. Returns the RAW token once.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_worker_access_link(p_worker_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_row   JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT to_jsonb(w) INTO v_row
    FROM public.workers w
   WHERE w.id = p_worker_id
     AND w.deleted_at IS NULL;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'worker not found';
  END IF;

  -- The caller must own the worker (when the table tracks ownership)
  IF v_row ? 'user_id' AND (v_row ->> 'user_id') IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  -- One active link per worker: a new link invalidates the previous one
  UPDATE public.worker_access_tokens
     SET revoked_at = now()
   WHERE worker_id = p_worker_id
     AND revoked_at IS NULL;

  -- 2 x UUIDv4 = 244 random bits, 64 hex chars
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  INSERT INTO public.worker_access_tokens (worker_id, token_hash, created_by)
  VALUES (p_worker_id, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), auth.uid());

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_worker_access_link(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_worker_access_link(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Admin: revoke a worker's link(s)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_worker_access_links(p_worker_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT to_jsonb(w) INTO v_row FROM public.workers w WHERE w.id = p_worker_id;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'worker not found';
  END IF;

  IF v_row ? 'user_id' AND (v_row ->> 'user_id') IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  UPDATE public.worker_access_tokens
     SET revoked_at = now()
   WHERE worker_id = p_worker_id
     AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_worker_access_links(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_worker_access_links(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Worker device: validate the token and return the worker's own data.
--    Returns {"ok": false, "error": "..."} instead of raising, so the client can
--    tell "revoked" apart from "network error".
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.worker_portal_login(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash        TEXT;
  v_token_id    UUID;
  v_worker_id   TEXT;
  v_worker      public.workers%ROWTYPE;
  v_meta_all    JSONB;
  v_proj_map    JSONB;
  v_meta        JSONB;
  v_group_id    TEXT;
  v_is_sup      BOOLEAN := FALSE;
  v_ids         TEXT[];
  v_members     JSONB := '[]'::jsonb;
  v_logs        JSONB := '[]'::jsonb;
  v_payments    JSONB := '[]'::jsonb;
  v_group       JSONB := NULL;
  v_projects    JSONB := '[]'::jsonb;
  v_project_ids TEXT[];
  v_pay_all     JSONB;
  v_groups_all  JSONB;
  v_proj_all    JSONB;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 OR length(p_token) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  SELECT t.id, t.worker_id
    INTO v_token_id, v_worker_id
    FROM public.worker_access_tokens t
   WHERE t.token_hash = v_hash
     AND t.revoked_at IS NULL
     AND (t.expires_at IS NULL OR t.expires_at > now());

  IF v_token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_worker
    FROM public.workers w
   WHERE w.id = v_worker_id
     AND w.deleted_at IS NULL;

  IF v_worker.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF COALESCE(to_jsonb(v_worker) ->> 'is_active', '1') IN ('0', 'false') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_blocked');
  END IF;

  UPDATE public.worker_access_tokens SET last_used_at = now() WHERE id = v_token_id;

  v_meta_all := COALESCE(public._karsync_setting_json('app_worker_metadata'), '{}'::jsonb);
  v_proj_map := COALESCE(public._karsync_setting_json('app_worker_projects'), '{}'::jsonb);
  v_meta     := COALESCE(v_meta_all -> v_worker.id, '{}'::jsonb);
  v_group_id := NULLIF(v_meta ->> 'groupId', '');

  -- Supervisor = team role "Master" (or a supervisor-like job title) AND belongs to a group
  v_is_sup := COALESCE(
    v_group_id IS NOT NULL AND (
         COALESCE(v_meta ->> 'teamRole', '') = 'Master'
      OR lower(COALESCE(v_worker.role, '')) LIKE '%master%'
      OR COALESCE(v_worker.role, '') LIKE '%سرپرست%'
      OR COALESCE(v_worker.role, '') LIKE '%استادکار%'
    ), FALSE);

  v_ids := ARRAY[v_worker.id];

  IF v_is_sup THEN
    SELECT COALESCE(array_agg(w2.id), ARRAY[]::TEXT[])
      INTO v_ids
      FROM public.workers w2
     WHERE w2.deleted_at IS NULL
       AND (w2.id = v_worker.id OR (v_meta_all -> w2.id ->> 'groupId') = v_group_id);
    IF NOT (v_worker.id = ANY (v_ids)) THEN
      v_ids := array_append(v_ids, v_worker.id);
    END IF;
  END IF;

  -- Worker rows (own + group members). Credentials are NEVER returned.
  SELECT COALESCE(jsonb_agg(
           (to_jsonb(w3) - 'user_id')
           || jsonb_build_object(
                'meta', COALESCE(v_meta_all -> w3.id, '{}'::jsonb) - 'username' - 'password',
                'project_id_resolved', COALESCE(to_jsonb(w3) ->> 'project_id', v_proj_map ->> w3.id)
              )
         ), '[]'::jsonb)
    INTO v_members
    FROM public.workers w3
   WHERE w3.id = ANY (v_ids)
     AND w3.deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(to_jsonb(l) - 'user_id'), '[]'::jsonb)
    INTO v_logs
    FROM public.attendance_logs l
   WHERE l.worker_id = ANY (v_ids)
     AND l.deleted_at IS NULL;

  -- Payments live in the JSON document "app_payments"
  v_pay_all := public._karsync_setting_json('app_payments');
  IF v_pay_all IS NOT NULL AND jsonb_typeof(v_pay_all) = 'array' THEN
    SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
      INTO v_payments
      FROM jsonb_array_elements(v_pay_all) AS p
     WHERE COALESCE(p ->> 'workerId', p ->> 'worker_id') = ANY (v_ids)
       AND p ->> 'deletedAt' IS NULL
       AND COALESCE(p ->> 'status', '') <> 'deleted';
  END IF;

  -- Group (only the worker's own group)
  IF v_group_id IS NOT NULL THEN
    v_groups_all := public._karsync_setting_json('app_groups');
    IF v_groups_all IS NOT NULL AND jsonb_typeof(v_groups_all) = 'array' THEN
      SELECT g
        INTO v_group
        FROM jsonb_array_elements(v_groups_all) AS g
       WHERE g ->> 'id' = v_group_id
         AND g ->> 'deletedAt' IS NULL
       LIMIT 1;
    END IF;
  END IF;

  -- Projects referenced by the returned workers / logs
  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::TEXT[])
    INTO v_project_ids
    FROM (
      SELECT COALESCE(to_jsonb(w4) ->> 'project_id', v_proj_map ->> w4.id) AS x
        FROM public.workers w4 WHERE w4.id = ANY (v_ids)
      UNION
      SELECT to_jsonb(l2) ->> 'project_id'
        FROM public.attendance_logs l2 WHERE l2.worker_id = ANY (v_ids)
    ) q
   WHERE x IS NOT NULL;

  v_proj_all := public._karsync_setting_json('app_projects');
  IF v_proj_all IS NOT NULL AND jsonb_typeof(v_proj_all) = 'array' THEN
    SELECT COALESCE(jsonb_agg(
             jsonb_build_object(
               'id', pr ->> 'id',
               'name', pr ->> 'name',
               'currency', COALESCE(pr ->> 'currency', 'IQD'),
               'standardWorkHours', COALESCE(pr ->> 'standardWorkHours', pr ->> 'standard_work_hours'),
               'overtimeMultiplier', COALESCE(pr ->> 'overtimeMultiplier', pr ->> 'overtime_multiplier'),
               'status', COALESCE(pr ->> 'status', 'active')
             )), '[]'::jsonb)
      INTO v_projects
      FROM jsonb_array_elements(v_proj_all) AS pr
     WHERE pr ->> 'id' = ANY (v_project_ids);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'worker_id', v_worker.id,
    'is_supervisor', v_is_sup,
    'workers', v_members,
    'logs', v_logs,
    'payments', v_payments,
    'group', v_group,
    'projects', v_projects
  );
END;
$$;

REVOKE ALL ON FUNCTION public.worker_portal_login(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_portal_login(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
