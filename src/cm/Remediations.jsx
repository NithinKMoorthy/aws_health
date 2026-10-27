import React, { useState } from 'react';
import { fmtDate } from '../data';
import { navigate, useStore } from '../store';
import { Alert, applySort, Breadcrumbs, Button, Container, KeyValue, Link, Pagination, ProgressBar, Select, Severity, Status, Table, useSort } from '../components/ui';
import { NotFound } from './Findings';

export function Remediations() {
  const { state } = useStore();
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [sort, onSort] = useSort({ by: 'date', desc: true });
  const tags = [...new Set(state.remediations.flatMap((r) => r.tags))].sort();

  const columns = [
    { id: 'name', header: 'Name', sort: (r) => r.name, cell: (r) => <Link onClick={() => navigate(`/app/cm/remediations/${r.id}`)}>{r.name}</Link> },
    {
      id: 'status',
      header: 'Status',
      sort: (r) => r.status,
      cell: (r) => (r.status === 'In progress' ? <Status value="In progress">In progress ({Math.round(r.progress)}%)</Status> : <Status value={r.status} />),
    },
    { id: 'outcome', header: 'Outcome', sort: (r) => r.outcome, cell: (r) => <Link onClick={() => navigate(`/app/cm/remediations/${r.id}`)}>{r.outcome}</Link> },
    { id: 'date', header: 'Date created', sort: (r) => r.date + r.id.padStart(6, '0'), cell: (r) => fmtDate(r.date) },
    { id: 'transformation', header: 'Transformation', sort: (r) => r.transformation, cell: (r) => r.transformation },
    { id: 'repos', header: 'Repositories', sort: (r) => r.repos.length, cell: (r) => <Link onClick={() => navigate(`/app/cm/remediations/${r.id}`)}>{r.repos.length}</Link> },
    { id: 'findings', header: 'Findings', sort: (r) => r.findings.length, cell: (r) => <Link onClick={() => navigate(`/app/cm/remediations/${r.id}`)}>{r.findings.length}</Link> },
  ];
  const rows = applySort(
    state.remediations.filter((r) => (!status || r.status === status) && (!tag || r.tags.includes(tag))),
    columns,
    sort,
  );

  return (
    <div>
      <div className="section-head">
        <h2>
          Remediations <span className="muted">({rows.length})</span>
        </h2>
      </div>
      <div className="filters">
        <Select compact width={150} value={status} onChange={setStatus} options={[{ value: '', label: 'All statuses' }, { value: 'In progress', label: 'In progress' }, { value: 'Complete', label: 'Complete' }, { value: 'Failed', label: 'Failed' }]} />
        <Select compact width={130} value={tag} onChange={setTag} options={[{ value: '', label: 'All tags' }, ...tags.map((t) => ({ value: t, label: t }))]} />
        <span className="grow" />
        <Pagination page={1} pages={1} onChange={() => {}} />
      </div>
      <Table
        columns={columns}
        rows={rows}
        sort={sort}
        onSort={onSort}
        empty={
          <>
            <strong>No remediations</strong>
            <p className="muted">Select findings and choose Create remediation.</p>
            <Button onClick={() => navigate('/app/cm/findings')}>Go to findings</Button>
          </>
        }
      />
    </div>
  );
}

export function RemediationDetail({ id }) {
  const { state, notify } = useStore();
  const r = state.remediations.find((x) => x.id === id);
  if (!r) return <NotFound what="Remediation" back="/app/cm/remediations" />;
  const findings = state.findings.filter((f) => r.findings.includes(f.id));
  const steps = ['Branch created', 'Transformation applied', 'Build validated', 'Ready for review'];
  const reached = r.status === 'Complete' ? 4 : Math.min(3, Math.floor((r.progress ?? 0) / 25) + 1);

  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') },
          { label: 'Remediations', onClick: () => navigate('/app/cm/remediations') },
          { label: r.name },
        ]}
      />
      <div className="section-head">
        <h1 className="page-title">{r.name}</h1>
        <div className="actions">
          <Button disabled={r.status !== 'Complete'} onClick={() => notify(`Pull request opened from ${r.branch} (mock).`)}>Open pull request</Button>
        </div>
      </div>
      {r.status === 'In progress' && (
        <Container>
          <ProgressBar value={r.progress ?? 0} label="Running transformation" tone="progress" />
        </Container>
      )}
      <Container header="Summary">
        <KeyValue
          columns={4}
          items={[
            ['Status', <Status value={r.status} />],
            ['Transformation', r.transformation],
            ['Date created', fmtDate(r.date)],
            ['Branch', <code>{r.branch}</code>],
            ['Validation', r.status === 'Complete' ? <Status value="Completed">{r.validation ?? 'Passed'}</Status> : 'Pending'],
            ['Repositories', r.repos.join(', ')],
            ['Outcome', `${r.outcome} of ${r.repos.length} repos transformed`],
            ['Tags', r.tags.length ? r.tags.join(', ') : '-'],
          ]}
        />
        {r.custom && (
          <Alert type="info" title="Custom transformation request">
            {r.custom}
          </Alert>
        )}
      </Container>
      <Container header="Progress">
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s} className={i < reached ? (i === reached - 1 && r.status !== 'Complete' ? 'current' : 'done') : ''}>
              <span className="dot" /> {s}
            </li>
          ))}
        </ol>
      </Container>
      <Container header={`Findings (${findings.length})`}>
        <Table
          columns={[
            { id: 't', header: 'Finding', cell: (f) => <Link onClick={() => navigate(`/app/cm/findings/${f.id}`)}>{f.title}</Link> },
            { id: 's', header: 'Severity', cell: (f) => <Severity value={f.severity} /> },
            { id: 'st', header: 'Status', cell: (f) => <Status value={f.status} /> },
            { id: 'r', header: 'Repository', cell: (f) => f.repo },
          ]}
          rows={findings}
        />
      </Container>
    </div>
  );
}
