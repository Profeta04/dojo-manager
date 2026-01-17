import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Palette } from "lucide-react";
import { DojoManagement } from "@/components/settings/DojoManagement";
import { DojoThemeSettings } from "@/components/settings/DojoThemeSettings";

export default function Settings() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, isDono, isSensei, loading: authLoading } = useAuth();

  // Admin has full access, Sensei can also manage dojos
  const canAccessSettings = isAdmin || isSuperAdmin || isDono || isSensei;
  const canManageDojos = isSuperAdmin || isAdmin || isSensei;

  // Redirect if not authorized
  if (!authLoading && !canAccessSettings) {
    navigate("/dashboard");
    return null;
  }

  if (authLoading) {
    return (
      <DashboardLayout>
        <LoadingSpinner />
      </DashboardLayout>
    );
  }

  // Removed: Sensei now has access to full settings including Dojo management

  return (
    <DashboardLayout>
      <PageHeader
        title="Configurações"
        description="Personalize as configurações do sistema"
      />

      <Tabs defaultValue="dojos" className="mt-6 space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="dojos" className="gap-2">
            <Building2 className="h-4 w-4" aria-hidden="true" />
            Dojos
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-2">
            <Palette className="h-4 w-4" aria-hidden="true" />
            Tema
          </TabsTrigger>
        </TabsList>

        {/* Dojos Management - Admin and Super Admin */}
        <TabsContent value="dojos" className="space-y-6">
          <DojoManagement />
        </TabsContent>

        {/* Theme Settings */}
        <TabsContent value="theme" className="space-y-6">
          <DojoThemeSettings />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
