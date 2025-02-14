import { formatForMaxCharCount } from '@src/utils';
import { AlertCircle, CheckCheckIcon } from 'lucide-react';
import { ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import CopyButton from '../buttons/CopyButton';

export const showErrorToast = (message: string | ReactNode) => {
  toast.custom((t) => {
    return (
      <div className="flex max-w-[18.75rem] items-start rounded-xl bg-red-600 px-3 py-2 text-sm text-neutrals-1100">
        <div>{message}</div>
        <button className="pl-2" onClick={() => toast.dismiss(t.id)}>
          <AlertCircle className="size-5" />
        </button>
      </div>
    );
  });
};

export const showSuccessToast = (message: string | ReactNode) => {
  toast.custom((t) => {
    return (
      <div className="flex max-w-[18.75rem] items-start rounded-xl bg-emerald-600 px-3 py-2 text-sm text-neutrals-1100">
        <div>{message}</div>
        <button className="pl-2" onClick={() => toast.dismiss(t.id)}>
          <CheckCheckIcon className="size-5" />
        </button>
      </div>
    );
  });
};

export const showTransactionSuccessToast = (name: string, id: string) => {
  toast.custom((t) => {
    return (
      <div className="flex max-w-[18.75rem] justify-between items-start rounded-xl bg-emerald-600 px-3 py-2 text-sm text-neutrals-1100">
        <div className="flex flex-col gap-2 text-white">
          <span>{name} Success!</span>
          <span className="flex gap-2 justify-center items-center">
            <Link
              to={`https://ao.link/#/entity/${id}`}
              target="_blank"
              rel="noreferrer"
              className="underline text-white hover:text-sky-500"
            >
              {formatForMaxCharCount(id, 12)}
            </Link>
            <CopyButton textToCopy={id} />
          </span>
        </div>
        <button className="pl-2" onClick={() => toast.dismiss(t.id)}>
          <CheckCheckIcon className="size-5" />
        </button>
      </div>
    );
  });
};
