-- Step 1: Add new enum values (they will be committed after this migration succeeds)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dono';

-- Step 2: Create dojos table
CREATE TABLE IF NOT EXISTS public.dojos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  -- Theme colors (stored as HSL values without 'hsl()' wrapper, e.g., "220 70% 50%")
  color_primary TEXT DEFAULT '0 72% 51%',
  color_secondary TEXT DEFAULT '0 0% 9%',
  color_background TEXT DEFAULT '0 0% 100%',
  color_foreground TEXT DEFAULT '0 0% 3.9%',
  color_accent TEXT DEFAULT '0 0% 96.1%',
  color_muted TEXT DEFAULT '0 0% 96.1%',
  -- Financial settings
  monthly_fee DECIMAL(10,2) DEFAULT 150.00,
  payment_due_day INTEGER DEFAULT 10,
  pix_key TEXT,
  welcome_message TEXT,
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on dojos
ALTER TABLE public.dojos ENABLE ROW LEVEL SECURITY;

-- Step 3: Create dojo_owners junction table
CREATE TABLE IF NOT EXISTS public.dojo_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dojo_id UUID NOT NULL REFERENCES public.dojos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(dojo_id, user_id)
);

ALTER TABLE public.dojo_owners ENABLE ROW LEVEL SECURITY;

-- Step 4: Create dojo_senseis junction table
CREATE TABLE IF NOT EXISTS public.dojo_senseis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dojo_id UUID NOT NULL REFERENCES public.dojos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(dojo_id, user_id)
);

ALTER TABLE public.dojo_senseis ENABLE ROW LEVEL SECURITY;

-- Step 5: Add dojo_id to existing tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dojo_id UUID REFERENCES public.dojos(id) ON DELETE SET NULL;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS dojo_id UUID REFERENCES public.dojos(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS dojo_id UUID REFERENCES public.dojos(id) ON DELETE SET NULL;

-- Step 6: Create helper functions using PL/pgSQL (works with uncommitted enum values)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'super_admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_dojo_owner(_user_id UUID, _dojo_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.dojo_owners
    WHERE user_id = _user_id AND dojo_id = _dojo_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_dojo_sensei(_user_id UUID, _dojo_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.dojo_senseis
    WHERE user_id = _user_id AND dojo_id = _dojo_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_dojos(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT dojo_id FROM public.dojo_owners WHERE user_id = _user_id
  UNION
  SELECT dojo_id FROM public.dojo_senseis WHERE user_id = _user_id;
END;
$$;

-- Step 7: Create RLS Policies for dojos
CREATE POLICY "Super admins manage dojos"
ON public.dojos
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Owners view their dojos"
ON public.dojos
FOR SELECT
TO authenticated
USING (public.is_dojo_owner(auth.uid(), id));

CREATE POLICY "Owners update their dojos"
ON public.dojos
FOR UPDATE
TO authenticated
USING (public.is_dojo_owner(auth.uid(), id))
WITH CHECK (public.is_dojo_owner(auth.uid(), id));

CREATE POLICY "Senseis view assigned dojos"
ON public.dojos
FOR SELECT
TO authenticated
USING (public.is_dojo_sensei(auth.uid(), id));

-- Step 8: RLS Policies for dojo_owners
CREATE POLICY "Super admins manage dojo owners"
ON public.dojo_owners
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Owners view own associations"
ON public.dojo_owners
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Step 9: RLS Policies for dojo_senseis
CREATE POLICY "Super admins manage dojo senseis"
ON public.dojo_senseis
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Owners manage senseis in dojos"
ON public.dojo_senseis
FOR ALL
TO authenticated
USING (public.is_dojo_owner(auth.uid(), dojo_id))
WITH CHECK (public.is_dojo_owner(auth.uid(), dojo_id));

CREATE POLICY "Senseis view own associations"
ON public.dojo_senseis
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Step 10: Create trigger for updated_at on dojos
CREATE TRIGGER update_dojos_updated_at
BEFORE UPDATE ON public.dojos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();