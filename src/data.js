// Seed data reconstructed from the reference screenshots (Aug 2026 tenant).
// Counts are chosen so every dashboard number in 5_Initial_Dashboard_CM.png
// falls out of the raw records rather than being hard-coded.

export const TENANT = {
  account: '522403652850',
  role: 'Admin/nkmoorth-Isengard',
  region: 'us-east-1',
  regionLabel: 'N. Virginia (us-east-1)',
  tenantId: '7223601f9a2dccc7c',
  webAppUrl: 'https://7223601f9a2dccc7c.transform.us-east-1.on.aws/signin/',
  profileArn: 'arn:aws:transform:us-east-1:522403652850:profile/EMRQHCRY44Y4',
  cliInstall: 'curl -fsSL https://transform-cli.awsstatic.com/install.sh | bash',
};

export const ANALYSIS_TYPES = [
  { id: 'td-quick', label: 'Tech debt (quick)', description: 'Fast scan for outdated runtimes, dependencies and applicable transformations.' },
  { id: 'td-comprehensive', label: 'Tech debt (comprehensive)', description: 'Deep review across dependency, security, maintainability, infrastructure, code-quality and architecture.' },
  { id: 'agentic', label: 'Agentic readiness', description: 'How well the repository supports agent-driven development and change.' },
  { id: 'modernization', label: 'Modernization readiness', description: 'Readiness to move to modern runtimes, frameworks and AWS services.' },
  { id: 'security', label: 'Security', description: 'Known CVEs, secrets and insecure code patterns.' },
];

export const typeLabel = (id) => (id === 'ple' ? 'Health analysis' : ANALYSIS_TYPES.find((t) => t.id === id)?.label ?? id);

export const CATEGORIES = ['Dependency', 'Security', 'Maintainability', 'Infrastructure', 'Code-quality', 'Architecture'];

const repoNames = {
  'angularjs-app': [
    'LegacyNodeJSOrderingSystem', 'angularjs-storefront', 'angular-admin-portal', 'ng-inventory-ui', 'legacy-cart-widget',
    'order-status-dashboard', 'customer-profile-spa', 'pricing-rules-ui', 'promo-banner-service', 'catalog-browser',
  ],
  'github-demo': [
    'MKPMobile', 'LegacyDemoAWSTransformApplication_NodeJS', 'java8-payments-api', 'python27-batch-jobs', 'dotnet-fx-reporting',
    'spring-boot-1x-gateway', 'express-legacy-auth', 'struts-claims-portal', 'react-15-dashboard', 'lambda-node12-etl',
  ],
  'github-my-learning': [
    'MyLearning', 'aws-sdk-playground', 'cdk-v1-samples', 'node-katas', 'serverless-notes',
    'terraform-sandbox', 'learning-go', 'docker-compose-labs', 'jest-experiments', 'webpack4-starter',
  ],
};

function buildRepos(source, total) {
  const named = repoNames[source] ?? [];
  return Array.from({ length: total }, (_, i) => named[i] ?? `${source}-repo-${String(i + 1).padStart(2, '0')}`);
}

export const initialSources = [
  { id: 'src-1', name: 'angularjs-app', status: 'Connected', provider: 'GitHub', org: 'angularjs-app', repos: buildRepos('angularjs-app', 33), connectedAt: '2026-08-10' },
  { id: 'src-2', name: 'github-demo', status: 'Connected', provider: 'GitHub', org: 'github-demo', repos: buildRepos('github-demo', 50), connectedAt: '2026-08-10' },
  { id: 'src-3', name: 'github-my-learning', status: 'Connected', provider: 'GitHub', org: 'github-my-learning', repos: buildRepos('github-my-learning', 33), connectedAt: '2026-08-20' },
];

let fid = 0;
const f = (title, severity, repo, date, analysisType, category, transformation = null, analysisId) => ({
  id: `F-${String(++fid).padStart(3, '0')}`,
  title,
  severity,
  status: 'Open',
  transformation,
  date,
  analysisType,
  category,
  repo,
  analysisId,
  notes: '',
});

const L = 'LegacyNodeJSOrderingSystem';
const M = 'MKPMobile';
const D = 'LegacyDemoAWSTransformApplication_NodeJS';
const ML = 'MyLearning';

