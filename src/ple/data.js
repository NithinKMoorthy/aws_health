// Seed data for the AWS Health planned lifecycle event (PLE) flow.
// Counts match the CM first-run onboarding spec: three Lambda runtime events
// (Node.js 16: 9 functions in 6 repos, Python 3.10: 3 in 2, Java 11: 4 in 3),
// 16 functions in 3 accounts, 86 repositories in acme-fintech, plus three
// manual-action events (ECS task retirement x2, EC2 instance retirement).

import { TENANT } from '../data';

// Countdown math uses a fixed "today" so day counts match the spec.
export const MOCK_TODAY = '2026-10-28';
export const ORG = 'acme-fintech';
export const OTHER_ACCOUNT = '111122223333';
export const ACCOUNTS = [TENANT.account, '210987654321', '345678901234'];
export const ACCOUNT_ENV = { [TENANT.account]: 'prod', '210987654321': 'staging', '345678901234': 'dev' };
const ENV_ACCOUNT = { prod: ACCOUNTS[0], staging: ACCOUNTS[1], dev: ACCOUNTS[2] };

export const daysLeft = (iso) => Math.round((new Date(`${iso}T12:00`) - new Date(`${MOCK_TODAY}T12:00`)) / 86400000);

const arn = (svc, code) => `arn:aws:health:us-east-1::event/${svc}/${code}/${code}_${svc.toLowerCase()}_${Math.abs(hash(code)).toString(16).slice(0, 8)}`;
function hash(s) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

// ---- Repository fixtures ---------------------------------------------------
// fns: [name, env, region] for each Lambda function (or cluster) defined in the repo.
// outcome: what the first campaign run does (merge | ready | fail).
// hold: merged, but waits for the team's next deploy (until AWS Health is fast-forwarded).
const NODE_REPOS = [
  { repo: 'bff-graphql', findings: 2, fns: [['bff-graphql', 'prod', 'us-east-1']], outcome: 'merge', owner: '@web-team', file: 'serverless.yml', line: 12, pr: 142 },
  { repo: 'bff-session', findings: 1, fns: [['bff-session', 'staging', 'us-east-1']], outcome: 'merge', owner: '@web-team', file: 'template.yaml', line: 9, pr: 88 },
  { repo: 'edge-functions', findings: 2, fns: [['edge-viewer-request', 'dev', 'us-west-2'], ['edge-origin-response', 'prod', 'us-west-2']], outcome: 'merge', owner: '@web-team', file: 'cdk/edge-stack.ts', line: 30, pr: 311 },
  { repo: 'statements', findings: 2, fns: [['render-template', 'prod', 'us-east-1'], ['statement-render', 'staging', 'us-east-1'], ['statement-mail', 'prod', 'us-west-2']], outcome: 'merge', hold: true, owner: '@payments-team', file: 'serverless.yml', line: 21, pr: 57 },
  { repo: 'slack-events', findings: 1, fns: [['slack-events', 'dev', 'eu-west-1']], outcome: 'ready', owner: '@platform-team', file: 'template.yaml', line: 7, pr: 19 },
  { repo: 'relay-in', findings: 1, fns: [['relay-in', 'dev', 'eu-west-1']], outcome: 'ready', owner: '@platform-team', file: 'serverless.yml', line: 14, pr: 203 },
];

const PY_REPOS = [
  { repo: 'billing-exports', findings: 2, fns: [['invoice-export', 'prod', 'us-east-1']], outcome: 'merge', hold: true, owner: '@billing-team', file: 'template.yaml', line: 16, pr: 64 },
  { repo: 'ledger', findings: 2, fns: [['ledger-sync', 'staging', 'eu-west-1'], ['fx-rates', 'prod', 'eu-west-1']], outcome: 'ready', owner: '@ledger-team', file: 'serverless.yml', line: 6, pr: 118 },
];

