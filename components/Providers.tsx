'use client';

import React from 'react';
import { KDSProvider } from '@/lib/kdsContext';
import { DeliveryProvider } from '@/lib/deliveryContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <KDSProvider>
      <DeliveryProvider>
        {children}
      </DeliveryProvider>
    </KDSProvider>
  );
}
