-- Schedule the AI-call worker via pg_cron + pg_net.
-- Guarded so the migration is safe to apply even where the extensions are absent.
-- Requires GUCs app.base_url and app.cron_token (set per project), e.g.:
--   ALTER DATABASE postgres SET app.base_url = 'https://<project>.lovable.app';
--   ALTER DATABASE postgres SET app.cron_token = '<CRON_TOKEN>';
-- NOTE: git push does NOT deploy; this schedule may need to be (re)applied in the
-- Supabase SQL editor after deploy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vdnx-ai-calls') THEN
      PERFORM cron.unschedule('vdnx-ai-calls');
    END IF;
    PERFORM cron.schedule('vdnx-ai-calls', '* * * * *', $cron$
      SELECT net.http_post(
        url := current_setting('app.base_url', true) || '/api/public/v1/ai-calls/run',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-token', current_setting('app.cron_token', true)
        ),
        body := '{}'::jsonb
      );
    $cron$);
  END IF;
END $$;
