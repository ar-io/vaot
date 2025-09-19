import { useQuery } from '@tanstack/react-query';
import arweaveGraphql from 'arweave-graphql';

export function useProcessMeta(processId?: string) {
  return useQuery({
    queryKey: ['process-meta', processId],
    queryFn: async () => {
      if (!processId) return null;

      const gql = arweaveGraphql('https://arweave.net/graphql');

      const res = await gql.getTransactions({
        ids: [processId],
        first: 1,
      });

      if (res.transactions.edges.length === 0) {
        throw new Error('Process not found');
      }

      const transaction = res.transactions.edges[0].node;

      const nameTag = transaction.tags.find((tag: any) => tag.name === 'Name');

      return {
        id: transaction.id,
        name: nameTag?.value || null,
        blockTimestamp: transaction.block?.timestamp,
        blockHeight: transaction.block?.height,
        owner: transaction.owner?.address,
        tags: transaction.tags,
      };
    },
    enabled: !!processId,
    staleTime: 1000 * 60 * 60, // 1 hour - process metadata doesn't change often
  });
}

export function useProcessAge(processId?: string) {
  const processMetaQuery = useProcessMeta(processId);

  const age = processMetaQuery.data?.blockTimestamp
    ? Date.now() / 1000 - processMetaQuery.data.blockTimestamp
    : null;

  return {
    ...processMetaQuery,
    age, // age in seconds
    ageFormatted: age ? formatAge(age) : null,
  };
}

function formatAge(ageInSeconds: number): string {
  const days = Math.floor(ageInSeconds / (24 * 60 * 60));
  const hours = Math.floor((ageInSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((ageInSeconds % (60 * 60)) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
