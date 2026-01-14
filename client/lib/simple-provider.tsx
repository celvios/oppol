'use client';

import { ReactNode, useEffect, useState } from 'react';

export function ReownProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return <>{children}</>;
  }
  
  return <>{children}</>;
}