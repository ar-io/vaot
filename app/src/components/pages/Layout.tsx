import { Link, Outlet, useParams } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar';
import { useGlobalState } from '@/store';
import { formatForMaxCharCount } from '@/utils';
import { XIcon, SettingsIcon } from 'lucide-react';
import CopyButton from '../buttons/CopyButton';
import { ResizablePanels } from '../data-display/Resizable';
import { useState } from 'react';
import CreateVaotModal from '../modals/CreateVaotModal';

function Layout() {
  const { id: vaotId } = useParams();
  const vaotIds = useGlobalState((state) => state.vaotIds);
  const setVaotIds = useGlobalState((state) => state.setVaotIds);
  const hyperbeamUrl = useGlobalState((state) => state.hyperbeamUrl);
  const setHyperbeamUrl = useGlobalState((state) => state.setHyperbeamUrl);

  const [showCreateVaotModal, setShowCreateVaotModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex flex-col h-screen justify-between">
      <Navbar />
      <div className="flex h-full w-full">
        <ResizablePanels size={(i) => (i === 0 ? 20 : 100)}>
          <Sidebar className="bg-transparent border-r border-stone-700 min-w-[14rem] py-3 justify-between">
            <div className="flex flex-col gap-2">
              {vaotIds.length ? (
                vaotIds.map((id) => (
                  <div
                    className={`${id === vaotId ? 'bg-white text-black border-emerald-500 ' : 'text-white border-stone-500 bg-stone-900'} flex gap-2 justify-between items-center bg-stone-900 p-2 border  rounded `}
                  >
                    <div className="flex gap-2">
                      {' '}
                      <Link
                        to={`/${id}`}
                        key={id}
                        className=" hover:text-emerald-600 rounded whitespace-nowrap"
                      >
                        {formatForMaxCharCount(id, 12)}
                      </Link>
                      <CopyButton textToCopy={id} />{' '}
                    </div>

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
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowCreateVaotModal(true)}
                className="p-2 border border-stone-500 rounded bg-stone-900 text-white tracking-wider hover:text-emerald-500"
              >
                New VAOT Process
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center justify-center gap-1 p-2 border border-stone-700 rounded bg-stone-900 text-stone-400 text-sm hover:text-emerald-500"
              >
                <SettingsIcon className="size-4" />
                Settings
              </button>
              {showSettings && (
                <div className="flex flex-col gap-1 p-2 border border-stone-700 rounded bg-stone-900">
                  <label className="text-xs text-stone-400">
                    HyperBEAM URL
                  </label>
                  <input
                    className="bg-stone-800 text-white text-xs p-1.5 rounded border border-stone-600 focus:border-emerald-500 outline-none"
                    value={hyperbeamUrl}
                    onChange={(e) => setHyperbeamUrl(e.target.value)}
                    placeholder="https://push.forward.computer"
                  />
                </div>
              )}
            </div>
          </Sidebar>

          <Outlet />
        </ResizablePanels>
      </div>
      <Footer />
      <Toaster
        containerStyle={{ position: 'fixed', zIndex: 99999 }}
        position="bottom-right"
      />
      {showCreateVaotModal && (
        <CreateVaotModal onClose={() => setShowCreateVaotModal(false)} />
      )}
    </div>
  );
}

export default Layout;
