import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ClassSchedule {
  id: string;
  name: string;
  schedule: string;
  sensei_name?: string;
}

export function StudentSchedule() {
  const { user } = useAuth();

  const { data: myClasses, isLoading } = useQuery({
    queryKey: ["student-schedule", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("class_students")
        .select(`
          class_id,
          classes:class_id (
            id,
            name,
            schedule,
            sensei_id,
            is_active
          )
        `)
        .eq("student_id", user.id);
      
      if (error) throw error;

      // Filter active classes
      const activeClasses = data?.filter(cs => cs.classes?.is_active) || [];
      const senseiIds = activeClasses
        .map(cs => cs.classes?.sensei_id)
        .filter(Boolean) as string[];
      
      let senseiNames: Record<string, string> = {};
      if (senseiIds.length > 0) {
        const { data: senseis } = await supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", senseiIds);
        
        senseiNames = (senseis || []).reduce((acc, s) => {
          acc[s.user_id] = s.name;
          return acc;
        }, {} as Record<string, string>);
      }

      return activeClasses.map(cs => ({
        id: cs.classes!.id,
        name: cs.classes!.name,
        schedule: cs.classes!.schedule || "Horário não definido",
        sensei_name: cs.classes?.sensei_id ? senseiNames[cs.classes.sensei_id] : undefined,
      })) as ClassSchedule[];
    },
    enabled: !!user?.id,
  });

  // Parse schedule to get day and time
  const parseSchedule = (schedule: string) => {
    // Expected format: "Segunda, Quarta, Sexta - 19:00" or similar
    const parts = schedule.split(" - ");
    return {
      days: parts[0] || schedule,
      time: parts[1] || "",
    };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-60" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!myClasses || myClasses.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum treino agendado</h3>
          <p className="text-muted-foreground">
            Você ainda não está matriculado em nenhuma turma. 
            Entre em contato com seu sensei para se matricular.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">Meus Treinos</h2>
        <Badge variant="secondary">{myClasses.length} turma{myClasses.length !== 1 ? 's' : ''}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {myClasses.map((classItem) => {
          const { days, time } = parseSchedule(classItem.schedule);
          
          return (
            <Card key={classItem.id} className="hover:border-accent/30 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                  {classItem.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{days}</span>
                </div>
                {time && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{time}</span>
                  </div>
                )}
                {classItem.sensei_name && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">Sensei: </span>
                    <span className="text-sm font-medium">{classItem.sensei_name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}