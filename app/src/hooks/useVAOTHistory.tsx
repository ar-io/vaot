import { queryClient } from '@/main';
import { VAOTWriteHandlers } from '@/services/vaot';
import { sleep } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import arweaveGraphql, { TransactionEdge } from 'arweave-graphql';
import { useMemo } from 'react';

export function useVAOTIncomingMessages(vaotId?: string) {
  return useQuery({
    queryKey: ['graphql-incoming-messages', vaotId],
    queryFn: async () => {
      const gql = arweaveGraphql('https://arweave.net/graphql');

      const results: TransactionEdge['node'][] = [];
      let cursor = null;
      let hasNextPage = true;
      while (hasNextPage) {
        try {
          await queryClient.fetchQuery({
            queryKey: ['graphql-incoming-messages', vaotId, cursor],
            queryFn: async () => {
              const res = await gql.getTransactions({
                first: 100,
                recipients: [vaotId],
              });
              res.transactions.edges.forEach((edge) =>
                results.push(edge.node as any),
              );
              cursor = res.transactions.edges[-1].cursor;
              hasNextPage = res.transactions.pageInfo.hasNextPage;
            },
            staleTime: Infinity,
          });
        } catch (error) {
          console.error(error);
        }
      }

      return results;
    },
    staleTime: 1000 * 60 * 60,
    enabled: !!vaotId,
  });
}

export function useVAOTOutgoingMessages(vaotId?: string) {
  return useQuery({
    queryKey: ['graphql-outgoing-messages', vaotId],
    queryFn: async () => {
      const gql = arweaveGraphql('https://arweave.net/graphql');

      const results = [];

      let cursor = null;
      let hasNextPage = true;
      while (hasNextPage) {
        try {
          await queryClient.fetchQuery({
            queryKey: ['graphql-incoming-messages', vaotId, cursor],
            queryFn: async () => {
              const res = await gql.getTransactions({
                first: 100,
                owners: ['fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY'],
                tags: [{ name: 'From-Process', values: [vaotId] }],
              });
              res.transactions.edges.forEach((edge) =>
                results.push(edge.node as any),
              );
              cursor = res.transactions.edges[-1].cursor;
              hasNextPage = res.transactions.pageInfo.hasNextPage;
            },
            staleTime: Infinity,
          });
        } catch (error) {
          console.error(error);
        }
      }
      return results;
    },
    staleTime: 1000 * 60 * 60,
    enabled: !!vaotId,
  });
}

export function useVAOTHistory(vaotId?: string) {
  const incomingMessagesQuery = useVAOTIncomingMessages(vaotId);
  const outgoingMessagesQuery = useVAOTOutgoingMessages(vaotId);

    const allMessages = useMemo(() => {
    if (!incomingMessagesQuery.data || !outgoingMessagesQuery.data) return [];
    return [...incomingMessagesQuery.data, ...outgoingMessagesQuery.data].sort(
      (a: TransactionEdge['node'], b: TransactionEdge['node']) => {
        const aTime = a.tags.find((t) => t.name === 'Timestamp').value;
        const bTime = b.tags.find((t) => t.name === 'Timestamp').value;
        try {
          return parseInt(aTime ?? '0') - parseInt(bTime ?? '0');
        } catch (error) {
          return 0;
        }
      },
    );
  }, [incomingMessagesQuery.data, outgoingMessagesQuery.data]);
  return {
    incomingMessages: incomingMessagesQuery,
    outgoingMessages: outgoingMessagesQuery,
    allMessages
  };
}
