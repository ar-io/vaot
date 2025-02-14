import { Link, Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar';
import { useGlobalState } from '@src/store';
import { formatForMaxCharCount } from '@src/utils';
import { XIcon } from 'lucide-react';
import CopyButton from '../buttons/CopyButton';

function Layout() {
  const vaotIds = useGlobalState((state) => state.vaotIds);
  const setVaotIds = useGlobalState((state) => state.setVaotIds);

  return (
    <div className="flex flex-col h-screen justify-between">
      <Navbar />
      <div className="flex h-full w-full">
        <Sidebar className="bg-transparent border-r border-stone-700 min-w-[14rem] py-3">
          {vaotIds.length ? (
            vaotIds.map((id) => (
              <div className="flex gap-2 justify-between items-center bg-stone-900 p-2 border border-stone-500 text-white rounded">
                <Link
                  to={`/${id}`}
                  key={id}
                  className=" hover:text-emerald-600 rounded"
                >
                  {formatForMaxCharCount(id, 8)}
                </Link>
                <CopyButton textToCopy={id} />
                <button
                  onClick={() => {
                    setVaotIds(vaotIds.filter((vaotId) => vaotId !== id));
                  }}
                >
                  <XIcon className="size-5" />
                </button>
              </div>
            ))
          ) : (
            <span className="text-white">No VAOT processes</span>
          )}
        </Sidebar>

        <Outlet />
      </div>
      <Footer />
      <Toaster
        containerStyle={{ position: 'fixed', zIndex: 99999 }}
        position="bottom-right"
      />
    </div>
  );
}

export default Layout;
