import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, CalendarDays, ClipboardCheck } from "lucide-react";
import { ClassesTab } from "@/components/classes/ClassesTab";
import { ScheduleTab } from "@/components/classes/ScheduleTab";
import { AttendanceTab } from "@/components/classes/AttendanceTab";

export default function Classes() {
  const { canManageStudents, loading: authLoading } = useAuth();

  if (authLoading) {
    return <DashboardLayout><LoadingSpinner /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <PageHeader title="Turmas" description="Gerencie turmas, agenda e presenças" />

      <Tabs defaultValue="classes" className="mt-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="classes" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Turmas</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Agenda</span>
          </TabsTrigger>
          {canManageStudents && (
            <TabsTrigger value="attendance" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Presenças</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="classes" className="mt-6">
          <ClassesTab />
        </TabsContent>

        <TabsContent value="schedule" className="mt-6">
          <ScheduleTab />
        </TabsContent>

        {canManageStudents && (
          <TabsContent value="attendance" className="mt-6">
            <AttendanceTab />
          </TabsContent>
        )}
      </Tabs>
    </DashboardLayout>
  );
}
