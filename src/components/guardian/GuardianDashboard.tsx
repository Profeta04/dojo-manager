import { useState } from "react";
import { useGuardianMinors } from "@/hooks/useGuardianMinors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BeltBadge } from "@/components/shared/BeltBadge";
import { RegistrationStatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Users, ChevronRight, CreditCard, GraduationCap, Calendar, ArrowLeft } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { GuardianMinorDetails } from "./GuardianMinorDetails";

type Profile = Tables<"profiles">;

export function GuardianDashboard() {
  const { minors, loading, hasMinors } = useGuardianMinors();
  const [selectedMinor, setSelectedMinor] = useState<Profile | null>(null);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!hasMinors) {
    return null;
  }

  if (selectedMinor) {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedMinor(null)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para lista de dependentes
        </Button>
        <GuardianMinorDetails minor={selectedMinor} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Área do Responsável</CardTitle>
              <CardDescription>
                Gerencie as informações dos seus dependentes
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {minors.map((minor) => (
              <Card 
                key={minor.id} 
                className="cursor-pointer hover:shadow-md transition-shadow border-border/50 hover:border-primary/30"
                onClick={() => setSelectedMinor(minor)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-foreground">{minor.name}</h3>
                      <div className="flex flex-wrap gap-2">
                        {minor.belt_grade && (
                          <BeltBadge grade={minor.belt_grade} />
                        )}
                        {minor.registration_status && (
                          <RegistrationStatusBadge status={minor.registration_status} />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{minor.email}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-border/50 flex gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      <span>Pagamentos</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      <span>Graduações</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Presenças</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
