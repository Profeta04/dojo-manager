import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, GraduationCap, Users, Clock, UserPlus, UserMinus, Loader2, Calendar, Edit, Trash2 } from "lucide-react";
import { z } from "zod";
import { Tables } from "@/integrations/supabase/types";

type Class = Tables<"classes">;
type Profile = Tables<"profiles">;

interface ClassWithDetails extends Class {
  sensei?: Profile;
  students?: Profile[];
  studentCount?: number;
}

const classSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional(),
  schedule: z.string().min(3, "Horário é obrigatório"),
  max_students: z.number().min(1, "Mínimo 1 aluno").optional(),
});

export default function Classes() {
  const navigate = useNavigate();
  const { user, canManageStudents, isAdmin, isSensei, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassWithDetails | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState("");
  const [maxStudents, setMaxStudents] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [editMode, setEditMode] = useState(false);

  // Fetch classes with details
  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data: classesData, error } = await supabase
        .from("classes")
        .select("*")
        .order("name");

      if (error) throw error;
      if (!classesData) return [];

      // Fetch additional details for each class
      const classesWithDetails: ClassWithDetails[] = await Promise.all(
        classesData.map(async (cls) => {
          // Get sensei info
          const { data: senseiProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", cls.sensei_id)
            .single();

          // Get enrolled students
          const { data: enrollments } = await supabase
            .from("class_students")
            .select("student_id")
            .eq("class_id", cls.id);

          let students: Profile[] = [];
          if (enrollments && enrollments.length > 0) {
            const studentIds = enrollments.map((e) => e.student_id);
            const { data: studentProfiles } = await supabase
              .from("profiles")
              .select("*")
              .in("user_id", studentIds);
            students = studentProfiles || [];
          }

          return {
            ...cls,
            sensei: senseiProfile || undefined,
            students,
            studentCount: students.length,
          };
        })
      );

      return classesWithDetails;
    },
    enabled: !!user,
  });

  // Fetch available students (approved, not in selected class)
  const { data: availableStudents } = useQuery({
    queryKey: ["available-students", selectedClass?.id],
    queryFn: async () => {
      if (!selectedClass) return [];

      // Get students with student role
      const { data: studentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");

      if (!studentRoles || studentRoles.length === 0) return [];

      const studentUserIds = studentRoles.map((r) => r.user_id);

      // Get approved profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", studentUserIds)
        .eq("registration_status", "aprovado");

      if (!profiles) return [];

      // Filter out students already enrolled in this class
      const enrolledIds = selectedClass.students?.map((s) => s.user_id) || [];
      return profiles.filter((p) => !enrolledIds.includes(p.user_id));
    },
    enabled: !!selectedClass && enrollDialogOpen,
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setSchedule("");
    setMaxStudents("");
    setEditMode(false);
    setSelectedClass(null);
  };

  const openEditDialog = (cls: ClassWithDetails) => {
    setSelectedClass(cls);
    setName(cls.name);
    setDescription(cls.description || "");
    setSchedule(cls.schedule);
    setMaxStudents(cls.max_students?.toString() || "");
    setEditMode(true);
    setDialogOpen(true);
  };

  const handleCreateOrUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = classSchema.safeParse({
      name,
      description: description || undefined,
      schedule,
      max_students: maxStudents ? parseInt(maxStudents) : undefined,
    });

    if (!validation.success) {
      toast({
        title: "Erro de validação",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setFormLoading(true);

    try {
      const classData = {
        name,
        description: description || null,
        schedule,
        max_students: maxStudents ? parseInt(maxStudents) : null,
        sensei_id: user!.id,
        is_active: true,
      };

      if (editMode && selectedClass) {
        const { error } = await supabase
          .from("classes")
          .update(classData)
          .eq("id", selectedClass.id);

        if (error) throw error;

        toast({
          title: "Turma atualizada!",
          description: `${name} foi atualizada com sucesso.`,
        });
      } else {
        const { error } = await supabase.from("classes").insert(classData);

        if (error) throw error;

        toast({
          title: "Turma criada!",
          description: `${name} foi criada com sucesso.`,
        });
      }

      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar turma",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleEnrollStudent = async () => {
    if (!selectedClass || !selectedStudentId) return;

    setFormLoading(true);

    try {
      const { error } = await supabase.from("class_students").insert({
        class_id: selectedClass.id,
        student_id: selectedStudentId,
      });

      if (error) throw error;

      toast({
        title: "Aluno matriculado!",
        description: "Aluno adicionado à turma com sucesso.",
      });

      setEnrollDialogOpen(false);
      setSelectedStudentId("");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao matricular aluno",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleRemoveStudent = async (studentUserId: string) => {
    if (!selectedClass) return;

    try {
      const { error } = await supabase
        .from("class_students")
        .delete()
        .eq("class_id", selectedClass.id)
        .eq("student_id", studentUserId);

      if (error) throw error;

      toast({
        title: "Aluno removido",
        description: "Aluno removido da turma.",
      });

      queryClient.invalidateQueries({ queryKey: ["classes"] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover aluno",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClass = async () => {
    if (!selectedClass) return;

    setFormLoading(true);

    try {
      // First remove all enrollments
      await supabase
        .from("class_students")
        .delete()
        .eq("class_id", selectedClass.id);

      // Then delete the class
      const { error } = await supabase
        .from("classes")
        .delete()
        .eq("id", selectedClass.id);

      if (error) throw error;

      toast({
        title: "Turma excluída",
        description: `${selectedClass.name} foi excluída.`,
      });

      setDeleteDialogOpen(false);
      setSelectedClass(null);
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir turma",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <LoadingSpinner />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader title="Turmas" description="Gerencie as turmas do dojo" />
        {canManageStudents && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90">
                <Plus className="h-4 w-4 mr-2" />
                Nova Turma
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editMode ? "Editar Turma" : "Criar Nova Turma"}</DialogTitle>
                <DialogDescription>
                  {editMode ? "Atualize as informações da turma." : "Preencha os dados para criar uma nova turma."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateOrUpdateClass} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da turma *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Turma Iniciante"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule">Horário *</Label>
                  <Input
                    id="schedule"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="Ex: Segunda e Quarta, 19h-20h"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxStudents">Máximo de alunos</Label>
                  <Input
                    id="maxStudents"
                    type="number"
                    min="1"
                    value={maxStudents}
                    onChange={(e) => setMaxStudents(e.target.value)}
                    placeholder="Deixe vazio para sem limite"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição opcional da turma"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-accent hover:bg-accent/90" disabled={formLoading}>
                    {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editMode ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {classes && classes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id} className={`${!cls.is_active ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-accent" />
                      {cls.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {cls.sensei?.name ? `Sensei: ${cls.sensei.name}` : ""}
                    </CardDescription>
                  </div>
                  <Badge variant={cls.is_active ? "default" : "secondary"}>
                    {cls.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {cls.schedule}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {cls.studentCount} aluno{cls.studentCount !== 1 ? "s" : ""}
                  {cls.max_students && ` / ${cls.max_students} vagas`}
                </div>

                {cls.description && (
                  <p className="text-sm text-muted-foreground">{cls.description}</p>
                )}

                {/* Enrolled Students List */}
                {cls.students && cls.students.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Alunos matriculados:</p>
                    <div className="flex flex-wrap gap-1">
                      {cls.students.slice(0, 5).map((student) => (
                        <Badge key={student.id} variant="outline" className="text-xs">
                          {student.name?.split(" ")[0]}
                          {canManageStudents && (
                            <button
                              onClick={() => {
                                setSelectedClass(cls);
                                handleRemoveStudent(student.user_id);
                              }}
                              className="ml-1 hover:text-destructive"
                            >
                              <UserMinus className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                      {cls.students.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{cls.students.length - 5}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {canManageStudents && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSelectedClass(cls);
                        setEnrollDialogOpen(true);
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Matricular
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(cls)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setSelectedClass(cls);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Nenhuma turma cadastrada ainda.</p>
            {canManageStudents && (
              <p className="text-sm text-muted-foreground mt-1">
                Clique em "Nova Turma" para criar a primeira.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enroll Student Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Matricular Aluno</DialogTitle>
            <DialogDescription>
              Selecione um aluno para matricular em {selectedClass?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Aluno</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um aluno" />
                </SelectTrigger>
                <SelectContent>
                  {availableStudents && availableStudents.length > 0 ? (
                    availableStudents.map((student) => (
                      <SelectItem key={student.id} value={student.user_id}>
                        {student.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Nenhum aluno disponível
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="bg-accent hover:bg-accent/90"
                onClick={handleEnrollStudent}
                disabled={!selectedStudentId || formLoading}
              >
                {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Matricular
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Turma</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a turma "{selectedClass?.name}"? 
              Esta ação não pode ser desfeita e todos os alunos serão desmatriculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={formLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClass}
              className="bg-destructive hover:bg-destructive/90"
              disabled={formLoading}
            >
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}