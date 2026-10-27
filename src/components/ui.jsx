import React, { useEffect, useRef, useState } from 'react';

export const Icon = {
  check: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" {...p}><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M4.8 8.2l2.2 2.2 4.2-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
  ),
  warn: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" {...p}><path d="M8 1.6l7 12.8H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 6v4M8 11.6v1" stroke="currentColor" strokeWidth="1.6" /></svg>
  ),
  info: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" {...p}><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 7v5M8 4.2v1.2" stroke="currentColor" strokeWidth="1.7" /></svg>
  ),
  error: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" {...p}><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.6" /></svg>
  ),
  spinner: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" className="spin" {...p}><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="28 12" /></svg>
  ),
  external: (p) => (
    <svg viewBox="0 0 16 16" width="12" height="12" {...p}><path d="M9 2h5v5M14 2L7 9M12 9.5V14H2V4h4.5" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>
  ),
  copy: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" {...p}><rect x="5" y="5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M2 11V2h9" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
  ),
  caret: (p) => (
    <svg viewBox="0 0 16 16" width="10" height="10" {...p}><path d="M2 5h12L8 12z" fill="currentColor" /></svg>
  ),
  filterCaret: (p) => (
    <svg viewBox="0 0 16 16" width="10" height="10" {...p}><path d="M2.5 4.5h11L8 12z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
  ),
  search: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" {...p}><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M10.6 10.6L14.5 14.5" stroke="currentColor" strokeWidth="1.8" /></svg>
  ),
  close: (p) => (
    <svg viewBox="0 0 16 16" width="16" height="16" {...p}><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" /></svg>
  ),
  menu: (p) => (
    <svg viewBox="0 0 16 16" width="18" height="18" {...p}><path d="M1.5 3.5h13M1.5 8h13M1.5 12.5h13" stroke="currentColor" strokeWidth="1.6" /></svg>
  ),
  refresh: (p) => (
    <svg viewBox="0 0 16 16" width="15" height="15" {...p}><path d="M13.5 8A5.5 5.5 0 1 1 11.4 3.7M13.5 2v3.5H10" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>
  ),
  send: (p) => (
    <svg viewBox="0 0 16 16" width="16" height="16" {...p}><path d="M1.5 2l13 6-13 6 2.5-6z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
  ),
  thumbUp: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" {...p}><path d="M2 7h3v7H2zM5 7l3-5c1.2 0 1.8.8 1.5 2L9 6.5h4.2c.9 0 1.5.8 1.3 1.6l-1.2 4.8c-.2.7-.8 1.1-1.5 1.1H5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
  ),
  thumbDown: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" style={{ transform: 'rotate(180deg)' }} {...p}><path d="M2 7h3v7H2zM5 7l3-5c1.2 0 1.8.8 1.5 2L9 6.5h4.2c.9 0 1.5.8 1.3 1.6l-1.2 4.8c-.2.7-.8 1.1-1.5 1.1H5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
  ),
  slash: (p) => (
    <svg viewBox="0 0 16 16" width="15" height="15" {...p}><rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10 4L6 12" stroke="currentColor" strokeWidth="1.4" /></svg>
  ),
  bell: (p) => (
    <svg viewBox="0 0 16 16" width="16" height="16" {...p}><path d="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11zM6.5 14h3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
  ),
  help: (p) => (
    <svg viewBox="0 0 16 16" width="16" height="16" {...p}><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6 6.2a2 2 0 1 1 2.8 1.8c-.6.3-.8.7-.8 1.3M8 11.3v1" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
  ),
  gear: (p) => (
    <svg viewBox="0 0 16 16" width="16" height="16" {...p}><circle cx="8" cy="8" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15M3 3l1.6 1.6M11.4 11.4L13 13M3 13l1.6-1.6M11.4 4.6L13 3" stroke="currentColor" strokeWidth="1.5" /></svg>
  ),
  terminal: (p) => (
    <svg viewBox="0 0 16 16" width="16" height="16" {...p}><rect x="1.5" y="2" width="13" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M4.5 6l2 2-2 2M8 10.5h3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
  ),
  grid: (p) => (
    <svg viewBox="0 0 16 16" width="16" height="16" {...p}>{[2, 7, 12].flatMap((x) => [2, 7, 12].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="2.6" height="2.6" fill="currentColor" />))}</svg>
  ),
};

export function TransformLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="atxg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c128d7" />
          <stop offset="1" stopColor="#5a26e0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="6" fill="url(#atxg)" />
      <path d="M16 6l8.5 5v10L16 26l-8.5-5V11z" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M11.5 18l3-4 3 3 3-4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Button({ variant = 'normal', disabled, iconRight, children, className = '', ...rest }) {
  return (
    <button type="button" className={`btn btn-${variant} ${className}`} disabled={disabled} {...rest}>
      {children}
      {iconRight}
    </button>
  );
}

export function Link({ children, external, onClick, href, ...rest }) {
  return (
    <a
      className="link"
      href={href ?? '#'}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick(e);
        }
      }}
      {...rest}
    >
      {children}
      {external && <Icon.external style={{ marginLeft: 4, verticalAlign: '-1px' }} />}
    </a>
  );
}

