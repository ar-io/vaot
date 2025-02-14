import TableView from './TableView';
import { useEffect, useState } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useVAOTProposals } from '@src/hooks/useVAOTProposals';
import { Link } from 'react-router-dom';
import { camelToReadable, formatForMaxCharCount } from '@src/utils';

import CopyButton from '@src/components/buttons/CopyButton';

type TableData = {
  controller: string;
  vote: 'yay' | 'nay';
};

const columnHelper = createColumnHelper<TableData>();

function VAOTVotesTable({
  vaotId,
  proposalId,
}: {
  vaotId?: string;
  proposalId?: string;
}) {
  const { data: proposals, isLoading: isLoadingProposals } =
    useVAOTProposals(vaotId);
  const proposal = proposals
    ? Object.values(proposals).find((p) => p.msgId === proposalId)
    : undefined;
  const [data, setData] = useState<TableData[]>([]);

  useEffect(() => {
    if (proposal) {
      const yays = Object.keys(proposal.yays);
      const nays = Object.keys(proposal.nays);
      const newData = [
        ...yays.map((controller) => ({ controller, vote: 'yay' })),
        ...nays.map((controller) => ({ controller, vote: 'nay' })),
      ];
      setData(newData as any);
    } else setData([]);
  }, [proposal]);

  // Define columns for the table
  const columns: ColumnDef<TableData, any>[] = ['controller', 'vote'].map(
    (key) =>
      columnHelper.accessor(key as keyof TableData, {
        id: key,
        size: undefined,
        header: camelToReadable(key),
        sortDescFirst: true,
        sortingFn: 'alphanumeric',
        cell: ({ row }) => {
          const rowValue = row.getValue(key) as any;
          if (key === 'vote') {
            return rowValue;
          } else
            return (
              <div className="flex gap-3 items-center justify-start">
                <Link
                  to={`https://ao.link/#/entity/${rowValue}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-500"
                >
                  {formatForMaxCharCount(rowValue, 8)}
                </Link>
                <CopyButton textToCopy={rowValue} />
              </div>
            );
        },
      }),
  );

  return (
    <div className="flex w-full flex-col border border-stone-500 rounded">
      <TableView
        data={data}
        columns={columns}
        isLoading={isLoadingProposals}
        defaultSortingState={{ id: 'vote', desc: true }}
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

          return '';
        }}
        headerClass="rounded-t text-white "
        tableClass="overflow-hidden rounded bg-stone-900"
        tableWrapperClassName="w-full rounded bg-stone-900"
        noDataFoundText={
          <span className="text-white p-5 ">No Votes Found</span>
        }
      />
    </div>
  );
}

export default VAOTVotesTable;
