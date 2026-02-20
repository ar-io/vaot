import { useHyperbeamState } from './useHyperbeamState';

export function useVAOTProposals(id?: string) {
  const { data: state, ...rest } = useHyperbeamState(id);
  return {
    ...rest,
    data: state?.proposals,
  };
}
