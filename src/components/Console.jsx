import React, { useState } from 'react';
import { TENANT } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Button, Container, CopyText, Icon, KeyValue, Link, Modal, Status, Tabs, TransformLogo } from './ui';

export function ConsoleTopBar() {
  return (
    <header className="console-top">
      <div className="console-top-left">
        <Link onClick={() => navigate('/console')}>
          <span className="aws-wordmark">aws</span>
        </Link>
        <span className="console-sep" />
        <TransformLogo size={22} />
        <span className="console-sep" />
        <Icon.grid />
        <div className="console-search">
          <Icon.search />
          <span>Search</span>
          <span className="console-kbd">[Option+S]</span>
        </div>
      </div>
      <div className="console-top-right">
        <Icon.terminal />
        <Icon.bell />
        <Icon.help />
        <Icon.gear />
        <span className="console-region">
          United States ({TENANT.regionLabel.split(' (')[0]}) <Icon.caret />
        </span>
        <span className="console-account">
          <span className="console-acct-chip">
            nkmoorth ({TENANT.account}) <Icon.caret />
          </span>
          <span>{TENANT.role}</span>
        </span>
      </div>
    </header>
  );
}

export const ConsoleFooter = () => (
  <footer className="console-footer">
    <span>© 2026, Amazon Web Services, Inc. or its affiliates.</span>
    <span>Privacy</span>
    <span>Terms</span>
    <span>Cookie preferences</span>
  </footer>
);

const RegionNotice = () => (
  <Alert type="info">
    AWS Transform may securely transmit data across AWS Regions within your geography for processing. For more information, access{' '}
    <Link external>AWS Transform documentation</Link>.
  </Alert>
);

const capabilities = [
  ['Assess Infrastructure', 'Evaluate on-premises infrastructure for cloud migration. Get TCO analysis and migration planning recommendations.'],
  ['Migrate Workloads', 'Assess, plan, and migrate virtual and physical servers to AWS with automated landing zone creation, network migration, and optimized EC2 instance launch.'],
  ['Modernize Mainframe', 'Analyze, document, and refactor COBOL and PL/I applications into modern Java with agent-assisted decomposition and testing.'],
  ['Modernize Custom Code', 'Upgrade languages, frameworks, SDKs and APIs across your codebases with reusable transformations and continuous modernization.'],
];

