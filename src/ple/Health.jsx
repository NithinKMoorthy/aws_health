import React, { useState } from 'react';
import { fmtDate, fmtDateTime, TENANT } from '../data';
import { navigate, useStore } from '../store';
import { ConsoleFooter, ConsoleTopBar } from '../components/Console';
import { Alert, Button, Container, Icon, KeyValue, Link, Status, Table, Tabs, TransformLogo } from '../components/ui';
import { OTHER_ACCOUNT } from './data';
import { CM_CUSTOMER_KEY } from './reducer';
import { DemoPanel, deepLink, unit } from './common';

// Screen 1: AWS Health Dashboard → Scheduled changes → PLE detail, with the
// "Remediate with AWS Transform" call to action.

const NAV = [
  ['account', 'Your account health'],
  ['org', 'Your organization health'],
  ['scheduled', 'Scheduled changes'],
  ['other', 'Other notifications'],
  ['log', 'Event log'],
];

export function isCmCustomer(state) {
  let stored = null;
  try {
    stored = window.localStorage.getItem(CM_CUSTOMER_KEY);
  } catch {
    stored = null;
  }
  return state.ple.onboarded || stored === '1';
}

export function openDeepLink(event, account) {
  // Production opens a new browser tab; the mock does the same.
  window.open(`${window.location.pathname}${deepLink(event, account)}`, '_blank', 'noopener');
}

export function HealthDashboard({ id, query }) {
  const { state } = useStore();
  const event = id && state.ple.events.find((e) => e.id === id);
  return (
    <div className="console">
      <ConsoleTopBar />
      <div className="console-subbar">
        <Icon.menu />
        <nav className="breadcrumbs">
          <Link onClick={() => navigate('/console/health')}>AWS Health</Link>
          <span className="sep">›</span>
          <Link onClick={() => navigate('/console/health')}>Scheduled changes</Link>
          {event && (
            <>
              <span className="sep">›</span>
              <span className="current">{event.title}</span>
            </>
          )}
        </nav>
      </div>
      <div className="console-layout">
        <aside className="console-sidenav">
          <h2>AWS Health</h2>
          {NAV.map(([k, label]) => (
            <a key={k} className={k === 'scheduled' ? 'active' : ''} onClick={() => navigate('/console/health')}>
              {label}
            </a>
          ))}
          <hr />
          <Link external>Health API documentation</Link>
        </aside>
        <main className="console-main">{event ? <EventDetail event={event} query={query} /> : <ScheduledChanges />}</main>
      </div>
      <ConsoleFooter />
    </div>
  );
}

function ScheduledChanges() {
  const { state } = useStore();
  const rows = [...state.ple.events].sort((a, b) => a.changeDate.localeCompare(b.changeDate));
  return (
    <>
      <h1 className="page-title">Scheduled changes</h1>
      <p className="page-desc">Upcoming changes to AWS services and resources in your account, including planned lifecycle events (PLEs).</p>
      <Container header={`Scheduled changes (${rows.length})`}>
        <Table
          columns={[
            { id: 'title', header: 'Event', cell: (e) => <Link onClick={() => navigate(`/console/health/${e.id}`)}>{e.title}</Link> },
            { id: 'service', header: 'Service', cell: (e) => e.service },
            { id: 'status', header: 'Status', cell: () => <Status value="Upcoming" /> },
            { id: 'date', header: 'Change date', cell: (e) => fmtDate(e.changeDate) },
            { id: 'region', header: 'Region', cell: () => TENANT.region },
            { id: 'res', header: 'Affected resources', cell: (e) => e.resources.length },
          ]}
          rows={rows}
        />
      </Container>
      <HealthDemo />
    </>
  );
}

function RemediateCard({ event, cm }) {
  const n = event.resources.length;
  return (
    <section className="container atx-card">
      <div className="atx-card-body">
        <TransformLogo size={36} />
        <div className="grow">
          <h2>Remediate with AWS Transform</h2>
          <p>
            AWS Transform can upgrade the code behind these {n} {event.service} {unit(event, n)} and open pull requests for your teams.
          </p>
          <p className="muted small">
            {event.td ? `Uses ${event.tdLabel} (AWS-managed transformation).` : 'AWS Transform generates a specialized skill for this change.'}
          </p>
        </div>
        <Button variant="primary" onClick={() => openDeepLink(event, TENANT.account)} iconRight={<Icon.external style={{ marginLeft: 6 }} />}>
          {cm ? 'Open in AWS Transform' : 'Remediate with AWS Transform'}
        </Button>
      </div>
    </section>
  );
}

