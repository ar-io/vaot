import { ConnectButton } from '@project-kardeshev/ao-wallet-kit';
import { Link } from 'react-router-dom';
import AddVaotIdInput from '../inputs/AddVaotIdInput';

function Navbar() {
  return (
    <div className="flex flex-row justify-between p-2 bg-stone-900 px-[4rem] py-2 border-b border-stone-700">
      <div className="flex gap-2">
        <div className="flex flex-col gap-1">
          <Link className="text-lg text-white" to={'/'}>
            VAOT
          </Link>
          <span className="text-xs text-gray-300">
            A multisig solution by ar.io
          </span>
        </div>
      </div>

      <AddVaotIdInput />

      <ConnectButton />
    </div>
  );
}

export default Navbar;
