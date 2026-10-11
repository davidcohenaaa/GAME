CREATE OR REPLACE FUNCTION public.schedule_geo_collection(p_url text, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $outer$
BEGIN
  PERFORM cron.unschedule('geo-daily-collection');

  PERFORM cron.schedule(
    'geo-daily-collection',
    '0 2 * * *',
    format($inner$
      select net.http_post(
        url:=%L,
        headers:='{"Content-Type": "application/json", "x-cron-secret": %L}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $inner$, p_url, p_secret)
  );
END;
$outer$;

GRANT EXECUTE ON FUNCTION public.schedule_geo_collection(text, text) TO service_role;
