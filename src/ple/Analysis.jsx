import React, { useState } from 'react';
import { fmtDate, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import { Breadcrumbs, Button, Icon, Link } from '../components/ui';
import { AnalysisDetail } from '../cm/Analyses';
import { ORG } from './data';
import { byDeadline, nextRunIso, unitFor } from './common';

// After setup: the analyses that now run continuously, their first run, and the
// shared settings. Health analysis finishes first; the rest run in the background.

const CADENCE = { once: 'Once', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const shortDate = (iso) => (iso ? new Date(`${iso}T12:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—');

export function PleAnalysisPage() {
  const { state } = useStore();
  const [banner, setBanner] = useState(true);
  const ids = state.ple.entryEventIds?.length ? state.ple.entryEventIds : [state.ple.entryEventId].filter(Boolean);
  const events = byDeadline(state.ple.events.filter((e) => ids.includes(e.id)));
  const schedule = state.ple.schedule;
  const src = state.sources.find((s) => s.id === 'src-ple');
  const repoCount = state.ple.setup.repos.length;

  // Without a schedule from setup (e.g. an existing customer), show the plain analysis detail.
  if (!events.length || !schedule) return <AnalysisDetail id="A-PLE" />;

  const n = events.reduce((k, e) => k + e.resources.length, 0);
  const u = unitFor(events, n);
  const groups = state.ple.groups.filter((g) => events.some((e) => e.id === g.pleId));
  const findings = state.findings.filter((f) => groups.some((g) => g.findingIds.includes(f.id)));
  const found = new Set(findings.flatMap((f) => f.functions ?? [])).size;
  const health = state.ple.analysis;
  const searching = health?.status === 'running';
  const openFindings = () => navigate('/app/cm/findings', { tab: 'ple' });

  const rows = schedule.analyses.map((a) => {
    if (a.type === 'ple') {
      const total = health?.repos.length ?? repoCount;
      return {
        type: a.type, cadence: a.cadence, scope: `These ${n} ${u}, then each new AWS Health notice`,
        status: searching ? 'running' : 'done', k: health?.done ?? 0, total, findings: searching ? null : findings.length, onFindings: openFindings,
      };
    }
    const run = state.analyses.find((x) => x.type === a.type && (a.type !== 'custom' || x.name === a.name));
    const total = run?.repos.length ?? repoCount;
    const status = schedule.start ? 'scheduled' : run?.status === 'Completed' ? 'done' : run?.done ? 'running' : 'queued';
    return {
      key: a.key ?? a.type, name: a.name, type: a.type, cadence: a.cadence, scope: a.prompt || `All ${total} repositories`, status, k: run?.done ?? 0, total,
      findings: status === 'done' ? run.findings : null, onFindings: () => navigate(`/app/cm/analyses/${run.id}`),
    };
  });
  const restDone = rows.every((r) => r.type === 'ple' || r.status === 'done');
  const hasHealth = rows.some((r) => r.type === 'ple');
  const estateCount = rows.filter((r) => r.type !== 'ple').length;

  return (
    <div className="page analyses-landing">
      <Breadcrumbs items={[{ label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') }, { label: 'Analyses' }]} />
      {banner && (
        <div className={`ready-banner landing-banner ${searching ? 'searching' : ''}`}>
          {searching ? <Icon.spinner /> : <Icon.check />}
          <span className="grow">
            <strong>{schedule.start ? 'Continuous analysis scheduled.' : 'Continuous analysis started.'}</strong>{' '}
            {hasHealth && (searching
              ? `Health analysis is finding the code behind ${n} ${u}. `
              : `Health analysis found the code behind ${found === n ? `all ${n}` : `${found} of ${n}`} ${u}. `)}
            {estateCount === 0 ? '' : schedule.start
              ? `${hasHealth ? 'The rest start' : 'The first run starts'} ${fmtDate(schedule.start)}.`
              : restDone ? `${hasHealth ? 'The rest have' : 'Every analysis has'} finished ${hasHealth ? 'their' : 'its'} first run.` : `${hasHealth ? 'The rest finish' : 'The first run finishes'} in about 20 minutes.`}
          </span>
          <Button disabled={hasHealth && searching} onClick={openFindings}>View findings</Button>
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setBanner(false)}><Icon.close /></button>
        </div>
      )}
      <div className="landing-title">
        <div>
          <h1>Analyses</h1>
          <p>What AWS Transform checks across your {repoCount} repositories, and how often. Results land in Findings.</p>
        </div>
        <Button onClick={() => navigate('/app/ple/schedule')}>Edit analyses</Button>
      </div>

      <section className="setup-card landing-card">
        <h2>Analyses <span className="muted h-note">({rows.length})</span></h2>
        <table className="table plain landing-table">
          <thead>
            <tr><th>Analysis</th><th>Status</th><th>Runs</th><th>Next run</th><th className="col-num">Findings</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key ?? r.type}>
                <td>
                  <strong>{r.name ?? typeLabel(r.type)}</strong>
                  <div className="muted small">{r.scope}</div>
                </td>
                <td>
                  {r.status === 'done' && <span className="run-state done"><span className="dot" />Completed</span>}
                  {r.status === 'queued' && <span className="run-state queued"><span className="dot" />Queued</span>}
                  {r.status === 'scheduled' && <span className="run-state queued"><span className="dot" />Scheduled</span>}
                  {r.status === 'running' && (
                    <>
                      <span className="run-state running"><span className="dot" />In progress · {r.k} of {r.total}</span>
                      <span className="run-meter"><span style={{ width: `${(100 * r.k) / (r.total || 1)}%` }} /></span>
                    </>
                  )}
                </td>
                <td>{CADENCE[r.cadence]}</td>
                <td>{shortDate(schedule.start ?? nextRunIso(r.cadence, schedule.day))}</td>
                <td className="col-num">{r.findings == null ? '—' : <Link className="underline" onClick={r.onFindings}><strong>{r.findings} {r.findings === 1 ? 'finding' : 'findings'}</strong></Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="setup-card landing-card">
        <div className="landing-card-head">
          <h2>Settings</h2>
          <Link onClick={() => navigate('/app/ple/schedule')}><strong>Edit</strong></Link>
        </div>
        <dl className="landing-settings">
          <div><dt>Repositories</dt><dd>{repoCount} in {src?.org ?? ORG} on {state.ple.setup.provider ?? 'GitHub'}</dd></div>
          <div><dt>Schedule</dt><dd>Runs start {schedule.day} at {schedule.time}</dd></div>
          <div><dt>Where it runs</dt><dd>{schedule.infra === 'account' ? 'Customer owned' : 'AWS managed'}{schedule.role ? ` · ${schedule.role}` : ''}</dd></div>
          <div><dt>AWS Health</dt><dd>Watching for new notices</dd></div>
        </dl>
      </section>
    </div>
  );
}
