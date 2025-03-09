import { useQuery } from '@tanstack/react-query';
import { useVAOT } from './useVAOT';
import { ARWEAVE_TX_REGEX } from '@ar.io/sdk';

export function useVAOTProposals(id?: string) {
  const vaot = useVAOT(id);
  return useQuery({
    queryKey: ['vaot-proposals', id, vaot],
    queryFn: async () => {
      return await vaot?.getProposals();
    },
    enabled: !!vaot && !!id && ARWEAVE_TX_REGEX.test(id),
  });
}
