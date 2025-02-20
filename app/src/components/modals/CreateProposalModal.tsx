import { useState } from 'react';
import BaseModal from './BaseModal';
import { useVAOT } from '@src/hooks/useVAOT';
import {
  showErrorToast,
  showTransactionSuccessToast,
} from '../notifications/toast';
import {
  VAOTProposalType,
  VAOTProposalTypes,
  VAOTWriteable,
} from '@src/services/vaot';
import Sidebar from '../pages/Sidebar';
import { useQueryClient } from '@tanstack/react-query';
import EvalProposalForm from '../data-display/forms/EvalProposalForm';
import { PROPOSAL_TYPE_PARAM_DEFAULTS } from '@src/constants';
import AddControllerProposalForm from '../data-display/forms/AddControllerProposalForm';
import RemoveControllerProposalForm from '../data-display/forms/RemoveControllerProposalForm';

function CreateProposalModal({
  onClose,
  vaotId,
}: {
  onClose: () => void;
  vaotId: string;
}) {
  const queryClient = useQueryClient();
  const vaot = useVAOT(vaotId);

  const [proposalParams, setProposalParams] = useState<
    Parameters<VAOTWriteable['propose']>[0]
  >({
    type: 'Eval',
    vote: undefined,
    evalStr: '',
    processId: '',
  });

  async function confirmProposal() {
    try {
      if (vaot instanceof VAOTWriteable) {
        const res = await vaot.propose({
          ...proposalParams,
          vote:
            proposalParams.vote === 'yay' || proposalParams.vote === 'nay'
              ? proposalParams.vote
              : undefined,
        });

        showTransactionSuccessToast(
          `${proposalParams.type.replace('-', ' ')} Proposal`,
          res.id,
        );
        queryClient.resetQueries({
          queryKey: ['vaot-proposals', vaotId],
        });
        queryClient.resetQueries({
          queryKey: ['vaot-controllers', vaotId],
        });
        onClose();
      } else throw new Error('VAOT is not writeable, sign in to use');
    } catch (error: any) {
      showErrorToast(error?.message ?? 'Unknown Error creating proposal');
    }
  }
  return (
    <BaseModal
      onClose={onClose}
      closeOnClickOutside={true}
      showCloseButton={true}
      useDefaultPadding={false}
    >
      <div className="flex flex-col justify-start bg-stone-800 text-white w-[95vw] h-[95vh]">
        <div className="flex flex-row w-full bg-stone-900 p-2 border-b border-stone-500">
          <h1 className="flex text-lg">
            Create Proposal | {proposalParams.type.replace('-', ' ')}
          </h1>
        </div>
        <div className="flex size-full">
          <Sidebar className="flex flex-col min-w-[13rem] h-full bg-stone-800 border-r border-stone-500 gap-2 pt-4 ">
            {VAOTProposalTypes.map((type) => (
              <button
                onClick={() =>
                  setProposalParams(PROPOSAL_TYPE_PARAM_DEFAULTS[type] as any)
                }
                className={`${proposalParams.type === type ? 'bg-white text-black' : ''} flex p-2 border border-stone-500 hover:border-emerald-600 hover:scale-105 bg-stone-900 transition-all rounded whitespace-nowrap`}
              >
                {type.replace('-', ' ')}
              </button>
            ))}
          </Sidebar>
          <div className="flex flex-col size-full justify-between">
            <div className="size-full">
              {/* form view */}
              {proposalParams.type === 'Eval' && (
                <EvalProposalForm
                  proposalParams={proposalParams as any}
                  setProposalParams={setProposalParams as any}
                />
              )}
              {(proposalParams as any).type === 'Add-Controller' && (
                <AddControllerProposalForm
                  proposalParams={proposalParams as any}
                  setProposalParams={setProposalParams as any}
                  vaotId={vaotId}
                />
              )}
              {(proposalParams as any).type === 'Remove-Controller' && (
                <RemoveControllerProposalForm
                  proposalParams={proposalParams as any}
                  setProposalParams={setProposalParams as any}
                  vaotId={vaotId}
                />
              )}
            </div>
            <div className="flex w-full p-2 justify-end gap-2">
              <button
                onClick={onClose}
                className="bg-stone-700 text-white border border-white rounded p-1 px-2"
              >
                Cancel
              </button>
              <button
                onClick={confirmProposal}
                className="bg-stone-300 text-black border border-black rounded p-1 px-2"
              >
                Create Proposal
              </button>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

export default CreateProposalModal;
