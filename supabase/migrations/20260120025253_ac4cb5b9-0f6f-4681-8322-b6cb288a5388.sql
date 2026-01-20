-- Create profiles table for user information
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  belt_grade TEXT DEFAULT 'branca',
  birth_date DATE,
  registration_status TEXT DEFAULT 'pendente',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create classes table for class/course definitions
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  martial_art TEXT NOT NULL DEFAULT 'judo',
  max_students INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create class_schedule table for scheduled class sessions
CREATE TABLE IF NOT EXISTS public.class_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_cancelled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create class_students table for student enrollments
CREATE TABLE IF NOT EXISTS public.class_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, student_id)
);

-- Create attendance table for tracking student attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  present BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  marked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, student_id, date)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Classes policies (viewable by all authenticated)
CREATE POLICY "Authenticated can view classes"
ON public.classes FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can manage classes"
ON public.classes FOR ALL
USING (auth.role() = 'authenticated');

-- Class schedule policies
CREATE POLICY "Authenticated can view schedules"
ON public.class_schedule FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can manage schedules"
ON public.class_schedule FOR ALL
USING (auth.role() = 'authenticated');

-- Class students policies
CREATE POLICY "Authenticated can view enrollments"
ON public.class_students FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can manage enrollments"
ON public.class_students FOR ALL
USING (auth.role() = 'authenticated');

-- Attendance policies
CREATE POLICY "Authenticated can view attendance"
ON public.attendance FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can manage attendance"
ON public.attendance FOR ALL
USING (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_schedule_date ON public.class_schedule(date);
CREATE INDEX IF NOT EXISTS idx_class_schedule_class_id ON public.class_schedule(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON public.attendance(class_id, date);
CREATE INDEX IF NOT EXISTS idx_class_students_class ON public.class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_profiles_registration ON public.profiles(registration_status);