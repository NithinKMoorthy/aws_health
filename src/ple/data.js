// Seed data for the AWS Health planned lifecycle event (PLE) flow.
// Counts are chosen so the numbers in the PLE screen spec fall out of the
// records: 40 Python 3.9 functions in 3 accounts, 37 found in 14 repos via
// 22 findings, 9/3/2 merged/ready/failed after the first campaign run, and
// 35 of 40 RESOLVED once the ready PRs merge.

import { TENANT } from '../data';

// Countdown math uses a fixed "today" so day counts match the spec.
export const MOCK_TODAY = '2026-10-26';
export const ORG = 'acme-fintech';
export const OTHER_ACCOUNT = '111122223333';
export const ACCOUNTS = [TENANT.account, '210987654321', '345678901234'];
export const ACCOUNT_ENV = { [TENANT.account]: 'prod', '210987654321': 'staging', '345678901234': 'dev' };

export const daysLeft = (iso) => Math.round((new Date(`${iso}T12:00`) - new Date(`${MOCK_TODAY}T12:00`)) / 86400000);

const arn = (svc, code) => `arn:aws:health:us-east-1::event/${svc}/${code}/${code}_${svc.toLowerCase()}_${Math.abs(hash(code)).toString(16).slice(0, 8)}`;
function hash(s) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

// ---- Repository fixtures ---------------------------------------------------
// fns: Lambda functions (or clusters/instances) whose IaC lives in the repo.
// outcome: what the first campaign run does (merge | ready | fail).
const PY_REPOS = [
  { repo: 'shared-utils', findings: 2, fns: ['shared-layer-publisher'], outcome: 'merge', owner: '@platform-team', file: 'template.yaml', line: 9, first: true },
  { repo: 'payments-api', findings: 2, fns: ['payments-authorize', 'payments-capture', 'payments-refund', 'payments-webhook'], outcome: 'merge', owner: '@payments-team', file: 'template.yaml', line: 14, pr: 482 },
  { repo: 'ledger-svc', findings: 2, fns: ['ledger-post', 'ledger-reconcile', 'ledger-close-day'], outcome: 'ready', owner: '@ledger-team', file: 'serverless.yml', line: 6, pr: 91, linked: 'ledger-worker' },
  { repo: 'ledger-worker', findings: 1, fns: ['ledger-queue-consumer', 'ledger-dlq-replay'], outcome: 'ready', owner: '@ledger-team', file: 'serverless.yml', line: 8, linked: 'ledger-svc', after: 'ledger-svc' },
  {
    repo: 'fraud-model', findings: 1, fns: ['fraud-score'], outcome: 'fail', owner: '@risk-team', file: 'infra/lambda.tf', line: 22,
    failure: { check: 'test_numpy_compat', reason: 'Unit test test_numpy_compat failed: numpy 1.19 has no python3.13 wheel; the TD pinned numpy>=2.1, which changes default float casting.', log: ['$ pytest tests/test_compat.py', 'FAILED tests/test_compat.py::test_numpy_compat - AssertionError: expected float64, got float32', '  > assert scores.dtype == np.float64', '1 failed, 48 passed in 6.21s'] },
  },
  {
    repo: 'kyc-batch', findings: 1, fns: ['kyc-nightly-batch'], outcome: 'fail', owner: '@compliance-team', file: 'template.yaml', line: 31,
    failure: { check: 'dependency check', reason: 'Dependency check failed: pandas==1.1.5 has no build for python3.13 and the upgrade to pandas 2.2 removes DataFrame.append, used in 6 places.', log: ['$ pip install -r requirements.txt --python-version 3.13', 'ERROR: No matching distribution found for pandas==1.1.5', 'atx: dependency check failed (1 blocking, 0 warnings)'] },
  },
  { repo: 'notifications-svc', findings: 2, fns: ['notify-email', 'notify-sms', 'notify-push', 'notify-digest'], outcome: 'merge', owner: '@messaging-team', file: 'template.yaml', line: 18, pr: 233 },
  { repo: 'orders-api', findings: 2, fns: ['orders-create', 'orders-get', 'orders-cancel', 'orders-export', 'orders-stream'], outcome: 'merge', owner: '@orders-team', file: 'cdk/lib/api-stack.ts', line: 41, pr: 1207 },
  { repo: 'inventory-sync', findings: 1, fns: ['inventory-pull', 'inventory-push', 'inventory-audit'], outcome: 'merge', owner: '@orders-team', file: 'template.yaml', line: 12, pr: 77 },
  { repo: 'reporting-etl', findings: 2, fns: ['etl-extract', 'etl-transform', 'etl-load', 'etl-backfill'], outcome: 'merge', owner: '@data-team', file: 'infra/main.tf', line: 57, pr: 318 },
  { repo: 'auth-hooks', findings: 1, fns: ['cognito-pre-signup', 'cognito-post-auth'], outcome: 'merge', owner: '@identity-team', file: 'template.yaml', line: 10, pr: 64 },
  { repo: 'audit-log-shipper', findings: 2, fns: ['audit-ship', 'audit-compact', 'audit-alert'], outcome: 'ready', owner: '@security-team', file: 'serverless.yml', line: 11, pr: 145 },
  { repo: 'image-resizer', findings: 1, fns: ['resize-thumb', 'resize-webp'], outcome: 'merge', owner: '@media-team', file: 'template.yaml', line: 16, pr: 52 },
  { repo: 'search-indexer', findings: 2, fns: ['index-docs', 'index-rebuild'], outcome: 'merge', owner: '@search-team', file: 'cdk/lib/indexer.ts', line: 23, pr: 410 },
];
const PY_NOT_FOUND = ['legacy-csv-import', 'ops-cron-cleanup', 'marketing-sync'];
const PY_PRE_RESOLVED = ['payments-authorize', 'payments-capture', 'payments-refund'];

