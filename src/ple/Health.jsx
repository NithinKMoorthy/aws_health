import React, { useState } from 'react';
import { fmtDate, TENANT } from '../data';
import { navigate, useStore } from '../store';
import { ConsoleFooter, ConsoleTopBar } from '../components/Console';
import { Button, Icon, Link, SearchInput, Table } from '../components/ui';
import { daysLeft, OTHER_ACCOUNT } from './data';
import { CM_CUSTOMER_KEY } from './reducer';
import { byDeadline, DemoPanel, deepLink, deepLinkMulti, fixable, fromName, targetName, unit } from './common';

// Screen 1: AWS Health Dashboard → Scheduled changes, with an AWS Transform summary
// of the changes it can fix. Fixable events link straight to their Get started page.

const NAV = [
  ['Service health', ['Open and recent issues', 'Service history']],
  ['Your account health', ['Open and recent issues', 'Scheduled changes', 'Other notifications', 'Event log']],
  ['Your organization health', []],
  ['Health integrations', ['Amazon EventBridge', 'AWS User Notifications']],
];

// How each event reads in AWS Health.
const COPY = {
  'lambda-node16': 'Lambda runtime end of support: Node.js 16',
  'lambda-py310': 'Lambda runtime end of support: Python 3.10',
  'lambda-java11': 'Lambda runtime end of support: Java 11',
  'cache-redis6': 'ElastiCache Redis OSS 6 end of standard support',
  'ecs-retire-1': 'ECS task patching retirement',
  'ecs-retire-2': 'ECS task patching retirement',
  'ec2-retire': 'EC2 instance scheduled retirement',
};
export const healthName = (e) => COPY[e.id] ?? e.title;
const summary = (e) => (fixable(e) ? `Upgrade to ${targetName(e)} before the deadline` : e.summary ?? '');
const count = (e, n) => `${n} ${unit(e, n)}`;
const fmtStart = (e) => `${fmtDate(e.changeDate)}, ${e.time ?? '12:00 AM PST'}`;

// AWS Health lists one row per event per Region.
function healthRows(events) {
  return events.flatMap((e) => {
    const regions = [...new Set(e.resources.map((r) => r.region ?? TENANT.region))];
    return regions.map((region) => ({ key: `${e.id}:${region}`, event: e, region, resources: e.resources.filter((r) => (r.region ?? TENANT.region) === region) }));
  });
}

function Due({ date }) {
  const d = daysLeft(date);
  const months = Math.round(d / 30.4);
  const label = d <= 1 ? 'Tomorrow' : d < 45 ? `In ${d} days` : `In ${months} months`;
  const tone = d <= 14 ? 'urgent' : d < 180 ? 'soon' : 'later';
  return <span className={`due due-${tone}`}>{label}</span>;
}

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
  window.location.hash = deepLink(event, account).slice(1);
  window.scrollTo(0, 0);
}

/** One event opens its own Get started page; several open the combined one. */
function openEvents(events, account) {
  if (events.length === 1) return openDeepLink(events[0], account);
  window.location.hash = deepLinkMulti(byDeadline(events), account).slice(1);
  window.scrollTo(0, 0);
}

export function HealthDashboard() {
  return (
    <div className="console">
      <ConsoleTopBar />
      <div className="console-layout">
        <aside className="console-sidenav health-nav">
          <h2>AWS Health Dashboard</h2>
          {NAV.map(([group, items]) => (
            <div key={group} className="nav-group">
              <div className="nav-group-head">{group}</div>
              {items.map((label) => (
                <a key={label} className={group === 'Your account health' && label === 'Scheduled changes' ? 'active' : ''} onClick={() => navigate('/console/health')}>
                  {label}
                </a>
              ))}
            </div>
          ))}
        </aside>
        <main className="console-main">
          <ScheduledChanges />
        </main>
      </div>
      <ConsoleFooter />
    </div>
  );
}

