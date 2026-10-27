import React, { useState } from 'react';
import { ANALYSIS_TYPES, fmtDate, fmtDateTime, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import {
  applySort, Breadcrumbs, Button, Container, FormField, Input, KeyValue, Link, Modal, Pagination, ProgressBar,
  Radio, SearchInput, Select, Severity, Status, Table, useSort,
} from '../components/ui';
import { NotFound } from './Findings';

const FREQUENCIES = [
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Monthly', label: 'Monthly' },
];

function nextRun(freq) {
  const d = new Date();
  d.setHours(2, 0, 0, 0);
  d.setDate(d.getDate() + (freq === 'Daily' ? 1 : freq === 'Weekly' ? 7 : 30));
  // Local-time ISO string (toISOString would shift to UTC).
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T02:00`;
}

function ScheduleModal({ onClose }) {
  const { state, dispatch, notify } = useStore();
  const sources = state.sources.filter((s) => s.status === 'Connected');
  const [name, setName] = useState('');
  const [type, setType] = useState('td-quick');
  const [source, setSource] = useState(sources[0]?.name ?? '');
  const [freq, setFreq] = useState('Weekly');
  const [infra, setInfra] = useState('AWS managed');
  const [touched, setTouched] = useState(false);
  const src = sources.find((s) => s.name === source);
  return (
    <Modal
      title="Schedule analysis"
      onClose={onClose}
      footer={
        <>
          <Button variant="link" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              setTouched(true);
              if (!name.trim() || !src) return;
              dispatch({
                type: 'ADD_SCHEDULE',
                schedule: { name: name.trim(), analysisType: type, source, repos: src.repos.length, frequency: freq, infra, nextRun: nextRun(freq) },
              });
              notify(`Schedule "${name.trim()}" created.`);
              onClose();
            }}
          >
            Create schedule
          </Button>
        </>
      }
    >
      <FormField label="Schedule name" error={touched && !name.trim() ? 'Name is required' : null}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="weekly-tech-debt" invalid={touched && !name.trim()} />
      </FormField>
      <FormField label="Analysis type">
        <Select value={type} onChange={setType} options={ANALYSIS_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
      </FormField>
      <FormField label="Source" description="All repositories in the source are analyzed." error={touched && !src ? 'Connect a source first' : null}>
        <Select value={source} onChange={setSource} options={sources.map((s) => ({ value: s.name, label: s.name, description: `${s.provider} · ${s.repos.length} repos` }))} />
      </FormField>
      <FormField label="Frequency">
        <Select value={freq} onChange={setFreq} options={FREQUENCIES} />
      </FormField>
      <FormField label="Infrastructure">
        <Radio name="sinfra" value={infra} onChange={setInfra} options={[{ value: 'AWS managed', label: 'AWS managed' }, { value: 'Customer owned', label: 'Customer owned' }]} />
      </FormField>
    </Modal>
  );
}

export function Analyses() {
  const { state, dispatch, notify } = useStore();
  const [status, setStatus] = useState('');
  const [repo, setRepo] = useState('');
  const [schedSearch, setSchedSearch] = useState('');
  const [schedSel, setSchedSel] = useState([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sort, onSort] = useSort({ by: 'date', desc: true });
  const allRepos = [...new Set(state.analyses.flatMap((a) => a.repos))].sort();

  const columns = [
    { id: 'date', header: 'Date created', sort: (a) => a.date, cell: (a) => fmtDate(a.date) },
    { id: 'name', header: 'Analysis', sort: (a) => a.name, cell: (a) => <Link className="link underline" onClick={() => navigate(`/app/cm/analyses/${a.id}`)}>{a.name}</Link> },
    { id: 'status', header: 'Status', sort: (a) => a.status, cell: (a) => <Status value={a.status} /> },
    {
      id: 'repos',
      header: 'Repositories',
      sort: (a) => a.repos.length,
      cell: (a) => <ProgressBar value={a.progress} label={`${a.done} of ${a.repos.length} repos`} tone={a.status === 'Completed' ? 'success' : 'progress'} />,
    },
    { id: 'findings', header: 'Findings', sort: (a) => a.findings, cell: (a) => <span className="num">{a.status === 'Completed' ? a.findings : '-'}</span> },
    { id: 'infra', header: 'Infrastructure', sort: (a) => a.infra, cell: (a) => a.infra },
  ];
  const rows = applySort(state.analyses.filter((a) => (!status || a.status === status) && (!repo || a.repos.includes(repo))), columns, sort);
  const schedules = state.schedules.filter((s) => !schedSearch || s.name.toLowerCase().includes(schedSearch.toLowerCase()));

  return (
    <div>
      <Container
        header={<>Analyses <span className="muted">({rows.length})</span></>}
        actions={<Button variant="primary" onClick={() => navigate('/app/cm/analyses/new')}>Run new analysis</Button>}
      >
        <div className="filters">
          <Select compact width={150} value={status} onChange={setStatus} options={[{ value: '', label: 'All statuses' }, { value: 'In progress', label: 'In progress' }, { value: 'Completed', label: 'Completed' }, { value: 'Failed', label: 'Failed' }]} />
          <Select compact width={260} value={repo} onChange={setRepo} options={[{ value: '', label: 'All repos' }, ...allRepos.map((r) => ({ value: r, label: r }))]} />
          <Select compact width={120} value="" onChange={() => {}} options={[{ value: '', label: 'All tags' }]} />
          <span className="grow" />
          <Pagination page={1} pages={1} onChange={() => {}} />
        </div>
        <Table columns={columns} rows={rows} sort={sort} onSort={onSort} empty={<strong>No analyses</strong>} />
      </Container>

      <Container
        header={<>Schedules <span className="muted">({state.schedules.length})</span></>}
        description="Recurring analyses that run automatically."
        actions={
          <>
            <Button
              disabled={!schedSel.length}
              onClick={() => {
                dispatch({ type: 'DELETE_SCHEDULES', ids: schedSel });
                notify(`${schedSel.length} schedule(s) deleted.`);
                setSchedSel([]);
              }}
            >
              Delete
            </Button>
            <Button onClick={() => setScheduleOpen(true)}>Schedule analysis</Button>
          </>
        }
      >
        <div className="filters">
          <SearchInput value={schedSearch} onChange={setSchedSearch} placeholder="Find schedules" width={500} />
          <span className="grow" />
          <Pagination page={1} pages={1} onChange={() => {}} />
        </div>
        <Table
          selectable
          selected={schedSel}
          onSelect={setSchedSel}
          rows={schedules}
          columns={[
            { id: 'id', header: 'Schedule ID', cell: (s) => s.id },
            { id: 'name', header: 'Schedule name', cell: (s) => s.name },
            { id: 'infra', header: 'Infrastructure', cell: (s) => s.infra },
            {
              id: 'status',
              header: 'Status',
              cell: (s) => (
                <span className="inline-gap">
                  <Status value={s.status} />
                  <Link onClick={() => dispatch({ type: 'TOGGLE_SCHEDULE', id: s.id })}>{s.status === 'Active' ? 'Pause' : 'Resume'}</Link>
                </span>
              ),
            },
            { id: 'freq', header: 'Frequency', cell: (s) => s.frequency },
            { id: 'type', header: 'Analysis type', cell: (s) => typeLabel(s.analysisType) },
            { id: 'source', header: 'Source', cell: (s) => s.source },
            { id: 'repos', header: 'Repositories', cell: (s) => s.repos },
            { id: 'next', header: 'Next run', cell: (s) => (s.status === 'Active' ? fmtDateTime(s.nextRun) : '-') },
          ]}
          empty={
            <>
              <strong>No schedules</strong>
              <p>Create a schedule to run analysis on a recurring basis.</p>
            </>
          }
        />
      </Container>
      {scheduleOpen && <ScheduleModal onClose={() => setScheduleOpen(false)} />}
    </div>
  );
}

export function AnalysisDetail({ id }) {
  const { state } = useStore();
  const a = state.analyses.find((x) => x.id === id);
  if (!a) return <NotFound what="Analysis" back="/app/cm/analyses" />;
  const findings = state.findings.filter((f) => f.analysisId === a.id);
  const perRepo = a.repos.map((repo, i) => ({
    id: repo,
    repo,
    status: a.status === 'Completed' || i < a.done ? 'Completed' : i === a.done ? 'In progress' : 'Pending',
    count: findings.filter((f) => f.repo === repo).length,
  }));
  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') },
          { label: 'Analyses', onClick: () => navigate('/app/cm/analyses') },
          { label: a.name },
        ]}
      />
      <div className="section-head">
        <h1 className="page-title">{a.name}</h1>
        {a.status === 'Completed' && a.findings > 0 && (
          <Button variant="primary" onClick={() => navigate('/app/cm/findings', a.type === 'ple' ? { tab: 'ple', analysis: a.id } : { tab: 'all', analysis: a.id })}>View findings</Button>
        )}
      </div>
      <Container header="Summary">
        <KeyValue
          columns={4}
          items={[
            ['Analysis type', typeLabel(a.type)],
            ['Status', <Status value={a.status} />],
            ['Started', fmtDateTime(a.date)],
            ['Infrastructure', a.infra],
            ['Source', a.source ?? '-'],
            ['Repositories', a.repos.length],
            ['Findings', a.status === 'Completed' ? a.findings : '-'],
            ['Analysis ID', a.id],
          ]}
        />
        {a.status === 'In progress' && <ProgressBar value={a.progress} label={`${a.done} of ${a.repos.length} repos`} tone="progress" />}
      </Container>
      <Container header={`Repositories (${a.repos.length})`}>
        <Table
          rows={perRepo}
          columns={[
            { id: 'r', header: 'Repository', cell: (r) => r.repo },
            { id: 's', header: 'Status', cell: (r) => <Status value={r.status} /> },
            { id: 'c', header: 'Findings', cell: (r) => (r.status === 'Completed' ? <Link onClick={() => navigate('/app/cm/findings', { repo: r.repo, status: 'all' })}>{r.count}</Link> : '-') },
          ]}
        />
      </Container>
      {findings.length > 0 && (
        <Container header={`Findings (${findings.length})`}>
          <Table
            rows={findings}
            columns={[
              { id: 't', header: 'Finding', cell: (f) => <Link onClick={() => navigate(`/app/cm/findings/${f.id}`)}>{f.title}</Link> },
              { id: 's', header: 'Severity', cell: (f) => <Severity value={f.severity} /> },
              { id: 'st', header: 'Status', cell: (f) => <Status value={f.status} /> },
              { id: 'r', header: 'Repository', cell: (f) => f.repo },
              { id: 'x', header: 'Transformation', cell: (f) => f.transformation ?? 'No remediation available.' },
            ]}
          />
        </Container>
      )}
    </div>
  );
}
