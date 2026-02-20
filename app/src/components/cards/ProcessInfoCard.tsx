import { useProcessInfo } from '@/hooks/useProcessInfo';
import ArIOSpinner from '../loading/ArIOSpinner';
import ReactJsonView from 'react-json-view';
import { isArweaveTransactionID } from '@/utils';

function ProcessInfoCard({ processId }: { processId?: string }) {
  const {
    data: processInfo,
    isLoading: isLoadingProcessInfo,
    error,
    refetch,
  } = useProcessInfo(processId);

  return (
    <div className="flex flex-col justify-center items-center bg-stone-900 rounded p-2 min-h-[200px]">
      {!isArweaveTransactionID(processId) && (
        <div className="text-red-600">Invalid Process ID</div>
      )}
      {isLoadingProcessInfo && (
        <div className="flex flex-col items-center">
          <ArIOSpinner width={'50px'} height={'50px'} className="size-20" />
          <span> Loading Process Info... </span>
        </div>
      )}
      {error && (
        <span className="text-red-600">
          Error loading Process Info: {error.message}{' '}
          <button onClick={() => refetch()}>Retry</button>
        </span>
      )}

      {processInfo && (
        <div className="flex flex-col size-full max-h-[250px]">
          <ReactJsonView
            src={processInfo}
            theme="summerfruit"
            style={{
              width: '100%',
              height: '100%',
              overflow: 'auto', // Ensures scrolling when needed
              textAlign: 'left', // Ensures left-aligned text
            }}
            name={null}
            indentWidth={2}
            displayDataTypes={false}
            displayObjectSize={false}
          />
        </div>
      )}
    </div>
  );
}

export default ProcessInfoCard;