function TransformSummary({ events }) {
  const { state } = useStore();
  const fix = events.filter(fixable);
  if (!fix.length) return null;
  const rows = healthRows(events);
  const nFixRows = rows.filter((r) => fixable(r.event)).length;
  const total = fix.reduce((n, e) => n + e.resources.length, 0);
  const units = [...new Set(fix.map((e) => unit(e, 2)))];
  const what = units.length === 1 ? units[0] : 'resources';
  const lambdaOnly = fix.every((e) => e.service === 'Lambda');
  const openCm = () => window.open(`${window.location.pathname}#/app/cm/dashboard`, '_blank', 'noopener');
  return (
    <section className="atx-summary">
      <div className="atx-summary-head">
        <span className="atx-summary-icon"><Icon.refresh /></span>
        <div className="grow">
          <h2>AWS Transform can resolve {nFixRows} of these {rows.length} changes</h2>
          <p>
            They affect {total} {lambdaOnly ? `Lambda ${what} on runtimes` : `${what} on versions`} reaching end of support. AWS Transform upgrades each one and opens a pull
            request for you to review.
          </p>
        </div>
        <Link onClick={openCm}><strong>{isCmCustomer(state) ? 'Open continuous modernization' : 'Keep runtimes current automatically'}</strong></Link>
        <button type="button" className="btn btn-atx" onClick={() => openEvents(fix, TENANT.account)}>Upgrade {total} {what}</button>
      </div>
      <div className="atx-summary-cards">
        {fix.map((e) => {
          const n = e.resources.length;
          const k = new Set(e.resources.map((r) => (e.scopeBy === 'regions' ? r.region : r.account))).size;
          const scope = e.scopeBy === 'regions' ? (k === 1 ? 'Region' : 'Regions') : k === 1 ? 'account' : 'accounts';
          return (
            <div key={e.id} className={`atx-mini ${daysLeft(e.changeDate) <= 120 ? 'urgent' : ''}`}>
              <div className="atx-mini-head">
                <strong>{fromName(e)}</strong>
                {daysLeft(e.changeDate) <= 120 ? <span className="due due-urgent">{daysLeft(e.changeDate)} days left</span> : <Due date={e.changeDate} />}
              </div>
              <div className="atx-mini-path">
                <span className="ver-old">{fromName(e)}</span> <span className="arrow">→</span> <span className="ver-new">{targetName(e)}</span>
              </div>
              <div className="muted small">
                {n} {unit(e, n)} in {k} {scope} · {fmtDate(e.changeDate)}
              </div>
              <Link onClick={() => openDeepLink(e, TENANT.account)}><strong>Upgrade {n} {unit(e, n)}</strong></Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScheduledChanges() {
  const { state, notify } = useStore();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState([]);
  const all = [...state.ple.events].sort((a, b) => a.changeDate.localeCompare(b.changeDate));
  const rowsAll = healthRows(all);
  const nFix = rowsAll.filter((r) => fixable(r.event)).length;
  const q = search.trim().toLowerCase();
  const rows = rowsAll
    .filter((r) => filter === 'all' || (filter === 'fix') === fixable(r.event))
    .filter((r) => !q || `${healthName(r.event)} ${summary(r.event)} ${r.event.service} ${r.region}`.toLowerCase().includes(q));
  const open = (e) => openDeepLink(e, TENANT.account);
  const toggle = (key) => setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  const upgradeSelected = () => openEvents(all.filter((e) => picked.some((k) => k.startsWith(`${e.id}:`))), TENANT.account);
  return (
    <>
      <nav className="breadcrumbs health-crumbs">
        <Link onClick={() => navigate('/console/health')}>AWS Health</Link>
        <span className="sep">›</span>
        <span className="current">Scheduled changes</span>
      </nav>
      <div className="health-title">
        <div>
          <h1>
            Scheduled changes <span className="muted">({rowsAll.length})</span>
          </h1>
          <p className="muted">
            Upcoming maintenance and lifecycle events that affect your resources. <Link className="underline">Older than 7 days</Link>
          </p>
        </div>
        <div className="health-title-side">
          <span className="muted small">Updated less than a minute ago</span>
          <Link onClick={() => notify('Opens the Amazon EventBridge console (mock).', 'info')}><strong>Get notified with EventBridge</strong></Link>
        </div>
      </div>
      <TransformSummary events={all} />
      <section className="container health-events">
        <div className="health-toolbar">
          <div className="pills">
            {[['all', `All (${rowsAll.length})`], ['fix', `Fixable with AWS Transform (${nFix})`], ['other', `Other (${rowsAll.length - nFix})`]].map(([k, label]) => (
              <button key={k} type="button" className={`pill ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
          <div className="grow" />
          <SearchInput value={search} onChange={setSearch} placeholder="Find events" width={240} />
          <button type="button" className="btn btn-atx" disabled={!picked.length} onClick={upgradeSelected}>Upgrade selected with AWS Transform</button>
        </div>
        <Table
          rowKey={(r) => r.key}
          columns={[
            { id: 'sel', header: '', width: 44, cell: (r) => (fixable(r.event) ? <input type="checkbox" checked={picked.includes(r.key)} onChange={() => toggle(r.key)} aria-label={`Select ${healthName(r.event)} in ${r.region}`} /> : null) },
            {
              id: 'event',
              header: 'Event',
              cell: (r) => (
                <div className="event-cell">
                  {fixable(r.event) ? <Link onClick={() => open(r.event)}><strong>{healthName(r.event)}</strong></Link> : <Link onClick={() => navigate(`/console/health/${r.event.id}`)}><strong>{healthName(r.event)}</strong></Link>}
                  <div className="muted small">{summary(r.event)}</div>
                </div>
              ),
            },
            { id: 'due', header: 'Due', cell: (r) => <Due date={r.event.changeDate} /> },
            { id: 'region', header: 'Region', cell: (r) => r.region },
            { id: 'start', header: 'Start time', cell: (r) => fmtStart(r.event) },
            { id: 'res', header: 'Affected', cell: (r) => <Link onClick={() => (fixable(r.event) ? open(r.event) : navigate(`/console/health/${r.event.id}`, { tab: 'resources' }))}>{count(r.event, r.resources.length)}</Link> },
            {
              id: 'fix',
              header: 'Resolution',
              cell: (r) =>
                fixable(r.event) ? (
                  <div className="resolution">
                    <a className="health-fix" onClick={() => open(r.event)}>Upgrade with AWS Transform</a>
                    <div className="muted small">Opens a pull request for review</div>
                  </div>
                ) : (
                  <div className="resolution">
                    <span>Manual action</span>
                    <div className="muted small">{r.event.manualAction}</div>
                  </div>
                ),
            },
          ]}
          rows={rows}
          empty="No scheduled changes match the filter."
        />
      </section>
      <HealthDemo event={all.find(fixable)} />
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
    </DemoPanel>
  );
}