export const initialFindings = [
  // Aug 24 deep analysis (3 repos, 17 findings)
  f('Deprecated and Unmaintained Packages', 'High', M, '2026-08-24', 'td-comprehensive', 'Dependency', null, 'A-2'),
  f('End-of-Life Expo SDK 38 Core Framework', 'High', M, '2026-08-24', 'td-comprehensive', 'Dependency', null, 'A-2'),
  f('No Dependency Manifest (package.json Missing)', 'High', D, '2026-08-24', 'td-comprehensive', 'Infrastructure', null, 'A-2'),
  f('Empty Repository - No Application Source Code', 'High', D, '2026-08-24', 'td-comprehensive', 'Architecture', null, 'A-2'),
  f('No test framework or test files', 'High', ML, '2026-08-24', 'td-comprehensive', 'Code-quality', null, 'A-2'),
  f('React Native 0.63 Outdated', 'High', M, '2026-08-24', 'td-comprehensive', 'Dependency', null, 'A-2'),
  f('Hard-coded API endpoints', 'Medium', M, '2026-08-24', 'td-comprehensive', 'Maintainability', null, 'A-2'),
  f('Missing CI/CD configuration', 'Medium', M, '2026-08-24', 'td-comprehensive', 'Infrastructure', null, 'A-2'),
  f('Insecure AsyncStorage token persistence', 'Medium', M, '2026-08-24', 'td-comprehensive', 'Security', null, 'A-2'),
  f('No README or onboarding docs', 'Low', M, '2026-08-24', 'td-comprehensive', 'Maintainability', null, 'A-2'),
  f('Missing .gitignore entries', 'Medium', D, '2026-08-24', 'td-comprehensive', 'Infrastructure', null, 'A-2'),
  f('Repository lacks license file', 'Low', D, '2026-08-24', 'td-comprehensive', 'Maintainability', null, 'A-2'),
  f('Webpack 4 build toolchain', 'Medium', ML, '2026-08-24', 'td-comprehensive', 'Dependency', null, 'A-2'),
  f('Inconsistent lint configuration', 'Medium', ML, '2026-08-24', 'td-comprehensive', 'Code-quality', null, 'A-2'),
  f('Unused dependencies in package.json', 'Low', ML, '2026-08-24', 'td-comprehensive', 'Dependency', null, 'A-2'),
  f('Console logging left in production paths', 'Low', ML, '2026-08-24', 'td-comprehensive', 'Code-quality', null, 'A-2'),
  f('Large monolithic component files', 'Low', ML, '2026-08-24', 'td-comprehensive', 'Maintainability', null, 'A-2'),
  // Aug 10 comprehensive on LegacyNodeJSOrderingSystem (10 findings)
  f('Security Vulnerabilities in Application Code', 'High', L, '2026-08-10', 'td-comprehensive', 'Security', null, 'A-3'),
  f('jsonwebtoken v8 Known CVEs', 'High', L, '2026-08-10', 'td-comprehensive', 'Security', null, 'A-3'),
  f('AWS SDK v2 in Maintenance Mode', 'High', L, '2026-08-10', 'td-comprehensive', 'Dependency', 'AWS/nodejs-aws-sdk-v2-to-v3', 'A-3'),
  f('Node.js 16.x Runtime End-of-Life', 'High', L, '2026-08-10', 'td-comprehensive', 'Dependency', 'AWS/nodejs-version-upgrade', 'A-3'),
  f('Express 4.16 with vulnerable body-parser', 'High', L, '2026-08-10', 'td-comprehensive', 'Security', null, 'A-3'),
  f('Callback-style async code', 'Medium', L, '2026-08-10', 'td-comprehensive', 'Architecture', 'AWS/nodejs-version-upgrade', 'A-3'),
  f('Secrets read from plaintext config', 'Medium', L, '2026-08-10', 'td-comprehensive', 'Security', null, 'A-3'),
  f('Moment.js deprecated date library', 'Medium', L, '2026-08-10', 'td-comprehensive', 'Dependency', null, 'A-3'),
  f('No structured logging', 'Medium', L, '2026-08-10', 'td-comprehensive', 'Infrastructure', null, 'A-3'),
  f('Duplicated order-validation logic', 'Low', L, '2026-08-10', 'td-comprehensive', 'Dependency', null, 'A-3'),
  // Aug 10 quick on LegacyNodeJSOrderingSystem (2 findings)
  f('Applicable transformation: AWS/nodejs-version-upgrade', 'High', L, '2026-08-10', 'td-quick', 'Dependency', 'AWS/nodejs-version-upgrade', 'A-4'),
  f('Outdated npm lockfile format', 'Low', L, '2026-08-10', 'td-quick', 'Dependency', null, 'A-4'),
];

