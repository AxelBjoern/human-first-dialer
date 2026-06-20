CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vdnx-ai-calls') THEN
    PERFORM cron.unschedule('vdnx-ai-calls');
  END IF;
  PERFORM cron.schedule('vdnx-ai-calls', '* * * * *', $cron$
    SELECT net.http_post(
      url := 'https://project--4cf4e7bb-3d7d-41f9-959a-b8d854de8d47.lovable.app/api/public/v1/ai-calls/run',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', '20f17eb667bcc31e04671eb7f8fb0b785ceb5fbb86954e10ba83bda253597321'
      ),
      body := '{}'::jsonb
    );
  $cron$);

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vdnx-calls-reconcile') THEN
    PERFORM cron.unschedule('vdnx-calls-reconcile');
  END IF;
  PERFORM cron.schedule('vdnx-calls-reconcile', '*/5 * * * *', $cron$
    SELECT net.http_post(
      url := 'https://project--4cf4e7bb-3d7d-41f9-959a-b8d854de8d47.lovable.app/api/public/v1/calls/reconcile',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', '20f17eb667bcc31e04671eb7f8fb0b785ceb5fbb86954e10ba83bda253597321'
      ),
      body := '{}'::jsonb
    );
  $cron$);
END $$;