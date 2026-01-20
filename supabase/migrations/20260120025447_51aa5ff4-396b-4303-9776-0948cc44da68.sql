-- Create get_user_dojos function (fixing 'do' reserved word issue)
CREATE OR REPLACE FUNCTION public.get_user_dojos(_user_id uuid)
RETURNS SETOF public.dojos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.*
  FROM public.dojos d
  INNER JOIN public.dojo_users du ON d.id = du.dojo_id
  WHERE du.user_id = _user_id
  UNION
  SELECT d.*
  FROM public.dojos d
  INNER JOIN public.dojo_owners downers ON d.id = downers.dojo_id
  WHERE downers.user_id = _user_id
  UNION
  SELECT d.*
  FROM public.dojos d
  INNER JOIN public.dojo_senseis ds ON d.id = ds.dojo_id
  WHERE ds.sensei_id = _user_id;
$$;