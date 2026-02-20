import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGlobalState } from '@/store';
import { fetchHyperbeamState, HyperbeamState } from '@/services/hyperbeam';
import { ARWEAVE_TX_REGEX } from '@ar.io/sdk';
import { useCallback, useState } from 'react';

export const HYPERBEAM_STATE_QUERY_KEY = 'hyperbeam-state';

export function useHyperbeamState(id?: string) {
  const hyperbeamUrl = useGlobalState((state) => state.hyperbeamUrl);
  const queryClient = useQueryClient();
  const [isForceRefreshing, setIsForceRefreshing] = useState(false);

  const query = useQuery({
    queryKey: [HYPERBEAM_STATE_QUERY_KEY, id, hyperbeamUrl],
    queryFn: () => fetchHyperbeamState(hyperbeamUrl, id!),
    enabled: !!id && ARWEAVE_TX_REGEX.test(id),
  });

  const forceRefresh = useCallback(async () => {
    if (!id) return;
    setIsForceRefreshing(true);
    try {
      const freshState = await fetchHyperbeamState(hyperbeamUrl, id, true);
      queryClient.setQueryData<HyperbeamState>(
        [HYPERBEAM_STATE_QUERY_KEY, id, hyperbeamUrl],
        freshState,
      );
    } finally {
      setIsForceRefreshing(false);
    }
  }, [id, hyperbeamUrl, queryClient]);

  return { ...query, forceRefresh, isForceRefreshing };
}
