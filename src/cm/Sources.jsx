import React, { useState } from 'react';
import { fmtDate } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Breadcrumbs, Button, Container, FormField, Input, KeyValue, Link, Modal, Pagination, Radio, SearchInput, Status, Table } from '../components/ui';
import { NotFound } from './Findings';

export const PROVIDERS = [
  { value: 'GitHub', label: 'GitHub', description: 'Repositories in a GitHub organization or user at github.com.' },
  { value: 'GitLab', label: 'GitLab', description: 'Repositories in a GitLab group or user at gitlab.com.' },
  { value: 'Bitbucket', label: 'Bitbucket', description: 'Repositories in a Bitbucket Cloud workspace at bitbucket.org.' },
];

/**
 * Connect-source form. The token is only validated for presence and then
 * discarded; this mock never stores or transmits it.
 */
export function useConnectSourceForm(onConnected) {
  const { state, dispatch, notify } = useStore();
  const [provider, setProvider] = useState('GitHub');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [token, setToken] = useState('');
  const [touched, setTouched] = useState(false);
  const dup = state.sources.some((s) => s.name === name.trim());
  const errors = {
    name: !name.trim() ? 'Source name is required' : dup ? 'A source with this name already exists' : !/^[A-Za-z0-9._-]+$/.test(name.trim()) ? 'Use letters, numbers, ".", "_" or "-"' : null,
    token: !token.trim() ? 'Access token is required' : null,
  };
  const submit = () => {
    setTouched(true);
    if (errors.name || errors.token) return false;
    dispatch({ type: 'ADD_SOURCE', name: name.trim(), provider, org: org.trim() });
    setToken('');
    notify(`Connecting source "${name.trim()}"…`, 'info');
    onConnected?.(name.trim());
    return true;
  };
  const err = (k) => (touched ? errors[k] : null);
  const tokenLabel = provider === 'GitHub' ? 'A GitHub personal access token' : provider === 'GitLab' ? 'A GitLab personal access token' : 'A Bitbucket app password';
  return { provider, setProvider, name, setName, org, setOrg, token, setToken, err, submit, tokenLabel };
}

export function ConnectSourceModal({ onClose, onConnected }) {
  const f = useConnectSourceForm(onConnected);
  return (
    <Modal
      title="Connect new source"
      onClose={onClose}
      footer={
        <>
          <Button variant="link" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => f.submit() && onClose()}>Connect</Button>
        </>
      }
    >
      <Alert type="warning" title="Your access token is stored in AWS Secrets Manager">
        When you connect this source, your personal access token is stored as a secret in AWS Secrets Manager in this AWS account. Any user or role in
        the account with permission to read that secret can retrieve the token and use the repository access it grants. We recommend that you use a
        token with the narrowest repository access you need and revoke it when you no longer use this source.
      </Alert>
      <FormField label="Provider">
        <Radio name="provider" value={f.provider} onChange={f.setProvider} options={PROVIDERS} />
      </FormField>
      <FormField label="Source name" description="A unique name for this source connection." error={f.err('name')}>
        <Input value={f.name} onChange={(e) => f.setName(e.target.value)} placeholder="my-source" invalid={!!f.err('name')} />
      </FormField>
      <FormField
        label="Organization / group / workspace (optional)"
        description="GitHub org, GitLab group/user, or Bitbucket workspace/project to discover repositories from. Defaults to the source name if left blank."
      >
        <Input value={f.org} onChange={(e) => f.setOrg(e.target.value)} placeholder="my-org" />
      </FormField>
      <FormField label="Access token" description={`${f.tokenLabel} with read access to your repositories. Stored securely and never shown again.`} error={f.err('token')}>
        <Input type="password" autoComplete="off" value={f.token} onChange={(e) => f.setToken(e.target.value)} placeholder="Paste your personal access token" invalid={!!f.err('token')} />
      </FormField>
    </Modal>
  );
}

