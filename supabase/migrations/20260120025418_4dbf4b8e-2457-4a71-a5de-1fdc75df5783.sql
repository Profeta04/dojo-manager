-- Create dojo_senseis table (junction table for dojos and senseis)
CREATE TABLE IF NOT EXISTS public.dojo_senseis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dojo_id UUID NOT NULL REFERENCES public.dojos(id) ON DELETE CASCADE,
  sensei_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dojo_id, sensei_id)
);

-- Create dojo_owners table (junction table for dojos and owners)
CREATE TABLE IF NOT EXISTS public.dojo_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dojo_id UUID NOT NULL REFERENCES public.dojos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dojo_id, user_id)
);

-- Add id column to profiles as an alias for user_id (for compatibility)
-- This is needed because some code references profile.id instead of profile.user_id
-- We'll use a generated column that mirrors user_id
-- Actually, we can't add a generated column that references another column as PK
-- Instead, let's just ensure the code uses user_id

-- Create functions for role management
CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_user_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = _role;
END;
$$;

-- Enable RLS
ALTER TABLE public.dojo_senseis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dojo_owners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dojo_senseis
CREATE POLICY "Authenticated can view dojo_senseis"
ON public.dojo_senseis FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage dojo_senseis"
ON public.dojo_senseis FOR ALL
USING (public.has_role(auth.uid(), 'dono') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for dojo_owners
CREATE POLICY "Authenticated can view dojo_owners"
ON public.dojo_owners FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Super admins can manage dojo_owners"
ON public.dojo_owners FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));