import { AOProcess } from '@ar.io/sdk';
import { connect } from '@permaweb/aoconnect';
import { ARNS_TX_ID_REGEX } from '@src/constants';
import { useGlobalState } from '@src/store';
import { isArweaveTransactionID } from '@src/utils';
import { useQuery } from '@tanstack/react-query';

export function useProcessInfo(id?: string) {
  const aoCuUrl = useGlobalState((state) => state.aoCuUrl);
  const gatewayUrl = useGlobalState((state) => state.gatewayUrl);

  return useQuery({
    queryKey: ['process-info', id],
    queryFn: async () => {
      if (!id || !isArweaveTransactionID(id)) return null;
      const processClient = new AOProcess({
        processId: id,
        ao: connect({
          CU_URL: aoCuUrl,
        }),
      });
      return await processClient.read<Record<string, string>>({
        tags: [{ name: 'Action', value: 'Info' }],
      });
    },
    enabled: !!id,
  });
}
