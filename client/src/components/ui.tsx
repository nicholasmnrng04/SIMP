import InlineLoading from '@carbon/react/es/components/InlineLoading/InlineLoading.js';
import { InlineNotification } from '@carbon/react/es/components/Notification/Notification.js';
import Modal from '@carbon/react/es/components/Modal/Modal.js';
import SkeletonText from '@carbon/react/es/components/SkeletonText/SkeletonText.js';
import Tag from '@carbon/react/es/components/Tag/Tag.js';
import { Tile } from '@carbon/react/es/components/Tile/Tile.js';
import { useState, type ReactNode } from 'react';

export function Feedback({ children, error = false, kind }: { children: ReactNode; error?: boolean; kind?: 'success' | 'info' | 'warning' | 'error' }) {
  const notificationKind = kind ?? (error ? 'error' : 'success');
  const subtitle = typeof children === 'string' || typeof children === 'number' ? String(children) : undefined;
  return <InlineNotification
    className="feedback"
    hideCloseButton
    kind={notificationKind}
    lowContrast
    role={notificationKind === 'error' ? 'alert' : 'status'}
    title={notificationKind === 'error' ? 'Tindakan belum berhasil' : notificationKind === 'warning' ? 'Perlu diperhatikan' : notificationKind === 'info' ? 'Informasi' : 'Berhasil'}
    subtitle={subtitle}
  >{subtitle === undefined ? <div className="feedback-content">{children}</div> : undefined}</InlineNotification>;
}
export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}
    {hint && <small id={`${id}-hint`}>{hint}</small>}{error && <span className="field-error" id={`${id}-error`}>{error}</span>}
  </div>;
}
export function LoadingPanel({ text = 'Memuat data…' }: { text?: string }) {
  return <div className="state-panel loading-panel" role="status"><InlineLoading description={text} status="active" /><SkeletonText paragraph lineCount={3} /></div>;
}
export function Brand({ href = '/ringkasan' }: { href?: string }) {
  return <a className="brand" href={href} aria-label="SIMP, buka Beranda"><img className="brand-logo" src="/arshaka-logo.png" alt="" /></a>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return <header className="page-heading simp-page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function MetricTile({ label, value, emphasis = false, helper }: { label: ReactNode; value: ReactNode; emphasis?: boolean; helper?: ReactNode }) {
  return <Tile className={`metric-tile${emphasis ? ' metric-tile-emphasis' : ''}`}><span>{label}</span><strong>{value}</strong>{helper && <small>{helper}</small>}</Tile>;
}

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export function StatusTag({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: StatusTone; className?: string }) {
  const types: Record<StatusTone, 'green' | 'warm-gray' | 'red' | 'blue' | 'gray'> = { success: 'green', warning: 'warm-gray', danger: 'red', info: 'blue', neutral: 'gray' };
  return <Tag className={`simp-status-tag ${className}`.trim()} size="sm" type={types[tone]}>{children}</Tag>;
}

export function ActionBar({ children, sticky = false }: { children: ReactNode; sticky?: boolean }) {
  return <div className={`form-actions action-bar${sticky ? ' action-bar-sticky' : ''}`}>{children}</div>;
}

export function FilterPanel({ title = 'Filter', active = false, children }: { title?: string; active?: boolean; children: ReactNode }) {
  return <details className="disclosure filter-panel" open={active}><summary>{title}{active ? ' · aktif' : ''}</summary>{children}</details>;
}

export function FormSection({ title, description, actions, children, className = '' }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`form-section ${className}`.trim()}><header><div><h2>{title}</h2>{description && <p className="muted">{description}</p>}</div>{actions}</header>{children}</section>;
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return <section className="state-panel empty-state"><div className="empty-state-mark" aria-hidden="true">○</div><h2>{title}</h2>{children && <div className="muted">{children}</div>}{action && <div className="inline-actions">{action}</div>}</section>;
}

export function ConfirmActionModal({ open, title, label = 'Konfirmasi tindakan', message, confirmLabel, cancelLabel = 'Batal', danger = false, busy = false, onConfirm, onClose }: { open: boolean; title: string; label?: string; message: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return <Modal
    aria-label={label}
    closeButtonLabel="Tutup"
    danger={danger}
    modalHeading={title}
    modalLabel={label}
    open={open}
    primaryButtonDisabled={busy}
    primaryButtonText={busy ? 'Memproses…' : confirmLabel}
    secondaryButtonText={cancelLabel}
    size="sm"
    onRequestClose={onClose}
    onRequestSubmit={onConfirm}
  ><div className="confirm-copy">{message}</div></Modal>;
}

type ConfirmRequest = { title: string; message: ReactNode; confirmLabel: string; danger?: boolean; resolve: (answer: boolean) => void };
export function useConfirmAction() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const confirm = (options: Omit<ConfirmRequest, 'resolve'>) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve }));
  const answer = (value: boolean) => { request?.resolve(value); setRequest(null); };
  const confirmation = <ConfirmActionModal
    open={!!request}
    title={request?.title ?? ''}
    message={request?.message}
    confirmLabel={request?.confirmLabel ?? 'Lanjutkan'}
    danger={request?.danger}
    onConfirm={() => answer(true)}
    onClose={() => answer(false)}
  />;
  return { confirm, confirmation };
}

export function HistoryTimeline({ children }: { children: ReactNode }) {
  return <div className="history-timeline">{children}</div>;
}
