import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { BeltBadge } from "@/components/shared/BeltBadge";
import { RegistrationStatusBadge } from "@/components/shared/StatusBadge";
import { StudentReportDialog } from "@/components/students/StudentReportDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, UserCheck, UserX, Clock, Mail, Loader2, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface GuardianWithMinors {
  guardian: Profile;
  minors: Profile[];
}

export default function Students() {
  const navigate = useNavigate();
  const { user, canManageStudents, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedGuardians, setExpandedGuardians] = useState<Set<string>>(new Set());

  const { data: students, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      // Get all users with sensei role (to exclude them)
      const { data: senseiRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sensei");

      const senseiUserIds = senseiRoles?.map((r) => r.user_id) || [];

      // Get all users with admin role (to exclude them)
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const adminUserIds = adminRoles?.map((r) => r.user_id) || [];

      // Get all guardians (users who have minors linked to them)
      const { data: guardianProfiles } = await supabase
        .from("profiles")
        .select("guardian_user_id")
        .not("guardian_user_id", "is", null);

      const guardianUserIds = [...new Set(guardianProfiles?.map((p) => p.guardian_user_id).filter(Boolean) || [])];

      // Exclude senseis, admins, and guardians
      const excludeIds = [...senseiUserIds, ...adminUserIds, ...guardianUserIds];

      // Get all profiles that are students (not admins, senseis, or guardians)
      let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });

      // Exclude senseis, admins, and guardians
      if (excludeIds.length > 0) {
        query = query.not("user_id", "in", `(${excludeIds.join(",")})`);
      }

      const { data: profiles } = await query;

      return profiles || [];
    },
    enabled: !!user && canManageStudents,
  });

  // Fetch guardians with their minors
  const { data: guardiansWithMinors, isLoading: isLoadingGuardians } = useQuery({
    queryKey: ["guardians-with-minors"],
    queryFn: async () => {
      // Get all profiles that have a guardian (minors)
      const { data: minorProfiles } = await supabase
        .from("profiles")
        .select("*")
        .not("guardian_user_id", "is", null);

      if (!minorProfiles || minorProfiles.length === 0) return [];

      // Get unique guardian user IDs
      const guardianUserIds = [...new Set(minorProfiles.map((p) => p.guardian_user_id).filter(Boolean))] as string[];

      // Fetch guardian profiles
      const { data: guardianProfiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", guardianUserIds);

      if (!guardianProfiles) return [];

      // Group minors by guardian
      const guardiansMap = new Map<string, GuardianWithMinors>();
      
      for (const guardian of guardianProfiles) {
        guardiansMap.set(guardian.user_id, {
          guardian,
          minors: minorProfiles.filter((m) => m.guardian_user_id === guardian.user_id),
        });
      }

      return Array.from(guardiansMap.values());
    },
    enabled: !!user && canManageStudents,
  });

  // Redirect if not authorized (after all hooks)
  if (!authLoading && !canManageStudents) {
    navigate("/dashboard");
    return null;
  }

  const handleApprove = async () => {
    if (!selectedStudent) return;
    setActionLoading(true);

    try {
      // Update profile status
      await supabase
        .from("profiles")
        .update({
          registration_status: "aprovado",
          approved_at: new Date().toISOString(),
          approved_by: user!.id,
        })
        .eq("id", selectedStudent.id);

      // Assign student role
      await supabase.rpc("assign_user_role", {
        _user_id: selectedStudent.user_id,
        _role: "student",
      });

      toast({
        title: "Aluno aprovado!",
        description: `${selectedStudent.name} foi aprovado com sucesso.`,
      });

      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao aprovar aluno",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
      setSelectedStudent(null);
      setActionType(null);
    }
  };

  const handleReject = async () => {
    if (!selectedStudent) return;
    setActionLoading(true);

    try {
      await supabase
        .from("profiles")
        .update({
          registration_status: "rejeitado",
        })
        .eq("id", selectedStudent.id);

      toast({
        title: "Cadastro rejeitado",
        description: `O cadastro de ${selectedStudent.name} foi rejeitado.`,
      });

      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao rejeitar cadastro",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
      setSelectedStudent(null);
      setActionType(null);
    }
  };

  const toggleGuardianExpanded = (guardianId: string) => {
    setExpandedGuardians((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(guardianId)) {
        newSet.delete(guardianId);
      } else {
        newSet.add(guardianId);
      }
      return newSet;
    });
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <LoadingSpinner />
      </DashboardLayout>
    );
  }

  const pendingStudents = students?.filter((s) => s.registration_status === "pendente") || [];
  const approvedStudents = students?.filter((s) => s.registration_status === "aprovado") || [];
  const rejectedStudents = students?.filter((s) => s.registration_status === "rejeitado") || [];

  const StudentTable = ({ data, showActions = false }: { data: Profile[]; showActions?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Faixa</TableHead>
          <TableHead>Status</TableHead>
          {showActions && <TableHead className="text-right">Ações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((student) => (
          <TableRow key={student.id}>
            <TableCell className="font-medium">{student.name}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Mail className="h-3 w-3" />
                {student.email}
              </div>
            </TableCell>
            <TableCell>
              {student.belt_grade ? (
                <BeltBadge grade={student.belt_grade} />
              ) : (
                <span className="text-muted-foreground">Branca</span>
              )}
            </TableCell>
            <TableCell>
              <RegistrationStatusBadge status={student.registration_status || "pendente"} />
            </TableCell>
            {showActions && (
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => {
                      setSelectedStudent(student);
                      setActionType("approve");
                    }}
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setSelectedStudent(student);
                      setActionType("reject");
                    }}
                  >
                    <UserX className="h-4 w-4 mr-1" />
                    Rejeitar
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-8 text-muted-foreground">
      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>{message}</p>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Alunos"
          description="Gerencie os alunos do dojo"
        />
        <StudentReportDialog />
      </div>

      <Tabs defaultValue="pending" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes
            {pendingStudents.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-warning/20 text-warning-foreground rounded-full text-xs">
                {pendingStudents.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Aprovados ({approvedStudents.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <UserX className="h-4 w-4" />
            Rejeitados ({rejectedStudents.length})
          </TabsTrigger>
          <TabsTrigger value="guardians" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Responsáveis ({guardiansWithMinors?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                Cadastros Pendentes de Aprovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingStudents.length > 0 ? (
                <StudentTable data={pendingStudents} showActions />
              ) : (
                <EmptyState message="Nenhum cadastro pendente de aprovação." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-600" />
                Alunos Aprovados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {approvedStudents.length > 0 ? (
                <StudentTable data={approvedStudents} />
              ) : (
                <EmptyState message="Nenhum aluno aprovado ainda." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-red-600" />
                Cadastros Rejeitados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rejectedStudents.length > 0 ? (
                <StudentTable data={rejectedStudents} />
              ) : (
                <EmptyState message="Nenhum cadastro rejeitado." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardians">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Responsáveis e Dependentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingGuardians ? (
                <LoadingSpinner />
              ) : guardiansWithMinors && guardiansWithMinors.length > 0 ? (
                <div className="space-y-4">
                  {guardiansWithMinors.map(({ guardian, minors }) => {
                    const isExpanded = expandedGuardians.has(guardian.id);
                    return (
                      <Card key={guardian.id} className="border-border/50">
                        <CardContent className="p-4">
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => toggleGuardianExpanded(guardian.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{guardian.name}</p>
                                <p className="text-sm text-muted-foreground">{guardian.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">
                                {minors.length} dependente{minors.length !== 1 ? "s" : ""}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="mt-4 pl-13 border-t pt-4">
                              <p className="text-sm font-medium text-muted-foreground mb-3">Dependentes:</p>
                              <div className="space-y-2">
                                {minors.map((minor) => (
                                  <div
                                    key={minor.id}
                                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Users className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <p className="font-medium text-sm">{minor.name}</p>
                                        <p className="text-xs text-muted-foreground">{minor.email}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {minor.belt_grade && <BeltBadge grade={minor.belt_grade} />}
                                      <RegistrationStatusBadge status={minor.registration_status || "pendente"} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState message="Nenhum responsável cadastrado." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!actionType} onOpenChange={() => { setActionType(null); setSelectedStudent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "approve" ? "Aprovar Aluno" : "Rejeitar Cadastro"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "approve"
                ? `Tem certeza que deseja aprovar o cadastro de ${selectedStudent?.name}? O aluno poderá acessar o sistema.`
                : `Tem certeza que deseja rejeitar o cadastro de ${selectedStudent?.name}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={actionType === "approve" ? handleApprove : handleReject}
              className={actionType === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === "approve" ? "Aprovar" : "Rejeitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}