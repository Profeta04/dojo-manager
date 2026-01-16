-- Create function to notify student when a task is assigned
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
  assigner_name TEXT;
BEGIN
  -- Get the name of the person who assigned the task
  SELECT name INTO assigner_name
  FROM public.profiles
  WHERE user_id = NEW.assigned_by;

  -- Create notification for the student
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (
    NEW.assigned_to,
    'task',
    'Nova tarefa atribuída',
    'Você recebeu uma nova tarefa: "' || NEW.title || '" de ' || COALESCE(assigner_name, 'um Sensei'),
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for task assignment notifications
CREATE TRIGGER on_task_created
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assigned();