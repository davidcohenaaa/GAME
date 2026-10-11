REVOKE ALL ON FUNCTION public.schedule_geo_collection(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_geo_collection(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.schedule_geo_collection(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.schedule_geo_collection(text, text) TO service_role;