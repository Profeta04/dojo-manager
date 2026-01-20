import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar, Clock, Users, CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ClassSchedule {
  id: string;
  name: string;
  schedule: string;
  sensei_name?: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  present: boolean;
  class_name: string;
}

interface ScheduledClass {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  class_name: string;
  is_cancelled: boolean;
}

export function StudentSchedule() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Fetch student's classes
  const { data: myClasses, isLoading: loadingClasses } = useQuery({
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

  // Fetch scheduled classes for the month
  const { data: scheduledClasses, isLoading: loadingSchedule } = useQuery({
    queryKey: ["student-scheduled-classes", user?.id, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      if (!user?.id || !myClasses?.length) return [];

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const classIds = myClasses.map(c => c.id);

      const { data, error } = await supabase
        .from("class_schedule")
        .select("id, date, start_time, end_time, class_id, is_cancelled")
        .in("class_id", classIds)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"))
        .order("date")
        .order("start_time");

      if (error) throw error;

      return (data || []).map(s => ({
        id: s.id,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        class_name: myClasses.find(c => c.id === s.class_id)?.name || "Treino",
        is_cancelled: s.is_cancelled || false,
      })) as ScheduledClass[];
    },
    enabled: !!user?.id && !!myClasses?.length,
  });

  // Fetch attendance history
  const { data: attendanceHistory, isLoading: loadingAttendance } = useQuery({
    queryKey: ["student-attendance-history", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id,
          date,
          present,
          class_id
        `)
        .eq("student_id", user.id)
        .order("date", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get class names
      const classIds = [...new Set(data?.map(a => a.class_id) || [])];
      let classNames: Record<string, string> = {};
      
      if (classIds.length > 0) {
        const { data: classes } = await supabase
          .from("classes")
          .select("id, name")
          .in("id", classIds);
        
        classNames = (classes || []).reduce((acc, c) => {
          acc[c.id] = c.name;
          return acc;
        }, {} as Record<string, string>);
      }

      return (data || []).map(a => ({
        id: a.id,
        date: a.date,
        present: a.present,
        class_name: classNames[a.class_id] || "Treino",
      })) as AttendanceRecord[];
    },
    enabled: !!user?.id,
  });

  // Compute attendance stats
  const attendanceStats = useMemo(() => {
    if (!attendanceHistory?.length) return { total: 0, present: 0, absent: 0, rate: 0 };
    
    const total = attendanceHistory.length;
    const present = attendanceHistory.filter(a => a.present).length;
    const absent = total - present;
    const rate = Math.round((present / total) * 100);
    
    return { total, present, absent, rate };
  }, [attendanceHistory]);

  // Get dates with scheduled classes
  const datesWithClasses = useMemo(() => {
    if (!scheduledClasses) return [];
    return scheduledClasses
      .filter(s => !s.is_cancelled)
      .map(s => new Date(s.date + "T00:00:00"));
  }, [scheduledClasses]);

  // Get dates with attendance
  const datesWithAttendance = useMemo(() => {
    if (!attendanceHistory) return { present: [], absent: [] };
    return {
      present: attendanceHistory.filter(a => a.present).map(a => new Date(a.date + "T00:00:00")),
      absent: attendanceHistory.filter(a => !a.present).map(a => new Date(a.date + "T00:00:00")),
    };
  }, [attendanceHistory]);

  // Get schedules for selected date
  const selectedDateSchedules = useMemo(() => {
    if (!scheduledClasses) return [];
    return scheduledClasses.filter(s => 
      isSameDay(new Date(s.date + "T00:00:00"), selectedDate)
    );
  }, [scheduledClasses, selectedDate]);

  // Get attendance for selected date
  const selectedDateAttendance = useMemo(() => {
    if (!attendanceHistory) return [];
    return attendanceHistory.filter(a => 
      isSameDay(new Date(a.date + "T00:00:00"), selectedDate)
    );
  }, [attendanceHistory, selectedDate]);

  const parseSchedule = (schedule: string) => {
    const parts = schedule.split(" - ");
    return { days: parts[0] || schedule, time: parts[1] || "" };
  };

  const formatTime = (time: string) => time.slice(0, 5);

  const isLoading = loadingClasses || loadingSchedule || loadingAttendance;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{myClasses?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Turmas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{attendanceStats.present}</p>
                <p className="text-xs text-muted-foreground">Presenças</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{attendanceStats.absent}</p>
                <p className="text-xs text-muted-foreground">Faltas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{attendanceStats.rate}%</p>
                <p className="text-xs text-muted-foreground">Frequência</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={ptBR}
              className="rounded-md pointer-events-auto"
              modifiers={{
                hasClass: datesWithClasses,
                present: datesWithAttendance.present,
                absent: datesWithAttendance.absent,
              }}
              modifiersClassNames={{
                hasClass: "bg-accent/20 font-bold",
                present: "!bg-success/30 text-success-foreground",
                absent: "!bg-destructive/30 text-destructive-foreground",
              }}
              classNames={{
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              }}
            />

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-accent/20" />
                <span>Treino agendado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-success/30" />
                <span>Presença</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-destructive/30" />
                <span>Falta</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </CardTitle>
            <CardDescription>
              {selectedDateSchedules.length === 0 && selectedDateAttendance.length === 0
                ? "Nenhum treino neste dia"
                : `${selectedDateSchedules.length} treino(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[350px]">
              {selectedDateSchedules.length > 0 || selectedDateAttendance.length > 0 ? (
                <div className="divide-y">
                  {/* Scheduled classes for this day */}
                  {selectedDateSchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={cn(
                        "p-4",
                        schedule.is_cancelled && "opacity-60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-accent" />
                            <span className="font-medium">{schedule.class_name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </span>
                          </div>
                        </div>
                        {schedule.is_cancelled ? (
                          <Badge variant="destructive">Cancelada</Badge>
                        ) : (
                          <Badge variant="outline">Agendada</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Attendance for this day */}
                  {selectedDateAttendance.map((attendance) => (
                    <div key={attendance.id} className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {attendance.present ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="font-medium">{attendance.class_name}</span>
                        </div>
                        <Badge variant={attendance.present ? "default" : "destructive"}>
                          {attendance.present ? "Presente" : "Falta"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                  <Calendar className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum treino neste dia</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* My Classes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Minhas Turmas
          </CardTitle>
          <CardDescription>Turmas em que você está matriculado</CardDescription>
        </CardHeader>
        <CardContent>
          {myClasses && myClasses.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myClasses.map((classItem) => {
                const { days, time } = parseSchedule(classItem.schedule);
                
                return (
                  <div
                    key={classItem.id}
                    className="p-4 rounded-lg border bg-card hover:border-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium">{classItem.name}</p>
                        {classItem.sensei_name && (
                          <p className="text-xs text-muted-foreground">Sensei {classItem.sensei_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{days}</span>
                      </div>
                      {time && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{time}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Você ainda não está matriculado em nenhuma turma.</p>
              <p className="text-sm">Entre em contato com seu sensei para se matricular.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Histórico de Presenças
          </CardTitle>
          <CardDescription>Últimos 50 registros de presença</CardDescription>
        </CardHeader>
        <CardContent>
          {attendanceHistory && attendanceHistory.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {attendanceHistory.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {record.present ? (
                      <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-success" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                        <XCircle className="h-4 w-4 text-destructive" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{record.class_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(record.date + "T00:00:00"), "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <Badge variant={record.present ? "default" : "destructive"}>
                    {record.present ? "Presente" : "Falta"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro de presença encontrado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}