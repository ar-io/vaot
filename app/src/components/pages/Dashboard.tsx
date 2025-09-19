import { useParams } from 'react-router-dom';
import Page from './Page';

import VAOTControllersTable from '../data-display/tables/VAOTControllersTable';
import VAOTProposalsTable from '../data-display/tables/VAOTProposalsTable';
import { useState, useMemo } from 'react';
import AddControllerModal from '../modals/AddControllerModal';
import CreateProposalModal from '../modals/CreateProposalModal';
import VAOTHistoricalProposalsTable from '../data-display/tables/VAOTHistoricalProposalsTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useProcessAge } from '@/hooks/useProcessMeta';
import { useVAOTControllers } from '@/hooks/useVAOTControllers';
import { useVAOTProposals } from '@/hooks/useVAOTProposals';

function Dashboard() {
  const { id } = useParams();

  const [showAddControllerModal, setShowAddControllerModal] = useState(false);
  const [showCreateProposalModal, setShowCreateProposalModal] = useState(false);

  // Fetch process metadata and counts
  const processAge = useProcessAge(id);
  const controllersQuery = useVAOTControllers(id);
  const proposalsQuery = useVAOTProposals(id);

  // Calculate counts
  const controllerCount = controllersQuery.data?.length ?? 0;
  const pendingProposalsCount = useMemo(() => {
    if (!proposalsQuery.data || !Array.isArray(proposalsQuery.data)) return 0;
    return proposalsQuery.data.filter(
      (proposal: any) => proposal.status === 'pending',
    ).length;
  }, [proposalsQuery.data]);

  return (
    <>
      <Page className="px-[4rem] pt-4 min-h-full overflow-y-auto">
        <div className="flex flex-col w-full gap-6 pb-32">
          <Tabs defaultValue="proposals" className="w-full">
            {/* Integrated Status Bar with Tabs */}
            <div className="flex flex-col bg-stone-800 border border-stone-700 rounded-sm overflow-hidden">
              {/* Process Info Row */}
              <div className="flex justify-between items-center p-4 border-b border-stone-700">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex flex-col">
                    <span className="text-stone-400">Process Name</span>
                    <span className="text-white">
                      {processAge.isLoading
                        ? '...'
                        : processAge.data?.name || 'Unnamed Process'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-stone-400">Process ID</span>
                    {id ? (
                      <a
                        href={`https://ao.link/#/entity/${id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-300 font-mono hover:text-emerald-200 transition-colors underline decoration-dotted underline-offset-2"
                      >
                        {`${id.slice(0, 8)}...${id.slice(-8)}`}
                      </a>
                    ) : (
                      <span className="text-white font-mono">N/A</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-stone-400">Age</span>
                    <span className="text-white">
                      {processAge.isLoading
                        ? '...'
                        : (processAge.ageFormatted ?? '--')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAddControllerModal(true)}
                    className="text-white hover:text-emerald-600 text-sm border border-stone-500 bg-stone-700 rounded px-3 py-2 transition-colors"
                  >
                    Add Controller
                  </button>
                  <button
                    onClick={() => setShowCreateProposalModal(true)}
                    className="text-white hover:text-emerald-600 text-sm border border-stone-500 bg-stone-700 rounded px-3 py-2 transition-colors"
                  >
                    Create Proposal
                  </button>
                </div>
              </div>

              {/* Tabs Row */}
              <TabsList className="grid w-full grid-cols-3 bg-transparent border-0 rounded-none h-auto">
                <TabsTrigger
                  value="controllers"
                  className="text-stone-400 data-[state=active]:text-emerald-400 data-[state=active]:bg-stone-700 rounded-none border-r border-stone-700 py-3"
                >
                  Controllers (
                  {controllersQuery.isLoading ? '...' : controllerCount})
                </TabsTrigger>
                <TabsTrigger
                  value="proposals"
                  className="text-stone-400 data-[state=active]:text-emerald-400 data-[state=active]:bg-stone-700 rounded-none border-r border-stone-700 py-3"
                >
                  Proposals (
                  {proposalsQuery.isLoading ? '...' : pendingProposalsCount})
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="text-stone-400 data-[state=active]:text-emerald-400 data-[state=active]:bg-stone-700 rounded-none py-3"
                >
                  History
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="controllers" className="mt-6">
              <VAOTControllersTable vaotId={id} />
            </TabsContent>

            <TabsContent value="proposals" className="mt-6">
              <VAOTProposalsTable vaotId={id} />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <VAOTHistoricalProposalsTable vaotId={id} />
            </TabsContent>
          </Tabs>
        </div>
      </Page>
      {showAddControllerModal && id && (
        <AddControllerModal
          vaotId={id}
          onClose={() => setShowAddControllerModal(false)}
        />
      )}
      {showCreateProposalModal && id && (
        <CreateProposalModal
          vaotId={id}
          onClose={() => setShowCreateProposalModal(false)}
        />
      )}
    </>
  );
}

export default Dashboard;
