import type { ReactNode } from 'react';

/** Thin wrapper that applies the page-container utility class. */
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="page-container">{children}</div>;
}
