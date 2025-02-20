import { ARWEAVE_TX_REGEX } from '@ar.io/sdk';
import { useGlobalState } from '@src/store';
import { useState } from 'react';
import { showErrorToast, showSuccessToast } from '../notifications/toast';

function AddVaotIdInput() {
  const vaotIds = useGlobalState((state) => state.vaotIds);
  const setVaotIds = useGlobalState((state) => state.setVaotIds);

  const [newId, setNewId] = useState('');

  function reset() {
    setNewId('');
  }

  function handleAdd() {
    if (!newId || !ARWEAVE_TX_REGEX.test(newId)) {
      showErrorToast('Invalid VAOT ID');
      return;
    }
    setVaotIds([...new Set([...vaotIds, newId])]);
    showSuccessToast('VAOT ID added');
    reset();
  }

  return (
    <div className="flex justify-center items-center py-1">
      <input
        placeholder="Enter VAOT ID"
        className="border h-full border-stone-700 rounded rounded-r-none border-r-0 p-2 outline-none text-white bg-neutral-900 w-[30rem]"
        value={newId}
        onChange={(e) => setNewId(e.target.value.trim())}
        type="text"
      />
      <button
        className="flex h-full items-center border border-l-0 border-stone-700 bg-neutral-800 rounded rounded-l-none py-1 px-3 text-white"
        onClick={handleAdd}
      >
        Add
      </button>
    </div>
  );
}

export default AddVaotIdInput;
