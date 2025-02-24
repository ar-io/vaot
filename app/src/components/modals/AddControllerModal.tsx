import { ReactElement, useState } from 'react';
import BaseModal from './BaseModal';
import { useVAOT } from '@/hooks/useVAOT';
import {
  showErrorToast,
  showTransactionSuccessToast,
} from '../notifications/toast';
import { VAOTWriteable } from '@/services/vaot';
import { useQueryClient } from '@tanstack/react-query';

function AddControllerModal({
  onClose,
  vaotId,
}: {
  onClose: () => void;
  vaotId: string;
}) {
  const queryClient = useQueryClient();
  const vaot = useVAOT(vaotId);
  const [controller, setController] = useState('');

  async function addController() {
    try {
      if (vaot instanceof VAOTWriteable) {
        const res = await vaot.propose({
          type: 'Add-Controller',
          controller: controller.trim(),
          vote: 'yay',
        });
        queryClient.resetQueries({ queryKey: ['vaot-proposals', vaotId] });
        queryClient.resetQueries({ queryKey: ['vaot-controllers', vaotId] });

        showTransactionSuccessToast('Add Controller Proposal', res.id);
        onClose();
      } else throw new Error('VAOT is not writeable, sign in to use');
    } catch (error: any) {
      showErrorToast(error?.message ?? 'Unknown Error adding controller');
    }
  }
  return (
    <BaseModal
      onClose={onClose}
      closeOnClickOutside={true}
      showCloseButton={true}
      useDefaultPadding={false}
    >
      <div className="flex flex-col justify-start bg-stone-800 text-white w-[30rem] h-fit p-3 gap-2">
        <h1 className="flex text-lg">Propose new Controller</h1>
        <input
          placeholder="Enter Controller Address"
          className="bg-stone-900 text-white p-2 rounded-lg border border-stone-600"
          value={controller}
          onChange={(e) => setController(e.target.value.trim())}
        />
        <button
          onClick={addController}
          className="bg-stone-600 p-2 rounded  transition-all hover:text-emerald-600 border border-stone-500 hover:bg-stone-700 hover:border-emerald-600"
        >
          Submit Add Controller Proposal
        </button>
      </div>
    </BaseModal>
  );
}

export default AddControllerModal;
