import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout, PageLayout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Inbox from "@/pages/inbox";
import Dashboard from "@/pages/dashboard";
import BusinessList from "@/pages/businesses/list";
import NewBusiness from "@/pages/businesses/new";
import BusinessDetail from "@/pages/businesses/detail";
import ConnectWhatsApp from "@/pages/businesses/connect";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to={`/login?from=${encodeURIComponent(location)}`} />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public pages */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />

      {/* Protected app pages — inside sidebar layout */}
      <Route>
        <ProtectedRoute>
          <Layout>
            <Switch>
              <Route path="/inbox" component={Inbox} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/businesses" component={BusinessList} />
              <Route path="/businesses/connect">
                <PageLayout><ConnectWhatsApp /></PageLayout>
              </Route>
              <Route path="/businesses/new">
                <PageLayout><NewBusiness /></PageLayout>
              </Route>
              <Route path="/businesses/:id">
                {() => <PageLayout><BusinessDetail /></PageLayout>}
              </Route>
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
