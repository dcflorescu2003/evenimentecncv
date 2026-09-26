DO $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key';
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'vault secret email_queue_service_role_key not found';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-store-versions-daily') THEN
    PERFORM cron.unschedule('check-store-versions-daily');
  END IF;
  PERFORM cron.schedule(
    'check-store-versions-daily',
    '10 6 * * *',
    format(
      $cmd$SELECT net.http_post(url := 'https://xqfnbxvumznnmjndkhpj.supabase.co/functions/v1/check-store-versions', headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb, body := '{}'::jsonb) AS request_id;$cmd$,
      v_key
    )
  );
END $$;