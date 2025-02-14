import { useState } from 'react';
import BaseModal from './BaseModal';
import { useVAOT } from '@src/hooks/useVAOT';
import {
  showErrorToast,
  showTransactionSuccessToast,
} from '../notifications/toast';
import { VAOTWriteable } from '@src/services/vaot';

import { useQueryClient } from '@tanstack/react-query';
import EvalProposalForm from '../data-display/forms/EvalProposalForm';
import { useVAOTProposals } from '@src/hooks/useVAOTProposals';
import AddControllerProposalForm from '../data-display/forms/AddControllerProposalForm';
import RemoveControllerProposalForm from '../data-display/forms/RemoveControllerProposalForm';

function ViewProposalModal({
  onClose,
  vaotId,
  proposalId,
}: {
  onClose: () => void;
  vaotId: string;
  proposalId: string;
}) {
  const queryClient = useQueryClient();
  const vaot = useVAOT(vaotId);
  const { data: proposals } = useVAOTProposals(vaotId);

  const proposal = proposals
    ? Object.values(proposals).find((p) => p.msgId === proposalId)
    : null;

  const [vote, setVote] = useState<'yay' | 'nay'>('nay');

  async function confirmVote() {
    try {
      if (vaot instanceof VAOTWriteable && proposal) {
        const res = await vaot.vote({
          proposalNumber: proposal.proposalNumber,
          vote,
        });

        showTransactionSuccessToast(
          `${proposal.type.replace('-', ' ')} vote successful`,
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
            (#{proposal?.proposalNumber}) Viewing{' '}
            {proposal?.type.replace('-', ' ')} Proposal
          </h1>
        </div>
        <div className="flex size-full">
          <div className="flex flex-col size-full justify-between">
            <div className="size-full">
              {/* form view */}
              {proposal?.type === 'Eval' && (
                <EvalProposalForm
                  readOnly={true}
                  proposalId={proposalId}
                  vaotId={vaotId}
                  proposalParams={proposal as any}
                  setProposalParams={(res) =>
                    setVote((res?.vote ?? 'nay') as any)
                  }
                />
              )}
              {proposal?.type === 'Add-Controller' && (
                <AddControllerProposalForm
                  proposalParams={proposal as any}
                  setProposalParams={(res) =>
                    setVote((res?.vote ?? 'nay') as any)
                  }
                  proposalId={proposalId}
                  vaotId={vaotId}
                />
              )}
              {proposal?.type === 'Remove-Controller' && (
                <RemoveControllerProposalForm
                  proposalParams={proposal as any}
                  setProposalParams={(res) =>
                    setVote((res?.vote ?? 'nay') as any)
                  }
                  proposalId={proposalId}
                  vaotId={vaotId}
                />
              )}
            </div>
            <div className="flex w-full p-2 justify-end gap-2">
              <button
                onClick={onClose}
                className="bg-stone-700 text-white border border-white rounded p-1 px-2"
              >
                Close
              </button>
              <button
                onClick={confirmVote}
                className="bg-stone-300 text-black border border-black rounded p-1 px-2"
              >
                Confirm Vote
              </button>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

export default ViewProposalModal;