const NODE_REPOS = [
  { repo: 'web-bff', findings: 2, fns: ['bff-graphql', 'bff-session'], outcome: 'merge', owner: '@web-team', file: 'template.yaml', line: 12, pr: 901 },
  { repo: 'checkout-edge', findings: 2, fns: ['edge-viewer-request', 'edge-origin-response'], outcome: 'merge', owner: '@web-team', file: 'cdk/lib/edge.ts', line: 30, pr: 77 },
  { repo: 'email-renderer', findings: 1, fns: ['render-template'], outcome: 'merge', owner: '@messaging-team', file: 'serverless.yml', line: 9, pr: 39 },
  { repo: 'slack-bot', findings: 1, fns: ['slack-events'], outcome: 'merge', owner: '@platform-team', file: 'template.yaml', line: 7, pr: 18 },
  { repo: 'pdf-statements', findings: 2, fns: ['statement-render', 'statement-mail'], outcome: 'merge', owner: '@payments-team', file: 'template.yaml', line: 21, pr: 260 },
  { repo: 'webhook-relay', findings: 1, fns: ['relay-in'], outcome: 'merge', owner: '@platform-team', file: 'infra/lambda.tf', line: 14, pr: 33 },
];

const RDS_REPOS = [
  { repo: 'core-db-infra', findings: 1, fns: ['core-ledger-db', 'core-ledger-db-replica'], outcome: 'merge', owner: '@dba-team', file: 'infra/rds.tf', line: 44, pr: 512 },
  { repo: 'analytics-warehouse', findings: 1, fns: ['analytics-pg'], outcome: 'merge', owner: '@data-team', file: 'cdk/lib/db-stack.ts', line: 27, pr: 88 },
];

const CACHE_REPOS = [
  { repo: 'session-store', findings: 1, fns: ['session-redis'], outcome: 'merge', owner: '@identity-team', file: 'infra/elasticache.tf', line: 12, pr: 71 },
  { repo: 'rate-limiter', findings: 1, fns: ['ratelimit-redis'], outcome: 'merge', owner: '@platform-team', file: 'template.yaml', line: 33, pr: 29 },
  { repo: 'cache-gateway', findings: 1, fns: ['gateway-cache', 'gateway-cache-ro'], outcome: 'merge', owner: '@web-team', file: 'cdk/lib/cache.ts', line: 18, pr: 140 },
];

