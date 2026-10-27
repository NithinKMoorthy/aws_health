import React, { useState } from 'react';
import { ANALYSIS_TYPES, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Breadcrumbs, Button, Container, FormField, Input, Link, Radio, SearchInput, Select, Status } from '../components/ui';
import { PROVIDERS, useConnectSourceForm } from './Sources';

function InlineConnect({ onDone, onCancel }) {
  const f = useConnectSourceForm(onDone);
  return (
    <div className="inline-connect">
      <div className="field-label">Connected source</div>
      <FormField label="Provider">
        <Radio name="iprovider" value={f.provider} onChange={f.setProvider} options={PROVIDERS} />
      </FormField>
      <div className="narrow">
        <FormField label="Organization">
          <Input value={f.org} onChange={(e) => f.setOrg(e.target.value)} placeholder="my-org" />
        </FormField>
        <FormField label="Personal access token" error={f.err('token')}>
          <Input type="password" autoComplete="off" value={f.token} onChange={(e) => f.setToken(e.target.value)} placeholder="Paste your personal access token" invalid={!!f.err('token')} />
        </FormField>
        <FormField label="Source name" error={f.err('name')}>
          <Input value={f.name} onChange={(e) => f.setName(e.target.value)} placeholder="my-source" invalid={!!f.err('name')} />
        </FormField>
      </div>
      <Button variant="primary" onClick={f.submit}>Connect source</Button>
      <div style={{ marginTop: 14 }}>
        <Link onClick={onCancel}>Use an existing source</Link>
      </div>
    </div>
  );
}

export function NewAnalysis({ query }) {
  const { state, dispatch, notify } = useStore();
  const [step, setStep] = useState(1);
  const [type, setType] = useState(null);
  const [name, setName] = useState('');
  const [source, setSource] = useState(query.source ?? '');
  const [connecting, setConnecting] = useState(false);
  const [tried, setTried] = useState(false);
  const [repos, setRepos] = useState([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [infra, setInfra] = useState('AWS managed');

  const src = state.sources.find((s) => s.name === source);
  const batchReady = state.infrastructure.some((i) => i.type === 'Batch' && i.status === 'Deployed');
  const typeErr = tried && !type ? 'Analysis type is required' : null;
  const srcErr = tried && !connecting && !src ? 'Choose a connected source' : tried && src?.status !== 'Connected' && src ? 'Source is still connecting' : null;

  const crumbs = (
    <Breadcrumbs
      items={[
        { label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') },
        { label: 'Analyses', onClick: () => navigate('/app/cm/analyses') },
        { label: 'Run new analysis' },
      ]}
    />
  );

  if (step === 2 && src) {
    const visible = src.repos.filter((r) => !repoSearch || r.toLowerCase().includes(repoSearch.toLowerCase()));
    const allVisible = visible.length > 0 && visible.every((r) => repos.includes(r));
    const run = () => {
      if (!repos.length) return;
      dispatch({ type: 'START_ANALYSIS', analysisType: type, name: name.trim(), source, repos, infra });
      notify(`${name.trim() || typeLabel(type)} started on ${repos.length} repo(s).`);
      navigate('/app/cm/analyses');
    };
    return (
      <div className="page">
        {crumbs}
        <h1 className="page-title">Run new analysis</h1>
        <Container header="Repositories" description={`Select repositories from ${src.name} (${src.repos.length} repos) to include.`}>
          <div className="filters">
            <SearchInput value={repoSearch} onChange={setRepoSearch} placeholder="Find repositories" />
            <label className="checkbox">
              <input type="checkbox" checked={allVisible} onChange={() => setRepos(allVisible ? repos.filter((r) => !visible.includes(r)) : [...new Set([...repos, ...visible])])} />
              Select all{repoSearch ? ' matching' : ''}
            </label>
            <span className="grow" />
            <span className="muted small">{repos.length} selected</span>
          </div>
          <div className="repo-grid">
            {visible.map((r) => (
              <label key={r} className={`repo-pick ${repos.includes(r) ? 'on' : ''}`}>
                <input type="checkbox" checked={repos.includes(r)} onChange={() => setRepos(repos.includes(r) ? repos.filter((x) => x !== r) : [...repos, r])} />
                {r}
              </label>
            ))}
          </div>
          {tried && !repos.length && <div className="field-error">Select at least one repository</div>}
        </Container>
        <Container header="Infrastructure">
          <Radio
            name="infra"
            value={infra}
            onChange={setInfra}
            options={[
              { value: 'AWS managed', label: 'AWS managed', description: 'AWS Transform runs the analysis in service-managed compute.' },
              { value: 'Customer owned', label: 'Customer owned', description: 'Runs in your account and VPC using AtxInfrastructureStack. Use this when code must stay in your network.' },
            ]}
          />
          {infra === 'Customer owned' && !batchReady && (
            <Alert type="warning" action={<Button onClick={() => navigate('/app/cm/settings')}>Go to Settings</Button>}>
              Team infrastructure isn't deployed in this account.
            </Alert>
          )}
        </Container>
        <div className="form-actions">
          <Button variant="link" onClick={() => setStep(1)}>Previous</Button>
          <Button
            variant="primary"
            disabled={infra === 'Customer owned' && !batchReady}
            onClick={() => {
              setTried(true);
              run();
            }}
          >
            Run analysis
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {crumbs}
      <h1 className="page-title">Run new analysis</h1>
      <Container header="Analysis details">
        <div className="narrow-wide">
          <FormField label="Analysis type" error={typeErr}>
            <Select
              value={type}
              onChange={setType}
              placeholder="Choose analysis type"
              invalid={!!typeErr}
              options={ANALYSIS_TYPES.map((t) => ({ value: t.id, label: t.label }))}
            />
            {type && <div className="field-desc" style={{ marginTop: 4 }}>{ANALYSIS_TYPES.find((t) => t.id === type).description}</div>}
          </FormField>
          <FormField label="Analysis name" secondary="optional">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter a name for this analysis" />
          </FormField>
        </div>
        {connecting ? (
          <InlineConnect
            onDone={(n) => {
              setSource(n);
              setConnecting(false);
            }}
            onCancel={() => setConnecting(false)}
          />
        ) : (
          <FormField label="Connected source" error={srcErr}>
            <div className="source-row">
              <Select
                width={660}
                value={source}
                onChange={(v) => {
                  setSource(v);
                  setRepos([]);
                }}
                placeholder="Choose source"
                options={state.sources.map((s) => ({ value: s.name, label: s.name, description: `${s.provider} · ${s.status === 'Connected' ? `${s.repos.length} repos` : s.status}` }))}
              />
              <Button onClick={() => setConnecting(true)}>
                <span className="plus">+</span> Connect a new source
              </Button>
            </div>
            {src && src.status !== 'Connected' && (
              <div style={{ marginTop: 6 }}>
                <Status value={src.status} />
              </div>
            )}
          </FormField>
        )}
      </Container>
      <div className="form-actions">
        <Button variant="link" onClick={() => navigate('/app/cm/analyses')}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => {
            setTried(true);
            if (!type || !src || src.status !== 'Connected' || connecting) return;
            setTried(false);
            setStep(2);
          }}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
