import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UserRoleProvider } from "./contexts/UserRoleContext";

// Demo
import SsoLoginDemo from "./pages/SsoLoginDemo";
import ComponentPreview from "./pages/ComponentPreview";

// Landing
import LandingPageV2 from "./pages/landing";
import PreviewIndex from "./pages/PreviewIndex";

// Tenant
import MyAgent from "./pages/tenant/MyOpenClaw";
import AgentDetail from "./pages/tenant/OpenClawDetail";
import OpenClawDetailGuide from "./pages/tenant/OpenClawDetailGuide";
import ModelQuota from "./pages/tenant/ModelQuota";
import HelpDocs from "./pages/tenant/HelpDocs";
import SkillSquare from "./pages/tenant/SkillSquare";
import AgentTemplate from "./pages/admin/AgentTemplate";
import ResetPassword from "./pages/tenant/ResetPassword";

// Admin
import AdminLayout from "./components/AdminLayout";
import BasicInfo from "./pages/admin/BasicInfo";
import PlatformPolicy from "./pages/admin/PlatformPolicy";
import MemberManagement from "./pages/admin/MemberManagement";
import ModelConfig from "./pages/admin/ModelConfig";
import ChannelConfig from "./pages/admin/ChannelConfig";
import SkillConfig from "./pages/admin/SkillConfig";
import ImageManagement from "./pages/admin/ImageManagement";
import SecurityGroupManagement from "./pages/admin/SecurityGroupManagement";
import CloudDevManagement from "./pages/admin/CloudDevManagement";
import AgentMonitor from "./pages/admin/OpenClawMonitor";
import AgentMigration from "./pages/admin/AgentMigration";
import TokensMonitor from "./pages/admin/TokensMonitor";
import AuditLog from "./pages/admin/AuditLog";
import SecurityManagement from "./pages/admin/SecurityManagement";
import SessionManagement from "./pages/admin/SessionManagement";
import SessionDetail from "./pages/admin/SessionDetail";
import OpsObservation from "./pages/admin/OpsObservation";
import MemoryManagement from "./pages/admin/MemoryManagement";
import FileManagement from "./pages/admin/FileManagement";
import SkillDetailPage from "./pages/admin/SkillDetailPage";
import AgentToolLibrary from "./pages/admin/AgentToolLibrary";
import ApiDocs from "./pages/admin/ApiDocs";
import ModeAwareRoute from "./components/ModeAwareRoute";
import StandardBasicInfo from "./pages/admin/standard/StandardBasicInfo";

function Router() {
  return (
    <Switch>
      {/* Landing Page */}
      <Route path="/" component={LandingPageV2} />

      {/* Preview - 全站页面索引，方便 demo */}
      <Route path="/preview" component={PreviewIndex} />

       {/* Demo */}
      <Route path="/demo/sso-login" component={SsoLoginDemo} />
      <Route path="/component-preview/:name" component={ComponentPreview} />

      {/* Tenant Routes */}
      <Route path="/my-openclaw" component={MyAgent} />
      <Route path="/openclaw/:id" component={OpenClawDetailGuide} />
      <Route path="/openclaw-guide" component={OpenClawDetailGuide} />
      <Route path="/openclaw-guide/:id" component={OpenClawDetailGuide} />
      <Route path="/model-quota" component={ModelQuota} />
      <Route path="/skill-square" component={SkillSquare} />
      <Route path="/help-docs" component={HelpDocs} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Admin Routes - 使用顶层路由避免 wouter 嵌套路由匹配问题 */}
      <Route path="/admin/basic-info" component={() => <AdminLayout><ModeAwareRoute standard={<StandardBasicInfo />} custom={<BasicInfo />} /></AdminLayout>} />
      <Route path="/admin/platform-policy" component={() => <AdminLayout><PlatformPolicy /></AdminLayout>} />
      <Route path="/admin/members" component={() => <AdminLayout><MemberManagement /></AdminLayout>} />
      <Route path="/admin/model-config" component={() => <AdminLayout><ModelConfig /></AdminLayout>} />
      <Route path="/admin/channel-config" component={() => <AdminLayout><ChannelConfig /></AdminLayout>} />
      <Route path="/admin/skill-config" component={() => <AdminLayout><SkillConfig /></AdminLayout>} />
      <Route path="/admin/agent-template" component={() => <AdminLayout><AgentTemplate /></AdminLayout>} />
      <Route path="/admin/image-management" component={() => <AdminLayout><ImageManagement /></AdminLayout>} />
      <Route path="/admin/security-group" component={() => <AdminLayout><SecurityGroupManagement /></AdminLayout>} />
      <Route path="/admin/cloud-dev" component={() => <AdminLayout><CloudDevManagement /></AdminLayout>} />
      <Route path="/admin/openclaw-monitor" component={() => <AdminLayout><AgentMonitor /></AdminLayout>} />
      <Route path="/admin/agent-migration" component={() => <AdminLayout><AgentMigration /></AdminLayout>} />
      <Route path="/admin/tokens-monitor" component={() => <AdminLayout><TokensMonitor /></AdminLayout>} />
      <Route path="/admin/security-management" component={() => <AdminLayout><SecurityManagement /></AdminLayout>} />
      <Route path="/admin/session/:id" component={({ params }) => <AdminLayout><SessionDetail params={params} /></AdminLayout>} />
      <Route path="/admin/session-management" component={() => <AdminLayout><SessionManagement /></AdminLayout>} />
      <Route path="/admin/ops-observation" component={() => <AdminLayout><OpsObservation /></AdminLayout>} />
      <Route path="/admin/audit-log" component={() => <AdminLayout><AuditLog /></AdminLayout>} />
      <Route path="/admin/memory-management" component={() => <AdminLayout><MemoryManagement /></AdminLayout>} />
      <Route path="/admin/file-management" component={() => <AdminLayout><FileManagement /></AdminLayout>} />
      <Route path="/admin/skill-detail/:id" component={({ params }) => <AdminLayout><SkillDetailPage skillId={params.id} /></AdminLayout>} />
      <Route path="/admin/agent-tool-library" component={() => <AdminLayout><AgentToolLibrary /></AdminLayout>} />
      <Route path="/admin/api-docs" component={() => <AdminLayout><ApiDocs /></AdminLayout>} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <UserRoleProvider>
          <TooltipProvider>
            <Router />
            <Toaster position="top-right" closeButton />
          </TooltipProvider>
        </UserRoleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
