import { Dialog, DialogPanel } from '@headlessui/react';
import { XIcon } from 'lucide-react';
import { ReactElement } from 'react';

const BaseModal = ({
  onClose,
  children,
  showCloseButton = true,
  useDefaultPadding = true,
  closeOnClickOutside = false,
}: {
  onClose: () => void;
  children: ReactElement;
  showCloseButton?: boolean;
  useDefaultPadding?: boolean;
  closeOnClickOutside?: boolean;
}) => {
  return (
    <Dialog
      open={true}
      onClose={closeOnClickOutside ? onClose : () => {}}
      className="relative z-10"
    >
      <div
        className="fixed inset-0 w-screen bg-[rgb(0,0,0,0.5)], backdrop-blur-xs"
        aria-hidden="true"
      />

      <div className="fixed inset-0 flex  w-screen items-center justify-center p-4">
        <DialogPanel
          className={`relative flex max-h-full flex-col items-stretch rounded-xl bg-stone-800 ${useDefaultPadding ? 'p-8' : ''} border border-stone-600 text-center text-grey-100`}
        >
          {showCloseButton && (
            <button className="absolute right-3 top-3" onClick={onClose}>
              <XIcon className="size-5 text-white" />
            </button>
          )}
          <div className="flex grow flex-col overflow-hidden overflow-y-auto rounded-xl scrollbar">
            {children}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default BaseModal;
