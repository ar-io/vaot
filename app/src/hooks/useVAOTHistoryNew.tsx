import { useMemo } from 'react';
import { useVAOTHistory } from './useVAOTHistory';
import { useProposalResults } from './useProposalResults';

type ProposalMessage = {
  id: string;
  timestamp: number;
  action: string;
  from: string;
  tags: { name: string; value: string }[];
};

type HistoricalProposal = {
  proposalNumber: number;
  proposer: string;
  yaysCount: number;
  naysCount: number;
  type: string;
  status: string;
  proposalId: string;
  timestamp: number;
  messages: ProposalMessage[];
  rawResult: any;
};
// Helper function to normalize timestamp (convert seconds to milliseconds if needed)
const normalizeTimestamp = (timestamp: number): number => {
  // If timestamp is in seconds (less than year 2000 in milliseconds), convert to milliseconds
  if (timestamp < 946684800000) {
    return timestamp * 1000;
  }
  return timestamp;
};

export function useVAOTHistoryNew(vaotId?: string) {
  const { incomingMessages, allMessages } = useVAOTHistory(vaotId);

  // Find all proposal messages (Action: Propose)
  const proposalMessages = useMemo(() => {
    if (!incomingMessages.data) return [];
    return incomingMessages.data
      .filter((node: any) =>
        node.tags.find(
          (t: any) => t.name === 'Action' && t.value === 'Propose',
        ),
      )
      .map((node: any) => ({
        id: node.id,
        timestamp: normalizeTimestamp(
          parseInt(
            node.tags.find((t: any) => t.name === 'Timestamp')?.value ||
              node.block?.timestamp?.toString() ||
              '0',
          ),
        ),
        tags: node.tags,
      }));
  }, [incomingMessages.data]);

  // Fetch proposal results using useQueries
  const proposalResultsQueries = useProposalResults(vaotId, proposalMessages);

  // Get messages for each proposal by proposal number
  const getMessagesForProposal = (
    proposalNumber: number,
  ): ProposalMessage[] => {
    if (!allMessages) return [];

    return allMessages
      .filter((message: any) =>
        message.tags.find(
          (t: any) =>
            t.name === 'Proposal-Number' &&
            parseInt(t.value) === proposalNumber,
        ),
      )
      .map((message: any) => ({
        id: message.id,
        timestamp: normalizeTimestamp(
          parseInt(
            message.tags.find((t: any) => t.name === 'Timestamp')?.value ||
              message.block?.timestamp?.toString() ||
              '0',
          ),
        ),
        action:
          message.tags.find((t: any) => t.name === 'Action')?.value ||
          'Unknown',
        from: message.owner?.address || 'Unknown',
        tags: message.tags,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  };

  // Helper function to extract proposal data from Messages array
  const extractProposalDataFromMessages = (messages: any[]): any => {
    // Find the first message with proposal data
    for (const message of messages) {
      if (message.Data && typeof message.Data === 'string') {
        try {
          const data = JSON.parse(message.Data);
          if (data.proposalNumber !== undefined) {
            return data;
          }
        } catch (error) {
          // Continue to next message if parsing fails
        }
      }
    }
    return null;
  };

  // Process the results into historical proposals
  const historicalProposals = useMemo(() => {
    const successfulResults = proposalResultsQueries
      .filter(
        (query) => query.data?.success && query.data?.result?.Output?.data,
      )
      .map((query) => query.data!);

    const proposals: HistoricalProposal[] = successfulResults
      .map((detail) => {
        // Parse the JSON string in Output.data
        let output;
        try {
          output = JSON.parse(detail.result?.Output?.data || '{}');
        } catch (error) {
          console.error('Failed to parse Output.data:', error);
          return null;
        }

        // Also extract data from Messages for additional context
        const messagesData = extractProposalDataFromMessages(
          detail.result?.Messages || [],
        );

        const proposalNumber =
          output['Proposal-Number'] || messagesData?.proposalNumber || 0;
        const messages = getMessagesForProposal(proposalNumber);

        return {
          proposalNumber,
          proposer: output['From'] || messagesData?.proposer || 'Unknown',
          yaysCount:
            output['Yays-Count'] ||
            Object.keys(messagesData?.yays || {}).length ||
            0,
          naysCount: output['Nays-Count'] || messagesData?.nays?.length || 0,
          type: output['Proposal-Type'] || messagesData?.type || 'Unknown',
          status: output['Proposal-Status'] || 'Unknown',
          proposalId: detail.messageId,
          timestamp: detail.timestamp,
          messages,
          rawResult: detail.result,
        };
      })
      .filter(Boolean) as HistoricalProposal[];

    // Sort by timestamp (most recent first)
    return proposals.sort((a, b) => b.timestamp - a.timestamp);
  }, [proposalResultsQueries, allMessages]);

  // Calculate loading and error states
  const isLoading =
    incomingMessages.isLoading ||
    proposalResultsQueries.some((query) => query.isLoading);

  const hasError =
    incomingMessages.isError ||
    proposalResultsQueries.some((query) => query.isError);

  const errors = [
    ...(incomingMessages.error ? [incomingMessages.error] : []),
    ...proposalResultsQueries
      .filter((query) => query.error)
      .map((query) => query.error!),
  ];

  return {
    historicalProposals,
    proposalMessages,
    isLoading,
    hasError,
    errors,
    // Raw data for advanced usage
    rawIncomingMessages: incomingMessages.data,
    rawAllMessages: allMessages,
    rawProposalResults: proposalResultsQueries
      .map((query) => query.data)
      .filter(Boolean),
  };
}
