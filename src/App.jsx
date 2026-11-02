import React from 'react';
import { StoreProvider, useRoute, useStore } from './store';
import { ConsoleLanding, EnableWebApp, ServiceManagement } from './components/Console';
import { WebApp } from './components/WebApp';
import { HealthDashboard } from './ple/Health';
import { Toasts } from './components/ui';
import { Tour } from './ple/Tour';

function Router() {
  const { parts, query } = useRoute();
  const { state, toasts, dismissToast } = useStore();
  let page;
  // A new customer's first stop is enabling the web application; then the page they asked for.
  if (parts[0] === 'app' && !state.ple.webAppEnabled) page = <EnableWebApp query={query} />;
  else if (parts[0] === 'app') page = <WebApp parts={parts} query={query} />;
  else if (parts[1] === 'health') page = <HealthDashboard />;
  else if (parts[1]) page = <ServiceManagement section={parts[1]} />;
  else page = <ConsoleLanding />;
  return (
    <>
      {page}
      <Toasts toasts={toasts} dismiss={dismissToast} />
      <Tour />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
