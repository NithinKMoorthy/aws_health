import React, { useState } from 'react';
import { fmtDate, TRANSFORMATIONS, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Breadcrumbs, Button, Container, FormField, Input, KeyValue, Link, Modal, Radio, Select, Severity, Status } from '../components/ui';

const DESCRIPTIONS = {
  Dependency: 'One or more dependencies are outdated, deprecated or past end-of-life. Staying on them increases security exposure and blocks upgrades of dependent libraries.',
  Security: 'Code or dependencies contain patterns or versions with known vulnerabilities. Exploitation could expose data or allow unauthorized access.',
  Maintainability: 'The repository structure or documentation makes change slower and riskier for new contributors and automated agents.',
  Infrastructure: 'Build, deployment or runtime configuration is missing or non-standard, preventing repeatable builds and automated validation.',
  'Code-quality': 'Quality signals such as tests, linting or logging hygiene are missing or inconsistent, reducing confidence in changes.',
  Architecture: 'The application structure limits modularity or modernization paths and may need refactoring before automated transformation.',
};

export function NotesModal({ finding, onClose }) {
  const { dispatch, notify } = useStore();
  const [text, setText] = useState(finding.notes);
  return (
    <Modal
      title="Notes"
      onClose={onClose}
      footer={
        <>
          <Button variant="link" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              dispatch({ type: 'SET_NOTE', id: finding.id, notes: text });
              notify('Notes saved.');
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <p className="muted small">{finding.title} · {finding.repo}</p>
      <textarea className="input textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add context, owners, or decisions for this finding" autoFocus />
    </Modal>
  );
}

export function CreateRemediationModal({ findings, onClose }) {
  const { dispatch, notify } = useStore();
  const suggested = findings.find((f) => f.transformation)?.transformation;
  const [mode, setMode] = useState(suggested ? 'predefined' : 'custom');
  const [transformation, setTransformation] = useState(suggested ?? TRANSFORMATIONS[0]);
  const [name, setName] = useState(suggested ? `${suggested.split('/')[1]}-${findings[0].repo}` : '');
  const [prompt, setPrompt] = useState(findings.length === 1 ? `Resolve "${findings[0].title}" in ${findings[0].repo}.` : '');
  const [tags, setTags] = useState('');
  const [touched, setTouched] = useState(false);
  const mismatched = mode === 'predefined' && findings.some((f) => f.transformation && f.transformation !== transformation);
  const invalid = !name.trim() || (mode === 'custom' && !prompt.trim());
  const repos = [...new Set(findings.map((f) => f.repo))];

  const submit = () => {
    setTouched(true);
    if (invalid) return;
    dispatch({
      type: 'CREATE_REMEDIATION',
      name: name.trim(),
      transformation: mode === 'custom' ? 'Custom transformation' : transformation,
      custom: mode === 'custom' ? prompt.trim() : null,
      findingIds: findings.map((f) => f.id),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    notify(`Remediation "${name.trim()}" started on ${repos.length} repo(s).`);
    onClose();
    navigate('/app/cm/remediations');
  };

  return (
    <Modal
      title="Create remediation"
      width={680}
      onClose={onClose}
      footer={
        <>
          <Button variant="link" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>Create remediation</Button>
        </>
      }
    >
      <p className="muted small">
        {findings.length} finding(s) across {repos.length} repo(s): {repos.join(', ')}
      </p>
      <FormField label="Remediation name" error={touched && !name.trim() ? 'Name is required' : null}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. node-18-upgrade-orders" invalid={touched && !name.trim()} />
      </FormField>
      <FormField label="Transformation">
        <Radio
          name="mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'predefined', label: 'AWS-managed transformation', description: 'Apply a predefined, validated transformation definition.' },
            { value: 'custom', label: 'Custom transformation', description: 'Describe the change; AWS Transform drafts a transformation definition for you to review.' },
          ]}
        />
      </FormField>
      {mode === 'predefined' ? (
        <FormField label="Transformation definition">
          <Select value={transformation} onChange={setTransformation} options={TRANSFORMATIONS.map((t) => ({ value: t, label: t, description: t === suggested ? 'Recommended for the selected findings' : undefined }))} />
          {mismatched && <Alert type="warning">Some selected findings recommend a different transformation and may not be resolved.</Alert>}
        </FormField>
      ) : (
        <FormField label="What should change?" error={touched && !prompt.trim() ? 'Describe the change' : null}>
          <textarea className="input textarea" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </FormField>
      )}
      <FormField label="Tags" secondary="optional" description="Comma separated">
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sdk, q3" />
      </FormField>
      <Alert type="info">AWS Transform creates a branch per repository, runs the transformation and build validation, and reports the outcome here.</Alert>
    </Modal>
  );
}

export function FindingDetail({ id }) {
  const { state, dispatch, notify } = useStore();
  const [notesOpen, setNotesOpen] = useState(false);
  const [remediate, setRemediate] = useState(false);
  const f = state.findings.find((x) => x.id === id);
  if (!f) return <NotFound what="Finding" back="/app/cm/findings" />;
  const analysis = state.analyses.find((a) => a.id === f.analysisId);
  const rem = state.remediations.find((r) => r.id === f.remediationId) ?? state.remediations.find((r) => r.findings.includes(f.id));

  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') },
          { label: 'Findings', onClick: () => navigate('/app/cm/findings') },
          { label: f.title },
        ]}
      />
      <div className="section-head">
        <h1 className="page-title">{f.title}</h1>
        <div className="actions">
          {f.status === 'Dismissed' ? (
            <Button onClick={() => { dispatch({ type: 'REOPEN_FINDINGS', ids: [f.id] }); notify('Finding reopened.'); }}>Reopen</Button>
          ) : (
            <Button disabled={f.status !== 'Open'} onClick={() => { dispatch({ type: 'DISMISS_FINDINGS', ids: [f.id] }); notify('Finding dismissed.'); }}>Dismiss</Button>
          )}
          <Button variant="primary" disabled={f.status !== 'Open'} onClick={() => setRemediate(true)}>Create remediation</Button>
        </div>
      </div>
      <Container header="Details">
        <KeyValue
          columns={4}
          items={[
            ['Severity', <Severity value={f.severity} />],
            ['Status', <Status value={f.status} />],
            ['Category', f.category],
            ['Repository', f.repo],
            ['Analysis', analysis ? <Link onClick={() => navigate(`/app/cm/analyses/${analysis.id}`)}>{analysis.name}</Link> : typeLabel(f.analysisType)],
            ['Date reported', fmtDate(f.date)],
            ['Transformation', f.transformation ?? 'No remediation available.'],
            ['Finding ID', f.id],
          ]}
        />
      </Container>
      <Container header="Description">
        <p>{DESCRIPTIONS[f.category]}</p>
      </Container>
      <Container header="Recommended next step">
        {f.transformation ? (
          <p>
            Apply <code>{f.transformation}</code> to <strong>{f.repo}</strong>. AWS Transform will create a branch, run the transformation, and validate the build.
          </p>
        ) : (
          <p>No predefined transformation covers this finding. Create a <strong>custom transformation</strong> from the finding, or dismiss it with a note if it's accepted risk.</p>
        )}
        {rem && (
          <Alert type={rem.status === 'Complete' ? 'success' : 'info'} title={`Remediation: ${rem.name}`}>
            {rem.status} · branch <code>{rem.branch}</code> · <Link onClick={() => navigate(`/app/cm/remediations/${rem.id}`)}>View remediation</Link>
          </Alert>
        )}
      </Container>
      <Container header="Notes" actions={<Button onClick={() => setNotesOpen(true)}>{f.notes ? 'Edit notes' : 'Add notes'}</Button>}>
        <p className={f.notes ? '' : 'muted'}>{f.notes || 'No notes yet.'}</p>
      </Container>
      {notesOpen && <NotesModal finding={f} onClose={() => setNotesOpen(false)} />}
      {remediate && <CreateRemediationModal findings={[f]} onClose={() => setRemediate(false)} />}
    </div>
  );
}

export function NotFound({ what, back }) {
  return (
    <div className="page">
      <Container>
        <div className="empty-state">
          <strong>{what} not found</strong>
          <p><Link onClick={() => navigate(back)}>Go back</Link></p>
        </div>
      </Container>
    </div>
  );
}
