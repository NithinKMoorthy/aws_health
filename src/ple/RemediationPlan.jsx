import React, { useMemo, useState } from 'react';
import { fmtDate, TRANSFORMATIONS } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Breadcrumbs, Button, Container, FormField, Icon, Input, Link, Modal, Radio, Select } from '../components/ui';
import { CAMPAIGN_NAMES, daysLeft, repoFixture, TARGETS } from './data';
import { groupView, PleTag } from './common';
import { groupTitle, skillPath } from './Groups';
import { skillSpec } from './Skill';

// Remediation plan: everything selected on Findings (or one group), shown as
// fixes in dependency order with what fixes each one. Shown before anything
// runs (R3); "Create campaign" starts it (R12).

const SKILL_TEST_MS = 6000;
const SEV_RANK = { High: 3, Medium: 2, Low: 1 };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const TD_TITLES = {
  'AWS/nodejs-version-upgrade': 'Node.js version upgrade',
  'AWS/nodejs-aws-sdk-v2-to-v3': 'AWS SDK for JavaScript v2 to v3',
  'AWS/java-version-upgrade': 'Java version upgrade',
  'AWS/python-version-upgrade': 'Python version upgrade',
};
const managedFixer = (td) => ({ kind: 'managed', name: td.replace(/^AWS\//, ''), title: TD_TITLES[td] ?? td, label: 'AWS-managed transformation' });

/** Findings in the plan, from ?findings=… or from a group (?scale, ?repo, ?finding). */
function usePlanFindings(state, groupId, query) {
  return useMemo(() => {
    const open = (f) => f && f.status === 'Open';
    if (query.findings) return query.findings.split(',').map((id) => state.findings.find((f) => f.id === id)).filter(open);
    const g = state.ple.groups.find((x) => x.id === groupId);
    if (!g) return [];
    const fs = state.findings.filter((f) => g.findingIds.includes(f.id) && open(f));
    if (query.finding) return fs.filter((f) => f.id === query.finding);
    if (query.repo) return fs.filter((f) => f.repo === query.repo);
    return fs;
  }, [state.findings, state.ple.groups, groupId, query.findings, query.finding, query.repo]);
}

function buildItems(state, findings, overrides, autoApprove) {
  const byGroup = new Map();
  const solo = [];
  findings.forEach((f) => {
    const g = state.ple.groups.find((x) => !x.adhoc && x.findingIds.includes(f.id));
    if (g) byGroup.set(g, [...(byGroup.get(g) ?? []), f]);
    else solo.push(f);
  });
  const items = [];
  byGroup.forEach((fs, g) => {
    const v = groupView(state, g);
    const e = v.event;
    let fixer;
    if (e?.td || (!e && v.td)) fixer = managedFixer(e?.td ?? v.td);
    else {
      const title = g.skill?.name ?? skillSpec(g, v).name;
      fixer = { kind: 'skill', name: slug(title), title, label: 'Generated skill' };
    }
    items.push({ key: g.id, g, v, e, title: groupTitle(g), findings: fs, fixer: overrides[g.id] ?? fixer, defaultFixer: fixer });
  });
  solo.forEach((f) => {
    const fixer = f.transformation ? managedFixer(f.transformation) : { kind: 'custom', name: `${slug(f.title)}-fix`, title: 'Custom fix', label: 'Custom transformation' };
    items.push({ key: f.id, f, title: f.title, findings: [f], fixer: overrides[f.id] ?? fixer, defaultFixer: fixer });
  });
  items.forEach((it) => {
    it.repos = [...new Set(it.findings.map((f) => f.repo))];
    it.severity = ['High', 'Medium', 'Low'].find((s) => it.findings.some((f) => f.severity === s));
    const sk = it.g?.skill;
    it.status = it.fixer.kind !== 'skill' ? 'ready' : sk?.status === 'generating' ? 'testing' : sk?.status === 'ready' || sk?.approved || autoApprove ? 'ready' : 'review';
    it.first = it.repos.some((r) => it.g && repoFixture(it.g.pleId, r)?.first);
  });
  // Dependency order: items holding shared repos first, then by change date and severity.
  return items.sort((a, b) => Number(b.first) - Number(a.first) || (a.e?.changeDate ?? '9').localeCompare(b.e?.changeDate ?? '9') || SEV_RANK[b.severity] - SEV_RANK[a.severity]);
}

export function RemediationPlan({ groupId, query }) {
  const { state, dispatch, notify } = useStore();
  const findings = usePlanFindings(state, groupId, query);
  const [overrides, setOverrides] = useState({});
  const [autoApprove, setAutoApprove] = useState(false);
  const [excluded, setExcluded] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [changing, setChanging] = useState(null);
  const items = buildItems(state, findings, overrides, autoApprove);
  const single = items.length === 1 && items[0].e ? items[0] : null;
  const names = single ? CAMPAIGN_NAMES[single.g.pleId] : null;
  const [name, setName] = useState(() => (names ? names[0] : items.length === 1 ? `Remediate ${items[0].title}` : `Remediate ${items[0]?.title ?? 'findings'} + ${Math.max(items.length - 1, 0)} more`));
  const [targetState, setTargetState] = useState(() => (names ? names[1](single.g.target) : 'All selected findings resolved'));

  const back = query.findings ? `/app/cm/findings?sel=${query.findings}` : groupId ? `/app/cm/findings/${groupId}` : '/app/cm/findings';
  if (!items.length) {
    return (
      <div className="page">
        <Breadcrumbs items={[{ label: 'Findings', onClick: () => navigate('/app/cm/findings') }, { label: 'Remediation plan' }]} />
        <Alert type="info" title="Nothing to remediate">These findings are already in a campaign or resolved. <Link onClick={() => navigate('/app/cm/findings')}>Back to findings</Link></Alert>
      </div>
    );
  }

  const inScope = (r) => !excluded.includes(r);
  const scoped = items.map((it) => ({ ...it, repos: it.repos.filter(inScope), findings: it.findings.filter((f) => inScope(f.repo)) })).filter((it) => it.findings.length);
  const allFindings = scoped.flatMap((it) => it.findings);
  const repos = [...new Set(allFindings.map((f) => f.repo))];
  const pairs = scoped.flatMap((it) => (it.v?.safety.pairs ?? []).filter(([a, b]) => inScope(a) && inScope(b)));
  const linkedRepos = [...new Set(pairs.flat())];
  const ready = scoped.filter((it) => it.status === 'ready').length;
  const allReady = ready === scoped.length;
  const nextReview = scoped.find((it) => it.status === 'review');
  const sevCounts = ['High', 'Medium', 'Low'].map((s) => [s, allFindings.filter((f) => f.severity === s).length]).filter(([, n]) => n);
  const due = scoped.map((it) => it.e?.changeDate).filter(Boolean).sort()[0];
  const managed = scoped.filter((it) => it.fixer.kind === 'managed').length;
  const custom = scoped.filter((it) => it.fixer.kind === 'custom').length;
  const skills = scoped.filter((it) => it.fixer.kind === 'skill').length;
  const planUrl = `${window.location.hash.replace(/^#/, '')}`;
  const toggle = (k) => setExpanded((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const create = () => {
    const cid = `C-${state.seq}`;
    const delays = {};
    scoped.forEach((it) => {
      if (it.fixer.kind === 'skill' && it.g.skill?.status !== 'ready') {
        dispatch({ type: 'PLE_SKILL_GENERATE', groupId: it.g.id, now: Date.now() });
        delays[it.g.id] = SKILL_TEST_MS;
      }
    });
    const newGroups = scoped.filter((it) => it.f).map((it) => ({ id: `G-adhoc-${it.f.id}`, pleId: it.f.pleId ?? null, name: it.title, shortName: it.title, type: 'A', findingIds: [it.f.id], target: null, skill: null, adhoc: true }));
    dispatch({
      type: 'PLE_START_CAMPAIGN',
      name: name.trim(),
      target: targetState.trim(),
      dueDate: due ?? null,
      groupIds: scoped.map((it) => (it.f ? `G-adhoc-${it.f.id}` : it.g.id)),
      newGroups,
      findingIds: allFindings.map((f) => f.id),
      excludeRepos: excluded,
      delays,
      checks: { equivalence: true, deps: true },
      now: Date.now(),
    });
    notify(`Campaign "${name.trim()}" started: ${plural(scoped.length, 'fix', 'fixes')} across ${plural(repos.length, 'repository', 'repositories')}.`);
    navigate(`/app/cm/campaigns/${cid}`);
  };

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Findings', onClick: () => navigate('/app/cm/findings') }, { label: 'Remediation plan' }]} />
      <div className="section-head">
        <div>
          <h1 className="page-title">Remediation plan</h1>
          <p className="page-desc">
            {plural(scoped.length, 'fix', 'fixes')} · {plural(allFindings.length, 'finding')} · {plural(repos.length, 'repository', 'repositories')} · {plural(repos.length, 'pull request')}
          </p>
          <p className="muted small">
            Check how each fix is made, then create a campaign. A campaign runs these fixes and opens one pull request per repository; nothing merges until your teams approve it.
          </p>
        </div>
        <Button onClick={() => navigate(back)}>Edit selection</Button>
      </div>

      {pairs.length > 0 && (
        <div className="dep-banner">
          <span className="tag tag-amber"><Icon.warn width={11} height={11} /> Cross-repo dependency</span>
          <div>
            <p>
              Some repos in this plan depend on each other: <strong>{linkedRepos.join(', ')}</strong>. AWS Transform runs them in sequence, but runtime links
              aren't visible from build files, so merging their PRs out of order could break the build. Remove a linked repo from this plan, or merge their PRs in order.
            </p>
            <div className="inline-gap">
              {linkedRepos.map((r) => <Link key={r} onClick={() => setExcluded([...excluded, r])}>Remove {r}</Link>)}
            </div>
          </div>
        </div>
      )}
      {excluded.length > 0 && (
        <Alert type="info" action={<Button variant="link" onClick={() => setExcluded([])}>Undo</Button>}>
          Removed from this plan: {excluded.join(', ')}. Their findings stay open on Findings.
        </Alert>
      )}

      <div className="plan-grid">
        <div>
          <Container
            header={<>Fixes <span className="muted">{scoped.length}</span></>}
            description={[managed && plural(managed, 'AWS-managed transformation'), custom && plural(custom, 'custom transformation'), skills && `${plural(skills, 'skill')} generated by AWS Transform`].filter(Boolean).join(' · ')}
            actions={scoped.length > 1 && <span className="muted small">In dependency order</span>}
          >
            <table className="table fixes-table">
              <thead>
                <tr><th style={{ width: 36 }} /><th style={{ width: '36%' }}>Fix</th><th>Fixed by</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {scoped.map((it, i) => (
                  <React.Fragment key={it.key}>
                    <tr>
                      <td><span className="order-num">{i + 1}</span></td>
                      <td className="wrap">
                        <strong>{it.title}</strong> {it.e && <span className="aws-ple-tag">AWS Health PLE</span>}
                        <div>
                          <Link onClick={() => toggle(it.key)}>{plural(it.findings.length, 'finding')} · {plural(it.repos.length, 'repository', 'repositories')} <Icon.caret className={expanded.has(it.key) ? 'up' : ''} /></Link>
                        </div>
                      </td>
                      <td className="wrap">
                        <strong>{it.fixer.title}</strong>
                        <div className={`small ${it.fixer.kind === 'skill' ? 'skill-text' : 'muted'}`}>{it.fixer.label}</div>
                        <div className="mono muted fixer-id" title={it.fixer.name}>{it.fixer.name}</div>
                        {it.fixer.kind === 'managed' && it.e && TARGETS[it.e.technology] && (
                          <div className="target-line">
                            <span className="muted small">Target</span>
                            <Select compact width={150} value={it.g.target} onChange={(t) => dispatch({ type: 'PLE_SET_TARGET', groupId: it.g.id, target: t })} options={TARGETS[it.e.technology].map((t) => ({ value: t, label: t, description: t === it.e.target ? 'Recommended' : undefined }))} />
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`dot-status ${it.status}`}>{it.status === 'ready' ? 'Ready' : it.status === 'testing' ? 'Testing' : 'Needs review'}</span>
                      </td>
                      <td className="row-actions-right">
                        {it.status === 'review' && <Button onClick={() => navigate(skillPath(it.g), { return: planUrl })}>Review</Button>}
                        <Link onClick={() => setChanging(it)}>Change</Link>
                      </td>
                    </tr>
                    {expanded.has(it.key) && (
                      <tr className="fix-detail">
                        <td />
                        <td colSpan={4}>
                          <ul className="plain-list">
                            {it.repos.map((r) => {
                              const fx = it.g && repoFixture(it.g.pleId, r);
                              return (
                                <li key={r}>
                                  <strong>{r}</strong> · {plural(it.findings.filter((f) => f.repo === r).length, 'finding')}
                                  {fx?.first && it.repos.length > 1 && <span className="muted small"> · runs first (others depend on it)</span>}
                                  {fx?.after && it.repos.includes(fx.after) && <span className="muted small"> · runs after {fx.after}</span>}
                                  {' '}<Link onClick={() => setExcluded([...excluded, r])}>Remove</Link>
                                </li>
                              );
                            })}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </Container>

          <Container header="Campaign details">
            <div className="two-col">
              <FormField label="Name" error={!name.trim() ? 'Name is required' : null}>
                <Input value={name} onChange={(e) => setName(e.target.value)} invalid={!name.trim()} />
              </FormField>
              <FormField label="Target state">
                <Input value={targetState} onChange={(e) => setTargetState(e.target.value)} />
              </FormField>
            </div>
            <p className="muted small checks-note">
              <Icon.info /> Every pull request runs AWS Transform validation, functional-equivalence and dependency checks before it opens. A fix counts as done only when it passes with no regressions.
            </p>
          </Container>
        </div>

        <aside className="plan-side container">
          <div className="plan-side-top">
            <h2>{allReady ? 'Ready to start' : `${plural(scoped.length - ready, 'fix needs', 'fixes need')} review`}</h2>
            <div className="meter-track"><div className="meter-fill success" style={{ width: `${(ready / scoped.length) * 100}%` }} /></div>
            <p>
              {!allReady
                ? 'Approve the generated skill, switch that fix to a transformation, or turn on auto-approve.'
                : skills
                  ? 'Every fix is ready. Generated skills are tested on held-out repositories before they change your code.'
                  : `Every fix is ready. AWS Transform opens ${plural(repos.length, 'pull request')} for your teams to review and merge.`}
            </p>
            {allReady ? (
              <Button variant="primary" className="block-btn" disabled={!name.trim()} onClick={create}>Create campaign</Button>
            ) : (
              <Button variant="primary" className="block-btn" onClick={() => navigate(skillPath(nextReview.g), { return: planUrl })}>Review next skill</Button>
            )}
          </div>
          {skills > 0 && (
          <div className="plan-side-toggle">
            <div>
              <strong>Auto-approve generated skills</strong>
              <p className="muted small">Skip review and start now. Changes are still validated before the pull request opens.</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} aria-label="Auto-approve generated skills" />
              <span />
            </label>
          </div>
          )}
          <div className="plan-stats">
            <div><div className="muted small">Findings</div><div className="stat-num">{allFindings.length}</div><div className="muted small">{sevCounts.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(' · ')}</div></div>
            <div><div className="muted small">Pull requests</div><div className="stat-num">{repos.length}</div><div className="muted small">one per repository{linkedRepos.length ? ` · ${linkedRepos.length} linked` : ''}</div></div>
            {due && (
              <div className="wide"><div className="muted small">Due date <PleTag /></div><div className="stat-num">{fmtDate(due)}</div><div className="muted small">{daysLeft(due)} days left · from AWS Health</div></div>
            )}
          </div>
        </aside>
      </div>

      {changing && <ChangeFixModal item={changing} onClose={() => setChanging(null)} onSave={(fixer) => { setOverrides({ ...overrides, [changing.key]: fixer }); setChanging(null); }} />}
    </div>
  );
}

function ChangeFixModal({ item, onClose, onSave }) {
  const canSkill = !!item.g && item.defaultFixer.kind === 'skill';
  const [kind, setKind] = useState(item.fixer.kind);
  const [td, setTd] = useState(item.fixer.kind === 'managed' ? `AWS/${item.fixer.name}` : TRANSFORMATIONS[0]);
  const [prompt, setPrompt] = useState(item.fixer.prompt ?? `Resolve "${item.title}" in ${item.repos.join(', ')}.`);
  const save = () => {
    if (kind === 'managed') onSave(managedFixer(td));
    else if (kind === 'custom') onSave({ kind, name: `${slug(item.title)}-fix`, title: 'Custom fix', label: 'Custom transformation', prompt });
    else onSave(item.defaultFixer);
  };
  return (
    <Modal
      title={`Change how "${item.title}" is fixed`}
      width={640}
      onClose={onClose}
      footer={<><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}
    >
      <Radio
        name="fixer"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'managed', label: 'AWS-managed transformation', description: 'A predefined, validated transformation definition.' },
          ...(canSkill ? [{ value: 'skill', label: 'Specialized skill', description: 'Generated by AWS Transform for this group. Needs review, then it is tested on held-out repositories.' }] : []),
          { value: 'custom', label: 'Custom transformation', description: 'Describe the change; AWS Transform drafts a transformation definition.' },
        ]}
      />
      {kind === 'managed' && (
        <FormField label="Transformation definition">
          <Select value={td} onChange={setTd} options={TRANSFORMATIONS.map((t) => ({ value: t, label: t }))} />
        </FormField>
      )}
      {kind === 'custom' && (
        <FormField label="What should change?">
          <textarea className="input textarea" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </FormField>
      )}
    </Modal>
  );
}
