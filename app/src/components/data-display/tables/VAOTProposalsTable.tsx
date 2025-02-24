import TableView from './TableView';
import { ReactNode, useEffect, useState } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useVAOTProposals } from '@/hooks/useVAOTProposals';
import { Link } from 'react-router-dom';
import { camelToReadable, formatForMaxCharCount } from '@/utils';
import { useVAOT } from '@/hooks/useVAOT';
import { EyeIcon, Trash2Icon } from 'lucide-react';
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

type TableData = {
  proposalNumber: number;
  proposer: string;
  yays: number;
  nays: number;
  type: string;
  proposalId: string;

  action: ReactNode;
};

const columnHelper = createColumnHelper<TableData>();

function VAOTProposalsTable({ vaotId }: { vaotId?: string }) {
  const queryClient = useQueryClient();
  const address = useAddress();
  const vaotClient = useVAOT(vaotId);
  const { data: proposals, isLoading: isLoadingProposals } =
    useVAOTProposals(vaotId);
  const [data, setData] = useState<TableData[]>([]);

  const [viewProposalId, setViewProposalId] = useState<string | undefined>();

  useEffect(() => {
    if (proposals) {
      const data = Object.entries(proposals).reduce(
        (acc: TableData[], [_, proposal]) => {
          acc = [
            ...acc,
            {
              proposalNumber: proposal.proposalNumber,
              proposer: proposal.proposer,
              yays: Object.keys(proposal.yays).length,
              nays: Object.keys(proposal.nays).length,
              type: proposal.type,
              proposalId: proposal.msgId,
              action: <></>,
            },
          ];
          return acc;
        },
        [] as TableData[],
      );
      setData(data);
    } else setData([]);
  }, [proposals]);

  // Define columns for the table
  const columns: ColumnDef<TableData, any>[] = [
    'proposalNumber',
    'proposer',
    'proposalId',
    'type',
    'yays',
    'nays',
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
  );

  return (
    <div className="flex flex-col w-full border border-stone-500 rounded">
      <TableView
        data={data}
        columns={columns}
        isLoading={isLoadingProposals}
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
        headerClass="rounded-t text-white "
        tableClass="overflow-hidden rounded"
        tableWrapperClassName="w-full rounded"
        noDataFoundText={
          <span className="text-white p-5">No Proposals Found</span>
        }
      />
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

export default VAOTProposalsTable;