const JAVA_REPOS = [
  { repo: 'payments', findings: 2, fns: [['payments-core', 'prod', 'us-east-1'], ['settlement-batch', 'prod', 'us-east-1']], outcome: 'ready', owner: '@payments-team', file: 'template.yaml', line: 14, pr: 402 },
  { repo: 'kyc-service', findings: 1, fns: [['kyc-check', 'staging', 'us-east-2']], outcome: 'ready', owner: '@compliance-team', file: 'cdk/kyc-stack.ts', line: 23, pr: 77 },
  { repo: 'audit', findings: 1, fns: [['audit-writer', 'dev', 'us-west-2']], outcome: 'ready', owner: '@security-team', file: 'main.tf', line: 41, pr: 35 },
];

const CACHE_REPOS = [
  { repo: 'session-store', findings: 1, fns: [['session-redis', 'prod', 'us-east-1']], outcome: 'merge', owner: '@identity-team', file: 'infra/elasticache.tf', line: 12, pr: 71 },
  { repo: 'rate-limiter', findings: 1, fns: [['ratelimit-redis', 'prod', 'us-east-1']], outcome: 'merge', owner: '@platform-team', file: 'template.yaml', line: 33, pr: 29 },
  { repo: 'cache-gateway', findings: 1, fns: [['gateway-cache', 'prod', 'us-east-1'], ['gateway-cache-ro', 'staging', 'us-east-1']], outcome: 'merge', owner: '@web-team', file: 'cdk/lib/cache.ts', line: 18, pr: 140 },
];

const OTHER_REPOS = [
  'admin-console', 'api-gateway-config', 'batch-scheduler', 'billing-ui', 'card-issuing', 'chargeback-svc', 'ci-templates', 'config-service',
  'customer-360', 'data-contracts', 'design-system', 'dev-portal', 'docs-site', 'dispute-portal', 'feature-flags', 'fx-rates', 'gl-mapper',
  'infra-modules', 'kafka-connectors', 'loan-origination', 'merchant-onboarding', 'mobile-app', 'mobile-api', 'observability-stack', 'partner-api',
  'payout-scheduler', 'pricing-engine', 'privacy-requests', 'risk-rules', 'sanctions-screening', 'sdk-python', 'sdk-typescript', 'settlement-svc',
  'statements-ui', 'support-tools', 'tax-calc', 'terraform-live', 'treasury-dashboard', 'user-profile', 'vault-policies', 'vendor-portal',
  'wire-transfers', 'account-closure', 'ach-gateway', 'aml-alerts', 'backoffice-api', 'budget-planner', 'cashflow-forecast', 'consent-service',
  'credit-decisioning', 'crm-sync', 'event-bus-schemas', 'interest-accrual', 'invoice-service', 'notification-templates', 'open-banking-api',
  'qa-automation', 'rewards-engine', 'web-storefront', 'search-api', 'recommendations', 'loyalty-api', 'geo-service', 'ops-runbooks',
  'email-service', 'cart-service', 'catalog-sync', 'shipping-rates', 'returns-portal', 'archived-v1-api', 'archived-mobile-legacy', 'archived-ops-scripts',
];
// Repos the AWS Transform GitHub app can't read (access denied) — produces the "partial" state.
export const UNREADABLE = ['archived-v1-api', 'archived-mobile-legacy', 'archived-ops-scripts'];

export const ORG_REPOS = [...NODE_REPOS, ...PY_REPOS, ...JAVA_REPOS, ...CACHE_REPOS].map((r) => r.repo).concat(OTHER_REPOS).sort();

// ---- Events ----------------------------------------------------------------

function buildResources(repos, arnFor) {
  return repos.flatMap((r) =>
    r.fns.map(([name, env, region]) => {
      const account = ENV_ACCOUNT[env] ?? ACCOUNTS[0];
      return { arn: arnFor(account, name, region), name, account, region, repo: r.repo, status: 'PENDING', updated: '2026-10-28T07:40', deployed: false };
    }),
  );
}
const fnArn = (account, name, region = 'us-east-1') => `arn:aws:lambda:${region}:${account}:function:${name}`;

