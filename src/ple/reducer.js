// PLE slice of the mock backend. pleReducer handles PLE_* actions; pleTick
// advances PLE analyses, skill generation, campaign runs, deploys and AWS
// Health status. Both return the full app state.

import {
  buildFindings, buildGroup, eventById, initialCampaigns, initialEvents, MOCK_TODAY, NEW_EVENT, ORG, ORG_REPOS, OTHER_GROUPS, repoFixture, UNREADABLE,
} from './data';

const ANALYSIS_MS = 9000;
const SKILL_MS = 6000;
const RUN_MS = 4000;
const MERGE_MS = 2500;
const DEPLOY_MS = 2000;
const HEALTH_MS = 3500;

export const CM_CUSTOMER_KEY = 'atx-mock-cm-customer';

export const RESOLVED_HEALTH = 'Resolved (AWS Health)';

function blankPle() {
  return {
    events: initialEvents,
    onboarded: false,
    entryEventId: null,
    entryEventIds: [],
    schedule: null,
    setup: { provider: null, repos: [], scope: null, skipped: false },
    eventBridge: false,
    analysis: null,
    groups: OTHER_GROUPS,
    campaigns: initialCampaigns,
    newEvent: null,
    lastHealthSync: '2026-10-26T07:40',
  };
}

// Group the analysis results: one group per PLE that has code in the given repos.
function analyze(state, ple, repos, onlyEventId) {
  let seq = state.seq;
  const findings = [];
  const groups = [];
  ple.events
    .filter((e) => e.codeChange && e.repos.length && (!onlyEventId || e.id === onlyEventId))
    .forEach((e) => {
      const scoped = { ...e, repos: e.repos.filter((r) => repos.includes(r.repo)) };
      if (!scoped.repos.length) return;
      const built = buildFindings(scoped, seq);
      seq = built.seq;
      findings.push(...built.findings);
      groups.push(buildGroup(e, built.findings, e.id === NEW_EVENT.id ? { isNew: true } : {}));
    });
  return { findings, groups, seq };
}

export function initialPleState(base) {
  const ple = blankPle();
  let stored = null;
  try {
    stored = window.localStorage.getItem(CM_CUSTOMER_KEY);
  } catch {
    stored = null;
  }
  if (stored !== '1') return { ...base, ple };
  // Existing CM customer: already connected, analyzed, and Health access granted.
  const repos = ORG_REPOS.filter((r) => !UNREADABLE.includes(r));
  const { findings, groups, seq } = analyze(base, ple, repos);
  return {
    ...base,
    seq,
    findings: [...findings, ...base.findings],
    sources: [...base.sources, pleSource(repos, 'GitHub')],
    analyses: [healthAnalysisRow(Date.now(), repos, findings.length), ...base.analyses],
    ple: { ...ple, onboarded: true, setup: { provider: 'GitHub', repos, scope: 'org', skipped: false }, groups: [...ple.groups, ...groups] },
  };
}

const pleSource = (repos, provider, name = ORG, org = ORG) => ({ id: 'src-ple', name, provider, org, repos, status: 'Connected', connectedAt: MOCK_TODAY });

const setPle = (state, patch) => ({ ...state, ple: { ...state.ple, ...patch } });
const mapGroups = (state, fn) => setPle(state, { groups: state.ple.groups.map(fn) });
const mapCampaign = (state, id, fn) => setPle(state, { campaigns: state.ple.campaigns.map((c) => (c.id === id ? fn(c) : c)) });
const mapRepo = (state, cid, repo, fn) => mapCampaign(state, cid, (c) => ({ ...c, repos: c.repos.map((r) => (r.repo === repo && r.status !== 'merged' ? fn(r) : r)) }));

