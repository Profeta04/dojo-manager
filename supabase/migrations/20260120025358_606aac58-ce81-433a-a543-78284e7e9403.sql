-- Create app_role enum
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'dono', 'admin', 'sensei', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create other enums
DO $$ BEGIN
    CREATE TYPE public.payment_status AS ENUM ('pendente', 'pago', 'atrasado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.registration_status AS ENUM ('pendente', 'aprovado', 'rejeitado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.belt_grade AS ENUM (
        'branca', 'cinza', 'azul', 'amarela', 'laranja', 'verde', 'roxa', 'marrom',
        'preta_1dan', 'preta_2dan', 'preta_3dan', 'preta_4dan', 'preta_5dan',
        'preta_6dan', 'preta_7dan', 'preta_8dan', 'preta_9dan', 'preta_10dan'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status public.payment_status DEFAULT 'pendente',
  description TEXT,
  reference_month DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  related_id UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create graduation_history table
CREATE TABLE IF NOT EXISTS public.graduation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  from_belt TEXT,
  to_belt TEXT NOT NULL,
  graduation_date DATE NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create guardian_minors table
CREATE TABLE IF NOT EXISTS public.guardian_minors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  minor_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  relationship TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(guardian_user_id, minor_user_id)
);

-- Create dojos table
CREATE TABLE IF NOT EXISTS public.dojos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create dojo_users table
CREATE TABLE IF NOT EXISTS public.dojo_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dojo_id UUID NOT NULL REFERENCES public.dojos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_owner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dojo_id, user_id)
);

-- Add sensei_id to classes
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS sensei_id UUID REFERENCES auth.users(id);
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS dojo_id UUID REFERENCES public.dojos(id);
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS schedule JSONB;

-- Add notes to class_schedule
ALTER TABLE public.class_schedule ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add guardian_user_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_user_id UUID REFERENCES auth.users(id);

-- Enable RLS on new tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graduation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_minors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dojos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dojo_users ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dono') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dono') OR public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for payments
CREATE POLICY "Students can view own payments"
ON public.payments FOR SELECT
USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sensei'));

CREATE POLICY "Admins can manage payments"
ON public.payments FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dono'));

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Authenticated can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for graduation_history
CREATE POLICY "Authenticated can view graduations"
ON public.graduation_history FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage graduations"
ON public.graduation_history FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sensei'));

-- RLS Policies for guardian_minors
CREATE POLICY "Guardians can view their minors"
ON public.guardian_minors FOR SELECT
USING (guardian_user_id = auth.uid() OR minor_user_id = auth.uid());

CREATE POLICY "Admins can manage guardians"
ON public.guardian_minors FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for dojos
CREATE POLICY "Authenticated can view dojos"
ON public.dojos FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage dojos"
ON public.dojos FOR ALL
USING (public.has_role(auth.uid(), 'dono') OR public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for dojo_users
CREATE POLICY "Authenticated can view dojo_users"
ON public.dojo_users FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage dojo_users"
ON public.dojo_users FOR ALL
USING (public.has_role(auth.uid(), 'dono') OR public.has_role(auth.uid(), 'super_admin'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_graduation_student ON public.graduation_history(student_id);
CREATE INDEX IF NOT EXISTS idx_dojo_users_dojo ON public.dojo_users(dojo_id);
CREATE INDEX IF NOT EXISTS idx_dojo_users_user ON public.dojo_users(user_id);