const OTHER_REPOS = [
  'admin-console', 'api-gateway-config', 'batch-scheduler', 'billing-ui', 'card-issuing', 'chargeback-svc', 'ci-templates', 'config-service',
  'customer-360', 'data-contracts', 'design-system', 'dev-portal', 'docs-site', 'dispute-portal', 'feature-flags', 'fx-rates', 'gl-mapper',
  'infra-modules', 'kafka-connectors', 'loan-origination', 'merchant-onboarding', 'mobile-app', 'mobile-api', 'observability-stack', 'partner-api',
  'payout-scheduler', 'pricing-engine', 'privacy-requests', 'risk-rules', 'sanctions-screening', 'sdk-python', 'sdk-typescript', 'settlement-svc',
  'statements-ui', 'support-tools', 'tax-calc', 'terraform-live', 'treasury-dashboard', 'user-profile', 'vault-policies', 'vendor-portal',
  'wire-transfers', 'account-closure', 'ach-gateway', 'aml-alerts', 'backoffice-api', 'budget-planner', 'cashflow-forecast', 'consent-service',
  'credit-decisioning', 'crm-sync', 'event-bus-schemas', 'interest-accrual', 'invoice-service', 'notification-templates', 'open-banking-api',
  'qa-automation', 'rewards-engine', 'archived-v1-api', 'archived-mobile-legacy', 'archived-ops-scripts',
];
// Repos the AWS Transform GitHub app can't read (access denied) — produces the "partial" state.
export const UNREADABLE = ['archived-v1-api', 'archived-mobile-legacy', 'archived-ops-scripts'];

export const ORG_REPOS = [...PY_REPOS, ...NODE_REPOS, ...RDS_REPOS, ...CACHE_REPOS].map((r) => r.repo).concat(OTHER_REPOS).sort();

// ---- Events ----------------------------------------------------------------
const fnArn = (account, name) => `arn:aws:lambda:us-east-1:${account}:function:${name}`;

function buildResources(repos, notFound, preResolved, arnFor) {
  const all = [...repos.flatMap((r) => r.fns.map((fn) => ({ name: fn, repo: r.repo }))), ...notFound.map((fn) => ({ name: fn, repo: null }))];
  return all.map((x, i) => {
    const account = ACCOUNTS[i % 3 === 2 ? 2 : i % 5 === 1 ? 1 : 0];
    return { arn: arnFor(account, x.name), name: x.name, account, repo: x.repo, status: preResolved.includes(x.name) ? 'RESOLVED' : 'PENDING', updated: '2026-10-26T07:40', deployed: false };
  });
}

const PY_DESC = [
  'AWS Lambda will end support for the Python 3.9 runtime on March 3, 2027, in line with the end of community security support for Python 3.9.',
  'After this date, Lambda will no longer apply security patches or other updates to the Python 3.9 runtime, and functions using it will no longer be eligible for technical support. You will not be able to create new Lambda functions using Python 3.9 starting April 2, 2027, and you will not be able to update existing functions starting May 3, 2027.',
  'We recommend that you upgrade your functions to Python 3.13 (python3.13). The affected resources tab lists the functions in your accounts that use python3.9. This list is refreshed as you update functions; a function shows RESOLVED once it is no longer on the deprecated runtime.',
].join('\n\n');

