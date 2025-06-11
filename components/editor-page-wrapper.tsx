'use client';

import type { ReactNode } from 'react';

/**
 * EditorPageWrapper - DEPRECATED
 *
 * Document editing functionality has been removed in Phase 1, Task 1.4
 * This component now serves as a simple wrapper for legacy compatibility.
 */
export function EditorPageWrapper({
  children,
  docId,
}: {
  children: ReactNode;
  docId: string;
}) {
  console.warn(
    '[EditorPageWrapper] Document editing functionality has been deprecated',
  );

  return <>{children}</>;
}
