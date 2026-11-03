import React, { useEffect, useRef, useState } from 'react';
import { fmtDate, typeLabel } from '../data';
import { daysLeft } from '../ple/data';
import { groupView } from '../ple/common';
import { skillSpec } from '../ple/Skill';
import { navigate, useDerived, useStore } from '../store';
import { downloadFile, Icon } from './ui';

// --- tiny markdown renderer: headings, bullets, numbered lists, **bold**, `code`, links
function inline(text) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/\S+)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) parts.push(<strong key={m.index}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) parts.push(<code key={m.index}>{t.slice(1, -1)}</code>);
    else parts.push(<a key={m.index} className="link underline" href={t} target="_blank" rel="noreferrer">{t}</a>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Markdown({ text }) {
  const blocks = [];
  let list = null;
  text.split('\n').forEach((line, i) => {
    const bullet = line.match(/^\s*[-•]\s+(.*)/);
    const num = line.match(/^\s*\d+\.\s+(.*)/);
    if (bullet || num) {
      const kind = bullet ? 'ul' : 'ol';
      if (!list || list.kind !== kind) {
        list = { kind, items: [] };
        blocks.push(list);
      }
      list.items.push((bullet || num)[1]);
      return;
    }
    list = null;
    if (line.startsWith('### ')) blocks.push({ kind: 'h', text: line.slice(4), i });
    else if (line.trim()) blocks.push({ kind: 'p', text: line, i });
  });
  return blocks.map((b, i) => {
    if (b.kind === 'h') return <h4 key={i}>{inline(b.text)}</h4>;
    if (b.kind === 'p') return <p key={i}>{inline(b.text)}</p>;
    const L = b.kind;
    return (
      <L key={i}>
        {b.items.map((it, j) => (
          <li key={j}>{inline(it)}</li>
        ))}
      </L>
    );
  });
}

const RESET_REPLY = `Resetting the whole continuous modernization infrastructure isn't something I can execute from here — this chat is **read-only** for continuous modernization, so setup and teardown both go through the **ATX CLI** (\`atx ct\`). I'll tell you what to expect and where to run it.
### Before you do this — what a full reset wipes
A full infrastructure reset tears down the account-level continuous modernization stack that everything else hangs off of. That means you'd lose:
- All **connected sources** (GitHub / GitLab / Bitbucket org connections)
- All **tracked repositories**
- All **analysis history and findings** (your tech-debt, security, and readiness results)
- All **remediation records**
For context, that includes the full findings set on **LegacyNodeJSOrderingSystem** we just walked through — the two auto-fixable transformations and the security items would all be gone unless you've captured them. If you want a record first, I can generate a downloadable report of your current portfolio before you tear anything down.
### How to do the reset
1. Make sure you have the \`atx ct\` CLI (and ideally the agent skills — AWS Transform Power for Kiro, or the awslabs plugin for Claude Code / Codex / Cursor) installed.
2. Run the teardown through \`atx ct\`. The exact command and flags live in the CLI reference — I don't want to hand you a command string that's slightly wrong for a destructive operation.
3. Re-provision from scratch afterward via the Settings setup flow (deploy infrastructure → connect a source → run an analysis).
References:
- Developer tools / CLI + skills: https://docs.aws.amazon.com/transform/latest/userguide/ct-developer-tools.html
- Setup & usage guide: https://docs.aws.amazon.com/transform/latest/userguide/continuous-modernization.html
Want me to generate a snapshot report of your current findings and repos before you reset, so you don't lose the picture?`;

const RESET_CHIPS = [
  { label: 'Generate a snapshot report first', intent: 'report' },
  { label: 'Show all my repos and sources', intent: 'sources' },
  { label: 'What does re-provisioning involve?', intent: 'reprovision' },
];

const seedConversation = [
  { id: 'u0', role: 'user', text: 'How do I fully reset my continuous modernization infrastructure?', time: '9:52 PM' },
  { id: 'b0', role: 'bot', text: RESET_REPLY, time: '9:53 PM', chips: RESET_CHIPS },
];

function buildReport(state, d) {
  const lines = [
    '# AWS Transform – Continuous modernization snapshot',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    `Sources: ${state.sources.length} · Analyses: ${state.analyses.length} · Remediations: ${state.remediations.length}`,
    `Active findings: ${d.active.length} (High ${d.high.length} / Medium ${d.medium.length} / Low ${d.low.length})`,
    '',
    '## Findings',
    '| ID | Finding | Severity | Status | Repository | Transformation |',
    '|---|---|---|---|---|---|',
    ...state.findings.map((f) => `| ${f.id} | ${f.title} | ${f.severity} | ${f.status} | ${f.repo} | ${f.transformation ?? '—'} |`),
    '',
    '## Remediations',
    ...state.remediations.map((r) => `- ${r.name} — ${r.status} — ${r.transformation} — branch \`${r.branch}\``),
    '',
    '## Sources',
    ...state.sources.map((s) => `- ${s.name} (${s.provider}) — ${s.repos.length} repos — ${s.status}`),
  ];
  return lines.join('\n');
}

function skillWalkthrough(groupId, state) {
  const g = state.ple.groups.find((x) => x.id === groupId);
  if (!g) return { text: "I couldn't find that skill." };
  const v = groupView(state, g);
  const spec = skillSpec(g, v);
  const sk = g.skill ?? {};
  const val = (k) => sk.edits?.[k] ?? spec[k];
  const repos = v.repos.length;
  return {
    text: `Here's what **${sk.name ?? spec.name}** will do, step by step:\n1. **Find the code.** ${val('target')}. That's ${v.live.length} findings across ${repos} ${repos === 1 ? 'repository' : 'repositories'}.\n2. **Change it.** ${val('approach')}.\n3. **Prove it.** ${val('validation')}.\n4. **Stay safe.** ${val('guardrails')}.\nBefore it touches your code, I test it on ${sk.heldOut ?? 2} held-out repositories. If any check fails, nothing runs and you'll see why.\nDecisions I picked for you: ${spec.decisions.map(([k, def]) => `**${k}**: ${sk.decisions?.[k] ?? def}`).join(', ')}. Change any of them with **Edit skill**.`,
    chips: [{ label: 'Open the group', nav: `/app/cm/findings/${g.id}` }],
  };
}


// ---- Custom groups, built in conversation ("Create custom group" on Findings) ----

// The group being drafted, and what the next typed message answers.
let groupDraft = null;
let awaiting = null;
const STOP = new Set(['all', 'the', 'and', 'for', 'with', 'findings', 'finding', 'in', 'of', 'any', 'every', 'group', 'my', 'that', 'are', 'from', 'everything', 'issues']);
// AWS Health findings stay in their Health groups; everything else open can be regrouped.
const groupable = (state, d) => d.active.filter((f) => !f.pleId && f.status === 'Open');
const listOf = (fs) => `${fs.slice(0, 8).map((f) => `- **${f.title}** in ${f.repo} · ${f.severity}`).join('\n')}${fs.length > 8 ? `\n- …and ${fs.length - 8} more` : ''}`;
const pluralize = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function suggestName(fs) {
  const cats = [...new Set(fs.map((f) => f.category))];
  const repos = [...new Set(fs.map((f) => f.repo))];
  if (cats.length === 1 && repos.length === 1) return `${cats[0]} in ${repos[0]}`;
  if (cats.length === 1) return `${cats[0]} fixes`;
  if (repos.length === 1) return `${repos[0]} cleanup`;
  return 'My custom group';
}

function matchFindings(text, pool) {
  const words = text.toLowerCase().split(/[^a-z0-9.-]+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return [];
  const hay = (f) => `${f.title} ${f.category} ${f.repo} ${f.severity} ${f.transformation ?? ''}`.toLowerCase();
  const all = pool.filter((f) => words.every((w) => hay(f).includes(w)));
  return all.length ? all : pool.filter((f) => words.some((w) => hay(f).includes(w)));
}

function pickPrompt(state, d) {
  awaiting = 'cg-pick';
  const pool = groupable(state, d);
  const topCat = Object.entries(pool.reduce((a, f) => ({ ...a, [f.category]: (a[f.category] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topRepo = Object.entries(pool.reduce((a, f) => ({ ...a, [f.repo]: (a[f.repo] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    text: `Let's build a custom group. Which findings belong together? Describe them by topic, repository or severity, for example **hard-coded credentials**, **everything in ${topRepo}** or **high severity ${(topCat ?? '').toLowerCase()}**.\nYou can also select rows on Findings first and I'll start from those.`,
    chips: [
      topCat && { label: `All ${topCat.toLowerCase()} findings`, intent: 'cg-text', text: topCat },
      topRepo && { label: `Everything in ${topRepo}`, intent: 'cg-text', text: topRepo },
      { label: 'Cancel', intent: 'cg-cancel' },
    ].filter(Boolean),
  };
}

function proposal(state, intro) {
  const fs = state.findings.filter((f) => groupDraft.ids.includes(f.id));
  const repos = [...new Set(fs.map((f) => f.repo))];
  const inGroups = state.ple.groups.filter((g) => g.findingIds.some((x) => groupDraft.ids.includes(x))).length;
  awaiting = null;
  return {
    text: `${intro}\n### ${groupDraft.name}\n${listOf(fs)}\n${pluralize(fs.length, 'finding')} across ${pluralize(repos.length, 'repository', 'repositories')}.${inGroups ? ` They leave the ${pluralize(inGroups, 'group')} they're in now.` : ''}${repos.length > 1 ? ' They span several repositories, so you can set a merge order in the plan.' : ''}`,
    chips: [
      { label: `Create “${groupDraft.name}”`, run: 'cg-create' },
      { label: 'Rename it', intent: 'cg-rename' },
      { label: 'Add more findings', intent: 'cg-add' },
      { label: 'Cancel', intent: 'cg-cancel' },
    ],
  };
}

export function startCustomGroupChat(ids) {
  groupDraft = ids.length ? { ids, name: null } : null;
  awaiting = null;
  continueInChat(ids.length ? `Create a custom group from my ${pluralize(ids.length, 'selected finding')}` : 'Help me create a custom group', 'custom-group');
}

function customGroupReply(pick, text, state, d) {
  const pool = groupable(state, d);
  if (pick === 'custom-group') {
    if (!groupDraft) return pickPrompt(state, d);
    const fs = state.findings.filter((f) => groupDraft.ids.includes(f.id));
    groupDraft.name = suggestName(fs);
    return proposal(state, `Here's the group I'd make from your selection. I named it after what the findings share; rename it if you like.`);
  }
  if (pick === 'cg-cancel') {
    groupDraft = null;
    awaiting = null;
    return { text: 'No problem, nothing was created. Your findings stay as they were.', chips: [{ label: 'Summarize my findings', intent: 'findings' }] };
  }
  if (pick === 'cg-rename') {
    awaiting = 'cg-name';
    return { text: `What should the group be called? It's **${groupDraft?.name}** now.` };
  }
  if (pick === 'cg-add') {
    awaiting = 'cg-add';
    return { text: 'Which findings should I add? Describe them the same way, by topic, repository or severity.' };
  }
  // Free text answering the last question.
  if (awaiting === 'cg-name') {
    groupDraft.name = text.trim().replace(/^["“]|["”]$/g, '');
    return proposal(state, 'Renamed. Here it is:');
  }
  const found = matchFindings(text, pool).filter((f) => !groupDraft?.ids.includes(f.id));
  if (!found.length) {
    return { text: `I couldn't match any open findings to “${text}”. Try a category like **Security**, a repository name, or a word from the finding title.`, chips: [{ label: 'Cancel', intent: 'cg-cancel' }] };
  }
  if (awaiting === 'cg-add' && groupDraft) {
    groupDraft.ids = [...groupDraft.ids, ...found.map((f) => f.id)];
    return proposal(state, `Added ${pluralize(found.length, 'finding')}.`);
  }
  const named = suggestName(found);
  const q = text.trim();
  groupDraft = { ids: found.map((f) => f.id), name: named !== 'My custom group' || !q ? named : `${q[0].toUpperCase()}${q.slice(1)} fixes` };
  return proposal(state, `I found ${pluralize(found.length, 'open finding')} that match. Here's the group I'd create:`);
}

function runChip(run, state, dispatch, notify) {
  if (run === 'cg-create' && groupDraft) {
    const id = `G-custom-${state.seq}`;
    const { name, ids } = groupDraft;
    dispatch({ type: 'PLE_CREATE_GROUP', name, findingIds: ids });
    notify(`Custom group “${name}” created with ${pluralize(ids.length, 'finding')}.`);
    groupDraft = null;
    awaiting = null;
    return {
      text: `Done. **${name}** is on Findings with ${pluralize(ids.length, 'finding')} and a Custom group tag. Next, review its remediation plan to pick a TD or generate a specialized skill.`,
      chips: [
        { label: 'Review the plan', nav: `/app/cm/findings/${id}/plan` },
        { label: 'Back to findings', nav: '/app/cm/findings' },
      ],
    };
  }
  return { text: 'That draft is no longer open. Choose Create custom group on Findings to start again.' };
}

function respond(intent, text, state, d) {
  if ((intent && (intent === 'custom-group' || intent.startsWith('cg-'))) || (!intent && awaiting)) return customGroupReply(intent === 'cg-text' ? null : intent, text, state, d);
  const t = (text || '').toLowerCase();
  const pick = intent
    || (/(reset|tear ?down|wipe)/.test(t) && 'reset')
    || (/(\bples?\b|lifecycle|aws health|end of support)/.test(t) && 'ple')
    || (/(report|snapshot|export)/.test(t) && 'report')
    || (/(re-?provision|deploy|infrastructure|stack)/.test(t) && 'reprovision')
    || (/(remediat|fix|branch)/.test(t) && 'remediations')
    || (/(analys|scan)/.test(t) && 'analyses')
    || (/(source|repo|github|gitlab|bitbucket)/.test(t) && 'sources')
    || (/(finding|debt|severity|high|cve|vulnerab)/.test(t) && 'findings')
    || (/(create|delete|dismiss|update|run|start)/.test(t) && 'readonly')
    || 'help';

  if (pick.startsWith('skill:')) return skillWalkthrough(pick.slice(6), state);

  switch (pick) {
    case 'reset':
      return { text: RESET_REPLY, chips: RESET_CHIPS };
    case 'ple': {
      const rows = state.ple.groups
        .filter((g) => g.pleId && g.findingIds.length)
        .map((g) => ({ g, e: state.ple.events.find((x) => x.id === g.pleId), repos: new Set(state.findings.filter((f) => g.findingIds.includes(f.id)).map((f) => f.repo)).size }))
        .sort((a, b) => a.e.changeDate.localeCompare(b.e.changeDate));
      if (!rows.length) return { text: 'No AWS Health PLEs are in your code yet. Connect repositories and allow AWS Health access to check them.' };
      const first = rows.find((r) => r.e.td) ?? rows[0];
      return {
        text: `Here's how I'd sequence the PLEs in your code:\n${rows
          .map((r) => `- **${r.g.shortName}** — due ${fmtDate(r.e.changeDate)} (${daysLeft(r.e.changeDate)} days), ${r.repos} repos, ${r.e.td ? `managed TD ready (${r.e.tdLabel})` : r.g.skill?.status === 'ready' ? 'specialized skill tested' : 'specialized skill proposed, needs your review'}`)
          .join('\n')}\nStart with **${first.g.shortName}**: it's the earliest change date with a managed TD, so it can run as one campaign without new tooling.`,
        chips: [
          { label: `Review plan for ${first.g.shortName}`, nav: `/app/cm/findings/${first.g.id}/plan` },
          { label: 'Show PLE findings', nav: '/app/cm/findings', query: { tab: 'ple' } },
        ],
      };
    }
    case 'report':
      downloadFile('cm-snapshot.md', buildReport(state, d));
      return {
        text: `I've generated a snapshot of your portfolio and downloaded it as **cm-snapshot.md**. It covers ${state.findings.length} findings across ${d.reposWith(state.findings)} repositories, ${state.remediations.length} remediation records and ${state.sources.length} connected sources.`,
        chips: [{ label: 'Open findings', nav: '/app/cm/findings' }],
      };
    case 'sources':
      return {
        text: `You have **${state.sources.length} sources** connected:\n${state.sources
          .map((s) => `- **${s.name}** (${s.provider}) — ${s.repos.length} repos — ${s.status}`)
          .join('\n')}\nRepositories with findings:\n${d.repoRows.map((r) => `- **${r.repo}** — ${r.total} findings (${r.High} high)`).join('\n')}`,
        chips: [
          { label: 'Open Sources', nav: '/app/cm/sources' },
          { label: 'Connect a new source', nav: '/app/cm/sources', query: { connect: '1' } },
        ],
      };
    case 'reprovision':
      return {
        text: `Re-provisioning is the Settings setup flow:\n1. **Common infrastructure (once per account)** — \`AtxDispatcherStack\`, \`atx-scheduler\`, and \`AtxSecurityAgentStack-<region>\`.\n2. **Team infrastructure** — \`AtxInfrastructureStack-<suffix>\` (AWS Batch, recommended) or \`atx-runner-<suffix>\` (EC2).\n3. **Connect a source** — GitHub, GitLab or Bitbucket.\n4. **Run an analysis** — start with Tech debt (quick) to get a baseline.\nYou need administrator access to the target account to deploy the CloudFormation stacks.`,
        chips: [{ label: 'Open Settings', nav: '/app/cm/settings' }],
      };
    case 'remediations':
      return {
        text: `There are **${state.remediations.length} remediations**:\n${state.remediations
          .map((r) => `- **${r.name}** — ${r.status} — \`${r.transformation}\` → branch \`${r.branch}\``)
          .join('\n')}\nAuto-fixable findings still open: **${d.active.filter((f) => f.transformation && f.status === 'Open').length}**.`,
        chips: [{ label: 'Open Remediations', nav: '/app/cm/remediations' }],
      };
    case 'analyses': {
      const running = state.analyses.filter((a) => a.status === 'In progress');
      return {
        text: `You've run **${state.analyses.length} analyses**${running.length ? ` (${running.length} in progress)` : ''}:\n${state.analyses
          .slice(0, 6)
          .map((a) => `- **${a.name}** (${typeLabel(a.type)}) — ${a.status} — ${a.repos.length} repo(s), ${a.findings} findings`)
          .join('\n')}`,
        chips: [
          { label: 'Run new analysis', nav: '/app/cm/analyses/new' },
          { label: 'Open Analyses', nav: '/app/cm/analyses' },
        ],
      };
    }
    case 'findings': {
      const top = d.high.slice(0, 5);
      return {
        text: `You have **${d.active.length} active findings** — ${d.high.length} high, ${d.medium.length} medium, ${d.low.length} low — across ${d.reposWith(d.active)} repositories. ${d.active.filter((f) => f.transformation).length} are auto-fixable.\nTop high-severity items:\n${top
          .map((f) => `- **${f.title}** in ${f.repo}${f.transformation ? ` — fixable with \`${f.transformation}\`` : ''}`)
          .join('\n')}`,
        chips: [
          { label: 'View all findings', nav: '/app/cm/findings' },
          { label: 'Show auto-fixable', nav: '/app/cm/findings', query: { fixable: '1' } },
        ],
      };
    }
    case 'readonly':
      return {
        text: `This chat is **read-only** for continuous modernization — I can explain and summarize, but creating, updating or deleting analyses, remediations and sources happens in the Continuous modernization pages or through \`atx ct\`.`,
        chips: [{ label: 'Open Continuous modernization', nav: '/app/cm/dashboard' }],
      };
    default:
      return {
        text: `I can help you understand your continuous modernization portfolio. Try asking about your **findings**, **analyses**, **remediations**, **sources**, or how to **reset** or **re-provision** infrastructure.`,
        chips: [
          { label: 'Summarize my findings', intent: 'findings' },
          { label: 'Show all my repos and sources', intent: 'sources' },
        ],
      };
  }
}

const QUICK_ACTIONS = [
  ['/findings', 'Summarize findings', 'findings'],
  ['/analyses', 'List analyses', 'analyses'],
  ['/remediations', 'List remediations', 'remediations'],
  ['/sources', 'List sources and repos', 'sources'],
  ['/report', 'Download snapshot report', 'report'],
];

const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// Conversation persists across chat surfaces for the session.
let conversationCache = seedConversation;

// Pages hand a prompt to the chat panel ("Walk me through it"). It waits here
// until a panel is mounted to pick it up.
let pendingPrompt = null;
export function continueInChat(text, intent) {
  pendingPrompt = { text, intent };
  window.dispatchEvent(new CustomEvent('atx-chat-prompt'));
}

export function ChatPanel({ variant = 'panel' }) {
  const { state, dispatch, notify } = useStore();
  const d = useDerived();
  const [messages, setMessages] = useState(conversationCache);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    conversationCache = messages;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const send = (text, intent, shown = text) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', text: shown, time: timeNow() }]);
    setDraft('');
    setTyping(true);
    setTimeout(() => {
      const r = respond(intent, text, state, d);
      setMessages((m) => [...m, { id: `b${Date.now()}`, role: 'bot', time: timeNow(), ...r }]);
      setTyping(false);
    }, 700 + Math.random() * 600);
  };

  useEffect(() => {
    const take = () => {
      if (!pendingPrompt) return;
      const p = pendingPrompt;
      pendingPrompt = null;
      send(p.text, p.intent);
    };
    take();
    window.addEventListener('atx-chat-prompt', take);
    return () => window.removeEventListener('atx-chat-prompt', take);
  });

  const onChip = (c) => {
    if (c.nav) navigate(c.nav, c.query);
    else if (c.run) {
      setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', text: c.label, time: timeNow() }]);
      const r = runChip(c.run, state, dispatch, notify);
      setTyping(true);
      setTimeout(() => { setMessages((m) => [...m, { id: `b${Date.now()}`, role: 'bot', time: timeNow(), ...r }]); setTyping(false); }, 500);
    } else send(c.text ?? c.label, c.intent, c.label);
  };

  const lastBot = [...messages].reverse().find((m) => m.role === 'bot');
  const slashMatches = draft.startsWith('/') ? QUICK_ACTIONS.filter(([cmd]) => cmd.startsWith(draft.split(' ')[0])) : [];

  return (
    <div className={`chat chat-${variant}`}>
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-date">August 20, 2026</div>
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="msg-user">
              <div className="bubble">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="msg-bot">
              {variant === 'panel' && (
                <div className="bot-name">
                  <Icon.refresh className="bot-icon" /> AWS Transform
                </div>
              )}
              <div className="bot-body">
                <Markdown text={m.text} />
              </div>
              <div className="msg-meta">
                <button type="button" className="icon-btn" aria-label="Helpful"><Icon.thumbUp /></button>
                <button type="button" className="icon-btn" aria-label="Not helpful"><Icon.thumbDown /></button>
                <span className="meta-sep" />
                <button type="button" className="icon-btn" aria-label="Copy" onClick={() => navigator.clipboard?.writeText(m.text).catch(() => {})}><Icon.copy /></button>
                <span className="meta-sep" />
                <span>{m.time}</span>
              </div>
              {m === lastBot && m.chips && !typing && (
                <div className="chips">
                  {m.chips.map((c) => (
                    <button type="button" key={c.label} className="chip" onClick={() => onChip(c)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {typing && (
          <div className="msg-bot">
            <div className="typing"><span /><span /><span /></div>
          </div>
        )}
      </div>
      <div className="chat-input-wrap">
        {slashMatches.length > 0 && (
          <ul className="slash-menu">
            {slashMatches.map(([cmd, label, intent]) => (
              <li key={cmd} onMouseDown={(e) => { e.preventDefault(); send(label, intent); }}>
                <code>{cmd}</code> <span className="muted">{label}</span>
              </li>
            ))}
          </ul>
        )}
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            const qa = QUICK_ACTIONS.find(([cmd]) => cmd === draft.trim());
            if (qa) send(qa[1], qa[2]);
            else send(draft);
          }}
        >
          <textarea
            value={draft}
            placeholder="Enter / for quick actions"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form.requestSubmit();
              }
            }}
            rows={2}
          />
          <div className="chat-input-row">
            <button type="button" className="icon-btn" aria-label="Quick actions" onClick={() => setDraft('/')}><Icon.slash /></button>
            <button type="button" className="icon-btn at" aria-label="Mention" onClick={() => setDraft((x) => `${x}@`)}>@</button>
            <span className="grow" />
            <button type="submit" className="icon-btn" aria-label="Send" disabled={!draft.trim()}><Icon.send /></button>
          </div>
        </form>
        <div className="chat-disclaimer">AWS Transform uses generative AI. You may need to verify responses.</div>
      </div>
    </div>
  );
}
