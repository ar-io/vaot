import TableView from './TableView';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { camelToReadable, formatForMaxCharCount } from '@/utils';
import { useVAOT } from '@/hooks/useVAOT';
import {
  EyeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Trash2Icon,
} from 'lucide-react';
import Tooltip from '../Tooltip';

import CopyButton from '@/components/buttons/CopyButton';
import ViewProposalModal from '@/components/modals/ViewProposalModal';
import { useAddress } from '@project-kardeshev/ao-wallet-kit';
import { VAOTWriteable } from '@/services/vaot';
import {
  showErrorToast,
  showTransactionSuccessToast,
} from '@/components/notifications/toast';
import { useQueryClient } from '@tanstack/react-query';
import { useVAOTHistoryNew } from '@/hooks/useVAOTHistoryNew';

type ProposalMessage = {
  id: string;
  timestamp: number;
  action: string;
  from: string;
  tags: { name: string; value: string }[];
};

type TableData = {
  proposalNumber: number;
  proposer: string;
  yaysCount: number;
  naysCount: number;
  type: string;
  status: string;
  proposalId: string;
  timestamp: number;
  messages: ProposalMessage[];
  action: ReactNode;
  isExpanded?: boolean;
};

const columnHelper = createColumnHelper<TableData>();

function VAOTHistoricalProposalsTable({ vaotId }: { vaotId?: string }) {
  const queryClient = useQueryClient();
  const address = useAddress();
  const vaotClient = useVAOT(vaotId);
  const { historicalProposals, isLoading, hasError } =
    useVAOTHistoryNew(vaotId);

  const [viewProposalId, setViewProposalId] = useState<string | undefined>();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Convert historical proposals to table data format
  const data: TableData[] = useMemo(() => {
    return historicalProposals.map((proposal) => ({
      ...proposal,
      action: <></>, // Will be populated in column definition
    }));
  }, [historicalProposals]);

  const toggleRowExpansion = (proposalNumber: number) => {
    // Close all other rows and only open the clicked one
    if (expandedRows.has(proposalNumber)) {
      // If clicking on already expanded row, close it
      setExpandedRows(new Set());
    } else {
      // Open only this row, close all others
      setExpandedRows(new Set([proposalNumber]));
    }
  };

  // Define columns for the table
  const columns: ColumnDef<TableData, any>[] = [
    // Expand column
    columnHelper.accessor('proposalNumber', {
      id: 'expand',
      header: '',
      cell: ({ row }) => {
        const proposalNumber = row.getValue('proposalNumber') as number;
        const isExpanded = expandedRows.has(proposalNumber);
        const hasMessages = row.original.messages.length > 0;

        return hasMessages ? (
          <button
            onClick={() => toggleRowExpansion(proposalNumber)}
            className="text-stone-400 hover:text-white transition-colors"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
          </button>
        ) : null;
      },
      size: 30,
    }),
    // Other columns
    ...[
      'proposalNumber',
      'proposer',
      'type',
      'status',
      'yaysCount',
      'naysCount',
      'action',
    ].map((key) =>
      columnHelper.accessor(key as keyof TableData, {
        id: key,
        header: key === 'action' ? '' : camelToReadable(key),
        sortDescFirst: true,
        sortingFn: 'alphanumeric',
        cell: ({ row }) => {
          const rowValue = row.getValue(key) as any;
          if (rowValue === undefined || rowValue === null) {
            return '';
          }

          switch (key) {
            case 'proposer':
            case 'proposalId': {
              return (
                <div className="flex gap-3 items-center justify-start">
                  <Link
                    to={`https://ao.link/#/entity/${rowValue}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-500"
                  >
                    {formatForMaxCharCount(rowValue, 8)}
                  </Link>{' '}
                  <CopyButton textToCopy={rowValue} />
                </div>
              );
            }
            case 'proposalCount': {
              return rowValue;
            }
            case 'action': {
              return (
                <div className="flex justify-end w-full items-center gap-4 pr-2">
                  {row.original.proposer === address && (
                    <Tooltip message="Delete Proposal">
                      <button
                        className="flex justify-center items-center"
                        onClick={async () => {
                          if (vaotClient instanceof VAOTWriteable) {
                            const res = await vaotClient
                              .revokeProposal({
                                proposalNumber: row.original.proposalNumber,
                              })
                              .catch((error) => {
                                showErrorToast(error.message);
                              });
                            if (res) {
                              showTransactionSuccessToast(
                                'Revoke Proposal',
                                res.id,
                              );
                              queryClient.resetQueries({
                                queryKey: ['vaot-proposals', vaotId],
                              });
                            }
                          } else {
                            showErrorToast(
                              'VAOT is not writeable, sign in to use',
                            );
                          }
                        }}
                      >
                        <Trash2Icon className="size-5" />
                      </button>
                    </Tooltip>
                  )}

                  <button
                    className="flex justify-center items-center"
                    onClick={() => setViewProposalId(row.original.proposalId)}
                  >
                    <EyeIcon className="size-5" />
                  </button>
                </div>
              );
            }

            default: {
              return rowValue;
            }
          }
        },
      }),
    ),
  ];

  const renderExpandedRow = (row: TableData) => {
    if (!expandedRows.has(row.proposalNumber) || row.messages.length === 0) {
      return null;
    }

    return (
      <div className="bg-stone-900 p-4 border-t border-stone-600">
        <h4 className="text-white font-medium mb-3">
          Proposal Messages ({row.messages.length})
        </h4>
        <div className="space-y-2">
          {row.messages.map((message) => (
            <div
              key={message.id}
              className="bg-stone-800 p-3 rounded border border-stone-600"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-medium">
                    {message.action}
                  </span>
                  <span className="text-stone-400 text-sm">
                    {message.timestamp && message.timestamp > 0
                      ? new Date(message.timestamp).toLocaleString()
                      : `No timestamp (${message.timestamp})`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://ao.link/#/entity/${message.from}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-300 hover:text-emerald-200 text-sm transition-colors"
                  >
                    {formatForMaxCharCount(message.from, 8)}
                  </a>
                  <CopyButton textToCopy={message.id} />
                </div>
              </div>
              <div className="text-stone-300 text-sm">
                Message ID: {formatForMaxCharCount(message.id, 12)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full border border-stone-500 rounded">
      <div className="overflow-hidden rounded">
        <TableView
          data={data}
          columns={columns}
          isLoading={isLoading}
          defaultSortingState={{ id: 'proposalNumber', desc: true }}
          paginationConfig={{ pageSize: 5 }}
          rowClass={(props) => {
            if (props?.headerGroup) {
              return 'rounded-t';
            }
            return '';
          }}
          dataClass={(props) => {
            if (props?.row !== undefined && props.row.getIsExpanded()) {
              return 'border-t-[1px] border-dark-grey border-b-0';
            }
            return 'whitespace-nowrap';
          }}
          headerClass="rounded-t text-white"
          tableClass="overflow-hidden"
          tableWrapperClassName="w-full"
          noDataFoundText={
            <span className="text-white p-5">
              No Historical Proposals Found
            </span>
          }
        />

        {/* Render expanded rows */}
        {data.map((row) => renderExpandedRow(row))}
      </div>
      {viewProposalId && vaotId && (
        <ViewProposalModal
          vaotId={vaotId}
          proposalId={viewProposalId}
          onClose={() => setViewProposalId(undefined)}
        />
      )}
    </div>
  );
}

export default VAOTHistoricalProposalsTable;