export function ConsoleLanding() {
  const { notify } = useStore();
  return (
    <div className="console">
      <ConsoleTopBar />
      <div className="console-subbar">
        <Icon.menu />
      </div>
      <div className="console-notice">
        <RegionNotice />
      </div>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-eyebrow">Migration &amp; Modernization</div>
            <h1>AWS Transform</h1>
            <p className="hero-tag">Agentic modernization of mainframe, VMware, Windows, and custom applications.</p>
            <p className="hero-body">
              AWS Transform is a collaborative enterprise IT transformation workbench powered by expert agents, agentic AI systems, and continuous
              learning that accelerates cloud migration, legacy app modernization, and tech debt reduction. It offers purpose-built transformations
              for mainframe, VMware, and Windows workloads. It also helps modernize any legacy code: from updating frameworks, APIS, or versions to any
              custom transformations.
            </p>
          </div>
          <div className="hero-card">
            <h2>Use AWS Transform</h2>
            <p>Manage users and groups to use the AWS Transform web application, or download AWS Transform CLI for custom code modernization.</p>
            <Button variant="console" onClick={() => navigate('/console/service')}>
              Manage web application users
            </Button>
            <Button variant="console" onClick={() => notify('Opening CLI download page (mock). Install: ' + TENANT.cliInstall, 'info')}>
              Download AWS Transform CLI <Icon.external style={{ marginLeft: 6 }} />
            </Button>
          </div>
        </div>
      </section>
      <section className="console-lower">
        <div className="console-lower-main">
          <h2>With AWS Transform you can</h2>
          <div className="cap-grid">
            {capabilities.map(([t, d]) => (
              <div key={t} className="cap-card">
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-card pricing">
          <h2>Pricing</h2>
          <p>
            Currently, AWS Transform offers migration and modernization of enterprise workloads, such as Windows, server migration (including
            VMware), and mainframe, at no cost, and offers custom transformations for code, APIs, frameworks, and more as a paid feature. You pay for
            AWS resources (e.g. EC2 instances) you create to run your application. You only pay for what you use, as you use it; there are no minimum
            fees and no upfront commitments.
          </p>
          <Link external>Learn more</Link>
        </div>
      </section>
      <button type="button" className="floating-logo" aria-label="Open AWS Transform web application" onClick={() => navigate('/app/chat')}>
        <TransformLogo size={40} />
      </button>
      <ConsoleFooter />
    </div>
  );
}

export function ServiceManagement({ section = 'service' }) {
  const { notify } = useStore();
  const [tab, setTab] = useState('users');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nav = [
    ['service', 'Service management'],
    ['partners', 'Partner agents'],
    ['connectors', 'Connectors'],
  ];
  return (
    <div className="console">
      <ConsoleTopBar />
      <div className="console-subbar">
        <Icon.menu />
        <nav className="breadcrumbs">
          <Link onClick={() => navigate('/console')}>AWS Transform</Link>
          <span className="sep">›</span>
          <span className="current">{nav.find((n) => n[0] === section)[1]}</span>
        </nav>
      </div>
      <div className="console-layout">
        <aside className="console-sidenav">
          <h2>AWS Transform</h2>
          {nav.map(([id, label]) => (
            <a key={id} href={`#/console/${id}`} className={section === id ? 'active' : ''}>
              {label}
            </a>
          ))}
          <hr />
          <Link external>Documentation</Link>
        </aside>
        <main className="console-main">
          <RegionNotice />
          {section === 'service' && (
            <>
              <h1 className="page-title">Service management</h1>
              <Container
                header="Your AWS Transform service"
                actions={
                  <Button onClick={() => setConfirmDelete(true)}>
                    Delete
                  </Button>
                }
              >
                <div className="two-col divided">
                  <div>
                    <div className="kv-key">Web application URL (with IAM)</div>
                    <div className="kv-value">
                      <span className="copy-text">
                        <button type="button" className="icon-btn" aria-label="Copy" onClick={() => notify('Copied to clipboard')}>
                          <Icon.copy />
                        </button>
                        <Link onClick={() => navigate('/app/chat')}>{TENANT.webAppUrl}</Link>
                      </span>
                    </div>
                    <div className="kv-key" style={{ marginTop: 16 }}>Service profile ARN</div>
                    <div className="kv-value">
                      <CopyText text={TENANT.profileArn} notify={notify} />
                    </div>
                  </div>
                  <div>
                    <div className="kv-key">
                      CLI install command <Link external>View install instruction</Link>
                    </div>
                    <div className="kv-value">
                      <CopyText text={TENANT.cliInstall} notify={notify} />
                    </div>
                    <div className="kv-key" style={{ marginTop: 16 }}>Tenant ID</div>
                    <div className="kv-value">
                      <CopyText text={TENANT.tenantId} notify={notify} />
                    </div>
                  </div>
                </div>
              </Container>
              <Tabs
                tabs={[
                  { id: 'users', label: 'Users' },
                  { id: 'settings', label: 'Settings' },
                ]}
                active={tab}
                onChange={setTab}
              />
              {tab === 'users' ? (
                <Container header="User access">
                  <KeyValue
                    columns={2}
                    items={[
                      ['Access model', 'IAM-only access'],
                      ['IAM access', <Status value="Active">Enabled</Status>],
                    ]}
                  />
                </Container>
              ) : (
                <Container header="Settings">
                  <KeyValue
                    columns={2}
                    items={[
                      ['Region', TENANT.regionLabel],
                      ['Cross-region processing', 'Enabled within geography'],
                      ['Encryption', 'AWS owned key'],
                      ['Chat retention', '30 days'],
                    ]}
                  />
                </Container>
              )}
            </>
          )}
          {section !== 'service' && (
            <>
              <h1 className="page-title">{nav.find((n) => n[0] === section)[1]}</h1>
              <Container>
                <div className="empty-state">
                  <strong>No {section === 'partners' ? 'partner agents' : 'connectors'}</strong>
                  <p className="muted">
                    {section === 'partners'
                      ? 'Partner agents extend AWS Transform with third-party expertise.'
                      : 'Connectors link AWS Transform to external systems such as source control and ticketing.'}
                  </p>
                </div>
              </Container>
            </>
          )}
        </main>
      </div>
      {confirmDelete && (
        <Modal
          title="Delete AWS Transform service?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button variant="link" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setConfirmDelete(false);
                  notify('Delete is disabled in this mock.', 'info');
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <Alert type="warning">Deleting the service removes the web application, all users' access, and all workspace data. This can't be undone.</Alert>
        </Modal>
      )}
      <ConsoleFooter />
    </div>
  );
}
