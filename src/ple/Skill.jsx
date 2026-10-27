import React, { useEffect, useState } from 'react';
import { fmtDate, TRANSFORMATIONS, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Breadcrumbs, Button, Container, FormField, Icon, Input, Link, ProgressBar, Select } from '../components/ui';
import { NotFound } from '../cm/Findings';
import { continueInChat } from '../components/Chat';
import { CAMPAIGN_NAMES, MOCK_TODAY } from './data';
import { groupView, PleTag } from './common';
import { groupPath, groupTitle } from './Groups';

// Review specialized skill (type C groups): what AWS Transform generated, the
// decisions it picked, and how to run and publish it. Running tests the skill
// on held-out repositories first (R14), then starts a campaign on the group.

const ROWS = [
  ['target', 'Target'],
  ['approach', 'Approach'],
  ['validation', 'Validation'],
  ['guardrails', 'Guardrails'],
];

/** Default skill content for a group. Edits are stored on group.skill. */
export function skillSpec(g, v) {
  const n = v.repos.length;
  const repos = `${n} ${n === 1 ? 'repository' : 'repositories'}`;
  if (g.pleId === 'rds-pg14') {
    return {
      name: 'PostgreSQL 14 to 16 engine upgrade',
      target: `RDS for PostgreSQL instances defined in infrastructure-as-code move from 14 to ${g.target}`,
      approach: 'Bump engine_version, create a matching parameter group with non-default parameters carried over, then flag extensions that change behavior',
      validation: `Infrastructure plan shows only the engine and parameter-group change · pg_upgrade --check passes on a snapshot clone in all ${repos}`,
      guardrails: 'Major-version changes need owner approval · applied in the next maintenance window · snapshot taken first',
      details: {
        target: v.live.map((f) => `${f.repo}: ${f.file}:${f.line} (${f.evidence})`),
        approach: ['Update engine_version and family in each definition', 'Create the new parameter group and copy non-default values', 'List extensions (postgis, pg_stat_statements) and check their supported versions'],
        validation: ['Infrastructure plan diff is limited to engine, family and parameter group', 'pg_upgrade --check on a snapshot clone', 'Application smoke tests pass against the clone', 'No deprecated parameters remain'],
        guardrails: ['Owner approval on each pull request', 'apply_immediately stays false', 'Manual snapshot before the change'],
      },
      decisions: [
        ['Target version', g.target, ['PostgreSQL 16', 'PostgreSQL 17']],
        ['Parameter group', 'Create new, copy non-defaults', ['Create new, copy non-defaults', 'Use the default group']],
        ['Upgrade window', 'Next maintenance window', ['Next maintenance window', 'Apply immediately']],
      ],
    };
  }
  if (g.pleId === 'cache-redis6') {
    return {
      name: 'Redis OSS 6 to Valkey 8 engine upgrade',
      target: `ElastiCache replication groups move from Redis OSS 6 to ${g.target}`,
      approach: 'Switch engine and engine_version, swap the parameter group family, keep the endpoint names',
      validation: `Infrastructure plan shows only the engine change · client connection test passes in all ${repos}`,
      guardrails: 'Owner approval on each pull request · applied in the maintenance window',
      details: {
        target: v.live.map((f) => `${f.repo}: ${f.file}:${f.line} (${f.evidence})`),
        approach: ['Change engine to valkey and engine_version to 8.0', 'Create a valkey8 parameter group', 'Keep cluster and endpoint names'],
        validation: ['Plan diff is limited to engine and parameter group', 'Client library connects and runs PING, GET, SET', 'No deprecated commands in use'],
        guardrails: ['Owner approval on each pull request', 'Applied in the maintenance window'],
      },
      decisions: [
        ['Target engine', g.target, ['Valkey 8.0', 'Redis OSS 7.1']],
        ['Upgrade window', 'Next maintenance window', ['Next maintenance window', 'Apply immediately']],
      ],
    };
  }
  return {
    name: `${g.shortName} fix`,
    target: `"${g.shortName}" resolved in all ${repos}`,
    approach: "Apply the smallest change that resolves the finding, following each repository's conventions",
    validation: 'Build and unit tests pass · the analysis no longer reports the finding',
    guardrails: 'One pull request per repository · no public API changes without owner approval',
    details: {
      target: v.repos.slice(0, 8).map((r) => r).concat(n > 8 ? [`…and ${n - 8} more`] : []),
      approach: ['Read the finding evidence in each repository', 'Make the minimal change', 'Update lockfiles or configuration only where the change needs it'],
      validation: ['Build passes', 'Unit tests pass with no regressions', 'Re-analysis no longer reports the finding'],
      guardrails: ['One pull request per repository', 'Owner approval for public API changes'],
    },
    decisions: [
      ['Change scope', 'Minimal fix', ['Minimal fix', 'Fix and refactor nearby code']],
      ['Tests', 'Add a regression test', ['Add a regression test', 'No new tests']],
    ],
  };
}

