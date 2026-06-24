interface Props {
  tag?: string;
  title: React.ReactNode;
  subtitle?: string;
  withToolbar?: boolean;
  children: React.ReactNode;
}

export function PageShell({
  tag,
  title,
  subtitle,
  withToolbar,
  children,
}: Props) {
  return (
    <section
      className={`section page-shell${withToolbar ? " page-shell--toolbar" : ""}`}
    >
      <div className="container">
        <div className="section-header">
          {tag && <span className="tag">{tag}</span>}
          <h1 className="section-title">{title}</h1>
          {subtitle && <p className="section-subtitle">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
