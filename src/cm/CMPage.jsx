import React from 'react';
import { navigate, useDerived } from '../store';
import { Tabs } from '../components/ui';
import { Dashboard } from './Dashboard';
import { FindingDetail } from './Findings';
import { Remediations, RemediationDetail } from './Remediations';
import { Analyses, AnalysisDetail } from './Analyses';
import { NewAnalysis } from './NewAnalysis';
import { Sources, SourceDetail } from './Sources';
import { Settings } from './Settings';
import { GroupDetail } from '../ple/Groups';
import { FindingsGrouped } from '../ple/FindingsGrouped';
import { RemediationPlan } from '../ple/RemediationPlan';
import { SkillReview } from '../ple/Skill';
import { CampaignDetail, Campaigns } from '../ple/Campaign';

const TABS = ['dashboard', 'findings', 'campaigns', 'remediations', 'analyses', 'sources', 'settings'];

export function CMPage({ parts, query }) {
  const d = useDerived();
  const [tab = 'dashboard', sub, leaf] = parts;

  // Sub-pages replace the header + tabs with breadcrumbs (see 12_Analysis_Initation_1.png).
  if (sub) {
    // Groups live under Findings (G-… ids); /problems is kept as an alias for old links.
    const isGroup = sub.startsWith('G-');
    if ((tab === 'findings' || tab === 'problems') && isGroup && leaf === 'plan') return <RemediationPlan key={`${sub}-${query.repo ?? ''}-${query.finding ?? ''}`} groupId={sub} query={query} />;
    if ((tab === 'findings' || tab === 'problems') && isGroup && leaf === 'skill') return <SkillReview key={sub} id={sub} query={query} />;
    if ((tab === 'findings' || tab === 'problems') && isGroup) return <GroupDetail key={sub} id={sub} query={query} />;
    if (tab === 'analyses' && sub === 'new') return <NewAnalysis query={query} />;
    if (tab === 'analyses') return <AnalysisDetail id={sub} />;
    if (tab === 'findings') return <FindingDetail id={sub} />;
    if (tab === 'remediations') return <RemediationDetail id={sub} />;
    if (tab === 'sources') return <SourceDetail id={sub} />;
    if (tab === 'campaigns' && sub === 'new') return <RemediationPlan key={query.findings} query={query} />;
    if (tab === 'campaigns') return <CampaignDetail key={sub} id={sub} query={query} />;
  }

  const active = tab === 'problems' ? 'findings' : TABS.includes(tab) ? tab : 'dashboard';
  const views = {
    dashboard: <Dashboard />,
    campaigns: <Campaigns />,
    findings: <FindingsGrouped key={JSON.stringify(query)} query={query} />,
    remediations: <Remediations />,
    analyses: <Analyses />,
    sources: <Sources query={query} />,
    settings: <Settings />,
  };

  return (
    <div className="page">
      <h1 className="page-title">Continuous modernization</h1>
      <p className="page-desc">Continuously assess and modernize your application portfolio. Review findings and remediation, and ask AWS Transform about your code.</p>
      <Tabs
        tabs={[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'findings', label: 'Findings', badge: d.openHigh },
          { id: 'campaigns', label: 'Campaigns' },
          { id: 'remediations', label: 'Remediations' },
          { id: 'analyses', label: 'Analyses' },
          { id: 'sources', label: 'Sources' },
          { id: 'settings', label: 'Settings' },
        ]}
        active={active}
        onChange={(id) => navigate(`/app/cm/${id}`)}
      />
      {views[active]}
    </div>
  );
}
