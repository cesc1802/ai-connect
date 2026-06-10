import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/shell/app-shell";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { OverviewScreen } from "@/screens/overview-screen";
import { MembersScreen } from "@/screens/members-screen";
import { WorkspacesListScreen } from "@/screens/workspaces-list-screen";
import { WorkspaceDetailScreen } from "@/screens/workspace-detail-screen";
import { PermissionsScreen } from "@/screens/permissions-screen";
import { MatrixScreen } from "@/screens/matrix-screen";
import { ProvidersScreen } from "@/screens/providers-screen";
import { TemplatesScreen } from "@/screens/templates-screen";
import { ChatScreen } from "@/screens/chat-screen";
import { ChatStoreProvider } from "@/lib/chat-context";
import { PlaceholderScreen } from "@/screens/placeholder-screen";
import { LoginScreen } from "@/screens/login-screen";

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginScreen />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
        <Route index element={<OverviewScreen />} />
        <Route
          path="chat"
          element={
            <ChatStoreProvider>
              <ChatScreen />
            </ChatStoreProvider>
          }
        />
        <Route path="members" element={<MembersScreen />} />
        <Route path="workspaces" element={<WorkspacesListScreen />} />
        <Route path="workspaces/:id" element={<WorkspaceDetailScreen />} />
        <Route path="permissions" element={<PermissionsScreen />} />
        <Route path="matrix" element={<MatrixScreen />} />
        <Route path="providers" element={<ProvidersScreen />} />
        <Route path="templates" element={<TemplatesScreen />} />
        <Route path="billing" element={<PlaceholderScreen title="Thanh toán" description="Quản lý gói, hoá đơn, hạn mức sử dụng." />} />
        <Route path="settings" element={<PlaceholderScreen title="Cài đặt" description="Cấu hình tổ chức, SSO, audit log." />} />
      </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
