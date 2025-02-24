import { ReactElement, useState } from 'react';
import BaseModal from './BaseModal';
import { useVAOT } from '@/hooks/useVAOT';
import {
  showErrorToast,
  showTransactionSuccessToast,
} from '../notifications/toast';
import { VAOT, VAOTWriteable } from '@/services/vaot';
import { useQueryClient } from '@tanstack/react-query';
import { useActiveStrategy } from '@project-kardeshev/ao-wallet-kit';
import { isValidAoAddress } from '@/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import CopyButton from '../buttons/CopyButton';
import { Trash } from 'lucide-react';
import { useGlobalState } from '@/store';
import { useNavigate } from 'react-router-dom';

function CreateVaotModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const vaotIds = useGlobalState((s) => s.vaotIds);
  const setVaotIds = useGlobalState((s) => s.setVaotIds);
  const strategy = useActiveStrategy();
  const [controllers, setControllers] = useState<string[]>([]);
  const [newController, setNewController] = useState<string>('');
  const [ownSelf, setOwnSelf] = useState<boolean>(false);

  function handleAddController(controller: string) {
    try {
      if (controllers.includes(controller))
        throw new Error('Already added that controller');
      if (isValidAoAddress(controller)) {
        setControllers([...controllers, controller]);
      } else {
        throw new Error('Invalid AO address');
      }
      setNewController('');
    } catch (error) {
      showErrorToast(error.message);
    }
  }

  async function handleCreate() {
    try {
      const processId = await VAOT.spawn({
        controllers,
        ownSelf,
        signer: await strategy.createDataItemSigner(),
      });
      setVaotIds([...vaotIds, processId]);
      showTransactionSuccessToast('Create VAOT Process', processId);
      navigate(`/${processId}`);
      onClose();
    } catch (error) {
      showErrorToast(error.message);
    }
  }

  return (
    <BaseModal
      onClose={onClose}
      closeOnClickOutside={true}
      showCloseButton={true}
      useDefaultPadding={false}
    >
      <div className="flex flex-col justify-start bg-stone-800 text-white w-fit h-[66vh] p-3 gap-2">
        <h1 className="flex text-lg">Create a new VAOT Process</h1>

        {/* body */}

        <div className="flex flex-col size-full gap-5">
          <div className="flex flex-col gap-2 size-full">
            <div className="flex gap-2">
              <input
                placeholder="Add Controller Address"
                className="flex w-full bg-stone-900 text-white p-2 rounded border border-stone-600"
                value={newController}
                onChange={(e) => setNewController(e.target.value.trim())}
              />{' '}
              <button
                onClick={() => handleAddController(newController)}
                className="bg-stone-600 p-1 px-4 rounded transition-all hover:text-emerald-600 border border-stone-500 hover:bg-stone-700 hover:border-emerald-600"
              >
                Add
              </button>
            </div>

            <ScrollArea className="border border-stone-500 bg-stone-950 rounded p-3 h-[350px] gap overflow-x-hidden">
              {controllers.length ? (
                controllers.map((c, i) => (
                  <div className="flex gap-10 border border-stone-500 p-2 rounded bg-stone-800 justify-between mb-2">
                    <div className="flex gap-2">
                      {c} <CopyButton textToCopy={c} />
                    </div>
                    <button
                      onClick={() =>
                        setControllers(
                          controllers.filter((controller) => controller !== c),
                        )
                      }
                    >
                      <Trash className="size-5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-stone-400 m-auto">
                  Add default controllers for the new VAOT process.
                </p>
              )}
            </ScrollArea>
          </div>
          <div className="flex gap-2 p-1 items-center justify-center text-center">
            {' '}
            <Checkbox
              onCheckedChange={(e) => setOwnSelf(Boolean(e.valueOf()))}
            />{' '}
            <span className="flex text-sm text-stone-400">
              Self-Owned VAOT. Activating this means the VAOT process itself
              will own itself.
            </span>
          </div>
        </div>
        {/* footer */}
        <div className="flex gap-4 w-full justify-end mt-3">
          <button
            onClick={() => onClose()}
            className="border border-stone-500 rounded p-1 px-4"
          >
            Close
          </button>
          <button
            onClick={handleCreate}
            className="bg-stone-600 p-1 px-4 rounded  transition-all hover:text-emerald-600 border border-stone-500 hover:bg-stone-700 hover:border-emerald-600"
          >
            Create
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

export default CreateVaotModal;
