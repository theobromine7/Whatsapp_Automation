import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout, PageLayout } from "@/components/layout";
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
    <Layout>
      <Switch>
        {/* Full-height pages — no inner padding wrapper */}
        <Route path="/" component={Inbox} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/businesses" component={BusinessList} />

        {/* Padded page layouts */}
        <Route path="/businesses/connect">
          <PageLayout><ConnectWhatsApp /></PageLayout>
        </Route>
        <Route path="/businesses/new">
          <PageLayout><NewBusiness /></PageLayout>
        </Route>
        <Route path="/businesses/:id">
          {(params) => <PageLayout><BusinessDetail /></PageLayout>}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
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