// Build the run order: repos marked `first` run alone, then everything else in
// parallel, except repos with `after` which wait for their linked repo.
// opts: findingIds (only these findings), excludeRepos, delays ({ groupId: ms },
// e.g. while a specialized skill is still being tested).
function scheduleRepos(state, groupIds, opts, now) {
  const { findingIds, excludeRepos = [], delays = {} } = opts ?? {};
  const rows = [];
  groupIds.forEach((gid) => {
    const g = state.ple.groups.find((x) => x.id === gid);
    if (!g) return;
    const fs = state.findings.filter((f) => g.findingIds.includes(f.id) && f.status !== 'Dismissed' && (!findingIds || findingIds.includes(f.id)));
    const repos = [...new Set(fs.map((f) => f.repo))].filter((r) => !excludeRepos.includes(r));
    repos.forEach((repo) => {
      const fx = repoFixture(g.pleId, repo) ?? {};
      const fids = fs.filter((f) => f.repo === repo).map((f) => f.id);
      rows.push({ repo, groupId: gid, status: 'queued', outcome: fx.outcome ?? 'merge', hold: !!fx.hold, owner: fx.owner ?? '@unassigned', prNum: fx.pr ?? 100 + rows.length, first: !!fx.first, after: fx.after, failure: fx.failure ?? null, findingIds: fids, pr: null, validation: null, deployed: false });
    });
  });
  const hasFirst = rows.some((r) => r.first);
  const base = now + 600;
  const wave2 = hasFirst ? base + RUN_MS + 400 : base;
  rows.forEach((r, i) => {
    r.startAt = (r.first ? base : wave2 + (i % 5) * 700) + (delays[r.groupId] ?? 0);
    r.runFor = RUN_MS + (i % 3) * 900;
  });
  rows.forEach((r) => {
    const parent = rows.find((p) => p.repo === r.after);
    if (parent) r.startAt = parent.startAt + parent.runFor + 500;
  });
  return rows;
}

function setFindingStatus(findings, ids, status, extra = {}) {
  if (!ids.length) return findings;
  return findings.map((f) => (ids.includes(f.id) && f.status !== 'Dismissed' ? { ...f, status, ...extra } : f));
}

