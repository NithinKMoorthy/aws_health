import React, { useState } from 'react';
import { fmtDate } from '../data';
import { useStore } from '../store';
import { Button, ButtonDropdown, Container, CopyText, Icon, Link, SearchInput, Status, Table } from '../components/ui';

const COMMON = [
  { title: 'Enable the dispatcher', stack: 'AtxDispatcherStack', type: 'Dispatcher', button: 'Deploy queue infrastructure' },
  { title: 'Enable scheduled runs', stack: 'atx-scheduler', type: 'Scheduler', button: 'Deploy scheduling infrastructure' },
  {
    title: 'Enable security analysis',
    stack: 'AtxSecurityAgentStack-<region>',
    deployName: 'AtxSecurityAgentStack-us-east-1',
    type: 'Security agent',
    button: 'Deploy security infrastructure',
    hint: 'Replace <region> with the target Region, for example AtxSecurityAgentStack-us-west-2.',
  },
];

const INSTRUCTIONS = `AWS Transform continuous modernization – infrastructure setup
Requires administrator access to the target AWS account.

Step 1 — Common infrastructure (once per account)
  - AtxDispatcherStack
  - atx-scheduler
  - AtxSecurityAgentStack-<region>

Step 2 — Team infrastructure
  - AtxInfrastructureStack-<suffix> (AWS Batch, recommended)
  - atx-runner-<suffix> (Amazon EC2, only if you do not want Batch)
`;

