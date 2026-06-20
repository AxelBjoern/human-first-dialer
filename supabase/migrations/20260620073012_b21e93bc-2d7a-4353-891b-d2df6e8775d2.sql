
-- ============================================================
-- 1. PLATFORM STAFF
-- ============================================================
CREATE TYPE public.platform_role AS ENUM ('superadmin', 'staff', 'billing', 'support');

CREATE TABLE public.platform_staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.platform_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_staff TO authenticated;
GRANT ALL ON public.platform_staff TO service_role;

ALTER TABLE public.platform_staff ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_staff WHERE user_id = _uid);
$$;

CREATE OR REPLACE FUNCTION public.has_platform_role(_uid uuid, _min public.platform_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_staff
    WHERE user_id = _uid
      AND CASE role
        WHEN 'superadmin' THEN 4
        WHEN 'staff'      THEN 3
        WHEN 'billing'    THEN 2
        WHEN 'support'    THEN 1
      END >= CASE _min
        WHEN 'superadmin' THEN 4
        WHEN 'staff'      THEN 3
        WHEN 'billing'    THEN 2
        WHEN 'support'    THEN 1
      END
  );
$$;

CREATE POLICY "Staff can read platform_staff" ON public.platform_staff
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Superadmins manage platform_staff" ON public.platform_staff
  FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'superadmin'));

-- Seed first superadmin
INSERT INTO public.platform_staff (user_id, role, created_by)
VALUES ('bba3b1ad-b78f-4dea-b7fa-0504cd1bb88b', 'superadmin', 'bba3b1ad-b78f-4dea-b7fa-0504cd1bb88b');

-- ============================================================
-- 2. BILLING PLANS
-- ============================================================
CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  monthly_call_quota integer,        -- null = unlimited
  monthly_ai_minute_quota integer,   -- null = unlimited
  seat_quota integer,                -- null = unlimited
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_plans TO authenticated;
GRANT ALL ON public.billing_plans TO service_role;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read plans" ON public.billing_plans
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Staff write plans" ON public.billing_plans
  FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'billing'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'billing'));

CREATE TRIGGER billing_plans_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. ORG SUBSCRIPTIONS
-- ============================================================
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','suspended');

CREATE TABLE public.org_subscriptions (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end   timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  trial_ends_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_subscriptions TO authenticated;
GRANT ALL ON public.org_subscriptions TO service_role;
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read subscriptions" ON public.org_subscriptions
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Staff write subscriptions" ON public.org_subscriptions
  FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'billing'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'billing'));
CREATE POLICY "Org members read own subscription" ON public.org_subscriptions
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER org_subscriptions_updated_at
  BEFORE UPDATE ON public.org_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. USAGE
-- ============================================================
CREATE TABLE public.org_usage_daily (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  day date NOT NULL,
  calls_count integer NOT NULL DEFAULT 0,
  ai_minutes numeric(10,2) NOT NULL DEFAULT 0,
  transcription_minutes numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, day)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_usage_daily TO authenticated;
GRANT ALL ON public.org_usage_daily TO service_role;
ALTER TABLE public.org_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read usage" ON public.org_usage_daily
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Org admins read own usage" ON public.org_usage_daily
  FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'admin'));

