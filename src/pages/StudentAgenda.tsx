import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { RequireApproval } from "@/components/auth/RequireApproval";
import { StudentSchedule } from "@/components/student/StudentSchedule";

export default function StudentAgenda() {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return <DashboardLayout><LoadingSpinner /></DashboardLayout>;
  }

  return (
    <RequireApproval>
      <DashboardLayout>
        <PageHeader 
          title="Minha Agenda" 
          description="Veja seus treinos e horários" 
        />

        <div className="mt-6">
          <StudentSchedule />
        </div>
      </DashboardLayout>
    </RequireApproval>
  );
}