export const initialEvents = [
  {
    id: 'lambda-node16',
    arn: arn('LAMBDA', 'AWS_LAMBDA_PLANNED_LIFECYCLE_EVENT'),
    title: 'AWS Lambda end of support for Node.js 16',
    service: 'Lambda', technology: 'Node.js', eventType: 'AWS_LAMBDA_PLANNED_LIFECYCLE_EVENT',
    changeDate: '2027-02-01', start: '2026-08-01', codeChange: true,
    td: 'AWS/nodejs-version-upgrade', tdLabel: 'Node.js version upgrade', from: 'nodejs16.x', target: 'nodejs22.x', evidence: 'Runtime: nodejs16.x',
    description: 'AWS Lambda will end support for the Node.js 16 runtime on February 1, 2027. Upgrade affected functions to Node.js 22 (nodejs22.x).',
    repos: NODE_REPOS,
    resources: buildResources(NODE_REPOS, [], [], fnArn),
  },
  {
    id: 'rds-pg14',
    arn: arn('RDS', 'AWS_RDS_PLANNED_LIFECYCLE_EVENT'),
    title: 'Amazon RDS for PostgreSQL 14 end of standard support',
    service: 'RDS', technology: 'PostgreSQL', eventType: 'AWS_RDS_PLANNED_LIFECYCLE_EVENT',
    changeDate: '2027-02-28', start: '2026-08-28', codeChange: true,
    td: null, tdLabel: null, from: 'postgres 14', target: 'PostgreSQL 16', evidence: 'engine_version = "14.12"',
    description: 'Amazon RDS for PostgreSQL 14 reaches end of standard support on February 28, 2027. Instances still on 14 after this date are enrolled in RDS Extended Support, which is charged per vCPU-hour. Upgrade to PostgreSQL 16 or later.',
    repos: RDS_REPOS,
    resources: buildResources(RDS_REPOS, [], [], (a, n) => `arn:aws:rds:us-east-1:${a}:db:${n}`),
  },
  {
    id: 'lambda-py39',
    arn: arn('LAMBDA', 'AWS_LAMBDA_PLANNED_LIFECYCLE_EVENT_PY39'),
    title: 'AWS Lambda end of support for Python 3.9',
    service: 'Lambda', technology: 'Python', eventType: 'AWS_LAMBDA_PLANNED_LIFECYCLE_EVENT',
    changeDate: '2027-03-03', start: '2026-09-03', codeChange: true,
    td: 'AWS/python-version-upgrade', tdLabel: 'Python version upgrade', from: 'python3.9', target: 'python3.13', evidence: 'Runtime: python3.9',
    description: PY_DESC,
    repos: PY_REPOS,
    resources: buildResources(PY_REPOS, PY_NOT_FOUND, PY_PRE_RESOLVED, fnArn),
  },
  // Open PLEs that aren't found in code.
  {
    id: 'eks-129', arn: arn('EKS', 'AWS_EKS_PLANNED_LIFECYCLE_EVENT'), title: 'Amazon EKS 1.29 end of standard support', service: 'EKS', technology: 'Kubernetes',
    eventType: 'AWS_EKS_PLANNED_LIFECYCLE_EVENT', changeDate: '2027-03-23', start: '2026-09-23', codeChange: true, notFoundReason: 'No matching code in connected repositories',
    description: 'Amazon EKS clusters on Kubernetes 1.29 move to extended support on March 23, 2027.', repos: [],
    resources: [0, 1].map((i) => ({ arn: `arn:aws:eks:us-east-1:${ACCOUNTS[i]}:cluster/platform-${i + 1}`, name: `platform-${i + 1}`, account: ACCOUNTS[i], repo: null, status: 'PENDING', updated: '2026-10-25T18:00' })),
  },
  {
    id: 'opensearch-1x', arn: arn('ES', 'AWS_ES_PLANNED_LIFECYCLE_EVENT'), title: 'Amazon OpenSearch Service 1.x end of standard support', service: 'OpenSearch', technology: 'OpenSearch',
    eventType: 'AWS_ES_PLANNED_LIFECYCLE_EVENT', changeDate: '2027-04-30', start: '2026-10-01', codeChange: true, notFoundReason: 'No matching code in connected repositories',
    description: 'OpenSearch 1.x domains reach end of standard support on April 30, 2027.', repos: [],
    resources: [{ arn: `arn:aws:es:us-east-1:${ACCOUNTS[0]}:domain/logs-search`, name: 'logs-search', account: ACCOUNTS[0], repo: null, status: 'PENDING', updated: '2026-10-25T18:00' }],
  },
  {
    id: 'ec2-retire', arn: arn('EC2', 'AWS_EC2_INSTANCE_RETIREMENT_SCHEDULED'), title: 'Amazon EC2 instance retirement', service: 'EC2', technology: '—',
    eventType: 'AWS_EC2_INSTANCE_RETIREMENT_SCHEDULED', changeDate: '2026-11-18', start: '2026-10-18', codeChange: false, notFoundReason: 'Not a code change',
    description: 'One or more EC2 instances are scheduled for retirement because of degraded underlying hardware. Stop and start the instance to move it to new hardware.', repos: [],
    resources: [{ arn: `arn:aws:ec2:us-east-1:${ACCOUNTS[1]}:instance/i-0a1b2c3d4e5f60718`, name: 'i-0a1b2c3d4e5f60718', account: ACCOUNTS[1], repo: null, status: 'PENDING', updated: '2026-10-24T10:00' }],
  },
  {
    id: 'dx-maint', arn: arn('DIRECTCONNECT', 'AWS_DIRECTCONNECT_MAINTENANCE_SCHEDULED'), title: 'AWS Direct Connect planned maintenance', service: 'Direct Connect', technology: '—',
    eventType: 'AWS_DIRECTCONNECT_MAINTENANCE_SCHEDULED', changeDate: '2026-11-04', start: '2026-11-04', codeChange: false, notFoundReason: 'Not a code change',
    description: 'Planned maintenance on a Direct Connect device may interrupt connectivity for up to 2 hours.', repos: [],
    resources: [{ arn: `arn:aws:directconnect:us-east-1:${ACCOUNTS[0]}:dxcon/dxcon-ffabc123`, name: 'dxcon-ffabc123', account: ACCOUNTS[0], repo: null, status: 'PENDING', updated: '2026-10-20T09:00' }],
  },
];

