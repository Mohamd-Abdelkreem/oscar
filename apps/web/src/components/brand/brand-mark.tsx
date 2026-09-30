import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand-mark" href="/" aria-label="Relay home">
      <span className="brand-mark__glyph" aria-hidden="true">
        R/
      </span>
      {compact ? null : (
        <span>
          <strong>Relay</strong>
          <small>full-stack starter</small>
        </span>
      )}
    </Link>
  );
}