const lambdaDesc = (from, date, to, id) =>
  [
    `AWS Lambda will end support for the ${from} runtime on ${date}.`,
    `After this date, Lambda will no longer apply security patches or other updates to the ${from} runtime, and functions using it will no longer be eligible for technical support.`,
    `We recommend that you upgrade your functions to ${to} (${id}). The affected resources tab lists the functions in your accounts that use the deprecated runtime; a function shows RESOLVED once it is no longer on it.`,
  ].join('\n\n');

const manual = (id, title, service, eventType, changeDate, time, region, unitName, name, summary, action) => ({
  id, arn: arn(service.toUpperCase().replace(/ /g, ''), `${eventType}_${id}`), title, service, technology: '—', eventType, changeDate, start: changeDate, time, codeChange: false,
  notFoundReason: 'Not a code change', summary, manualAction: action, unitName, description: `${title}. ${action}`, repos: [],
  resources: [{ arn: `arn:aws:${service.toLowerCase()}:${region}:${ACCOUNTS[0]}:${name}`, name, account: ACCOUNTS[0], region, repo: null, status: 'PENDING', updated: '2026-10-27T10:00' }],
});

export const initialEvents = [
  {
    id: 'lambda-node16',
    arn: arn('LAMBDA', 'AWS_LAMBDA_PLANNED_LIFECYCLE_EVENT'),
    title: 'AWS Lambda end of support for Node.js 16',
    service: 'Lambda', technology: 'Node.js', eventType: 'AWS_LAMBDA_PLANNED_LIFECYCLE_EVENT',
    changeDate: '2027-02-01', start: '2026-08-01', time: '11:00 PM PST', codeChange: true, scopeBy: 'accounts',
    td: 'AWS/nodejs-version-upgrade', tdLabel: 'Node.js version upgrade', from: 'nodejs16.x', target: 'nodejs22.x', evidence: 'Runtime: nodejs16.x',
    description: lambdaDesc('Node.js 16', 'February 1, 2027', 'Node.js 22', 'nodejs22.x'),
    repos: NODE_REPOS,
    resources: buildResources(NODE_REPOS, fnArn),
  },
  {
    id: 'lambda-py310',
    arn: arn('LAMBDA', 'AWS_LAMBDA_PLANNED_LIFECYCLE_EVENT_PY310'),
    title: 'AWS Lambda end of support for Python 3.10',
    service: 'Lambda', technology: 'Python', eventType: 'AWS_LAMBDA_PLANNED_LIFECYCLE_EVENT',
    changeDate: '2027-03-02', start: '2026-09-02', time: '11:00 PM PST', codeChange: true, scopeBy: 'regions',
    td: 'AWS/python-version-upgrade', tdLabel: 'Python version upgrade', from: 'python3.10', target: 'python3.13', evidence: 'Runtime: python3.10',
    description: lambdaDesc('Python 3.10', 'March 2, 2027', 'Python 3.13', 'python3.13'),
    repos: PY_REPOS,
    resources: buildResources(PY_REPOS, fnArn),
  },
  {
    id: 'lambda-java11',
    arn: arn('LAMBDA', 'AWS_LAMBDA_PLANNED_LIFECYCLE_EVENT_JAVA11'),
    title: 'AWS Lambda end of support for Java 11',
    service: 'Lambda', technology: 'Java', eventType: 'AWS_LAMBDA_PLANNED_LIFECYCLE_EVENT',
    changeDate: '2027-07-29', start: '2027-01-29', time: '12:00 AM PDT', codeChange: true, scopeBy: 'regions',
    td: 'AWS/java-version-upgrade', tdLabel: 'Java version upgrade', from: 'java11', target: 'java21', evidence: 'Runtime: java11',
    description: lambdaDesc('Java 11', 'July 29, 2027', 'Java 21', 'java21'),
    repos: JAVA_REPOS,
    resources: buildResources(JAVA_REPOS, fnArn),
  },
  // Not code changes: AWS Health lists them, AWS Transform doesn't offer a fix.
  manual('ecs-retire-1', 'Amazon ECS task patching retirement', 'ECS', 'AWS_ECS_TASK_PATCHING_RETIREMENT', '2026-10-29', '11:00 PM PDT', 'us-east-1', 'task', 'task/orders/3f9a1c2b',
    'Tasks on an outdated platform version are replaced', 'AWS replaces the task. Make sure your service can restart cleanly.'),
  manual('ecs-retire-2', 'Amazon ECS task patching retirement', 'ECS', 'AWS_ECS_TASK_PATCHING_RETIREMENT', '2026-11-02', '9:00 AM PST', 'us-east-2', 'task', 'task/payouts/8e21d0aa',
    'Tasks on an outdated platform version are replaced', 'AWS replaces the task. Make sure your service can restart cleanly.'),
  manual('ec2-retire', 'Amazon EC2 instance scheduled retirement', 'EC2', 'AWS_EC2_INSTANCE_RETIREMENT_SCHEDULED', '2026-11-14', '2:00 AM PST', 'us-east-1', 'instance', 'instance/i-0a1b2c3d4e5f60718',
    'Underlying host is being retired', 'Stop and start the instance to move it to a new host.'),
];

