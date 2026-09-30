const steps = [
  ["01", "Browser", "access token / memory"],
  ["02", "Express API", "CSRF + purpose claims"],
  ["03", "PostgreSQL", "hashed refresh family"],
] as const;

export function ProtocolTrace() {
  return (
    <ol className="protocol-trace">
      {steps.map(([number, title, detail], index) => (
        <li key={number}>
          <span className="protocol-trace__node" aria-hidden="true">
            {number}
          </span>
          <div>
            <strong>{title}</strong>
            <small>{detail}</small>
          </div>
          {index < steps.length - 1 ? (
            <span className="protocol-trace__pulse" aria-hidden="true" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
