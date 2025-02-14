import { useVAOTControllers } from '@src/hooks/useVAOTControllers';
import TableView from './TableView';
import { ReactNode, useEffect, useState } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useVAOTProposals } from '@src/hooks/useVAOTProposals';
import { Link } from 'react-router-dom';
import { camelToReadable, formatForMaxCharCount } from '@src/utils';
import { useVAOT } from '@src/hooks/useVAOT';
import { HammerIcon } from 'lucide-react';
import Tooltip from '../Tooltip';
import { VAOTWriteable } from '@src/services/vaot';
import {
  showErrorToast,
  showSuccessToast,
} from '@src/components/notifications/toast';
import CopyButton from '@src/components/buttons/CopyButton';

type TableData = {
  controller: string;
  proposalCount: number;
  action: ReactNode;
};

const columnHelper = createColumnHelper<TableData>();

function VAOTControllersTable({ vaotId }: { vaotId?: string }) {
  const vaotClient = useVAOT(vaotId);
  const { data: controllers, isLoading: isLoadingControllers } =
    useVAOTControllers(vaotId);
  const { data: proposals, isLoading: isLoadingProposals } =
    useVAOTProposals(vaotId);
  const [data, setData] = useState<TableData[]>([]);

  useEffect(() => {
    if (controllers && proposals) {
      const proposalRecords = Object.values(proposals);
      const data = controllers.reduce((acc: TableData[], controller) => {
        const proposalsForController = proposalRecords.filter(
          (proposal) => proposal.proposer === controller,
        );
        acc = [
          ...acc,
          {
            controller,
            proposalCount: proposalsForController.length,
            action: <></>,
          },
        ];
        return acc;
      }, [] as TableData[]);
      setData(data);
    } else setData([]);
  }, [controllers, proposals]);

  // Define columns for the table
  const columns: ColumnDef<TableData, any>[] = [
    'controller',
    'proposalCount',
    'action',
  ].map((key) =>
    columnHelper.accessor(key as keyof TableData, {
      id: key,
      size: undefined,
      header: key === 'action' ? '' : camelToReadable(key),
      sortDescFirst: true,
      sortingFn: 'alphanumeric',
      cell: ({ row }) => {
        const rowValue = row.getValue(key) as any;
        if (rowValue === undefined || rowValue === null) {
          return '';
        }

        switch (key) {
          case 'controller': {
            return (
              <Link
                to={`https://ao.link/#/entity/${rowValue}`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-500"
              >
                {formatForMaxCharCount(rowValue, 8)}
              </Link>
            );
          }
          case 'proposalCount': {
            return rowValue;
          }
          case 'action': {
            return (
              <div className="flex justify-end w-full ">
                <Tooltip message={'Propose Controller removal'}>
                  <button
                    className="px-2"
                    onClick={async () => {
                      if (vaotClient instanceof VAOTWriteable) {
                        const res = await vaotClient
                          .propose({
                            type: 'Remove-Controller',
                            controller: row.original.controller,
                            vote: 'yay',
                          })
                          .catch((e) => showErrorToast(e.message));
                        if (res) {
                          showSuccessToast(
                            <span>
                              Controller removal Proposed with txid:{' '}
                              {formatForMaxCharCount(res.id)}
                              <CopyButton textToCopy={res.id} />
                            </span>,
                          );
                        }
                      }
                    }}
                  >
                    <HammerIcon className="size-5" />
                  </button>
                </Tooltip>
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
    <div className="flex w-full flex-col border border-stone-500 rounded">
      <TableView
        data={data}
        columns={columns}
        isLoading={isLoadingControllers || isLoadingProposals}
        defaultSortingState={{ id: 'controller', desc: true }}
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
        tableClass="overflow-hidden rounded"
        tableWrapperClassName="w-full rounded"
        noDataFoundText={
          <span className="text-white p-5">No Proposals Found</span>
        }
      />
    </div>
  );
}

export default VAOTControllersTable;
