import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import {
  AOWalletKit,
  ArConnectStrategy,
  ArweaveWebWalletStrategy,
  ethereumStrategy,
} from '@project-kardeshev/ao-wallet-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 1 day
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  (
    <React.StrictMode>
      <AOWalletKit
        config={{
          permissions: [
            'SIGN_TRANSACTION',
            'ACCESS_ADDRESS',
            'ACCESS_ALL_ADDRESSES',
            'ACCESS_PUBLIC_KEY',
          ],
        }}
        strategies={[
          new ArConnectStrategy(),
          new ArweaveWebWalletStrategy(),
          ethereumStrategy,
        ]}
      >
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AOWalletKit>
    </React.StrictMode>
  ) as any,
);
