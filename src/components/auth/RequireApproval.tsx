import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PendingApprovalScreen } from "./PendingApprovalScreen";

interface RequireApprovalProps {
  children: ReactNode;
}

export function RequireApproval({ children }: RequireApprovalProps) {
  const navigate = useNavigate();
  const { user, loading, isPending } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null;
  }

  if (isPending) {
    return <PendingApprovalScreen />;
  }

  return <>{children}</>;
}