function EventDetail({ event, query }) {
  const { state } = useStore();
  const [tab, setTab] = useState(query.tab ?? 'details');
  const cm = isCmCustomer(state);
  const accounts = [...new Set(event.resources.map((r) => r.account))];
  const n = event.resources.length;
  return (
    <>
      <div className="health-head">
        <h1 className="page-title">{event.title}</h1>
        <div className="health-meta">
          <span className="badge badge-blue">Upcoming</span>
          <span>Change date <strong>{fmtDate(event.changeDate)}</strong></span>
          <span className="meta-sep" />
          <span>{TENANT.region}</span>
        </div>
      </div>
      <Tabs
        tabs={[
          { id: 'details', label: 'Details' },
          { id: 'resources', label: `Affected resources (${n})` },
          { id: 'accounts', label: `Affected accounts (${accounts.length})` },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'details' && (
        <>
          {event.codeChange && event.repos.length > 0 && <RemediateCard event={event} cm={cm} />}
          <Container header="Event details">
            <KeyValue
              columns={3}
              items={[
                ['Service', event.service],
                ['Event type', <span className="mono small">{event.eventType}</span>],
                ['Event category', 'Scheduled change'],
                ['Status', <Status value="Upcoming" />],
                ['Region', TENANT.region],
                ['Start time', fmtDate(event.start)],
                ['Change date', fmtDate(event.changeDate)],
                ['Last update time', fmtDateTime(state.ple.lastHealthSync)],
                ['Affected accounts', accounts.length],
              ]}
            />
          </Container>
          <Container header="Description">
            <p className="pre">{event.description}</p>
          </Container>
        </>
      )}
      {tab === 'resources' && (
        <>
          {event.codeChange && event.repos.length > 0 && (
            <Alert type="info" action={<Button onClick={() => openDeepLink(event, TENANT.account)}>{cm ? 'Open in AWS Transform' : 'Remediate'}</Button>}>
              <Link onClick={() => openDeepLink(event, TENANT.account)}>Remediate these {unit(event, 2)} with AWS Transform →</Link>
            </Alert>
          )}
          <Container header={`Affected resources (${n})`}>
            <Table
              rowKey={(r) => r.arn}
              columns={[
                { id: 'arn', header: 'Resource ARN', cell: (r) => <span className="mono small">{r.arn}</span> },
                { id: 'acct', header: 'Account', cell: (r) => r.account },
                { id: 'region', header: 'Region', cell: () => TENANT.region },
                { id: 'status', header: 'Status', cell: (r) => <Status value={r.status} /> },
              ]}
              rows={event.resources}
            />
          </Container>
        </>
      )}
      {tab === 'accounts' && (
        <Container header={`Affected accounts (${accounts.length})`}>
          <Table
            rowKey={(a) => a}
            columns={[
              { id: 'acct', header: 'Account ID', cell: (a) => a },
              { id: 'res', header: 'Affected resources', cell: (a) => event.resources.filter((r) => r.account === a).length },
              { id: 'pending', header: 'Pending', cell: (a) => event.resources.filter((r) => r.account === a && r.status === 'PENDING').length },
            ]}
            rows={accounts}
          />
        </Container>
      )}
      <HealthDemo event={event} />
    </>
  );
}

function HealthDemo({ event }) {
  const { state, notify } = useStore();
  const cm = isCmCustomer(state);
  const setCustomer = (on) => {
    try {
      if (on) window.localStorage.setItem(CM_CUSTOMER_KEY, '1');
      else window.localStorage.removeItem(CM_CUSTOMER_KEY);
    } catch {
      /* storage unavailable */
    }
    notify(on ? 'Existing CM customer: reloading.' : 'New customer: reloading.', 'info');
    setTimeout(() => window.location.reload(), 400);
  };
  const nonCode = state.ple.events.find((e) => !e.codeChange);
  return (
    <DemoPanel>
      <div className="demo-row">
        <span>Customer: <strong>{cm ? 'existing CM customer' : 'new to CM'}</strong></span>
        <Button onClick={() => setCustomer(!cm)}>{cm ? 'Reset to new customer' : 'Make existing CM customer'}</Button>
      </div>
      {event && (
        <div className="demo-row">
          <span>Deep link from an account that can't see this PLE</span>
          <Button onClick={() => openDeepLink(event, OTHER_ACCOUNT)}>Open as {OTHER_ACCOUNT}</Button>
        </div>
      )}
      {nonCode && (
        <div className="demo-row">
          <span>Not a code change (card hidden)</span>
          <Button onClick={() => navigate(`/console/health/${nonCode.id}`)}>{nonCode.title}</Button>
        </div>
      )}
    </DemoPanel>
  );
}
