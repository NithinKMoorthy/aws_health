import React, { useMemo, useState } from 'react';
import { CATEGORIES, fmtDateTime, typeLabel } from '../data';
import { navigate, useDerived, useStore } from '../store';
import { Button, Container, downloadFile, Link, Tabs } from '../components/ui';

const SEV_COLORS = { High: '#e8806a', Medium: '#f1b27a', Low: '#efcb6c' };

function StatCard({ tone, title, value, sub, fixable }) {
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
      {fixable != null && <span className="fix-pill">{fixable}</span>}
    </div>
  );
}

function Donut({ data, center, label }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 66;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 320 220" className="donut">
        <g transform="translate(160 110) rotate(-90)">
          {data.map((d) => {
            const len = (d.value / total) * c;
            const el = (
              <circle key={d.label} r={r} fill="none" stroke={d.color} strokeWidth="16" strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-offset} />
            );
            offset += len;
            return el;
          })}
        </g>
        {(() => {
          let acc = 0;
          return data.map((d) => {
            const mid = ((acc + d.value / 2) / total) * 2 * Math.PI - Math.PI / 2;
            acc += d.value;
            const x1 = 160 + Math.cos(mid) * (r + 9);
            const y1 = 110 + Math.sin(mid) * (r + 9);
            const x2 = 160 + Math.cos(mid) * (r + 28);
            const y2 = 110 + Math.sin(mid) * (r + 28);
            const right = Math.cos(mid) >= 0;
            return (
              <g key={d.label}>
                <polyline points={`${x1},${y1} ${x2},${y2} ${x2 + (right ? 14 : -14)},${y2}`} fill="none" stroke="#5f6b7a" strokeWidth="1" />
                <text x={x2 + (right ? 18 : -18)} y={y2 + 4} textAnchor={right ? 'start' : 'end'} className="donut-label">
                  {d.label}
                </text>
              </g>
            );
          });
        })()}
        <text x="160" y="106" textAnchor="middle" className="donut-center">{center}</text>
        <text x="160" y="128" textAnchor="middle" className="donut-sub">{label}</text>
      </svg>
      <div className="legend">
        {data.map((d) => (
          <span key={d.label}>
            <i style={{ background: d.color, borderRadius: 2 }} /> {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const step = max <= 10 ? 0.5 : Math.ceil(max / 20);
  const ticks = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(Number(t.toFixed(1)));
  return (
    <div className="barchart">
      <div className="bar-title">Category</div>
      <div className="bar-grid">
        {rows.map((r) => (
          <div className="bar-row" key={r.label}>
            <span className="bar-label">{r.label}</span>
            <div className="bar-track">
              {ticks.map((t) => (
                <span key={t} className="gridline" style={{ left: `${(t / max) * 100}%` }} />
              ))}
              <div className="bar" style={{ width: `${(r.value / max) * 100}%` }} title={`${r.label}: ${r.value}`} />
            </div>
          </div>
        ))}
        <div className="bar-row axis">
          <span className="bar-label" />
          <div className="bar-track">
            {ticks.map((t) => (
              <span key={t} className="tick" style={{ left: `${(t / max) * 100}%` }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="bar-xlabel">Findings</div>
    </div>
  );
}

export function Dashboard() {
  const { state, notify } = useStore();
  const d = useDerived();
  const breakdownTypes = useMemo(() => {
    const order = ['td-comprehensive', 'td-quick', 'security', 'agentic', 'modernization'];
    return order.filter((t) => d.active.some((f) => f.analysisType === t));
  }, [d.active]);
  const [bt, setBt] = useState(breakdownTypes[0]);
  const curType = breakdownTypes.includes(bt) ? bt : breakdownTypes[0];
  const typeFindings = d.active.filter((f) => f.analysisType === curType);
  const typeRepos = [...new Set(typeFindings.map((f) => f.repo))];
  const techCounts = typeRepos.reduce((acc, r) => {
    const t = state.repoTech[r] ?? 'Unknown';
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const techColors = { Unknown: '#7d9fdc', JavaScript: '#f5b45c', TypeScript: '#5ec2b7', Java: '#c178de', Python: '#8bc86a' };
  const donutData = Object.entries(techCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: techColors[label] ?? '#9aa5b1' }));
  const categoryRows = CATEGORIES.map((c) => ({ label: c, value: typeFindings.filter((f) => f.category === c).length }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const fixable = (list) => list.filter((f) => f.transformation).length;
  const totalFixable = fixable(d.active);

  const generateReport = () => {
    const md = [
      `# ${typeLabel(curType)} report`,
      `${typeRepos.length} repositories analyzed · ${typeFindings.length} findings`,
      '',
      '## Findings by category',
      ...categoryRows.map((r) => `- ${r.label}: ${r.value}`),
      '',
      '## Findings',
      ...typeFindings.map((f) => `- [${f.severity}] ${f.title} — ${f.repo}${f.transformation ? ` (fix: ${f.transformation})` : ''}`),
    ].join('\n');
    downloadFile(`${curType}-report.md`, md);
    notify('Report generated and downloaded.');
  };

  return (
    <div className="dash">
      <div className="section-head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted small">
            Last analyzed: {d.lastAnalyzed ? fmtDateTime(d.lastAnalyzed) : '—'} · {d.analyzedRepos.size} analyzed repositories · {d.connectedSources.length} sources connected
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/app/cm/analyses/new')}>
          New analysis
        </Button>
      </div>

      <div className="stats">
        <StatCard tone="high" title="High severity findings" value={d.high.length} sub={`Across ${d.reposWith(d.high)} repos`} fixable={fixable(d.high) ? `${fixable(d.high)} auto-fixable` : null} />
        <StatCard tone="medium" title="Medium severity findings" value={d.medium.length} sub={`Across ${d.reposWith(d.medium)} repos`} fixable={fixable(d.medium) ? `${fixable(d.medium)} auto-fixable` : null} />
        <StatCard tone="low" title="Low severity findings" value={d.low.length} sub={`Across ${d.reposWith(d.low)} repos`} fixable={fixable(d.low) ? `${fixable(d.low)} auto-fixable` : null} />
        <StatCard
          tone="total"
          title="Total findings"
          value={d.active.length}
          sub={`${d.analyzedRepos.size} repos analyzed`}
          fixable={`${totalFixable} auto-fixable (${d.active.length ? Math.round((totalFixable / d.active.length) * 100) : 0}%)`}
        />
      </div>

      <Container header="Top 3 repos with findings" actions={<Button onClick={() => navigate('/app/cm/findings')}>View all findings</Button>}>
        <table className="table plain">
          <thead>
            <tr>
              <th style={{ width: '32%' }}>Repository</th>
              <th style={{ width: '24%' }}>Distribution</th>
              <th>High</th>
              <th>Medium</th>
              <th>Low</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {d.repoRows.slice(0, 3).map((r) => (
              <tr key={r.repo}>
                <td>
                  <Link onClick={() => navigate('/app/cm/findings', { repo: r.repo, status: 'all-active' })}>{r.repo}</Link>
                </td>
                <td>
                  <div className="dist">
                    {['High', 'Medium', 'Low'].map((s) => (
                      <span key={s} style={{ flex: r[s], background: SEV_COLORS[s] }} title={`${s}: ${r[s]}`} />
                    ))}
                  </div>
                </td>
                <td>{r.High}</td>
                <td>{r.Medium}</td>
                <td>{r.Low}</td>
                <td>
                  <strong>{r.total}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="legend">
          {Object.entries(SEV_COLORS).map(([k, c]) => (
            <span key={k}>
              <i style={{ background: c }} /> {k}
            </span>
          ))}
        </div>
      </Container>

      <Container header="Analysis breakdown">
        {breakdownTypes.length === 0 ? (
          <div className="empty-state">
            <strong>No findings yet</strong>
            <p className="muted">Run an analysis to see a breakdown.</p>
          </div>
        ) : (
          <>
            <Tabs className="sub-tabs" tabs={breakdownTypes.map((t) => ({ id: t, label: typeLabel(t) }))} active={curType} onChange={setBt} />
            <div className="section-head tight">
              <strong>
                {typeRepos.length} repositories analyzed · {typeFindings.length} findings
              </strong>
              <Button onClick={generateReport}>Generate report</Button>
            </div>
            <div className="breakdown">
              <div>
                <h3 className="chart-title">Technology distribution</h3>
                <Donut data={donutData} center={typeRepos.length} label="Repos analyzed" />
              </div>
              <div>
                <h3 className="chart-title">Findings by category</h3>
                <BarChart rows={categoryRows} />
              </div>
            </div>
          </>
        )}
      </Container>
    </div>
  );
}
