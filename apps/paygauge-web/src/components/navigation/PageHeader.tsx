import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TallyMark } from "./TallyMark";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function PageHeader({ title, subtitle, actions, backHref, backLabel = "Back" }: PageHeaderProps) {
  return (
    <header className="pg-standard-header">
      <div className="pg-standard-header-title">
        <div className="pg-standard-header-brand">
          <TallyMark />
          <h1>{title}</h1>
        </div>
        {!backHref && actions ? <div className="pg-standard-header-actions">{actions}</div> : null}
      </div>
      {subtitle ? <p className="pg-standard-header-subtitle">{subtitle}</p> : null}
      {backHref ? (
        <div className="pg-standard-header-toolbar">
          <Link className="pg-link" href={backHref}><ArrowLeft aria-hidden="true" /> {backLabel}</Link>
          {actions ? <div className="pg-standard-header-actions">{actions}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
