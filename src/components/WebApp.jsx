import React, { useEffect, useState } from 'react';
import { TENANT } from '../data';
import { navigate, useStore } from '../store';
import { ChatPanel } from './Chat';
import { Container, Icon, Link, Table, TransformLogo } from './ui';
import { CMPage } from '../cm/CMPage';
import { PleOnboarding } from '../ple/Onboarding';

function SideNav({ onClose, current }) {
  const { notify } = useStore();
  const [demosOpen, setDemosOpen] = useState(true);
  const go = (path) => {
    navigate(path);
    onClose();
  };
  const ext = (label) => () => notify(`Opens ${label} in a new tab (mock).`, 'info');
  return (
    <>
      <div className="sidenav-backdrop" onClick={onClose} />
      <aside className="sidenav">
        <div className="sidenav-head">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close navigation">
            <Icon.menu />
          </button>
          <span className="brand">AWS Transform</span>
        </div>
        <nav>
          <a className={current === 'cm' ? 'active' : ''} onClick={() => go('/app/cm/dashboard')}>
            Continuous modernization <span className="new-badge">New</span>
          </a>
          <a className={current === 'workspaces' ? 'active' : ''} onClick={() => go('/app/workspaces')}>Workspaces</a>
          <a onClick={ext('AWS Transform CLI download')}>Download AWS Transform CLI <Icon.external /></a>
          <a className={current === 'whats-new' ? 'active' : ''} onClick={() => go('/app/whats-new')}>What's new</a>
          <a onClick={ext('Documentation')}>Documentation <Icon.external /></a>
          <a className="expander" onClick={() => setDemosOpen((o) => !o)}>
            <Icon.caret className={demosOpen ? '' : 'rot'} /> Demos
          </a>
          {demosOpen &&
            ['VMware migration', 'Mainframe modernization', 'Windows modernization', 'Custom / code'].map((d) => (
              <a key={d} className="nested" onClick={ext(`${d} demo`)}>
                {d} <Icon.external />
              </a>
            ))}
          <a onClick={ext('Blog posts')}>Blog posts <Icon.external /></a>
          <a onClick={ext('Success stories')}>Success stories <Icon.external /></a>
          <a onClick={() => go('/console')}>AWS console (mock) </a>
          <a onClick={() => go('/console/health')}>AWS Health Dashboard (mock)</a>
        </nav>
        <p className="sidenav-foot">
          Usage is subject to <Link>AWS Responsible AI Policy</Link>. AWS Transform may retain chats to provide and maintain the service. AWS
          Transform may process data across AWS Regions, see <Link>cross-region processing</Link> for more information.
        </p>
      </aside>
    </>
  );
}

function TopBar({ onMenu }) {
  const { notify } = useStore();
  return (
    <header className="app-top">
      <button type="button" className="icon-btn" onClick={onMenu} aria-label="Open navigation">
        <Icon.menu />
      </button>
      <Link onClick={() => navigate('/app/chat')}>
        <span className="brand">AWS Transform</span>
      </Link>
      <span className="grow" />
      <Link onClick={() => notify('Thanks — feedback form would open here (mock).', 'info')}>
        <strong>Provide feedback</strong>
      </Link>
      <span className="top-sep" />
      <span>{TENANT.regionLabel}</span>
      <span className="avatar">N</span>
    </header>
  );
}

const AppFooter = () => (
  <footer className="app-footer">
    <span>Privacy</span>
    <span>Site terms</span>
    <span>Cookie preferences</span>
    <span>Documentation</span>
    <span>© 2026, Amazon Web Services, Inc. or its affiliates. All rights reserved.</span>
  </footer>
);

function Workspaces() {
  const rows = [
    { id: 'ws-1', name: 'Order system modernization', type: 'Custom / code', updated: 'Aug 24, 2026', owner: 'nkmoorth' },
    { id: 'ws-2', name: 'Mobile tech-debt review', type: 'Continuous modernization', updated: 'Aug 20, 2026', owner: 'nkmoorth' },
  ];
  return (
    <div className="page">
      <h1 className="page-title">Workspaces</h1>
      <Container header={`Workspaces (${rows.length})`}>
        <Table
          columns={[
            { id: 'name', header: 'Name', cell: (r) => <Link onClick={() => navigate(r.type.startsWith('Cont') ? '/app/cm/dashboard' : '/app/chat')}>{r.name}</Link> },
            { id: 'type', header: 'Job type', cell: (r) => r.type },
            { id: 'owner', header: 'Owner', cell: (r) => r.owner },
            { id: 'updated', header: 'Last updated', cell: (r) => r.updated },
          ]}
          rows={rows}
        />
      </Container>
    </div>
  );
}

function WhatsNew() {
  const items = [
    ['Aug 2026', 'Continuous modernization (preview)', 'Connect GitHub, GitLab or Bitbucket organizations, run recurring tech-debt, security and readiness analyses, and remediate findings with transformations.'],
    ['Jul 2026', 'Agentic readiness analysis', 'Assess how well repositories support agent-driven change.'],
    ['Jun 2026', 'AWS Transform Power for Kiro', 'Drive transformations from Kiro, Claude Code, Codex and Cursor via agent skills.'],
  ];
  return (
    <div className="page">
      <h1 className="page-title">What's new</h1>
      {items.map(([date, title, body]) => (
        <Container key={title} header={title} description={date}>
          <p>{body}</p>
        </Container>
      ))}
    </div>
  );
}

export function WebApp({ parts, query }) {
  const [navOpen, setNavOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  // "Walk me through it" opens the chat panel if it's collapsed.
  useEffect(() => {
    const open = () => setChatOpen(true);
    window.addEventListener('atx-chat-prompt', open);
    return () => window.removeEventListener('atx-chat-prompt', open);
  }, []);
  const section = parts[1] ?? 'chat';

  let body;
  if (section === 'cm') {
    body = (
      <div className={`cm-layout ${chatOpen ? '' : 'chat-closed'}`}>
        <div className="cm-main">
          <CMPage parts={parts.slice(2)} query={query} />
        </div>
        <div className="cm-chat">
          <button
            type="button"
            className="chat-toggle"
            onClick={() => setChatOpen((o) => !o)}
            aria-label={chatOpen ? 'Collapse chat' : 'Expand chat'}
            title={chatOpen ? 'Collapse chat' : 'Expand chat'}
          >
            {chatOpen ? '›' : '‹'}
          </button>
          {chatOpen && <ChatPanel variant="panel" />}
        </div>
      </div>
    );
  } else if (section === 'ple') body = <PleOnboarding step={parts[2] ?? 'welcome'} query={query} />;
  else if (section === 'workspaces') body = <Workspaces />;
  else if (section === 'whats-new') body = <WhatsNew />;
  else
    body = (
      <div className="chat-home">
        <ChatPanel variant="full" />
      </div>
    );

  return (
    <div className="app">
      <TopBar onMenu={() => setNavOpen(true)} />
      {navOpen && <SideNav onClose={() => setNavOpen(false)} current={section} />}
      <div className="app-body">{body}</div>
      {section === 'cm' && !chatOpen && (
        <button type="button" className="floating-logo" onClick={() => setChatOpen(true)} aria-label="Open chat">
          <TransformLogo size={40} />
        </button>
      )}
      {section !== 'cm' && <AppFooter />}
    </div>
  );
}
