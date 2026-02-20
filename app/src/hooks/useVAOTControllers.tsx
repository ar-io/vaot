import { useHyperbeamState } from './useHyperbeamState';

export function useVAOTControllers(id?: string) {
  const { data: state, ...rest } = useHyperbeamState(id);
  return {
    ...rest,
    data: state?.controllers,
  };
}
