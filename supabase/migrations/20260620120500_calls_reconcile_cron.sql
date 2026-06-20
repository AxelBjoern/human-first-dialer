-- Schedule the CDR reconcile worker via pg_cron + pg_net (every 5 minutes).
-- Guarded so the migration is safe to apply even where the extensions are absent.
-- Requires GUCs app.base_url and app.cron_token (see the AI-calls cron migration).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vdnx-calls-reconcile') THEN
      PERFORM cron.unschedule('vdnx-calls-reconcile');
    END IF;
    PERFORM cron.schedule('vdnx-calls-reconcile', '*/5 * * * *', $cron$
      SELECT net.http_post(
        url := current_setting('app.base_url', true) || '/api/public/v1/calls/reconcile',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-token', current_setting('app.cron_token', true)
        ),
        body := '{}'::jsonb
      );
    $cron$);
  END IF;
END $$;
