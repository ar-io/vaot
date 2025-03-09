import { useQuery } from '@tanstack/react-query';
import { useVAOT } from './useVAOT';
import { ARWEAVE_TX_REGEX } from '@ar.io/sdk';

export function useVAOTControllers(id?: string) {
  const vaot = useVAOT(id);
  return useQuery({
    queryKey: ['vaot-controllers', id, vaot],
    queryFn: async () => {
      return await vaot?.getControllers();
    },
    enabled: !!vaot && !!id && ARWEAVE_TX_REGEX.test(id),
  });
}
