'use client';

import React from 'react';
import OwnerControlPanel from '@/components/owner/OwnerControlPanel';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  return <OwnerControlPanel onSwitchToOperations={() => router.push('/')} />;
}