const statusMap = {
  Connected: ['success', Icon.check],
  Complete: ['success', Icon.check],
  Completed: ['success', Icon.check],
  Deployed: ['success', Icon.check],
  Resolved: ['success', Icon.check],
  Active: ['success', Icon.check],
  Open: ['warning', Icon.warn],
  'Not deployed': ['info', Icon.info],
  Dismissed: ['stopped', Icon.info],
  Paused: ['stopped', Icon.info],
  Failed: ['error', Icon.error],
  'In progress': ['progress', Icon.spinner],
  'In remediation': ['progress', Icon.spinner],
  Connecting: ['progress', Icon.spinner],
  Deploying: ['progress', Icon.spinner],
  Pending: ['progress', Icon.spinner],
  'Resolved (AWS Health)': ['success', Icon.check],
  RESOLVED: ['success', Icon.check],
  PENDING: ['warning', Icon.warn],
  Upcoming: ['info', Icon.info],
  queued: ['stopped', Icon.info],
  running: ['progress', Icon.spinner],
  change_ready: ['info', Icon.check],
  merged: ['success', Icon.check],
  failed: ['error', Icon.error],
  draft_pr: ['stopped', Icon.info],
  manual: ['stopped', Icon.info],
};

export function Status({ value, children }) {
  const [tone, Ico] = statusMap[value] ?? ['info', Icon.info];
  return (
    <span className={`status status-${tone}`}>
      <Ico /> {children ?? value}
    </span>
  );
}

export function Severity({ value }) {
  return <span className={`sev sev-${value.toLowerCase()}`}>{value}</span>;
}

export function Container({ header, actions, children, className = '', description }) {
  return (
    <section className={`container ${className}`}>
      {(header || actions) && (
        <div className="container-header">
          <div>
            {header && <h2>{header}</h2>}
            {description && <p className="muted small">{description}</p>}
          </div>
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      <div className="container-body">{children}</div>
    </section>
  );
}

export function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={active === t.id}
          className={`tab ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.badge != null && t.badge > 0 && <span className="count-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOutside]);
}

/** Cloudscape-style select. options: [{value,label,description?}] */
export function Select({ value, options, onChange, placeholder = 'Choose', invalid, compact, width, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const selected = options.find((o) => o.value === value);
  return (
    <div className={`select ${compact ? 'compact' : ''}`} ref={ref} style={width ? { width } : undefined}>
      <button
        type="button"
        className={`select-trigger ${invalid ? 'invalid' : ''} ${open ? 'open' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className={selected ? '' : 'placeholder'}>{selected ? selected.label : placeholder}</span>
        <Icon.caret className={`caret ${open ? 'up' : ''}`} />
      </button>
      {open && (
        <ul className="select-menu" role="listbox">
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={o.value === value ? 'selected' : ''}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <div>{o.label}</div>
              {o.description && <div className="muted small">{o.description}</div>}
            </li>
          ))}
          {options.length === 0 && <li className="muted">No options</li>}
        </ul>
      )}
    </div>
  );
}

