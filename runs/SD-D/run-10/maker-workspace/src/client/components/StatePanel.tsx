export function StatePanel({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: { label: string; run(): void };
}) {
  return (
    <section className="empty-library">
      <div className="empty-orbit">
        <span>↗</span>
      </div>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{detail}</p>
      {action && (
        <button className="button button--primary" onClick={action.run}>
          {action.label}
        </button>
      )}
    </section>
  );
}
