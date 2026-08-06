export function Brand({ className = "" }: { className?: string }) {
  return (
    <div aria-label="SetterSaga" className={`brand ${className}`.trim()} translate="no">
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-mark-core" />
      </span>
      <span>
        <strong>CATAN</strong>
        <small>SAGA</small>
      </span>
    </div>
  );
}
