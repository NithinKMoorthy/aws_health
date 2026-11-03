import React, { useMemo, useState } from 'react';
import { fmtDate, TRANSFORMATIONS } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Breadcrumbs, Button, Container, FormField, Icon, Input, Link, Modal, Select } from '../components/ui';
import { CAMPAIGN_NAMES, daysLeft, repoFixture, TARGETS } from './data';
import { DependencyWarning, EventHeader, groupView, PleTag, unit } from './common';
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
const managedFixer = (td) => (td.startsWith('AWS/')
  ? { kind: 'managed', name: td.replace(/^AWS\//, ''), title: TD_TITLES[td] ?? td, label: 'AWS-managed TD' }
  : { kind: 'custom', name: td, title: td, label: 'Custom TD' });

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
    const ah = state.ple.groups.find((x) => x.adhoc && x.skill && x.findingIds.includes(f.id));
    if (ah && !overrides[f.id]) {
      const v = groupView(state, ah);
      const title = ah.skill.name ?? skillSpec(ah, v).name;
      const fixer = { kind: 'skill', name: slug(title), title, label: 'Generated skill' };
      items.push({ key: ah.id, g: ah, v, e: null, title: f.title, findings: [f], fixer, defaultFixer: fixer });
      return;
    }
    const fixer = f.transformation ? managedFixer(f.transformation) : { kind: 'custom', name: `${slug(f.title)}-fix`, title: 'Custom fix', label: 'Custom TD' };
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

// A whole AWS Health event's group gets the event plan; any other selection the general one.
export function RemediationPlan({ groupId, query }) {
  const { state } = useStore();
  const g = groupId && state.ple.groups.find((x) => x.id === groupId);
  const event = g?.pleId && !query.review && !query.findings && !query.repo && !query.finding && state.ple.events.find((e) => e.id === g.pleId);
  if (event) return <EventPlan g={g} event={event} />;
  return <GeneralPlan groupId={groupId} query={query} />;
}

// ---- One lifecycle event: one pull request per repository ---------------------------

function EventPlan({ g, event }) {
  const { state, dispatch, notify } = useStore();
  const [excluded, setExcluded] = useState([]);
  const [preview, setPreview] = useState(null);
  const findings = state.findings.filter((f) => g.findingIds.includes(f.id) && f.status === 'Open');
  const repos = [...new Set(findings.map((f) => f.repo))];
  const fns = (r) => event.resources.filter((x) => x.repo === r).map((x) => x.name);
  const picked = repos.filter((r) => !excluded.includes(r));
  const nFns = picked.reduce((k, r) => k + fns(r).length, 0);
  const total = event.resources.length;
  const target = g.target ?? event.target;
  const names = CAMPAIGN_NAMES[event.id];
  const toggle = (r) => setExcluded((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]));
  const days = daysLeft(event.changeDate);

  if (!repos.length) {
    return (
      <div className="page get-started">
        <Breadcrumbs items={[{ label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') }, { label: 'Findings', onClick: () => navigate('/app/cm/findings') }, { label: 'Remediation plan' }]} />
        <Alert type="info" title="Nothing to remediate">These findings are already in a campaign or resolved. <Link onClick={() => navigate('/app/cm/findings')}>Back to findings</Link></Alert>
      </div>
    );
  }

  const create = () => {
    const cid = `C-${state.seq}`;
    const name = names?.[0] ?? `Upgrade ${g.shortName}`;
    dispatch({
      type: 'PLE_START_CAMPAIGN',
      name,
      target: names ? names[1](target) : `All resources on ${target}`,
      dueDate: event.changeDate,
      groupIds: [g.id],
      findingIds: findings.filter((f) => picked.includes(f.repo)).map((f) => f.id),
      excludeRepos: excluded,
      checks: { equivalence: true, deps: true },
      now: Date.now(),
    });
    notify(`Campaign "${name}" started: ${plural(picked.length, 'pull request')} across ${plural(nFns, 'function')}.`);
    navigate(`/app/cm/campaigns/${cid}`);
  };

  return (
    <div className="page get-started">
      <Breadcrumbs items={[{ label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') }, { label: 'Findings', onClick: () => navigate('/app/cm/findings') }, { label: 'Remediation plan' }]} />
      <EventHeader event={event} />
      <div className="setup-head">
        <h1>Remediation plan</h1>
        <p>AWS Transform opens one pull request per repository. Each passes validation before it opens, and nothing merges until your teams approve.</p>
      </div>
      <section className="setup-card flush">
        <div className="plan-head">
          <span className="ver-old">{event.from}</span> <span className="arrow">→</span>
          {TARGETS[event.technology] ? (
            <Select compact width={130} value={target} onChange={(t) => dispatch({ type: 'PLE_SET_TARGET', groupId: g.id, target: t })} options={TARGETS[event.technology].map((t) => ({ value: t, label: t, description: t === event.target ? 'Recommended' : undefined }))} />
          ) : (
            <span className="ver-new">{target}</span>
          )}
          <span>{event.tdLabel ?? 'Specialized skill'} <span className="muted">· {event.td ? 'AWS-managed transformation' : 'generated by AWS Transform'}</span></span>
          <span className="grow" />
          <span className="muted">Due</span> {fmtDate(event.changeDate)} <span className={`due ${days <= 120 ? 'due-urgent' : 'due-soon'}`}>{days} days left</span>
        </div>
        <table className="table plain plan-table">
          <thead>
            <tr><th style={{ width: 40 }} /><th>Pull request</th><th>{unit(event, 2).replace(/^./, (c) => c.toUpperCase())}</th><th>What changes</th><th className="num">Size</th></tr>
          </thead>
          <tbody>
            {repos.map((r) => {
              const fx = repoFixture(event.id, r) ?? {};
              const [add, del] = fx.size ?? [10, 8];
              return (
                <tr key={r} className={excluded.includes(r) ? 'muted-row' : ''}>
                  <td><input type="checkbox" checked={!excluded.includes(r)} onChange={() => toggle(r)} aria-label={`Include ${r}`} /></td>
                  <td>
                    <strong>{r}</strong>
                    <div><Link onClick={() => setPreview(r)}><strong className="small">Preview changes</strong></Link></div>
                  </td>
                  <td>{fns(r).join(', ')}</td>
                  <td>Runtime in {fx.file ?? 'template.yaml'}{fx.delta ? ` · ${fx.delta}` : ''}</td>
                  <td className="num mono small"><span className="add">+{add}</span> <span className="del">−{del}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="muted small scan-note">
        <Icon.info /> Each pull request runs AWS Transform validation, functional-equivalence and dependency checks before it opens. Any that fail are held back and shown here, not opened.
      </p>
      <div className="setup-actions">
        <span className="muted">{plural(picked.length, 'pull request')} · {nFns} of {total} {unit(event, total)}</span>
        <span className="grow" />
        <Button variant="link" onClick={() => navigate(`/app/cm/findings/${g.id}`)}>Cancel</Button>
        <Button variant="primary" disabled={!picked.length} onClick={create}>Create campaign</Button>
      </div>
      {preview && (
        <Modal title={`${preview}: preview changes`} onClose={() => setPreview(null)} footer={<Button variant="primary" onClick={() => setPreview(null)}>Close</Button>} width={680}>
          {(() => {
            const fx = repoFixture(event.id, preview) ?? {};
            return (
              <>
                <p className="muted">Generated by {event.td ?? 'a specialized skill'} for this event. Validation runs before the pull request opens.</p>
                <pre className="code-block diff">
                  {`--- a/${fx.file}\n+++ b/${fx.file}\n@@ ${fx.line ?? 1} @@\n-  ${event.evidence}\n+  ${event.evidence.replace(event.from, target)}${fx.delta ? `\n\n# Also: ${fx.delta}` : ''}`}
                </pre>
              </>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

// ---- General plan: any selection of findings and groups ------------------------------

function GeneralPlan({ groupId, query }) {
  const { state, dispatch, notify } = useStore();
  const findings = usePlanFindings(state, groupId, query);
  const [overrides, setOverrides] = useState({});
  const [autoApprove, setAutoApprove] = useState(false);
  const [excluded, setExcluded] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());
  // ?review=1 (from Findings) opens the first item's review panel.
  const [reviewing, setReviewing] = useState(() => (query.review ? '__first' : null));
  const [reviewTab, setReviewTab] = useState(null);
  const openReview = (key, tab) => { setReviewing(key); setReviewTab(tab); };
  const [orders, setOrders] = useState({});
  const [leftOut, setLeftOut] = useState([]);
  const [confirmed, setConfirmed] = useState({});
  const [ordering, setOrdering] = useState(null);
  const items = buildItems(state, findings, overrides, autoApprove);
  const single = items.length === 1 && items[0].e ? items[0] : null;
  const names = single ? CAMPAIGN_NAMES[single.g.pleId] : null;
  const [name, setName] = useState(() => (names ? names[0] : items.length === 1 ? `Remediate ${items[0].title}` : `Remediate ${items[0]?.title ?? 'findings'} + ${Math.max(items.length - 1, 0)} more`));
  const targetState = names ? names[1](single.g.target) : 'All selected findings resolved';

  const back = query.findings ? `/app/cm/findings?sel=${query.findings}` : groupId ? `/app/cm/findings/${groupId}` : '/app/cm/findings';
  if (!items.length) {
    return (
      <div className="page">
        <Breadcrumbs items={[{ label: 'Findings', onClick: () => navigate('/app/cm/findings') }, { label: 'Remediation plan' }]} />
        <Alert type="info" title="Nothing to remediate">These findings are already in a campaign or resolved. <Link onClick={() => navigate('/app/cm/findings')}>Back to findings</Link></Alert>
      </div>
    );
  }

  const reviewKey = reviewing === '__first' ? items[0]?.key : reviewing;
  // Opened from Findings (?review), a skill item opens on the skill tab and a TD item on the TD tab.
  const tabFor = (it) => reviewTab ?? (it.fixer.kind === 'skill' && it.g ? 'skill' : 'td');
  const inScope = (r) => !excluded.includes(r);
  const scoped = items.filter((it) => !leftOut.includes(it.key)).map((it) => ({ ...it, repos: it.repos.filter(inScope), findings: it.findings.filter((f) => inScope(f.repo)) })).filter((it) => it.findings.length);
  const allFindings = scoped.flatMap((it) => it.findings);
  const repos = [...new Set(allFindings.map((f) => f.repo))];
  // Items spanning several repos need a merge order the customer confirms.
  const withOrder = (it) => {
    const set = orders[it.key] ?? [];
    return set.filter((r) => it.repos.includes(r)).concat(it.repos.filter((r) => !set.includes(r)));
  };
  // Repos whose changes may depend on each other: the ones the analysis links, else the first few.
  const linked = (it) => {
    const dep = it.repos.filter((r) => { const fx = it.g && repoFixture(it.g.pleId, r); return fx?.first || fx?.after; });
    return (dep.length >= 2 ? dep : it.repos).slice(0, 3);
  };
  const unordered = scoped.filter((it) => it.repos.length > 1 && !confirmed[it.key]);
  const linkedRepos = [...new Set(unordered.flatMap(linked))];
  const move = (it, r, d) => {
    const list = withOrder(it);
    const i = list.indexOf(r);
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setOrders({ ...orders, [it.key]: list });
  };
  const setOrderFor = (it) => { setOrdering(it.key); setExpanded((x) => new Set([...x, it.key])); };
  const ready = scoped.filter((it) => it.status === 'ready').length;
  const allReady = ready === scoped.length;
  const nextReview = scoped.find((it) => it.status === 'review');
  const sevCounts = ['High', 'Medium', 'Low'].map((s) => [s, allFindings.filter((f) => f.severity === s).length]).filter(([, n]) => n);
  const due = scoped.map((it) => it.e?.changeDate).filter(Boolean).sort()[0];
  const managed = scoped.filter((it) => it.fixer.kind === 'managed').length;
  const custom = scoped.filter((it) => it.fixer.kind === 'custom').length;
  const skills = scoped.filter((it) => it.fixer.kind === 'skill').length;
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
            {plural(scoped.length, 'item')} · {plural(allFindings.length, 'finding')} · {plural(repos.length, 'repository', 'repositories')} · one pull request each
          </p>
        </div>
        <Button onClick={() => navigate(back)}>Edit selection</Button>
      </div>

      {unordered.length > 0 && (
        <DependencyWarning
          where="plan"
          repos={linkedRepos}
          onRemove={(r) => setExcluded([...excluded, r])}
          onSetOrder={() => setOrderFor(unordered[0])}
        />
      )}
      {leftOut.length > 0 && (
        <Alert type="info" action={<Button variant="link" onClick={() => setLeftOut([])}>Undo</Button>}>
          Left out of this plan: {items.filter((it) => leftOut.includes(it.key)).map((it) => it.title).join(', ')}. Their findings stay open on Findings.
        </Alert>
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
            description={`✦ ${[managed + custom && plural(managed + custom, 'existing TD'), skills && `${plural(skills, 'skill')} generated by AWS Transform`].filter(Boolean).join(' · ')}`}
            actions={<span className="muted small">In dependency order</span>}
          >
            <table className="table fixes-table">
              <thead>
                <tr><th style={{ width: 48 }} /><th style={{ width: '36%' }}>Fix</th><th style={{ width: '30%' }}>Fixed by</th><th>Status</th></tr>
              </thead>
              <tbody>
                {scoped.map((it, i) => (
                  <React.Fragment key={it.key}>
                    <tr className={reviewKey === it.key ? 'reviewing' : ''}>
                      <td><span className="order-num">{i + 1}</span></td>
                      <td className="wrap">
                        <strong>{it.title}</strong> {it.e && <span className="aws-ple-tag">AWS Health PLE</span>}
                        <div>
                          <Link className="muted-link" onClick={() => toggle(it.key)}>{plural(it.findings.length, 'finding')} · {plural(it.repos.length, 'repository', 'repositories')} <Icon.caret className={expanded.has(it.key) ? 'up' : ''} /></Link>
                        </div>
                      </td>
                      <td className="wrap">
                        <div className="mono fixer-id" title={it.fixer.name}>{it.fixer.name}</div>
                        <div className={`small ${it.fixer.kind === 'skill' ? 'skill-text' : 'muted'}`}>{it.fixer.label}</div>
                        {it.fixer.kind === 'managed' && it.e && TARGETS[it.e.technology] && (
                          <div className="target-line">
                            <span className="muted small">Target</span>
                            <Select compact width={150} value={it.g.target} onChange={(t) => dispatch({ type: 'PLE_SET_TARGET', groupId: it.g.id, target: t })} options={TARGETS[it.e.technology].map((t) => ({ value: t, label: t, description: t === it.e.target ? 'Recommended' : undefined }))} />
                          </div>
                        )}
                      </td>
                      <td className="status-col">
                        <div className="status-line">
                          <span className={`dot-status ${it.status}`}>{it.status === 'ready' ? 'Ready' : it.status === 'testing' ? 'Testing' : 'Needs review'}</span>
                          {it.status === 'review' && <Button onClick={() => (reviewKey === it.key && reviewTab !== 'td' ? setReviewing(null) : openReview(it.key, 'skill'))}>Review</Button>}
                          <span className="grow" />
                          <button type="button" className={`change-btn ${reviewKey === it.key && tabFor(it) === 'td' ? 'on' : ''}`} onClick={() => (reviewKey === it.key && tabFor(it) === 'td' ? setReviewing(null) : openReview(it.key, 'td'))}>Change</button>
                        </div>
                      </td>
                    </tr>
                    {expanded.has(it.key) && (
                      <tr className="fix-detail">
                        <td />
                        <td colSpan={3}>
                          {ordering === it.key && <p className="small muted order-hint">Put the repo others depend on first. Pull requests open and merge in this order.</p>}
                          <ul className={`plain-list ${ordering === it.key ? 'ordering' : ''}`}>
                            {withOrder(it).map((r, ri, arr) => {
                              const fx = it.g && repoFixture(it.g.pleId, r);
                              return (
                                <li key={r}>
                                  {ordering === it.key && (
                                    <span className="order-ctl">
                                      <span className="order-pos">{ri + 1}</span>
                                      <button type="button" className="icon-btn" disabled={ri === 0} aria-label={`Move ${r} up`} onClick={() => move(it, r, -1)}>↑</button>
                                      <button type="button" className="icon-btn" disabled={ri === arr.length - 1} aria-label={`Move ${r} down`} onClick={() => move(it, r, 1)}>↓</button>
                                    </span>
                                  )}
                                  <strong>{r}</strong> · {plural(it.findings.filter((f) => f.repo === r).length, 'finding')}
                                  {fx?.first && it.repos.length > 1 && <span className="muted small"> · runs first (others depend on it)</span>}
                                  {fx?.after && it.repos.includes(fx.after) && <span className="muted small"> · runs after {fx.after}</span>}
                                  {' '}<Link onClick={() => setExcluded([...excluded, r])}>Remove</Link>
                                </li>
                              );
                            })}
                          </ul>
                          {ordering === it.key && (
                            <div className="inline-gap order-actions">
                              <Button variant="primary" onClick={() => { setConfirmed({ ...confirmed, [it.key]: true }); setOrdering(null); notify(`Merge order set for ${it.title}.`); }}>Confirm order</Button>
                              <Button variant="link" onClick={() => setOrdering(null)}>Cancel</Button>
                            </div>
                          )}
                          {it.repos.length > 1 && confirmed[it.key] && ordering !== it.key && (
                            <p className="small muted">Merge order set by you · <Link onClick={() => setOrdering(it.key)}>Change order</Link></p>
                          )}
                        </td>
                      </tr>
                    )}
                    {reviewKey === it.key && (
                      <tr className="review-row">
                        <td colSpan={4}>
                          <ReviewPanel
                            key={`${it.fixer.kind}-${tabFor(it)}`}
                            it={it}
                            tab={tabFor(it)}
                            onTab={setReviewTab}
                            many={scoped.length > 1}
                            onLeaveOut={() => { setLeftOut([...leftOut, it.key]); setReviewing(null); }}
                            onClose={() => setReviewing(null)}
                            onUseTd={(t) => setOverrides({ ...overrides, [it.key]: managedFixer(t) })}
                            onUseSkill={() => setOverrides({ ...overrides, [it.key]: { kind: 'skill', name: slug(it.g.skill?.name ?? skillSpec(it.g, it.v).name), title: it.g.skill?.name ?? skillSpec(it.g, it.v).name, label: 'Generated skill' } })}
                            onApproveTd={() => notify(`${it.fixer.title} kept for ${it.title}.`)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </Container>

          {allReady && (
          <Container header="Campaign details">
            <div className="two-col">
              <FormField label="Name" error={!name.trim() ? 'Name is required' : null}>
                <Input value={name} onChange={(e) => setName(e.target.value)} invalid={!name.trim()} />
              </FormField>
            </div>
            <p className="muted small checks-note">
              <Icon.info /> Every pull request runs AWS Transform validation, functional-equivalence and dependency checks before it opens. A fix counts as done only when it passes with no regressions.
            </p>
          </Container>
          )}
        </div>

        <aside className="plan-side container">
          <div className="plan-side-top">
            <h2>{allReady ? 'Ready to start' : `${ready} of ${plural(scoped.length, 'item')} ready`}</h2>
            <div className="meter-track"><div className="meter-fill success" style={{ width: `${(ready / scoped.length) * 100}%` }} /></div>
            <p>
              {!allReady
                ? `Approve the generated ${scoped.length - ready === 1 ? 'skill' : 'skills'}, switch ${scoped.length - ready === 1 ? 'that item' : 'those items'} to a TD, or turn on auto-approve.`
                : skills
                  ? 'Every fix is ready. Generated skills are tested on held-out repositories before they change your code.'
                  : `Every fix is ready. AWS Transform opens ${plural(repos.length, 'pull request')} for your teams to review and merge.`}
            </p>
            {allReady ? (
              <Button variant="primary" className="block-btn" disabled={!name.trim()} onClick={create}>Create campaign</Button>
            ) : (
              <Button variant="primary" className="block-btn" onClick={() => { openReview(nextReview.key, 'skill'); setTimeout(() => document.querySelector('.review-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); }}>Review next skill</Button>
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
            <div><div className="muted small">Findings</div><div className="stat-num">{allFindings.length}</div><div className="muted small">{sevCounts.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(' · ')} severity</div></div>
            <div><div className="muted small">Pull requests</div><div className="stat-num">{repos.length}</div><div className="muted small">one per repository</div></div>
            <div className="wide"><div className="muted small">Repositories</div><div className="stat-num">{repos.length}</div><div className="muted small">{linkedRepos.length ? `${linkedRepos.length} may depend on each other` : scoped.some((it) => it.repos.length > 1) ? 'merge order set' : 'run independently'}</div></div>
            {due && (
              <div className="wide"><div className="muted small">Due date <PleTag /></div><div className="stat-num">{fmtDate(due)}</div><div className="muted small">{daysLeft(due)} days left · from AWS Health</div></div>
            )}
          </div>
        </aside>
      </div>

    </div>
  );
}

// ---- Inline review, under its item: Review opens the skill tab, Change opens the TD tab ----

const plural2 = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
const SPEC_KEYS = [['target', 'Target'], ['approach', 'Approach'], ['validation', 'Validation'], ['guardrails', 'Guardrails']];
const SAVE_OPTIONS = [['published', 'Publish', 'Shared in the Skills Library once it passes validation'], ['draft', 'Save as draft', 'Visible in the Skills Library now, marked “Not yet validated”'], ['one-off', 'One-off', 'Used for this remediation only; nothing is shared']];
// How AWS Transform recommends saving a skill, with a one-line reason.
const saveRecommendation = (it) => (it.repos.length > 1
  ? ['published', `It applies to ${it.repos.length} repos, so others can reuse it once it passes.`]
  : it.g?.custom ? ['draft', 'The group was edited by hand, so share it as a draft until it passes once.']
    : ['one-off', 'It’s specific to one repo; nothing here is worth sharing yet.']);
const TD_VERSIONS = { 'AWS/nodejs-version-upgrade': 'v3.2', 'AWS/nodejs-aws-sdk-v2-to-v3': 'v2.1', 'AWS/java-version-upgrade': 'v4.0', 'AWS/python-version-upgrade': 'v2.3' };
const tdOf = (fixer) => (fixer.kind === 'managed' ? `AWS/${fixer.name}` : fixer.kind === 'custom' ? fixer.name : null);
const tdLabel = (td) => td.replace(/^(AWS|Custom)\//, '');
const isManagedTd = (td) => td.startsWith('AWS/');

// What a TD does for this item, in the same four rows as a skill.
function tdSpec(it, td) {
  const e = it.e;
  if (e) {
    return {
      Target: `${it.g?.target ?? e.target} on every affected ${unit(e, 1)}`,
      Approach: e.service === 'Lambda' ? 'Bump the runtime in infrastructure-as-code, update engines and dependencies, replace APIs the new runtime removes' : `Change the version setting in infrastructure-as-code, carry over settings the new ${e.service} version needs`,
      Validation: 'Build and tests pass on the new version · the analysis no longer reports the old one',
      Guardrails: 'Infrastructure-as-code and dependency files only · one pull request per repository',
    };
  }
  return {
    Target: `${tdLabel(td)} applied in ${plural2(it.repos.length, 'repo')}`,
    Approach: 'Apply the TD’s recipe one commit per change',
    Validation: 'Build and tests pass; the original rule re-runs clean',
    Guardrails: 'Files the TD declares · nothing else',
  };
}

const Chevron = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;

function ReviewPanel({ it, tab, onTab, onClose, onUseTd, onUseSkill, onApproveTd, onLeaveOut, many }) {
  const { dispatch, notify } = useStore();
  const { g, v } = it;
  const s = g?.skill ?? {};
  const spec = g ? skillSpec(g, v) : null;
  const edits = s.edits ?? {};
  const findingTotal = it.findings.length;
  const usingSkill = it.fixer.kind === 'skill';
  const skillId = slug(s.name ?? spec?.name ?? `${it.title}-fix`);
  const [editing, setEditing] = useState(false);
  const [openSpec, setOpenSpec] = useState(() => new Set());
  const [addingContext, setAddingContext] = useState(false);
  const [context, setContext] = useState(s.context ?? '');
  const [recommendedSave, saveReason] = saveRecommendation(it);
  const savePick = s.saveAs ?? recommendedSave;
  const update = (patch) => g && dispatch({ type: 'PLE_SKILL_UPDATE', groupId: g.id, patch });
  const flip = (k) => setOpenSpec((o) => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // TD choices: the recommendation and the current fix first, then the other TDs.
  const recTd = tdOf(it.defaultFixer);
  const curTd = tdOf(it.fixer);
  const tdOptions = [...new Set([recTd, curTd, ...TRANSFORMATIONS].filter(Boolean))];
  const [td, setTd] = useState(curTd ?? tdOptions[0]);
  const full = td === recTd;
  const covered = full ? findingTotal : Math.max(1, findingTotal - 1);
  const left = full ? [] : it.findings.slice(covered);
  const optionName = (t) => [`${tdLabel(t)}${TD_VERSIONS[t] ? ` ${TD_VERSIONS[t]}` : ''}`, t === recTd && 'Recommended', t === curTd && 'Current'].filter(Boolean).join(' · ');

  const contextLine = () => (
    <div className="tf-line"><span className="tf-label">Context</span>
      {addingContext || context
        ? <textarea className="rp-context" rows={2} autoFocus={addingContext} value={context} onChange={(e) => { setContext(e.target.value); update({ context: e.target.value }); }} placeholder="Anything AWS Transform should know, e.g. “keys live in the shared-config repo”" />
        : <><span className="tf-value muted">None added</span><Link className="tf-link" onClick={() => setAddingContext(true)}><strong>Add context</strong></Link></>}
    </div>
  );

  return (
    <div className="rp-inline-review tf">
      <header>
        <strong>Transformation</strong>
        <div className="tf-toggle" role="tablist" aria-label="How to remediate">
          {[['skill', 'Specialized skill'], ['td', 'Managed or custom TD']].map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} disabled={value === 'skill' && !g} onClick={() => onTab(value)}>{label}</button>
          ))}
        </div>
      </header>

      {tab === 'skill' && g ? (
        <>
          <div className="tf-skill">
            <span className="tf-skill-mark" aria-hidden="true">✦</span>
            <div>
              <strong className="mono">{skillId}</strong>
              <small>{usingSkill ? `Generated from your analysis · covers ${plural2(findingTotal, 'finding')} in ${plural2(it.repos.length, 'repo')}` : `No skill yet · generating one takes ~${it.repos.length > 3 ? 15 : 8} agent minutes`}</small>
            </div>
            <button type="button" className={`tf-edit ${editing ? 'on' : ''}`} onClick={() => setEditing((x) => !x)}>✎ {editing ? 'Done editing' : 'Edit skill'}</button>
          </div>
          <ul className="tf-spec">
            {SPEC_KEYS.map(([k, label]) => {
              const value = edits[k] ?? spec[k];
              const changed = edits[k] != null && edits[k] !== spec[k];
              const open = openSpec.has(k) || editing;
              const detail = {
                target: `Covers ${plural2(findingTotal, 'finding')}. AWS Transform re-runs the original rule after merge to confirm the remediation.`,
                approach: 'Each step is a separate commit on one branch, so a reviewer can follow the change.',
                validation: 'Validation runs before the pull request opens; the skill stops if a check fails.',
                guardrails: 'AWS Transform stops and asks you if a change would fall outside these bounds.',
              }[k];
              return (
                <li key={k} className={open ? 'open' : ''}>
                  <button type="button" className="tf-spec-row" aria-expanded={open} onClick={() => flip(k)}>
                    <Chevron />
                    <span className="tf-spec-name">{label}</span><span className="tf-spec-value">{value}</span>
                    <span className={`tf-badge ${changed ? 'edited' : ''}`}>{changed ? 'Edited' : 'Default'}</span>
                  </button>
                  {open && (
                    <div className="tf-spec-detail">
                      {editing && <input value={value} onChange={(e) => update({ edits: { ...edits, [k]: e.target.value } })} aria-label={`${label} for ${skillId}`} />}
                      <p>{detail}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="tf-line"><span className="tf-label">Decisions</span>
            {editing ? (
              <div className="tf-decisions">
                {spec.decisions.map(([label, rec, opts]) => (
                  <label key={label}><span>{label}</span>
                    <select value={s.decisions?.[label] ?? rec} onChange={(e) => update({ decisions: { ...(s.decisions ?? {}), [label]: e.target.value } })}>
                      {opts.map((o) => <option key={o} value={o}>{o}{o === rec ? ' (recommended)' : ''}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            ) : <span className="tf-value">{spec.decisions.map(([label, rec]) => s.decisions?.[label] ?? rec).join(' · ')}</span>}
            {!editing && <span className="tf-note">{spec.decisions.every(([label, rec]) => (s.decisions?.[label] ?? rec) === rec) ? 'Recommended' : 'Changed by you'}</span>}
          </div>
          {contextLine()}
          <div className="tf-line"><span className="tf-label">Save the skill</span>
            <div className="rp-save">
              <div className="rp-publish" role="radiogroup" aria-label="Save the skill">
                {SAVE_OPTIONS.map(([value, label, blurb]) => (
                  <label key={value} className={savePick === value ? 'selected' : ''}>
                    <input type="radio" name={`save-${it.key}`} checked={savePick === value} onChange={() => update({ saveAs: value })} />
                    <span><strong>{label}{value === recommendedSave && <span className="sk-tag">Recommended</span>}</strong><small>{blurb}</small></span>
                  </label>
                ))}
              </div>
              <small className="rp-save-reason">✦ {saveReason}</small>
            </div>
          </div>
          <footer>
            {usingSkill
              ? <Button variant="primary" onClick={() => { update({ approved: true, saveAs: savePick, name: s.name ?? spec.name }); notify(`“${s.name ?? spec.name}” approved for ${it.title}.`); onClose(); }}>Approve skill</Button>
              : <Button variant="primary" onClick={() => { onUseSkill(); update({ approved: true, saveAs: savePick, name: s.name ?? spec.name }); notify(`${it.title} now uses a generated skill.`); onClose(); }}>Use this skill</Button>}
            <button type="button" className="tf-close" onClick={onClose}>Close</button>
            <Link className="tf-link tf-full" onClick={() => navigate(skillPath(g), { return: window.location.hash.replace(/^#/, '') })}><strong>Open full page</strong></Link>
          </footer>
        </>
      ) : (
        <>
          <div className="tf-td-pick">
            <span className={`tf-td-kind ${isManagedTd(td) ? 'managed' : ''}`} title={isManagedTd(td) ? 'Managed TD' : 'Custom TD'}>{isManagedTd(td) ? 'M' : 'C'}</span>
            <select value={td} onChange={(e) => setTd(e.target.value)} aria-label="Transformation definition">
              {tdOptions.map((t) => <option key={t} value={t}>{optionName(t)}</option>)}
            </select>
            <span className={`tf-td-cover ${full ? 'full' : ''}`}>Covers {covered} of {plural2(findingTotal, 'finding')} · {full ? '4 of 4' : '3 of 4'} validations</span>
          </div>
          {left.length
            ? <p className="tf-tradeoff"><strong>Trade-off:</strong> {tdLabel(td)} wasn’t built for {it.title}. <span className="tf-stays">Stays open: {left.map((f) => f.title).join(', ')}.</span></p>
            : <p className="tf-tradeoff"><strong>Why this TD:</strong> {it.e ? `Moves every affected ${unit(it.e, 1)} from ${it.e.from} to ${it.g?.target ?? it.e.target}, the version AWS Health recommends.` : `Covers all ${plural2(findingTotal, 'finding')} in ${it.repos.length === 1 ? it.repos[0] : `${it.repos.length} repos`}.`}</p>}
          <ul className="tf-spec">
            {Object.entries(tdSpec(it, td)).map(([label, value]) => (
              <li key={label}>
                <div className="tf-spec-row static"><Chevron /><span className="tf-spec-name">{label}</span><span className="tf-spec-value">{value}</span><span className="tf-badge">{isManagedTd(td) ? 'Managed' : 'Custom'}</span></div>
              </li>
            ))}
          </ul>
          <div className="tf-line"><span className="tf-label">Decisions</span><span className="tf-value">{[it.e ? `Target ${it.g?.target ?? it.e.target}` : 'TD defaults', 'One pull request per repository'].join(' · ')}</span><span className="tf-note">Set by this TD</span></div>
          {contextLine()}
          <footer>
            {td === curTd
              ? <Button variant="primary" onClick={() => { onApproveTd(); onClose(); }}>Keep this TD</Button>
              : <Button variant="primary" onClick={() => { onUseTd(td); notify(`${it.title} now uses ${tdLabel(td)}.`); onClose(); }}>Use this TD</Button>}
            <button type="button" className="tf-close" onClick={onClose}>Close</button>
            {many && <Link className="tf-link tf-full" onClick={onLeaveOut}><strong>Leave out of this campaign</strong></Link>}
          </footer>
        </>
      )}
    </div>
  );
}
