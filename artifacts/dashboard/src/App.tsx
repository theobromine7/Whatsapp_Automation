import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout, PageLayout } from "@/components/layout";
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

function Router() {
  return (
    <Switch>
      {/* Public pages — no layout chrome */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />

      {/* App pages — inside sidebar layout */}
      <Route>
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
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