export function Settings() {
  const { state, dispatch, notify } = useStore();
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');
  const infra = state.infrastructure;
  const deployed = infra.filter((i) => i.status === 'Deployed').length;
  const statusOf = (name) => infra.find((i) => i.name === name)?.status;

  const deploy = (name, stackType) => {
    if (statusOf(name) === 'Deploying') return;
    dispatch({ type: 'DEPLOY_STACK', name, stackType });
    notify(`Launching CloudFormation stack ${name} (mock).`, 'info');
  };

  const teamItems = [
    { id: 'batch', label: 'AWS Batch (recommended)', description: 'AtxInfrastructureStack' },
    { id: 'ec2', label: 'Amazon EC2', description: 'atx-runner' },
  ];
  const onTeam = (id) => (id === 'batch' ? deploy('AtxInfrastructureStack', 'Batch') : deploy('atx-runner', 'EC2'));

  const rows = infra.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <section className="container">
        <button type="button" className="expander-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Icon.caret className={open ? '' : 'rot'} /> <h2>How to provision infrastructure</h2>
        </button>
        {open && (
          <div className="container-body">
            <h3>Provision without the web application</h3>
            <p className="small">You can provision the infrastructure for analysis and remediation with the following tools.</p>
            <ul className="small">
              <li><strong>Kiro Power</strong> - <Link external>Installing Kiro Power</Link></li>
              <li><strong>Agentic skill</strong> - <Link external>Adding the AWS Transform skill</Link></li>
              <li><strong>AWS Transform CLI</strong> - <Link external>Installing the AWS Transform CLI</Link></li>
            </ul>
            <h3 style={{ marginTop: 22 }}>Provision from the web app</h3>
            <p className="small warn-line">
              <Icon.warn /> You need administrator access to the target AWS account. Need someone else to deploy?{' '}
              <span className="copy-text">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    navigator.clipboard?.writeText(INSTRUCTIONS).catch(() => {});
                    notify('Setup instructions copied.');
                  }}
                >
                  <Icon.copy />
                </button>
                Copy instructions
              </span>
            </p>
            <p className="small">The following steps guide you through creating the required CloudFormation infrastructure.</p>
            <div className="two-col divided">
              <div>
                <h3>Step 1 — Common infrastructure deployed once per account</h3>
                <p className="field-desc">Enter the stack name exactly. One CloudFormation stack per account.</p>
                {COMMON.map((c) => {
                  const st = statusOf(c.deployName ?? c.stack);
                  return (
                    <div key={c.stack} className="stack-block">
                      <div className="field-label">{c.title}</div>
                      <div className="small">
                        <strong>Stack name</strong> - <CopyText text={c.stack} notify={notify} />
                      </div>
                      {c.hint && <p className="field-desc">{c.hint}</p>}
                      <div className="inline-gap">
                        <Button disabled={st === 'Deployed' || st === 'Deploying'} onClick={() => deploy(c.deployName ?? c.stack, c.type)}>
                          {c.button} <Icon.external style={{ marginLeft: 6 }} />
                        </Button>
                        {st && st !== 'Not deployed' && <Status value={st} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <h3>Step 2 — Team infrastructure</h3>
                <p className="field-desc">
                  Deploy more than one only if you need different configurations, for example a different role, security access, or setup, add a suffix to the stack name.
                </p>
                <div className="field-label">Enable analysis &amp; remediation</div>
                <div className="small">
                  <strong>Stack name (AWS Batch, recommended)</strong> - <CopyText text="AtxInfrastructureStack-<suffix>" notify={notify} />
                </div>
                <div className="small" style={{ margin: '4px 0 10px' }}>
                  <strong>Stack name (Amazon EC2, only if you do not want Batch)</strong> - <CopyText text="atx-runner-<suffix>" notify={notify} />
                </div>
                <ButtonDropdown label="Deploy analysis and remediation infrastructure" items={teamItems} onItem={onTeam} />
              </div>
            </div>
          </div>
        )}
      </section>

      <Container
        header={<>Infrastructure <span className="muted">({deployed}/{infra.length})</span></>}
        description="Deploy infrastructure in your account to run analysis within your VPC. Use this when you need data to stay in your network. You own and manage these resources."
        actions={
          <>
            <button type="button" className="icon-btn round" aria-label="Refresh" onClick={() => notify('Infrastructure status refreshed.', 'info')}>
              <Icon.refresh />
            </button>
            <ButtonDropdown
              variant="primary"
              label="Deploy infrastructure"
              onItem={(id) => {
                const map = {
                  dispatcher: ['AtxDispatcherStack', 'Dispatcher'],
                  scheduler: ['atx-scheduler', 'Scheduler'],
                  security: ['AtxSecurityAgentStack-us-east-1', 'Security agent'],
                  batch: ['AtxInfrastructureStack', 'Batch'],
                  ec2: ['atx-runner', 'EC2'],
                };
                deploy(...map[id]);
              }}
              items={[
                { id: 'dispatcher', label: 'Dispatcher', disabled: statusOf('AtxDispatcherStack') === 'Deployed' },
                { id: 'scheduler', label: 'Scheduler', disabled: statusOf('atx-scheduler') === 'Deployed' },
                { id: 'security', label: 'Security agent', disabled: statusOf('AtxSecurityAgentStack-us-east-1') === 'Deployed' },
                { id: 'batch', label: 'AWS Batch', disabled: statusOf('AtxInfrastructureStack') === 'Deployed' },
                { id: 'ec2', label: 'Amazon EC2 runner', disabled: statusOf('atx-runner') === 'Deployed' },
              ]}
            />
          </>
        }
      >
        <div className="filters">
          <SearchInput value={search} onChange={setSearch} placeholder="Find infrastructure" width={500} />
        </div>
        <Table
          rowKey={(r) => r.name}
          rows={rows}
          columns={[
            { id: 'name', header: 'CloudFormation stack name', cell: (r) => (r.status === 'Not deployed' ? r.name : <Link className="link underline" external>{r.name}</Link>) },
            { id: 'status', header: 'Status', cell: (r) => <Status value={r.status} /> },
            { id: 'type', header: 'Type', cell: (r) => r.type },
            { id: 'at', header: 'Deployed at', cell: (r) => fmtDate(r.deployedAt) },
          ]}
        />
      </Container>
    </div>
  );
}
