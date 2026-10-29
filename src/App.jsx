import React from 'react';
import { StoreProvider, useRoute, useStore } from './store';
import { ConsoleLanding, ServiceManagement } from './components/Console';
import { WebApp } from './components/WebApp';
import { HealthDashboard } from './ple/Health';
import { Toasts } from './components/ui';

function Router() {
  const { parts, query } = useRoute();
  const { toasts, dismissToast } = useStore();
  let page;
  if (parts[0] === 'app') page = <WebApp parts={parts} query={query} />;
  else if (parts[1] === 'health') page = <HealthDashboard />;
  else if (parts[1]) page = <ServiceManagement section={parts[1]} />;
  else page = <ConsoleLanding />;
  return (
    <>
      {page}
      <Toasts toasts={toasts} dismiss={dismissToast} />
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
