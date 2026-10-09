// Small building blocks every page uses, so all screens share one structure:
// PageHeader (title, one-line description, actions) followed by Cards.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? "on" : ""} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A labelled form control. `group` is for several controls (e.g. checkboxes): a <label> would
 *  tick the first one whenever its text is clicked. */
export function Field({ label, hint, group, children }: { label: string; hint?: ReactNode; group?: boolean; children: ReactNode }) {
  const body = (
    <>
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </>
  );
  return group ? <div className="field" role="group" aria-label={label}>{body}</div> : <label className="field">{body}</label>;
}

export function Badge({ tone, children }: { tone: "pass" | "fail" | "neutral"; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty muted">{children}</p>;
}

/** Long text folded to two lines, with "more" / "less" (e.g. a full product claim). */
export function Clamp({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false); // only offer "more" when the text really is cut off
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setCut(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <span className="clamp">
      <span ref={ref} className={open ? "clamp-text open" : "clamp-text"}>{children}</span>
      {(cut || open) && (
        <button className="link-button small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "less" : "more"}</button>
      )}
    </span>
  );
}
