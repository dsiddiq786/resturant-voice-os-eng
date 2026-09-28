'use client';

import React from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { KDSProvider } from '@/lib/kdsContext';
import { DeliveryProvider } from '@/lib/deliveryContext';
import { OwnerConfigProvider } from '@/lib/ownerConfigContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <OwnerConfigProvider>
        <KDSProvider>
          <DeliveryProvider>
            {children}
          </DeliveryProvider>
        </KDSProvider>
      </OwnerConfigProvider>
    </ErrorBoundary>
  );
}