export function ButtonDropdown({ label, items, variant = 'normal', onItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div className="dropdown" ref={ref}>
      <Button variant={variant} onClick={() => setOpen((o) => !o)} iconRight={<Icon.caret style={{ marginLeft: 8 }} />}>
        {label}
      </Button>
      {open && (
        <ul className="select-menu right">
          {items.map((it) => (
            <li
              key={it.id}
              className={it.disabled ? 'disabled' : ''}
              onClick={() => {
                if (it.disabled) return;
                onItem(it.id);
                setOpen(false);
              }}
            >
              <div>{it.label}</div>
              {it.description && <div className="muted small">{it.description}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FormField({ label, description, error, children, secondary }) {
  return (
    <div className="field">
      {label && (
        <label className="field-label">
          {label}
          {secondary && <span className="field-secondary"> - {secondary}</span>}
        </label>
      )}
      {description && <div className="field-desc">{description}</div>}
      {children}
      {error && (
        <div className="field-error">
          <Icon.error /> {error}
        </div>
      )}
    </div>
  );
}

export function Input({ invalid, className = '', ...props }) {
  return <input className={`input ${invalid ? 'invalid' : ''} ${className}`} {...props} />;
}

export function SearchInput({ value, onChange, placeholder, width = 260 }) {
  return (
    <div className="search" style={{ width }}>
      <Icon.search />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" className="icon-btn" onClick={() => onChange('')} aria-label="Clear">
          <Icon.close width={12} height={12} />
        </button>
      )}
    </div>
  );
}

export function Radio({ name, options, value, onChange }) {
  return (
    <div className="radio-group">
      {options.map((o) => (
        <label key={o.value} className="radio">
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>
            <span className="radio-label">{o.label}</span>
            {o.description && <span className="radio-desc">{o.description}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, width = 600 }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon.close />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Alert({ type = 'info', title, children, action }) {
  const Ico = { info: Icon.info, warning: Icon.warn, error: Icon.error, success: Icon.check }[type];
  return (
    <div className={`alert alert-${type}`}>
      <Ico className="alert-icon" />
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        <div>{children}</div>
      </div>
      {action}
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  return (
    <div className="pagination">
      <button type="button" className="icon-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        ‹
      </button>
      {Array.from({ length: Math.max(pages, 1) }, (_, i) => i + 1).map((p) => (
        <button type="button" key={p} className={`page ${p === page ? 'active' : ''}`} onClick={() => onChange(p)}>
          {p}
        </button>
      ))}
      <button type="button" className="icon-btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
        ›
      </button>
    </div>
  );
}

/** Generic table. columns: [{id, header, cell(row), sort?(row) , width}] */
export function Table({ columns, rows, selectable, selected = [], onSelect, rowKey = (r) => r.id, empty, sort, onSort }) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(rowKey(r)));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {selectable && (
              <th className="cb">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onSelect(allSelected ? selected.filter((k) => !rows.some((r) => rowKey(r) === k)) : [...new Set([...selected, ...rows.map(rowKey)])])}
                  aria-label="Select all"
                />
              </th>
            )}
            {columns.map((c) => {
              const sortable = !!c.sort && onSort;
              const activeSort = sort?.by === c.id;
              return (
                <th key={c.id} style={c.width ? { width: c.width } : undefined} className={sortable ? 'sortable' : ''} onClick={() => sortable && onSort(c.id)}>
                  <span className="th-inner">
                    {c.header}
                    {sortable && (activeSort ? <Icon.caret className={sort.desc ? '' : 'up'} /> : <Icon.filterCaret />)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const k = rowKey(r);
            const isSel = selected.includes(k);
            return (
              <tr key={k} className={isSel ? 'selected' : ''}>
                {selectable && (
                  <td className="cb">
                    <input type="checkbox" checked={isSel} onChange={() => onSelect(isSel ? selected.filter((x) => x !== k) : [...selected, k])} aria-label={`Select ${k}`} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.id}>{c.cell(r)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="table-empty">{empty}</div>}
    </div>
  );
}

export function useSort(initial) {
  const [sort, setSort] = useState(initial);
  const onSort = (by) => setSort((s) => (s.by === by ? { by, desc: !s.desc } : { by, desc: false }));
  return [sort, onSort];
}

export function applySort(rows, columns, sort) {
  const col = columns.find((c) => c.id === sort.by);
  if (!col?.sort) return rows;
  return [...rows].sort((a, b) => {
    const x = col.sort(a);
    const y = col.sort(b);
    const r = x < y ? -1 : x > y ? 1 : 0;
    return sort.desc ? -r : r;
  });
}

export function ProgressBar({ value, label, tone = 'success' }) {
  return (
    <div className="progress">
      {label && <div className={`progress-label ${tone}`}>{label}</div>}
      <div className="progress-row">
        <div className="progress-track">
          <div className={`progress-fill ${tone}`} style={{ width: `${value}%` }} />
        </div>
        <span className="small">{Math.round(value)}%</span>
      </div>
    </div>
  );
}

export function CopyText({ text, mono, notify }) {
  return (
    <span className="copy-text">
      <button
        type="button"
        className="icon-btn"
        aria-label="Copy"
        onClick={() => {
          navigator.clipboard?.writeText(text).catch(() => {});
          notify?.('Copied to clipboard');
        }}
      >
        <Icon.copy />
      </button>
      <span className={mono ? 'mono' : ''}>{text}</span>
    </span>
  );
}

export function Toasts({ toasts, dismiss }) {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type ?? 'success'}`}>
          <span>{t.text}</span>
          <button type="button" className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <Icon.close width={12} height={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs">
      {items.map((it, i) => (
        <span key={it.label}>
          {i > 0 && <span className="sep">›</span>}
          {it.onClick ? <Link onClick={it.onClick}>{it.label}</Link> : <span className="current">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function KeyValue({ items, columns = 3 }) {
  return (
    <div className="kv" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {items.map(([k, v]) => (
        <div key={k}>
          <div className="kv-key">{k}</div>
          <div className="kv-value">{v}</div>
        </div>
      ))}
    </div>
  );
}

export function downloadFile(name, content, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