// Arrives later via EventBridge (Screen 11).
export const NEW_EVENT = {
  id: 'cache-redis6',
  arn: arn('ELASTICACHE', 'AWS_ELASTICACHE_PLANNED_LIFECYCLE_EVENT'),
  title: 'ElastiCache for Redis OSS v6 end of standard support',
  service: 'ElastiCache', technology: 'Redis', eventType: 'AWS_ELASTICACHE_PLANNED_LIFECYCLE_EVENT',
  changeDate: '2027-01-31', start: '2026-10-26', codeChange: true,
  td: null, tdLabel: null, from: 'redis 6.2', target: 'Valkey 8.0', evidence: 'engine_version = "6.2"',
  description: 'ElastiCache for Redis OSS version 6 reaches end of standard support on January 31, 2027. Upgrade to Valkey 8 or Redis OSS 7.1.',
  repos: CACHE_REPOS,
  resources: buildResources(CACHE_REPOS, [], [], (a, n) => `arn:aws:elasticache:us-east-1:${a}:replicationgroup:${n}`),
  campaignMatch: 'C-elasticache',
  // The matching campaign already published a tested skill for engine upgrades.
  reuseSkill: { status: 'ready', saveAs: 'published', heldOut: 2, passed: 2, name: 'elasticache-engine-upgrade' },
};

export const ALL_EVENTS = [...initialEvents, NEW_EVENT];
export const eventById = (id) => ALL_EVENTS.find((e) => e.id === id);
export const repoFixture = (eventId, repo) => eventById(eventId)?.repos.find((r) => r.repo === repo);

// ---- Findings & groups -----------------------------------------------------
// Findings are added to the CM findings list when the PLE analysis finishes.
const EXTRA_EVIDENCE = {
  python: [['requirements.txt', 3, 'python_requires=">=3.9,<3.10"'], ['.github/workflows/ci.yml', 19, 'python-version: "3.9"']],
  node: [['package.json', 5, '"engines": { "node": "16.x" }'], ['.nvmrc', 1, '16']],
};

export function buildFindings(event, startSeq) {
  let seq = startSeq;
  const out = [];
  const extras = event.technology === 'Python' ? EXTRA_EVIDENCE.python : event.technology === 'Node.js' ? EXTRA_EVIDENCE.node : [];
  event.repos.forEach((r) => {
    for (let i = 0; i < r.findings; i++) {
      const [file, line, evidence] = i === 0 ? [r.file, r.line, event.evidence] : extras[(i - 1) % extras.length] ?? [r.file, r.line + 12, event.evidence];
      out.push({
        id: `F-${++seq}`,
        title: `${event.title.replace(/^AWS |^Amazon /, '')}`,
        severity: 'High',
        status: 'Open',
        transformation: event.td,
        date: MOCK_TODAY,
        analysisType: 'ple',
        category: 'Dependency',
        repo: r.repo,
        analysisId: 'A-PLE',
        notes: '',
        pleId: event.id,
        file,
        line,
        evidence,
        // The IaC finding covers the functions; supporting findings cover none.
        functions: i === 0 ? r.fns : [],
      });
    }
  });
  return { findings: out, seq };
}