const RUN_OPTIONS = [
  ['published', 'Run and publish', (r) => `Runs on ${r}, then publishes to the Skills Library once it passes validation.`, 'Run, then publish'],
  ['draft', 'Run and publish a draft now', () => 'Visible in the Skills Library right away, marked "Not yet validated".', 'Run and publish draft'],
  ['one-off', 'Run one-off', (r) => `Runs on ${r} only. Nothing is shared.`, 'Run one-off'],
];

export function SkillReview({ id, query = {} }) {
  const { state, dispatch, notify } = useStore();
  const g = state.ple.groups.find((x) => x.id === id);
  const [mode, setMode] = useState('skill');
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const [contextOpen, setContextOpen] = useState(false);
  const [pendingRun, setPendingRun] = useState(false);
  const [td, setTd] = useState(TRANSFORMATIONS[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [, force] = useState(0);
  const s = g?.skill ?? { status: 'proposed' };

  useEffect(() => {
    if (s.status !== 'generating') return undefined;
    const t = setInterval(() => force((n) => n + 1), 300);
    return () => clearInterval(t);
  }, [s.status]);

  const v = g && groupView(state, g);
  const spec = g && skillSpec(g, v);
  const edits = s.edits ?? {};
  const decisions = s.decisions ?? {};
  const name = s.name ?? spec?.name ?? '';
  const saveAs = s.saveAs === 'one-off' || s.saveAs === 'draft' || s.saveAs === 'published' ? s.saveAs : 'published';
  const availableTo = s.availableTo ?? 'account';
  const update = (patch) => dispatch({ type: 'PLE_SKILL_UPDATE', groupId: g.id, patch });

  const startCampaign = () => {
    const names = CAMPAIGN_NAMES[g.pleId] ?? [`Remediate ${g.shortName}`, () => `"${g.shortName}" resolved in every repository`];
    const cid = `C-${state.seq}`;
    dispatch({
      type: 'PLE_START_CAMPAIGN',
      name: names[0],
      target: names[1](g.target),
      dueDate: v.event?.changeDate ?? null,
      groupIds: [g.id],
      checks: { equivalence: true, deps: true },
      now: Date.now(),
    });
    notify(saveAs === 'one-off' ? `Running "${name}" on ${v.repos.length} repositories.` : `Running "${name}". It publishes to the Skills Library ${saveAs === 'draft' ? 'now as a draft' : 'once it passes validation'}.`);
    navigate(`/app/cm/campaigns/${cid}`);
  };

  // Once the held-out test passes, continue the run the user asked for.
  useEffect(() => {
    if (pendingRun && s.status === 'ready') {
      setPendingRun(false);
      startCampaign();
    }
  }, [pendingRun, s.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g || g.type !== 'C') return <NotFound what="Specialized skill" back="/app/cm/findings" />;
  const e = v.event;
  const reposLabel = v.repos.length === 1 ? v.repos[0] : `the ${v.repos.length} repositories in this group`;
  const remediated = v.campaigns.length > 0;
  const pct = s.status === 'generating' ? Math.min(100, ((Date.now() - s.startedAt) / s.duration) * 100) : 0;
  const analysis = state.analyses.find((a) => a.id === v.live[0]?.analysisId);
  const statusBadge = s.status === 'ready' ? 'Tested · ready to run' : s.status === 'generating' ? 'Testing on held-out repositories' : 'Ready · requires review';
  const runLabel = RUN_OPTIONS.find((o) => o[0] === saveAs)[3];
  const edited = (k) => edits[k] != null && edits[k] !== spec[k];
  const toggleRow = (k) => setOpen((o) => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const run = () => {
    if (mode === 'td') {
      notify(`Switched to ${td === 'custom' ? 'a custom transformation' : td}. Review the plan to run it.`, 'info');
      navigate(groupPath(g));
      return;
    }
    if (s.status === 'ready') startCampaign();
    else {
      setPendingRun(true);
      dispatch({ type: 'PLE_SKILL_GENERATE', groupId: g.id, now: Date.now() });
    }
  };

  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: 'Findings', onClick: () => navigate('/app/cm/findings', e ? { tab: 'ple' } : undefined) },
          { label: groupTitle(g), onClick: () => navigate(groupPath(g)) },
          { label: 'Review skill' },
        ]}
      />
      {query.return && (
        <Alert type="info" action={<Button onClick={() => navigate(query.return)}>Back to plan</Button>}>
          You're reviewing this skill for a remediation plan. Approve it to mark the item ready.
        </Alert>
      )}
      <h1 className="page-title">Review specialized skill</h1>
      <p className="page-desc">A specialized transformation skill is ready for this group. Review it, run it, and publish it so other repositories can reuse it.</p>

      <Container>
        <div className="skill-callout">
          <span className="skill-callout-icon"><Icon.refresh /></span>
          <div>
            <strong>A specialized transformation skill is ready</strong>
            <p>
              Built from {e ? <>the AWS Health PLE and an analysis of {reposLabel}</> : <>an analysis of {reposLabel}</>}. No managed transformation covers {e ? 'this change' : 'these findings'}, so AWS Transform
              generated a skill and picked a recommended option for each decision. Use it as is, modify its decisions, or switch to a custom or managed transformation.
            </p>
          </div>
        </div>
        <div className="skill-strip">
          <span className="strip-label">Group · {remediated ? 'remediation started' : 'not yet remediated'}</span>
          <strong>{groupTitle(g)}</strong>
          {e && <span className="aws-ple-tag">AWS Health PLE</span>}
          <span className="pill">{v.repos.length === 1 ? <span className="mono">{v.repos[0]}</span> : `${v.repos.length} repositories`}</span>
          <span className="pill">Impact {v.severity.toLowerCase()}</span>
          <span className="pill">Effort {v.repos.length <= 3 ? '1–2 days' : '3–5 days'}</span>
          <span className="pill">{v.live.length} findings</span>
          {e && <span className="pill">Due {fmtDate(e.changeDate)} <PleTag /></span>}
        </div>
      </Container>

      <Container
        header="Specialized transformation skill"
        description={`Prepared from your analysis on ${fmtDate(analysis?.date?.slice(0, 10) ?? MOCK_TODAY)}. Review each step, then run it, publish it, or both.`}
        actions={<span className={`skill-badge ${s.status === 'ready' ? 'ok' : ''}`}>{statusBadge}</span>}
      >
        <ol className="skill-steps">
          <li>
            <span className="step-marker done"><Icon.check /></span>
            <div className="step-card done">
              <div className="step-card-head">
                <h3>Analysis · {analysis?.name ?? typeLabel(v.live[0]?.analysisType)} <span className="done-tag">Done</span></h3>
                {analysis && <Link onClick={() => navigate(`/app/cm/analyses/${analysis.id}`)}>View analysis</Link>}
              </div>
              <p>
                Analyzed <strong>{reposLabel}</strong> on {fmtDate(analysis?.date?.slice(0, 10) ?? MOCK_TODAY)}. No managed transformation matched, so the specialized skill was derived from it.
              </p>
            </div>
          </li>

          <li>
            <span className="step-marker">2</span>
            <div className="step-card">
              <div className="step-card-head">
                <h3>Transformation</h3>
                <div className="segmented">
                  <button type="button" className={mode === 'skill' ? 'on' : ''} onClick={() => setMode('skill')}>Specialized skill</button>
                  <button type="button" className={mode === 'td' ? 'on' : ''} onClick={() => setMode('td')}>Managed or custom transformation</button>
                </div>
              </div>
              {mode === 'skill' ? (
                <>
                  <div className="skill-head">
                    <span className="skill-icon"><Icon.refresh /></span>
                    <div className="grow">
                      <strong>{name}</strong>
                      <div className="muted small">
                        Generated for {g.shortName} from your analysis · covers {v.live.length} of {v.live.length} findings · {spec.details.validation.length} of {spec.details.validation.length} validations
                      </div>
                    </div>
                    <Button onClick={() => setEditing((x) => !x)}>{editing ? 'Done editing' : 'Edit skill'}</Button>
                  </div>
                  <div className="skill-rows">
                    {ROWS.map(([k, label]) => (
                      <div key={k} className="skill-row">
                        <button type="button" className="skill-row-head" onClick={() => toggleRow(k)} aria-expanded={open.has(k)}>
                          <Icon.caret className={open.has(k) ? '' : 'rot'} />
                          <span className="skill-row-label">{label}</span>
                          <span className="skill-row-value">{edits[k] ?? spec[k]}</span>
                          <span className={`tag ${edited(k) ? 'tag-blue' : ''}`}>{edited(k) ? 'Edited' : 'Default'}</span>
                        </button>
                        {(open.has(k) || editing) && (
                          <div className="skill-row-body">
                            {editing ? (
                              <textarea className="input textarea" rows={2} value={edits[k] ?? spec[k]} onChange={(x) => update({ edits: { ...edits, [k]: x.target.value } })} />
                            ) : (
                              <ul className="plain-list">{spec.details[k].map((d) => <li key={d}>{d}</li>)}</ul>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="kv-line">
                    <span className="kv-line-label">Decisions</span>
                    {editing ? (
                      <div className="decision-edit">
                        {spec.decisions.map(([k, def, opts]) => (
                          <FormField key={k} label={k}>
                            <Select compact value={decisions[k] ?? def} onChange={(x) => update({ decisions: { ...decisions, [k]: x } })} options={opts.map((o) => ({ value: o, label: o, description: o === def ? 'Recommended' : undefined }))} />
                          </FormField>
                        ))}
                      </div>
                    ) : (
                      <span className="grow">{spec.decisions.map(([k, def]) => decisions[k] ?? def).join(' · ')}</span>
                    )}
                    <span className="muted small">{spec.decisions.every(([k, def]) => (decisions[k] ?? def) === def) ? 'Recommended' : 'Changed'}</span>
                  </div>
                  <div className="kv-line">
                    <span className="kv-line-label">Context</span>
                    {contextOpen ? (
                      <textarea className="input textarea grow" rows={3} value={s.context ?? ''} placeholder="Team conventions, links to runbooks, things the skill should avoid" onChange={(x) => update({ context: x.target.value })} />
                    ) : (
                      <span className="grow">{s.context ? s.context : 'None added'}</span>
                    )}
                    <Link onClick={() => setContextOpen((c) => !c)}>{contextOpen ? 'Done' : s.context ? 'Edit context' : 'Add context'}</Link>
                  </div>
                </>
              ) : (
                <div className="td-switch">
                  <p className="muted small">No managed transformation covers {e ? 'this change' : 'these findings'} today. Switching skips the skill; the transformation runs on the same repositories.</p>
                  <FormField label="Transformation">
                    <Select value={td} onChange={setTd} options={[...TRANSFORMATIONS.map((t) => ({ value: t, label: t, description: 'AWS-managed' })), { value: 'custom', label: 'Custom transformation', description: 'Describe the change in your own words' }]} />
                  </FormField>
                  {td === 'custom' && (
                    <FormField label="What should change?">
                      <textarea className="input textarea" rows={3} value={customPrompt} onChange={(x) => setCustomPrompt(x.target.value)} />
                    </FormField>
                  )}
                </div>
              )}
            </div>
          </li>

          <li>
            <span className="step-marker">3</span>
            <div className="step-card">
              <h3>Run and publish</h3>
              <div className="run-options">
                {RUN_OPTIONS.map(([val, label, desc]) => (
                  <label key={val} className={`radio-card wide ${saveAs === val ? 'on' : ''}`}>
                    <input type="radio" name="saveas" checked={saveAs === val} onChange={() => update({ saveAs: val })} disabled={mode === 'td'} />
                    <span>
                      <span className="radio-label">{label} {val === 'published' && <span className="rec-tag">Recommended</span>}</span>
                      <span className="radio-desc">{desc(reposLabel)}</span>
                    </span>
                  </label>
                ))}
              </div>
              {saveAs !== 'one-off' && (
                <div className="skill-name-row">
                  <FormField label="Skill name">
                    <Input value={name} onChange={(x) => update({ name: x.target.value })} />
                  </FormField>
                  <FormField label="Available to">
                    <Select value={availableTo} onChange={(x) => update({ availableTo: x })} options={[{ value: 'account', label: 'This account' }, { value: 'org', label: 'My organization' }]} />
                  </FormField>
                </div>
              )}
              <p className="muted small">
                {saveAs === 'one-off'
                  ? 'Nothing is published. The skill is kept with this campaign only.'
                  : `Publishes the skill definition, your decisions and context as defaults, and validation rules. No code from ${reposLabel}.`}
              </p>
              <p className="muted small">
                <Icon.info /> Before it changes your code, AWS Transform tests the skill on {s.heldOut ?? 2} held-out repositories. {s.status === 'ready' ? `It passed on ${s.passed} of ${s.heldOut}.` : ''}
              </p>
              {s.status === 'generating' && <ProgressBar value={pct} label={pct < 50 ? 'Running build and test on held-out repositories…' : 'Checking for regressions…'} tone="progress" />}
              <div className="inline-gap" style={{ marginTop: 12 }}>
                {query.return && mode === 'skill' ? (
                  <Button variant="primary" disabled={!name.trim()} onClick={() => { update({ approved: true }); notify(`"${name}" approved. It's tested on held-out repositories when the campaign starts.`); navigate(query.return); }}>
                    Approve skill
                  </Button>
                ) : (
                  <Button variant="primary" disabled={s.status === 'generating' || !name.trim()} onClick={run}>
                    {mode === 'td' ? 'Use this transformation' : s.status === 'generating' ? 'Testing…' : runLabel}
                  </Button>
                )}
                <Button className="btn-ai" onClick={() => continueInChat(`Walk me through the "${name}" skill`, `skill:${g.id}`)}>
                  <Icon.refresh style={{ marginRight: 6 }} /> Walk me through it
                </Button>
                {remediated && <Link onClick={() => navigate(`/app/cm/campaigns/${v.campaigns[0].id}`)}>View campaign</Link>}
              </div>
            </div>
          </li>
        </ol>
      </Container>
    </div>
  );
}