export function Sources({ query }) {
  const { state } = useStore();
  const [open, setOpen] = useState(query.connect === '1');
  return (
    <div>
      <div className="section-head">
        <h2>
          Sources <span className="muted">({state.sources.length})</span>
        </h2>
        <Button variant="primary" onClick={() => setOpen(true)}>Connect new source</Button>
      </div>
      <div className="filters">
        <span className="grow" />
        <Pagination page={1} pages={1} onChange={() => {}} />
      </div>
      <Table
        rows={state.sources}
        columns={[
          { id: 'name', header: 'Source name', cell: (s) => <Link className="link underline" onClick={() => navigate(`/app/cm/sources/${s.id}`)}>{s.name}</Link> },
          { id: 'status', header: 'Status', cell: (s) => <Status value={s.status} /> },
          { id: 'repos', header: '# of repos', cell: (s) => (s.status === 'Connected' ? s.repos.length : '-') },
          { id: 'provider', header: 'Provider', cell: (s) => s.provider },
        ]}
        empty={
          <>
            <strong>No sources</strong>
            <p className="muted">Connect a GitHub, GitLab or Bitbucket source to start analyzing repositories.</p>
          </>
        }
      />
      {open && <ConnectSourceModal onClose={() => setOpen(false)} />}
    </div>
  );
}

export function SourceDetail({ id }) {
  const { state, dispatch, notify } = useStore();
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(false);
  const s = state.sources.find((x) => x.id === id);
  if (!s) return <NotFound what="Source" back="/app/cm/sources" />;
  const analyzed = new Set(state.analyses.flatMap((a) => a.repos));
  const rows = s.repos
    .filter((r) => !search || r.toLowerCase().includes(search.toLowerCase()))
    .map((r) => ({ id: r, repo: r, analyzed: analyzed.has(r), findings: state.findings.filter((f) => f.repo === r && f.status !== 'Dismissed').length }));
  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') },
          { label: 'Sources', onClick: () => navigate('/app/cm/sources') },
          { label: s.name },
        ]}
      />
      <div className="section-head">
        <h1 className="page-title">{s.name}</h1>
        <div className="actions">
          <Button onClick={() => setConfirm(true)}>Disconnect</Button>
          <Button variant="primary" disabled={s.status !== 'Connected'} onClick={() => navigate('/app/cm/analyses/new', { source: s.name })}>Run analysis</Button>
        </div>
      </div>
      <Container header="Details">
        <KeyValue
          columns={4}
          items={[
            ['Status', <Status value={s.status} />],
            ['Provider', s.provider],
            ['Organization', s.org],
            ['Connected', fmtDate(s.connectedAt)],
          ]}
        />
      </Container>
      <Container header={`Repositories (${s.repos.length})`}>
        <div className="filters">
          <SearchInput value={search} onChange={setSearch} placeholder="Find repositories" />
        </div>
        <Table
          rows={rows}
          columns={[
            { id: 'repo', header: 'Repository', cell: (r) => r.repo },
            { id: 'a', header: 'Analyzed', cell: (r) => (r.analyzed ? <Status value="Completed">Yes</Status> : <span className="muted">Not yet</span>) },
            { id: 'f', header: 'Findings', cell: (r) => (r.findings ? <Link onClick={() => navigate('/app/cm/findings', { repo: r.repo, status: 'all' })}>{r.findings}</Link> : '-') },
          ]}
        />
      </Container>
      {confirm && (
        <Modal
          title={`Disconnect ${s.name}?`}
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button variant="link" onClick={() => setConfirm(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  dispatch({ type: 'REMOVE_SOURCE', id: s.id });
                  notify(`Source "${s.name}" disconnected.`);
                  navigate('/app/cm/sources');
                }}
              >
                Disconnect
              </Button>
            </>
          }
        >
          <p>AWS Transform stops tracking the {s.repos.length} repositories in this source and deletes the stored access token. Existing findings and remediation history are kept.</p>
        </Modal>
      )}
    </div>
  );
}
