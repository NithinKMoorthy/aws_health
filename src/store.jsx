import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import {
  findingTemplates,
  initialAnalyses,
  initialFindings,
  initialInfrastructure,
  initialRemediations,
  initialSources,
  repoTech,
  typeLabel,
} from './data';
import { CM_CUSTOMER_KEY, initialPleState, plePending, pleReducer, pleTick, RESOLVED_HEALTH } from './ple/reducer';

// Mock "backend": everything lives in memory and resets on reload.
// Long-running work (analyses, remediations, connections, stack deploys) is
// simulated by TICK, which advances anything whose timer has elapsed.

const ANALYSIS_SECONDS = { 'td-quick': 12, 'td-comprehensive': 25, agentic: 18, modernization: 18, security: 15 };
const REMEDIATION_SECONDS = 20;

const initialState = {
  sources: initialSources,
  findings: initialFindings,
  remediations: initialRemediations,
  analyses: initialAnalyses,
  schedules: [],
  infrastructure: initialInfrastructure,
  repoTech: { ...repoTech },
  seq: 100,
};

const nowIso = () => new Date().toISOString().slice(0, 16);
const today = () => new Date().toISOString().slice(0, 10);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_SOURCE': {
      const { name, provider, org } = action;
      const count = 6 + Math.floor(Math.random() * 30);
      const base = org || name;
      const repos = Array.from({ length: count }, (_, i) => `${base}-service-${String(i + 1).padStart(2, '0')}`);
      const src = { id: `src-${state.seq}`, name, provider, org: base, repos, status: 'Connecting', connectedAt: today(), readyAt: Date.now() + 2500 };
      return { ...state, seq: state.seq + 1, sources: [...state.sources, src] };
    }
    case 'REMOVE_SOURCE':
      return { ...state, sources: state.sources.filter((s) => s.id !== action.id) };

    case 'START_ANALYSIS': {
      const { analysisType, name, source, repos, infra, autoGroup } = action;
      const id = `A-${state.seq}`;
      const a = {
        id,
        date: nowIso(),
        name: name || typeLabel(analysisType),
        type: analysisType,
        status: 'In progress',
        repos,
        done: 0,
        progress: 0,
        findings: 0,
        infra,
        source,
        startedAt: Date.now(),
        duration: (ANALYSIS_SECONDS[analysisType] ?? 15) * 1000,
        autoGroup,
      };
      return { ...state, seq: state.seq + 1, analyses: [a, ...state.analyses] };
    }

    case 'DISMISS_FINDINGS':
      return { ...state, findings: state.findings.map((f) => (action.ids.includes(f.id) ? { ...f, status: 'Dismissed' } : f)) };
    case 'REOPEN_FINDINGS':
      return { ...state, findings: state.findings.map((f) => (action.ids.includes(f.id) ? { ...f, status: 'Open' } : f)) };
    case 'SET_NOTE':
      return { ...state, findings: state.findings.map((f) => (f.id === action.id ? { ...f, notes: action.notes } : f)) };

    case 'CREATE_REMEDIATION': {
      const { name, transformation, findingIds, tags, custom } = action;
      const fs = state.findings.filter((f) => findingIds.includes(f.id));
      const repos = [...new Set(fs.map((f) => f.repo))];
      const id = `R-${state.seq}`;
      const r = {
        id,
        name,
        status: 'In progress',
        outcome: 0,
        date: today(),
        transformation,
        custom,
        repos,
        findings: findingIds,
        tags,
        branch: `atx/remediation/${slug(name)}-${state.seq}`,
        startedAt: Date.now(),
        duration: REMEDIATION_SECONDS * 1000,
        progress: 0,
      };
      return {
        ...state,
        seq: state.seq + 1,
        remediations: [r, ...state.remediations],
        findings: state.findings.map((f) => (findingIds.includes(f.id) ? { ...f, status: 'In remediation', remediationId: id } : f)),
      };
    }

    case 'ADD_SCHEDULE':
      return { ...state, seq: state.seq + 1, schedules: [...state.schedules, { ...action.schedule, id: `sch-${state.seq}`, status: 'Active' }] };
    case 'DELETE_SCHEDULES':
      return { ...state, schedules: state.schedules.filter((s) => !action.ids.includes(s.id)) };
    case 'TOGGLE_SCHEDULE':
      return { ...state, schedules: state.schedules.map((s) => (s.id === action.id ? { ...s, status: s.status === 'Active' ? 'Paused' : 'Active' } : s)) };

    case 'DEPLOY_STACK': {
      const exists = state.infrastructure.some((i) => i.name === action.name);
      const row = { name: action.name, type: action.stackType, status: 'Deploying', deployedAt: null, readyAt: Date.now() + 6000 };
      return {
        ...state,
        infrastructure: exists ? state.infrastructure.map((i) => (i.name === action.name ? { ...i, ...row } : i)) : [...state.infrastructure, row],
      };
    }

    case 'TICK':
      return pleTick(tick(state, action.now), action.now);

    default:
      return pleReducer(state, action) ?? state;
  }
}