export const GROUP_TYPES = {
  A: 'A: related issues, one repo',
  B: 'B: one issue, many repos, TD exists',
  C: 'C: one issue, many repos, specialized skill',
};

export function buildGroup(event, findings, extra = {}) {
  return {
    id: `G-${event.id}`,
    pleId: event.id,
    name: event.title.replace(/^AWS |^Amazon /, ''),
    shortName: shortName(event),
    type: event.td ? 'B' : 'C',
    findingIds: findings.map((f) => f.id),
    target: event.target,
    skill: event.td ? null : event.reuseSkill ?? { status: 'proposed', heldOut: 2 },
    ...extra,
  };
}

export function shortName(event) {
  const m = {
    'lambda-py39': 'Lambda Python 3.9',
    'lambda-node16': 'Lambda Node.js 16',
    'rds-pg14': 'RDS for PostgreSQL 14',
    'cache-redis6': 'ElastiCache Redis OSS 6',
  };
  return m[event.id] ?? event.title;
}

// Non-PLE groups over the seeded tech-debt findings (F-001…F-029): 6 groups
// covering 22 findings, leaving 7 standalone findings.
export const OTHER_GROUPS = [
  ['G-mkp-rn', 'MKPMobile on an end-of-life React Native stack', ['F-001', 'F-002', 'F-006']],
  ['G-mkp-maint', 'MKPMobile maintainability and security gaps', ['F-007', 'F-008', 'F-009', 'F-010']],
  ['G-legacy-node', 'Node.js 16 runtime in LegacyNodeJSOrderingSystem', ['F-021', 'F-023', 'F-028']],
  ['G-legacy-sec', 'Vulnerable code and dependencies in LegacyNodeJSOrderingSystem', ['F-018', 'F-019', 'F-022', 'F-024']],
  ['G-demo-scaffold', 'Demo application is missing project scaffolding', ['F-003', 'F-004', 'F-011', 'F-012']],
  ['G-ml-quality', 'MyLearning code-quality and tooling gaps', ['F-005', 'F-013', 'F-014', 'F-015']],
].map(([id, name, findingIds]) => ({ id, pleId: null, name, shortName: name, type: 'A', findingIds, target: null, skill: null }));

// ---- Remediation defaults ------------------------------------------------------

export const prettyTarget = (t) => {
  if (!t) return '';
  let m = t.match(/^python(\d+\.\d+)$/);
  if (m) return `Python ${m[1]}`;
  m = t.match(/^nodejs(\d+)\.x$/);
  if (m) return `Node.js ${m[1]}`;
  return t;
};

export const TARGETS = {
  Python: ['python3.12', 'python3.13'],
  'Node.js': ['nodejs20.x', 'nodejs22.x'],
  PostgreSQL: ['PostgreSQL 16', 'PostgreSQL 17'],
  Redis: ['Valkey 8.0', 'Redis OSS 7.1'],
};

export const CAMPAIGN_NAMES = {
  'lambda-py39': ['Eliminate Python 3.9 Lambdas', (t) => `All Lambda functions on ${t}`],
  'lambda-node16': ['Eliminate Node.js 16 Lambdas', (t) => `All Lambda functions on ${t}`],
  'rds-pg14': ['Upgrade RDS for PostgreSQL 14', (t) => `All RDS for PostgreSQL instances on ${t}`],
  'cache-redis6': ['Retire Redis OSS 6', (t) => `All ElastiCache clusters on ${t}`],
};

// A historical campaign that the new ElastiCache PLE matches (Screen 11).
export const initialCampaigns = [
  {
    id: 'C-elasticache',
    name: 'Modernize ElastiCache',
    target: 'All ElastiCache clusters on Valkey 8',
    targetEngine: 'valkey',
    dueDate: '2026-09-30',
    groups: [{ id: 'G-memcached', name: 'ElastiCache Memcached 1.5 end of support', pleId: null }],
    createdAt: '2026-07-14',
    repos: [
      { repo: 'feature-flags', groupId: 'G-memcached', status: 'merged', pr: 58, validation: 'Passed', owner: '@platform-team', findingIds: [], deployed: true },
      { repo: 'pricing-engine', groupId: 'G-memcached', status: 'merged', pr: 233, validation: 'Passed', owner: '@pricing-team', findingIds: [], deployed: true },
    ],
  },
];