// Arrives later via EventBridge (Screen 11).
export const NEW_EVENT = {
  id: 'cache-redis6',
  arn: arn('ELASTICACHE', 'AWS_ELASTICACHE_PLANNED_LIFECYCLE_EVENT'),
  title: 'ElastiCache for Redis OSS v6 end of standard support',
  service: 'ElastiCache', technology: 'Redis', eventType: 'AWS_ELASTICACHE_PLANNED_LIFECYCLE_EVENT',
  changeDate: '2027-01-31', start: '2026-10-28', time: '11:00 PM PST', codeChange: true,
  td: null, tdLabel: null, from: 'redis 6.2', target: 'Valkey 8.0', evidence: 'engine_version = "6.2"',
  description: 'ElastiCache for Redis OSS version 6 reaches end of standard support on January 31, 2027. Upgrade to Valkey 8 or Redis OSS 7.1.',
  repos: CACHE_REPOS,
  resources: buildResources(CACHE_REPOS, (a, n, region) => `arn:aws:elasticache:${region}:${a}:replicationgroup:${n}`),
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
  python: [['requirements.txt', 3, 'python_requires=">=3.10,<3.11"'], ['.github/workflows/ci.yml', 19, 'python-version: "3.10"']],
  node: [['package.json', 5, '"engines": { "node": "16.x" }'], ['.nvmrc', 1, '16']],
  java: [['pom.xml', 18, '<maven.compiler.release>11</maven.compiler.release>'], ['.github/workflows/ci.yml', 22, "java-version: '11'"]],
};

export function buildFindings(event, startSeq) {
  let seq = startSeq;
  const out = [];
  const extras = { Python: EXTRA_EVIDENCE.python, 'Node.js': EXTRA_EVIDENCE.node, Java: EXTRA_EVIDENCE.java }[event.technology] ?? [];
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
        functions: i === 0 ? r.fns.map(([name]) => name) : [],
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
    'lambda-node16': 'Lambda Node.js 16',
    'lambda-py310': 'Lambda Python 3.10',
    'lambda-java11': 'Lambda Java 11',
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
  m = t.match(/^java(\d+)$/);
  if (m) return `Java ${m[1]}`;
  return t;
};

export const TARGETS = {
  Python: ['python3.12', 'python3.13'],
  'Node.js': ['nodejs20.x', 'nodejs22.x'],
  Java: ['java17', 'java21'],
  Redis: ['Valkey 8.0', 'Redis OSS 7.1'],
};

export const CAMPAIGN_NAMES = {
  'lambda-node16': ['Eliminate Node.js 16 Lambdas', (t) => `All Lambda functions on ${t}`],
  'lambda-py310': ['Eliminate Python 3.10 Lambdas', (t) => `All Lambda functions on ${t}`],
  'lambda-java11': ['Eliminate Java 11 Lambdas', (t) => `All Lambda functions on ${t}`],
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