-- Rollup function: recompute a single org/day from source tables
CREATE OR REPLACE FUNCTION public.rollup_org_usage_day(_org uuid, _day date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_calls int;
  v_ai_minutes numeric(10,2);
  v_tx_minutes numeric(10,2);
BEGIN
  SELECT COUNT(*) INTO v_calls
  FROM public.call_logs
  WHERE organization_id = _org
    AND started_at >= _day::timestamptz
    AND started_at <  (_day + 1)::timestamptz;

  SELECT COALESCE(SUM(COALESCE(duration_s,0)),0)/60.0 INTO v_ai_minutes
  FROM public.call_logs
  WHERE organization_id = _org
    AND ai_job_id IS NOT NULL
    AND started_at >= _day::timestamptz
    AND started_at <  (_day + 1)::timestamptz;

  SELECT COALESCE(SUM(COALESCE(cl.duration_s,0)),0)/60.0 INTO v_tx_minutes
  FROM public.transcriptions t
  JOIN public.call_logs cl ON cl.id = t.call_log_id
  WHERE cl.organization_id = _org
    AND t.created_at >= _day::timestamptz
    AND t.created_at <  (_day + 1)::timestamptz;

  INSERT INTO public.org_usage_daily (organization_id, day, calls_count, ai_minutes, transcription_minutes, updated_at)
  VALUES (_org, _day, v_calls, v_ai_minutes, v_tx_minutes, now())
  ON CONFLICT (organization_id, day) DO UPDATE
    SET calls_count = EXCLUDED.calls_count,
        ai_minutes = EXCLUDED.ai_minutes,
        transcription_minutes = EXCLUDED.transcription_minutes,
        updated_at = now();
END;
$$;

-- Current-period view
CREATE OR REPLACE VIEW public.org_usage_current_period AS
SELECT
  s.organization_id,
  s.plan_id,
  s.status,
  s.current_period_start,
  s.current_period_end,
  COALESCE(SUM(u.calls_count), 0)::int AS calls_count,
  COALESCE(SUM(u.ai_minutes), 0)::numeric(10,2) AS ai_minutes,
  COALESCE(SUM(u.transcription_minutes), 0)::numeric(10,2) AS transcription_minutes
FROM public.org_subscriptions s
LEFT JOIN public.org_usage_daily u
  ON u.organization_id = s.organization_id
 AND u.day >= s.current_period_start::date
 AND u.day <  s.current_period_end::date
GROUP BY s.organization_id, s.plan_id, s.status, s.current_period_start, s.current_period_end;

GRANT SELECT ON public.org_usage_current_period TO authenticated, service_role;

-- ============================================================
-- 5. STAFF CROSS-ORG READ POLICIES
-- ============================================================
CREATE POLICY "Platform staff read organizations" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Platform staff read org_members" ON public.org_members
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Platform staff read clients" ON public.clients
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Platform staff read call_logs" ON public.call_logs
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Platform staff read call_sessions" ON public.call_sessions
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Platform staff read transcriptions" ON public.transcriptions
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Platform staff read ai_call_jobs" ON public.ai_call_jobs
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Platform staff read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

-- ============================================================
-- 6. QUOTA + STATUS ENFORCEMENT
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_org_can_use(_org uuid, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status public.subscription_status;
  v_plan_id uuid;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_call_q int;
  v_ai_q int;
  v_used_calls int;
  v_used_ai numeric;
BEGIN
  SELECT status, plan_id, current_period_start, current_period_end
    INTO v_status, v_plan_id, v_period_start, v_period_end
  FROM public.org_subscriptions WHERE organization_id = _org;

  -- No subscription row → unlimited (legacy/free)
  IF v_status IS NULL THEN RETURN; END IF;

  IF v_status IN ('suspended','canceled') THEN
    RAISE EXCEPTION 'Workspace is %; contact VDNX support.', v_status
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_plan_id IS NULL THEN RETURN; END IF;

  SELECT monthly_call_quota, monthly_ai_minute_quota
    INTO v_call_q, v_ai_q
  FROM public.billing_plans WHERE id = v_plan_id;

  IF _kind = 'call' AND v_call_q IS NOT NULL THEN
    SELECT COALESCE(SUM(calls_count),0) INTO v_used_calls
    FROM public.org_usage_daily
    WHERE organization_id = _org
      AND day >= v_period_start::date AND day < v_period_end::date;
    IF v_used_calls >= v_call_q THEN
      RAISE EXCEPTION 'Monthly call quota reached (% / %).', v_used_calls, v_call_q
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF _kind = 'ai' AND v_ai_q IS NOT NULL THEN
    SELECT COALESCE(SUM(ai_minutes),0) INTO v_used_ai
    FROM public.org_usage_daily
    WHERE organization_id = _org
      AND day >= v_period_start::date AND day < v_period_end::date;
    IF v_used_ai >= v_ai_q THEN
      RAISE EXCEPTION 'Monthly AI-minute quota reached (% / %).', v_used_ai, v_ai_q
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_enforce_call_quota()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.check_org_can_use(NEW.organization_id, 'call');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_enforce_ai_quota()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.check_org_can_use(NEW.organization_id, 'ai');
  RETURN NEW;
END;
$$;

CREATE TRIGGER call_sessions_quota
  BEFORE INSERT ON public.call_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_call_quota();

CREATE TRIGGER ai_call_jobs_quota
  BEFORE INSERT ON public.ai_call_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_ai_quota();
