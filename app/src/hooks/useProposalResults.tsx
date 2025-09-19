import { useQueries } from '@tanstack/react-query';
import { result } from '@permaweb/aoconnect';

type ProposalMessage = {
  id: string;
  timestamp: number;
  tags: { name: string; value: string }[];
};

export function useProposalResults(
  vaotId: string | undefined,
  proposalMessages: ProposalMessage[],
) {
  return useQueries({
    queries: proposalMessages.map((message) => ({
      queryKey: ['proposal-result', vaotId, message.id],
      queryFn: async () => {
        if (!vaotId) throw new Error('VAOT ID is required');

        try {
          const resultData = await result({
            message: message.id,
            process: vaotId,
          });

          return {
            messageId: message.id,
            timestamp: message.timestamp,
            result: resultData,
            success: true,
          };
        } catch (error) {
          console.error(
            `Failed to fetch result for message ${message.id}:`,
            error,
          );
          return {
            messageId: message.id,
            timestamp: message.timestamp,
            result: null,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      enabled: !!vaotId && !!message.id,
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    })),
  });
}
