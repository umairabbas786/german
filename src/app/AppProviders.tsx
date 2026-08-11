import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConsumerIdentityMigration } from '../components/ConsumerIdentityMigration';
import { DailyCreditsProvider } from '../contexts/DailyCreditsContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <ConsumerIdentityMigration>
        <DailyCreditsProvider>{children}</DailyCreditsProvider>
      </ConsumerIdentityMigration>
    </BrowserRouter>
  );
}