function tick(state, now) {
  let changed = false;
  let { seq } = state;
  let findings = state.findings;
  const repoTechNext = { ...state.repoTech };

  const sources = state.sources.map((s) => {
    if (s.status === 'Connecting' && now >= s.readyAt) {
      changed = true;
      return { ...s, status: 'Connected' };
    }
    return s;
  });

  const infrastructure = state.infrastructure.map((i) => {
    if (i.status === 'Deploying' && now >= i.readyAt) {
      changed = true;
      return { ...i, status: 'Deployed', deployedAt: today() };
    }
    return i;
  });

  const analyses = state.analyses.map((a) => {
    if (a.status !== 'In progress') return a;
    changed = true;
    const progress = Math.min(100, ((now - a.startedAt) / a.duration) * 100);
    const done = Math.floor((progress / 100) * a.repos.length);
    if (progress < 100) return { ...a, progress, done };
    // Completed: emit synthetic findings per repo.
    const templates = findingTemplates[a.type] ?? [];
    const created = [];
    a.repos.forEach((repo, ri) => {
      const take = templates.filter((_, ti) => (ti + ri) % 3 !== 2);
      take.forEach(([title, severity, category, transformation]) => {
        created.push({
          id: `F-${++seq}`,
          title,
          severity,
          status: 'Open',
          transformation,
          date: today(),
          analysisType: a.type,
          category,
          repo,
          analysisId: a.id,
          notes: '',
        });
      });
      if (!repoTechNext[repo]) repoTechNext[repo] = ri % 2 ? 'TypeScript' : 'JavaScript';
    });
    findings = [...created, ...findings];
    return { ...a, progress: 100, done: a.repos.length, status: 'Completed', findings: created.length };
  });

  const resolvedBy = {};
  const remediations = state.remediations.map((r) => {
    if (r.status !== 'In progress') return r;
    changed = true;
    const progress = Math.min(100, ((now - r.startedAt) / r.duration) * 100);
    if (progress < 100) return { ...r, progress };
    r.findings.forEach((fid) => (resolvedBy[fid] = r.id));
    return { ...r, progress: 100, status: 'Complete', outcome: r.repos.length, validation: 'Passed' };
  });
  if (Object.keys(resolvedBy).length) {
    findings = findings.map((f) => (resolvedBy[f.id] ? { ...f, status: 'Resolved' } : f));
  }

  if (!changed) return state;
  return { ...state, seq, sources, infrastructure, analyses, remediations, findings, repoTech: repoTechNext };
}

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, initialPleState);
  const [toasts, setToasts] = useState([]);

  const busy =
    state.analyses.some((a) => a.status === 'In progress') ||
    state.remediations.some((r) => r.status === 'In progress') ||
    state.sources.some((s) => s.status === 'Connecting') ||
    state.infrastructure.some((i) => i.status === 'Deploying') ||
    plePending(state.ple);

  useEffect(() => {
    if (!busy) return undefined;
    const t = setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), 500);
    return () => clearInterval(t);
  }, [busy]);

  const notify = useCallback((text, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const value = useMemo(() => ({ state, dispatch, notify, toasts, dismissToast }), [state, notify, toasts, dismissToast]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);

// ---- Hash router -----------------------------------------------------------
// Routes look like #/console, #/app/cm/findings?repo=MKPMobile, etc.

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/console/health';
  const [path, qs = ''] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const h = () => setRoute(parseHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}

export function navigate(path, query) {
  const qs = query ? `?${new URLSearchParams(query)}` : '';
  window.location.hash = `${path}${qs}`;
  window.scrollTo(0, 0);
}

// Back to a brand-new customer at the AWS Health entry point. All other state is
// in memory, so a reload clears it.
export function resetPrototype() {
  if (!window.confirm('Reset the prototype? This clears all progress and returns to AWS Health.')) return;
  try {
    window.localStorage.removeItem(CM_CUSTOMER_KEY);
  } catch {
    /* storage unavailable */
  }
  window.location.hash = '/console/health';
  window.location.reload();
}

// ---- Derived selectors -----------------------------------------------------

export function useDerived() {
  const { state } = useStore();
  return useMemo(() => {
    const active = state.findings.filter((f) => f.status !== 'Dismissed' && f.status !== 'Resolved' && f.status !== RESOLVED_HEALTH);
    const bySev = (s) => active.filter((f) => f.severity === s);
    const reposWith = (list) => new Set(list.map((f) => f.repo)).size;
    const completed = state.analyses.filter((a) => a.status === 'Completed');
    const analyzedRepos = new Set(completed.flatMap((a) => a.repos));
    const lastAnalyzed = completed.map((a) => a.date).sort().at(-1);
    const repoRows = Object.values(
      active.reduce((acc, f) => {
        acc[f.repo] ??= { repo: f.repo, High: 0, Medium: 0, Low: 0, total: 0 };
        acc[f.repo][f.severity] += 1;
        acc[f.repo].total += 1;
        return acc;
      }, {}),
    ).sort((a, b) => b.total - a.total || b.High - a.High);
    return {
      active,
      high: bySev('High'),
      medium: bySev('Medium'),
      low: bySev('Low'),
      reposWith,
      analyzedRepos,
      lastAnalyzed,
      repoRows,
      openHigh: state.findings.filter((f) => f.status === 'Open' && f.severity === 'High').length,
      connectedSources: state.sources.filter((s) => s.status === 'Connected'),
    };
  }, [state]);
}
