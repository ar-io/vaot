import { useParams } from 'react-router-dom';
import Page from './Page';

import VAOTControllersTable from '../data-display/tables/VAOTControllersTable';
import VAOTProposalsTable from '../data-display/tables/VAOTProposalsTable';
import { useState } from 'react';
import AddControllerModal from '../modals/AddControllerModal';
import CreateProposalModal from '../modals/CreateProposalModal';
import VAOTHistoricalProposalsTable from '../data-display/tables/VAOTHistoricalProposalsTable';

function Dashboard() {
  const { id } = useParams();

  const [showAddControllerModal, setShowAddControllerModal] = useState(false);
  const [showCreateProposalModal, setShowCreateProposalModal] = useState(false);

  return (
    <>
      <Page className="px-[4rem] pt-4 h-full">
        <div className="flex flex-col w-full gap-10">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <h1 className="text-white text-3xl">Controllers</h1>
              <button
                onClick={() => setShowAddControllerModal(true)}
                className="text-white hover:text-emerald-600 text-lg border-stone-500 bg-stone-700 rounded px-2 py-1"
              >
                Add Controller
              </button>
            </div>

            <VAOTControllersTable vaotId={id} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <h1 className="text-white text-3xl">Proposals</h1>
              <button
                onClick={() => setShowCreateProposalModal(true)}
                className="text-white hover:text-emerald-600 text-lg border-stone-500 bg-stone-700 rounded px-2 py-1"
              >
                Create Proposal
              </button>
            </div>
            <VAOTProposalsTable vaotId={id} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <h1 className="text-white text-3xl">Historical Proposals</h1>
            </div>
            <VAOTHistoricalProposalsTable vaotId={id} />
          </div>
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