export function pleReducer(state, action) {
  const now = action.now ?? Date.now();
  switch (action.type) {
    case 'PLE_SET_ENTRY':
      return setPle(state, { entryEventId: action.eventId, entryEventIds: action.eventIds ?? [action.eventId] });

    case 'PLE_SET_SCHEDULE':
      // Continuous analysis chosen at setup: [{ type, cadence }], plus the shared day and time.
      return setPle(state, { schedule: action.schedule, eventBridge: action.schedule.analyses.some((a) => a.type === 'ple') || state.ple.eventBridge });

    case 'PLE_CONNECT_REPOS': {
      const others = state.sources.filter((s) => s.id !== 'src-ple');
      return {
        ...setPle(state, { setup: { ...state.ple.setup, provider: action.provider, repos: action.repos, push: action.push } }),
        sources: [...others, pleSource(action.repos, action.provider, action.name, action.org)],
      };
    }

    case 'PLE_HEALTH_ACCESS':
      return setPle(state, {
        setup: {
          ...state.ple.setup, scope: action.scope, skipped: action.scope === 'skipped', comprehensive: action.comprehensive,
          pleCadence: action.pleCadence ?? 'weekly', tdType: action.tdType ?? 'td-comprehensive', tdCadence: action.tdCadence ?? 'weekly',
        },
        eventBridge: action.eventBridge ?? state.ple.eventBridge,
        comprehensive: action.comprehensive,
      });

    case 'PLE_START_ANALYSIS': {
      const repos = state.ple.setup.repos;
      const unreadable = repos.filter((r) => UNREADABLE.includes(r));
      return setPle(state, { analysis: { status: 'running', startedAt: now, duration: ANALYSIS_MS, repos, unreadable, done: 0 } });
    }

    case 'PLE_GROUP_REMOVE':
      return mapGroups(state, (g) => (g.id === action.groupId ? { ...g, findingIds: g.findingIds.filter((id) => !action.findingIds.includes(id)) } : g));

    case 'PLE_GROUP_SPLIT': {
      const src = state.ple.groups.find((g) => g.id === action.groupId);
      if (!src) return state;
      const id = `${src.id}-split-${state.seq}`;
      const split = { ...src, id, name: `${src.name} (split)`, shortName: `${src.shortName} (split)`, findingIds: action.findingIds, isNew: false, splitFrom: src.id };
      const next = mapGroups(state, (g) => (g.id === src.id ? { ...g, findingIds: g.findingIds.filter((x) => !action.findingIds.includes(x)) } : g));
      return { ...setPle(next, { groups: [...next.ple.groups, split] }), seq: state.seq + 1 };
    }

    case 'PLE_GROUP_MERGE':
      return mapGroups(state, (g) => {
        if (g.id === action.groupId) return { ...g, findingIds: g.findingIds.filter((x) => !action.findingIds.includes(x)) };
        if (g.id === action.intoId) return { ...g, findingIds: [...new Set([...g.findingIds, ...action.findingIds])] };
        return g;
      });

    case 'PLE_MOVE_FINDINGS':
      // Move findings to another group, or make them standalone (toGroupId null).
      return mapGroups(state, (g) => {
        const rest = g.findingIds.filter((x) => !action.findingIds.includes(x));
        return g.id === action.toGroupId ? { ...g, findingIds: [...rest, ...action.findingIds] } : rest.length === g.findingIds.length ? g : { ...g, findingIds: rest };
      });

    case 'PLE_SET_TARGET':
      return mapGroups(state, (g) => (g.id === action.groupId ? { ...g, target: action.target } : g));

    case 'PLE_SKILL_GENERATE':
      // Test the skill on held-out repositories; keeps the user's edits and choices.
      return mapGroups(state, (g) => (g.id === action.groupId ? { ...g, skill: { heldOut: 2, ...g.skill, status: 'generating', inputs: action.inputs ?? g.skill?.inputs, startedAt: now, duration: SKILL_MS } } : g));

    case 'PLE_SKILL_UPDATE':
      return mapGroups(state, (g) => (g.id === action.groupId ? { ...g, skill: { status: 'proposed', heldOut: 2, ...g.skill, ...action.patch } } : g));

    case 'PLE_SKILL_SAVE_AS':
      return mapGroups(state, (g) => (g.id === action.groupId ? { ...g, skill: { ...g.skill, saveAs: action.saveAs } } : g));

    case 'PLE_START_CAMPAIGN': {
      const id = `C-${state.seq}`;
      // Standalone findings run as one-off groups created with the campaign.
      if (action.newGroups?.length) state = setPle(state, { groups: [...state.ple.groups, ...action.newGroups] });
      const repos = scheduleRepos(state, action.groupIds, { findingIds: action.findingIds, excludeRepos: action.excludeRepos, delays: action.delays }, now);
      const groups = action.groupIds.map((gid) => {
        const g = state.ple.groups.find((x) => x.id === gid);
        return { id: gid, name: g.shortName, pleId: g.pleId };
      });
      const c = { id, name: action.name, target: action.target, dueDate: action.dueDate, groups, createdAt: MOCK_TODAY, repos, checks: action.checks, setId: action.setId ?? null };
      return {
        ...setPle(state, { campaigns: [c, ...state.ple.campaigns] }),
        seq: state.seq + 1,
        findings: setFindingStatus(state.findings, repos.flatMap((r) => r.findingIds), 'In remediation', { campaignId: id }),
      };
    }

    case 'PLE_ADD_GROUP_TO_CAMPAIGN': {
      const c = state.ple.campaigns.find((x) => x.id === action.campaignId);
      const g = state.ple.groups.find((x) => x.id === action.groupId);
      if (!c || !g) return state;
      const repos = scheduleRepos(state, [g.id], null, now);
      const next = mapCampaign(state, c.id, (x) => ({ ...x, groups: [...x.groups, { id: g.id, name: g.shortName, pleId: g.pleId }], repos: [...x.repos, ...repos], dueDate: eventById(g.pleId)?.changeDate ?? x.dueDate }));
      return { ...setPle(next, { newEvent: null }), findings: setFindingStatus(state.findings, repos.flatMap((r) => r.findingIds), 'In remediation', { campaignId: c.id }) };
    }

    case 'PLE_MERGE_PR':
      return mapRepo(state, action.campaignId, action.repo, (r) => (r.status === 'change_ready' ? { ...r, status: 'merged', mergeAt: null, deployAt: r.hold ? null : now + DEPLOY_MS } : r));

    case 'PLE_RETRY': {
      // A retry picks up the fix the owner pushed; it passes validation.
      const run = state.ple.campaigns.find((c) => c.id === action.campaignId)?.repos.find((r) => r.repo === action.repo);
      const next = mapRepo(state, action.campaignId, action.repo, (r) => ({ ...r, status: 'queued', startAt: now + 400, runFor: RUN_MS, outcome: 'ready', validation: null, retried: (r.retried ?? 0) + 1 }));
      return { ...next, findings: setFindingStatus(next.findings, run?.findingIds ?? [], 'In remediation') };
    }

    case 'PLE_DRAFT_PR':
      return mapRepo(state, action.campaignId, action.repo, (r) => ({ ...r, status: 'draft_pr', pr: r.prNum }));

    case 'PLE_MANUAL':
      return mapRepo(state, action.campaignId, action.repo, (r) => ({ ...r, status: 'manual' }));

    case 'PLE_MARK_NOT_FOUND_MANUAL':
      return setPle(state, {
        events: state.ple.events.map((e) => (e.id === action.eventId ? { ...e, resources: e.resources.map((x) => (x.repo ? x : { ...x, manual: true })) } : e)),
      });

    case 'PLE_HEALTH_REFRESH': {
      // Demo fast-forward: everything deployed (or handled manually) resolves now.
      let next = state;
      next = setPle(next, {
        campaigns: next.ple.campaigns.map((c) => ({
          ...c,
          repos: c.repos.map((r) => (r.status === 'merged' ? { ...r, deployed: true, deployAt: null, resolveAt: now } : r)),
        })),
        events: next.ple.events.map((e) => ({ ...e, resources: e.resources.map((x) => (x.manual && x.status === 'PENDING' ? { ...x, status: 'RESOLVED', updated: nowIso(now) } : x)) })),
        lastHealthSync: nowIso(now),
      });
      return pleTick(next, now, true);
    }

    case 'PLE_NEW_EVENT': {
      if (state.ple.events.some((e) => e.id === NEW_EVENT.id)) return state;
      let next = setPle(state, { events: [...state.ple.events, NEW_EVENT] });
      if (!next.ple.onboarded) return next;
      const { findings, groups, seq } = analyze(next, next.ple, next.ple.setup.repos, NEW_EVENT.id);
      next = setPle(next, { groups: [...next.ple.groups, ...groups], newEvent: groups.length ? { eventId: NEW_EVENT.id, groupId: groups[0].id } : null });
      return { ...next, seq, findings: [...findings, ...next.findings] };
    }

    case 'PLE_ENABLE_EVENTBRIDGE':
      return setPle(state, { eventBridge: true });

    case 'PLE_DISMISS_NEW':
      return setPle(state, { newEvent: null });

    default:
      return null;
  }
}

