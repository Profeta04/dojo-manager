-- Create a function to sync admin users to all dojos
-- This ensures that whenever a dojo is created, all admins are linked to it
-- And whenever an admin role is assigned, they are linked to all dojos

-- Function to link a user to all active dojos
CREATE OR REPLACE FUNCTION public.link_user_to_all_dojos(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert the user into dojo_senseis for all active dojos they're not already linked to
  INSERT INTO public.dojo_senseis (user_id, dojo_id)
  SELECT _user_id, d.id
  FROM public.dojos d
  WHERE d.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.dojo_senseis ds 
      WHERE ds.user_id = _user_id AND ds.dojo_id = d.id
    );
END;
$$;

-- Function to link all admins to a specific dojo
CREATE OR REPLACE FUNCTION public.link_admins_to_dojo(_dojo_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Find all users with admin role and link them to this dojo
  INSERT INTO public.dojo_senseis (user_id, dojo_id)
  SELECT ur.user_id, _dojo_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM public.dojo_senseis ds 
      WHERE ds.user_id = ur.user_id AND ds.dojo_id = _dojo_id
    );
END;
$$;

-- Trigger function to auto-link admins when a new dojo is created
CREATE OR REPLACE FUNCTION public.trigger_link_admins_to_new_dojo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true THEN
    PERFORM public.link_admins_to_dojo(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function to auto-link admin to all dojos when admin role is assigned
CREATE OR REPLACE FUNCTION public.trigger_link_admin_to_all_dojos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    PERFORM public.link_user_to_all_dojos(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on dojos table
DROP TRIGGER IF EXISTS on_dojo_created_link_admins ON public.dojos;
CREATE TRIGGER on_dojo_created_link_admins
  AFTER INSERT ON public.dojos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_link_admins_to_new_dojo();

-- Create trigger on user_roles table
DROP TRIGGER IF EXISTS on_admin_role_assigned ON public.user_roles;
CREATE TRIGGER on_admin_role_assigned
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_link_admin_to_all_dojos();

-- Run initial sync: link all current admins to all current dojos
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  FOR admin_user_id IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    PERFORM public.link_user_to_all_dojos(admin_user_id);
  END LOOP;
END;
$$;