export const initialRemediations = [
  { id: 'R-4', name: 'Test Remediation', status: 'Complete', outcome: 1, date: '2026-08-24', transformation: 'AWS/nodejs-aws-sdk-v2-to-v3', repos: [L], findings: ['F-020'], tags: ['test'], branch: 'atx/remediation/test-remediation-0824' },
  { id: 'R-3', name: 'Some remediation name', status: 'Complete', outcome: 1, date: '2026-08-20', transformation: 'AWS/nodejs-version-upgrade', repos: [L], findings: ['F-021'], tags: [], branch: 'atx/remediation/some-remediation-name-0820' },
  { id: 'R-2', name: 'AWS SDK Remediation', status: 'Complete', outcome: 1, date: '2026-08-10', transformation: 'AWS/nodejs-aws-sdk-v2-to-v3', repos: [L], findings: ['F-020'], tags: ['sdk'], branch: 'atx/remediation/aws-sdk-remediation-0810' },
  { id: 'R-1', name: 'aws-sdk-v2-to-v3', status: 'Complete', outcome: 1, date: '2026-08-10', transformation: 'AWS/nodejs-aws-sdk-v2-to-v3', repos: [L], findings: ['F-020'], tags: ['sdk'], branch: 'atx/remediation/aws-sdk-v2-to-v3-0810' },
];

export const initialAnalyses = [
  { id: 'A-1', date: '2026-08-25T09:26', name: 'Tech debt (quick)', type: 'td-quick', status: 'Completed', repos: ['angularjs-storefront'], done: 1, progress: 100, findings: 0, infra: 'AWS managed', source: 'angularjs-app' },
  { id: 'A-2', date: '2026-08-24T14:02', name: 'Deep Analysis for these three', type: 'td-comprehensive', status: 'Completed', repos: [M, D, ML], done: 3, progress: 100, findings: 17, infra: 'AWS managed', source: 'github-demo' },
  { id: 'A-3', date: '2026-08-10T11:40', name: 'Tech debt (comprehensive)', type: 'td-comprehensive', status: 'Completed', repos: [L], done: 1, progress: 100, findings: 10, infra: 'Customer owned', source: 'angularjs-app' },
  { id: 'A-4', date: '2026-08-10T10:12', name: 'Tech debt (quick)', type: 'td-quick', status: 'Completed', repos: [L], done: 1, progress: 100, findings: 2, infra: 'Customer owned', source: 'angularjs-app' },
];

export const repoTech = {
  [L]: 'JavaScript',
  [M]: 'Unknown',
  [D]: 'Unknown',
  [ML]: 'Unknown',
  'angularjs-storefront': 'JavaScript',
};

export const initialInfrastructure = [
  { name: 'AtxInfrastructureStack', status: 'Deployed', type: 'Batch', deployedAt: '2026-08-10' },
  { name: 'AtxDispatcherStack', status: 'Deployed', type: 'Dispatcher', deployedAt: '2026-08-10' },
  { name: 'AtxSecurityAgentStack-us-east-1', status: 'Deployed', type: 'Security agent', deployedAt: '2026-08-10' },
  { name: 'atx-scheduler', status: 'Deployed', type: 'Scheduler', deployedAt: '2026-08-10' },
  { name: 'atx-runner', status: 'Not deployed', type: 'EC2', deployedAt: null },
];

// Synthetic findings emitted when a mock analysis finishes.
export const findingTemplates = {
  'td-quick': [
    ['Applicable transformation: AWS/nodejs-version-upgrade', 'High', 'Dependency', 'AWS/nodejs-version-upgrade'],
    ['Outdated package manager lockfile', 'Low', 'Dependency', null],
  ],
  'td-comprehensive': [
    ['AWS SDK v2 in Maintenance Mode', 'High', 'Dependency', 'AWS/nodejs-aws-sdk-v2-to-v3'],
    ['Runtime approaching End-of-Life', 'High', 'Dependency', 'AWS/nodejs-version-upgrade'],
    ['Known CVEs in transitive dependencies', 'High', 'Security', null],
    ['Missing automated tests', 'Medium', 'Code-quality', null],
    ['No infrastructure as code', 'Medium', 'Infrastructure', null],
    ['Tightly coupled service layers', 'Low', 'Architecture', null],
  ],
  agentic: [
    ['No AGENTS.md / contributor guidance for agents', 'Medium', 'Maintainability', null],
    ['Build cannot run non-interactively', 'High', 'Infrastructure', null],
    ['Low unit-test coverage limits safe agent changes', 'Medium', 'Code-quality', null],
  ],
  modernization: [
    ['Runtime approaching End-of-Life', 'High', 'Dependency', 'AWS/nodejs-version-upgrade'],
    ['Self-managed cron jobs could move to EventBridge', 'Low', 'Architecture', null],
    ['Container image based on deprecated base', 'Medium', 'Infrastructure', null],
  ],
  security: [
    ['Hard-coded credentials detected', 'High', 'Security', null],
    ['jsonwebtoken v8 Known CVEs', 'High', 'Security', null],
    ['Missing HTTP security headers', 'Medium', 'Security', null],
  ],
};

export const TRANSFORMATIONS = ['AWS/nodejs-version-upgrade', 'AWS/nodejs-aws-sdk-v2-to-v3', 'AWS/java-version-upgrade', 'AWS/python-version-upgrade'];

export const fmtDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso.length === 10 ? `${iso}T12:00` : iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return `${fmtDate(iso)}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};