// Local wall-clock time, matching how fmtDateTime parses seeded timestamps.
function healthAnalysisRow(now, repos, count) {
  return { id: 'A-PLE', date: nowIso(now), name: 'Health analysis', type: 'ple', status: 'Completed', repos, done: repos.length, progress: 100, findings: count, infra: 'AWS managed', source: ORG };
}

const nowIso = (ms) => {
  const d = new Date(ms);
  return new Date(ms - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function plePending(ple) {
  if (ple.analysis?.status === 'running') return true;
  if (ple.groups.some((g) => g.skill?.status === 'generating')) return true;
  return ple.campaigns.some((c) =>
    c.repos.some(
      (r) => r.status === 'queued' || r.status === 'running' || (r.status === 'change_ready' && r.mergeAt) || (r.status === 'merged' && ((!r.deployed && r.deployAt) || r.resolveAt)),
    ),
  );
}

// A finished analysis started from PLE setup still needs its findings grouped.
const needsGrouping = (a) => a.autoGroup && a.status === 'Completed' && !a.grouped;

// Group a finished analysis by issue: one group per finding title that shows up
// in two or more repositories (type B when a managed TD exists, else C).
function groupAnalysis(state, a) {
  const byTitle = {};
  state.findings.filter((f) => f.analysisId === a.id).forEach((f) => (byTitle[f.title] ??= []).push(f));
  const groups = Object.entries(byTitle)
    .filter(([, fs]) => new Set(fs.map((f) => f.repo)).size > 1)
    .map(([title, fs]) => ({
      id: `G-${a.id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      pleId: null,
      name: title,
      shortName: title,
      type: fs[0].transformation ? 'B' : 'C',
      findingIds: fs.map((f) => f.id),
      target: null,
      skill: null,
    }));
  return {
    ...setPle(state, { groups: [...state.ple.groups, ...groups] }),
    analyses: state.analyses.map((x) => (x.id === a.id ? { ...x, grouped: true } : x)),
  };
}

export function pleTick(state, now, force = false) {
  const { ple } = state;
  const toGroup = state.analyses.filter(needsGrouping);
  if (!force && !plePending(ple) && !toGroup.length) return state;
  let changed = force || toGroup.length > 0;
  let next = toGroup.reduce(groupAnalysis, state);

  // PLE analysis.
  if (ple.analysis?.status === 'running') {
    changed = true;
    const a = ple.analysis;
    const progress = Math.min(1, (now - a.startedAt) / a.duration);
    if (progress < 1) {
      next = setPle(next, { analysis: { ...a, done: Math.floor(progress * a.repos.length) } });
    } else {
      const readable = a.repos.filter((r) => !a.unreadable.includes(r));
      const only = ple.setup.skipped ? ple.entryEventId : null;
      const { findings, groups, seq } = analyze(next, ple, readable, only);
      const analysisRow = healthAnalysisRow(now, a.repos, findings.length);
      next = {
        ...setPle(next, { analysis: { ...a, status: 'done', done: a.repos.length }, groups: [...next.ple.groups.filter((g) => !g.pleId), ...groups], onboarded: true }),
        seq,
        findings: [...findings, ...next.findings.filter((f) => f.analysisId !== 'A-PLE')],
        analyses: [analysisRow, ...next.analyses.filter((x) => x.id !== 'A-PLE')],
      };
    }
  }

  // Specialized skill generation (type C groups).
  if (next.ple.groups.some((g) => g.skill?.status === 'generating' && now >= g.skill.startedAt + g.skill.duration)) {
    changed = true;
    next = mapGroups(next, (g) => {
      if (g.skill?.status !== 'generating' || now < g.skill.startedAt + g.skill.duration) return g;
      const repos = new Set(next.findings.filter((f) => g.findingIds.includes(f.id)).map((f) => f.repo)).size;
      return { ...g, skill: { ...g.skill, status: 'ready', heldOut: 2, passed: 2, saveAs: g.skill.saveAs ?? (repos <= 3 ? 'one-off' : 'draft') } };
    });
  }

  // Campaign runs → PRs → merge → deploy → AWS Health RESOLVED.
  const toResolve = [];
  const toFail = [];
  const campaigns = next.ple.campaigns.map((c) => {
    let touched = false;
    const repos = c.repos.map((r) => {
      let x = r;
      if (x.status === 'queued' && now >= x.startAt) x = { ...x, status: 'running' };
      if (x.status === 'running' && now >= x.startAt + x.runFor) {
        if (x.outcome === 'fail') {
          x = { ...x, status: 'failed', validation: `Failed: ${x.failure?.check ?? 'build'}` };
          toFail.push(...x.findingIds);
        } else {
          x = { ...x, status: 'change_ready', validation: 'Passed', pr: x.prNum, mergeAt: x.outcome === 'merge' ? now + MERGE_MS : null };
        }
      }
      // Held repos stay merged until the team's next deploy (AWS Health fast-forward in the demo).
      if (x.status === 'change_ready' && x.mergeAt && now >= x.mergeAt) x = { ...x, status: 'merged', mergeAt: null, deployAt: x.hold ? null : now + DEPLOY_MS };
      if (x.status === 'merged' && !x.deployed && x.deployAt && now >= x.deployAt) x = { ...x, deployed: true, deployAt: null, resolveAt: now + HEALTH_MS };
      if (x.status === 'merged' && x.deployed && x.resolveAt && now >= x.resolveAt) {
        toResolve.push(x);
        x = { ...x, resolveAt: null };
      }
      if (x !== r) touched = true;
      return x;
    });
    if (!touched) return c;
    changed = true;
    return { ...c, repos };
  });

  if (!changed) return state;
  next = setPle(next, { campaigns });

  if (toFail.length) next = { ...next, findings: setFindingStatus(next.findings, toFail, 'Open', { failedValidation: true }) };

  if (toResolve.length) {
    const resolvedRepos = new Set(toResolve.map((r) => r.repo));
    const events = next.ple.events.map((e) => ({
      ...e,
      resources: e.resources.map((x) => (x.repo && resolvedRepos.has(x.repo) && x.status === 'PENDING' ? { ...x, status: 'RESOLVED', deployed: true, updated: nowIso(now) } : x)),
    }));
    next = setPle(next, { events, lastHealthSync: nowIso(now) });
    // A finding resolves when every resource it covers is RESOLVED.
    const resById = new Map(events.flatMap((e) => e.resources.map((x) => [`${e.id}:${x.name}`, x])));
    const fids = toResolve.flatMap((r) => r.findingIds);
    next = {
      ...next,
      findings: next.findings.map((f) => {
        if (!fids.includes(f.id)) return f;
        const covered = (f.functions ?? []).map((n) => resById.get(`${f.pleId}:${n}`));
        return covered.every((x) => !x || x.status === 'RESOLVED') ? { ...f, status: RESOLVED_HEALTH } : f;
      }),
    };
  }
  return next;
}
