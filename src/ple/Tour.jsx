import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TENANT } from '../data';
import { navigate, useStore } from '../store';
import { Icon } from '../components/ui';
import { CM_CUSTOMER_KEY } from './reducer';
import { byDeadline, deepLinkMulti, fixable } from './common';

// Story mode: a presenter tour of the PLE journey, from the AWS Health notice to the
// event closing. One step per screen: the narrator explains what the screen is for and
// Next performs its main action, so the real app state advances underneath. Steps that
// wait on simulated work (searching, validating) hold Next until it's done.

const HERO = 'lambda-node16';
const AUTOSTART_KEY = 'atx-tour-autostart';
const PRIMARY = '.setup-actions .btn-primary';

const heroCampaign = (state) => state.ple.campaigns.find((c) => c.groups.some((g) => g.pleId === HERO));

// Presses a screen's main button, the same click a customer would make.
const press = (sel = PRIMARY) => () => document.querySelector(sel)?.click();

// React-controlled inputs ignore a plain `.value =`; go through the native setter.
function fill(input, value) {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const CHAPTERS = ['The notice', 'Set up', 'Fix', 'Close out'];

// One step per screen: what the screen is for, then Next does its main action.
// at: route prefix the step lives on. go: where "Take me there" returns to if you wander off.
// target: the area to highlight. points: [selector, text] pairs the highlight cycles
// through on its own, so the screen's detail comes without extra clicks.
// ready: hold Next until true.
const STEPS = [
  {
    chapter: 0, at: '/console/health', go: () => '/console/health', target: '[data-tour="health-summary"]',
    points: [
      ['[data-tour="health-summary"]', 'AWS Health now shows which of these changes AWS Transform can resolve, right where the customer reads the notice.'],
      ['[data-tour="health-summary"] .btn-atx', 'One action covers all three runtime notices: 16 functions, nearest deadline first.'],
    ],
    title: 'Start where the notice lives',
    body: 'AWS Health tells customers a runtime is retiring, but not where it is in their code. AWS Transform meets them right here and offers to fix it.',
    next: 'Upgrade 16 functions', action: ({ state }) => navigate(deepLinkMulti(byDeadline(state.ple.events.filter(fixable)), TENANT.account).slice(1)),
  },
  {
    chapter: 0, at: '/app/ple/welcome', target: '.enable-modes',
    points: [['.enable-included', 'IAM-only access, AWS managed encryption and storage. Nothing to configure first.']],
    title: 'One click to turn on AWS Transform',
    body: 'A new customer has no AWS Transform yet. Quick start enables the web application with defaults, then lands them on the page for the notice they came from.',
    next: 'Enable', action: press('[data-tour="enable"]'),
  },
  {
    chapter: 0, at: '/app/ple/welcome', target: '.gs-card',
    points: [
      ['.gs-steps', 'Two steps: connect the repositories, then keep them continuously modern.'],
      ['.gs-events', 'Node.js 16 is due first, Python 3.10 and Java 11 follow, and every future notice after. Fixing these is the hook.'],
    ],
    title: 'Turn one notice into an ongoing program',
    body: 'The customer arrives with an urgent deadline. We solve that first, and show that more notices are coming so it’s worth setting up once.',
    next: 'Get started', action: press('.gs-cta'),
  },
  {
    chapter: 1, at: '/app/ple/connect', go: () => '/app/ple/connect', target: '.setup-narrow',
    points: [
      ['.access-fields', 'One source for every repository, with a token scoped to code reads and pull requests.'],
      ['[data-tour="health-analysis"]', 'Health analysis finds the code behind these functions now, then each new AWS Health notice.'],
      ['[data-tour="analyses"]', 'Tech debt and modernization readiness keep the rest of the estate current on a schedule.'],
    ],
    title: 'Set up once, on one page',
    body: 'Connect the repositories and choose what keeps them current. Nothing in the code changes until a team merges a pull request.',
    next: 'Begin continuous analysis',
    action: () => {
      const inputs = document.querySelectorAll('.access-fields input');
      if (inputs[0] && !inputs[0].value) fill(inputs[0], 'acme-github');
      const token = document.querySelector('.access-fields input[type="password"]');
      if (token && !token.value) fill(token, 'ghp_demo_story_mode_token');
      setTimeout(press('.verify-btn'), 60);
      setTimeout(press(), 1100);
      // Two-step layout: Next lands on the analyses step, so begin there too.
      setTimeout(() => window.location.hash.includes('/app/ple/schedule') && press()(), 1500);
    },
  },
  {
    chapter: 2, at: '/app/cm/analyses/A-PLE', go: () => '/app/cm/analyses/A-PLE', target: '.landing-banner',
    ready: (s) => s.ple.analysis?.status === 'done', waiting: 'Finding the code…',
    points: [
      ['.landing-banner', 'The code behind all 16 functions is found. The campaign can start now.'],
      ['.landing-table', 'Security, tech debt and modernization readiness finish their first run in the background, then repeat on schedule.'],
      ['.landing-settings', 'AWS Health keeps being watched, so the next notice arrives with its code already found.'],
    ],
    title: 'Fix now, nothing blocks it',
    body: 'The code behind the notices is ready immediately. The broader analyses keep running in the background.',
    next: 'Create campaign', action: () => navigate(`/app/cm/findings/G-${HERO}/plan`),
  },
  {
    chapter: 2, at: '/app/cm/findings/', target: '.plan-table',
    points: [
      ['.plan-table', 'One pull request per repository, with its functions and the exact change. Preview any diff.'],
      ['.scan-note', 'Validation, functional-equivalence and dependency checks run first. Failures are held back, never opened.'],
    ],
    title: 'Review the plan, then let it run',
    body: 'One validated pull request per repository. The team sees exactly what changes before anything opens.',
    next: 'Create campaign', action: press(),
  },
  {
    chapter: 3, at: '/app/cm/campaigns/', target: '.ec-stats',
    points: [
      ['.ec-table', 'Pull requests open as they pass validation. A failure shows why, with retry, draft or manual options.'],
      ['.ec-stats', 'Opened, merged by teams, and confirmed on the new runtime in Lambda.'],
      ['.ec-side', 'Teams merge and deploy as usual. AWS Transform never deploys.'],
    ],
    title: 'Track it to the deadline',
    body: 'Pull requests open as they pass validation. Teams merge and deploy as usual; AWS Transform confirms each function on its new runtime.',
    ready: (s) => heroCampaign(s)?.repos.every((r) => !['queued', 'running'].includes(r.status)), waiting: 'Opening pull requests…',
    next: 'Merge and deploy',
    action: ({ state, dispatch }) => {
      const c = heroCampaign(state);
      c?.repos.filter((r) => r.status === 'change_ready').forEach((r) => dispatch({ type: 'PLE_MERGE_PR', campaignId: c.id, repo: r.repo, now: Date.now() }));
      // Skip AWS Health's ~72-hour delay.
      setTimeout(() => dispatch({ type: 'PLE_HEALTH_REFRESH', now: Date.now() }), 300);
    },
  },
  {
    chapter: 3, at: '/app/cm/campaigns/', target: '.ec-stats',
    points: [
      ['.ec-stats', 'Every function confirmed on Node.js 22.'],
      ['.ec-title', 'AWS Health marks the event resolved, ahead of the deadline.'],
    ],
    title: 'The notice closes itself',
    body: 'Once every function is upgraded, AWS Health marks the event resolved, ahead of the deadline. No one had to search for anything.',
    next: 'And the next one?',
    action: ({ dispatch }) => {
      dispatch({ type: 'PLE_NEW_EVENT' });
      navigate('/app/cm/findings', { tab: 'ple' });
    },
  },
  {
    chapter: 3, at: '/app/cm/findings', target: '.alert-success',
    title: 'The next notice arrives already solved',
    body: 'A new end-of-support notice, already matched to code by continuous analysis. One click to its campaign. That’s continuous modernization.',
    next: 'Finish',
  },
];

// ---- Engine ------------------------------------------------------------------

const routeNow = () => window.location.hash.slice(1).split('?')[0] || '/';

export function startTour(state) {
  let stored = null;
  try {
    stored = window.localStorage.getItem(CM_CUSTOMER_KEY);
  } catch {
    stored = null;
  }
  const dirty = state.ple.onboarded || state.ple.setup.repos.length > 0 || stored === '1';
  if (dirty) {
    if (!window.confirm('Story mode starts as a new customer. Reset the prototype and begin?')) return false;
    try {
      window.localStorage.removeItem(CM_CUSTOMER_KEY);
      window.sessionStorage.setItem(AUTOSTART_KEY, '1');
    } catch {
      /* storage unavailable */
    }
    window.location.hash = '/console/health';
    window.location.reload();
    return false;
  }
  navigate('/console/health');
  return true;
}

function useTargetRect(selector, active) {
  const [rect, setRect] = useState(null);
  const [el, setEl] = useState(null);
  useEffect(() => {
    if (!active || !selector) {
      setEl(null);
      setRect(null);
      return undefined;
    }
    let found = null;
    let raf = 0;
    const measure = () => {
      if (!found || !found.isConnected) {
        found = document.querySelector(selector);
        if (found) {
          setEl(found);
          // Tall targets scroll to the top, leaving room for the card below them.
          const tall = found.getBoundingClientRect().height > window.innerHeight * 0.45;
          found.style.scrollMarginTop = '72px';
          found.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'smooth' });
        } else {
          setEl(null);
        }
      }
      if (found) {
        const r = found.getBoundingClientRect();
        setRect((p) => (p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [selector, active]);
  return { rect, el };
}

export function Tour() {
  const { state, dispatch } = useStore();
  const [idx, setIdx] = useState(null);
  const [route, setRoute] = useState(routeNow);
  const [missing, setMissing] = useState(false);
  const step = idx == null ? null : STEPS[idx];
  const onRoute = step ? route.startsWith(step.at) : false;
  const [point, setPoint] = useState(0);
  const [hover, setHover] = useState(false);
  const cardRef = useRef(null);
  const [cardSize, setCardSize] = useState({ w: 400, h: 280 });
  const points = step?.points ?? [];
  const { rect, el } = useTargetRect(points[point]?.[0] ?? step?.target, onRoute);
  const ready = !step?.ready || !!step.ready(state);

  useEffect(() => {
    let auto = null;
    try {
      auto = window.sessionStorage.getItem(AUTOSTART_KEY);
      window.sessionStorage.removeItem(AUTOSTART_KEY);
    } catch {
      auto = null;
    }
    if (auto) setIdx(0);
    const h = () => setRoute(routeNow());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  // Each screen opens on its first point; points advance every few seconds unless hovered.
  useEffect(() => setPoint(0), [idx]);
  useEffect(() => {
    if (!onRoute || hover || points.length < 2) return undefined;
    const t = setTimeout(() => setPoint((i) => (i + 1) % points.length), 5000);
    return () => clearTimeout(t);
  }, [onRoute, hover, point, points.length]);

  const close = useCallback(() => setIdx(null), []);
  const advance = useCallback(() => setIdx((i) => (i == null ? i : i + 1 >= STEPS.length ? null : i + 1)), []);

  const next = useCallback(() => {
    if (!step || !ready) return;
    step.action?.({ el, state, dispatch });
    advance();
  }, [step, ready, el, state, dispatch, advance]);

  // Give navigation and rendering a moment before saying the step is lost.
  // Optional steps whose target never appears are skipped.
  useEffect(() => {
    setMissing(false);
    if (!step || (onRoute && el)) return undefined;
    const t = setTimeout(() => (step.optional && onRoute ? advance() : setMissing(true)), 2500);
    return () => clearTimeout(t);
  }, [step, onRoute, el, advance]);

  useEffect(() => {
    if (!step) return undefined;
    const h = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [step, close, next]);

  useLayoutEffect(() => {
    const r = cardRef.current?.getBoundingClientRect();
    if (r && (Math.abs(r.width - cardSize.w) > 1 || Math.abs(r.height - cardSize.h) > 1)) setCardSize({ w: r.width, h: r.height });
  });

  if (!step) {
    return (
      <button type="button" className="tour-launch" onClick={() => startTour(state) && setIdx(0)}>
        <PlayGlyph /> Story mode
      </button>
    );
  }

  const pad = 8;
  const spot = onRoute && rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;

  const cardStyle = placeCard(spot, cardSize);
  const nextLabel = !ready ? step.waiting ?? 'Working…' : step.next ?? (idx === STEPS.length - 1 ? 'Finish' : 'Next');

  return (
    <div className="tour" aria-live="polite">
      {spot ? <div className="tour-spot" style={spot} /> : <div className="tour-dim" />}
      <div ref={cardRef} className="tour-card" style={cardStyle} role="dialog" aria-label={`Story mode: ${step.title}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <div className="tour-chapters" aria-hidden="true">
          {CHAPTERS.map((c, i) => (
            <span key={c} className={i < step.chapter ? 'done' : i === step.chapter ? 'on' : ''} title={c} />
          ))}
        </div>
        <div className="tour-head">
          <span className="tour-eyebrow">{step.chapter + 1} · {CHAPTERS[step.chapter]}</span>
          <button type="button" className="icon-btn" onClick={close} aria-label="Exit story mode"><Icon.close /></button>
        </div>
        <div className="tour-goal">Goal of this screen</div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        {points.length > 0 && (
          <ul className="tour-points">
            {points.map(([sel, text], i) => (
              <li key={sel}>
                <button type="button" className={i === point ? 'on' : ''} onClick={() => setPoint(i)}>
                  <span className="tour-point-dot" />
                  <span>{text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {missing && (
          <p className="tour-warn">
            {onRoute ? 'Can’t find this on the page.' : 'This step continues on another page.'}{' '}
            {step.go ? <a className="link" onClick={() => navigate(step.go(state))}>Take me there</a> : <a className="link" onClick={advance}>Skip</a>}
          </p>
        )}
        <div className="tour-actions">
          <span className="muted small">{idx + 1} of {STEPS.length}</span>
          <span className="grow" />
          <button type="button" className="btn btn-primary" disabled={!ready || (!onRoute && !!step.action)} onClick={next}>
            {!ready && <Icon.spinner />} {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Beside the highlight when it's wide and short (below, then above), or tall and
// narrow (right, then left), aligned to its edge. Bottom-right corner as a last resort.
function placeCard(spot, { w, h }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = 16;
  const gap = 14;
  if (!spot) return { top: (vh - h) / 2, left: (vw - w) / 2 };
  const clampX = (x) => Math.max(m, Math.min(vw - w - m, x));
  const clampY = (y) => Math.max(56, Math.min(vh - h - m, y));
  // Line up with the highlight's left edge, or its right edge when it sits on the right.
  const alignX = clampX(spot.left + spot.width / 2 > vw / 2 ? spot.left + spot.width - w : spot.left);
  const alignY = clampY(spot.top);
  if (spot.top + spot.height + gap + h <= vh - m) return { top: spot.top + spot.height + gap, left: alignX };
  if (spot.top - gap - h >= 56) return { top: spot.top - gap - h, left: alignX };
  if (spot.left + spot.width + gap + w <= vw - m) return { top: alignY, left: spot.left + spot.width + gap };
  if (spot.left - gap - w >= m) return { top: alignY, left: spot.left - gap - w };
  return { top: vh - h - 24, left: vw - w - 24 };
}

function PlayGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /></svg>
  );
}
