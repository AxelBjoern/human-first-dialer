-- Add the 'team_lead' role to org_role.
-- MUST be its own migration: Postgres cannot use a newly added enum value
-- in the same transaction that adds it. Subsequent migrations (re-ranking
-- has_org_role, can_supervise, policies) reference 'team_lead' safely.
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'team_lead' BEFORE 'agent';
