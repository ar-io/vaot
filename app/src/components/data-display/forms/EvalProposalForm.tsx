import ProcessInfoCard from '@src/components/cards/ProcessInfoCard';
import VAOTVotesTable from '../tables/VAOTVotesTable';
import { Editor } from '@monaco-editor/react';
import RadioGroup from '@src/components/inputs/RadioGroup';
import { useVAOTProposals } from '@src/hooks/useVAOTProposals';
import { VAOTEvalProposalData } from '@src/services/vaot';
import { PROPOSAL_TYPE_PARAM_DEFAULTS } from '@src/constants';

function EvalProposalForm({
  vaotId,
  proposalId,
  proposalParams,
  setProposalParams,
  readOnly = false,
}: {
  vaotId?: string;
  proposalId?: string;
  proposalParams: (typeof PROPOSAL_TYPE_PARAM_DEFAULTS)['Eval'];
  setProposalParams: (
    params: (typeof PROPOSAL_TYPE_PARAM_DEFAULTS)['Eval'],
  ) => void;
  readOnly?: boolean;
}) {
  const { data: proposals } = useVAOTProposals(vaotId);

  const proposal: VAOTEvalProposalData | null = proposals
    ? (Object.values(proposals).find(
        (p) => p.msgId === proposalId,
      ) as VAOTEvalProposalData)
    : null;

  return (
    <div className="flex size-full gap-2 px-6 ">
      <div className="flex flex-col h-full w-fit">
        {/* process ID vote inputs, with who voted */}
        <div className="flex flex-row gap-10 items-center p-2 w-fit">
          <div className="flex flex-col gap-1 min-w-[27rem] ">
            <label className="text-white flex">Process ID</label>
            <input
              className="bg-stone-900 text-white p-2 rounded-lg border border-stone-600 outline-none disabled:bg-stone-400 disabled:text-stone-800"
              disabled={!!proposalId}
              value={
                proposalId ? proposal?.processId : proposalParams.processId
              }
              onChange={
                !proposalId
                  ? (e) =>
                      setProposalParams({
                        ...proposalParams,
                        processId: e.target.value,
                      })
                  : undefined
              }
            />
          </div>
        </div>
        <RadioGroup
          className="flex gap-4 w-fit my-4"
          value={proposalParams.vote}
          onChange={(v) => setProposalParams({ ...proposalParams, vote: v })}
          defaultValue={proposalId ? 'nay' : 'none'}
          indicatorClass={`
                  relative flex size-full items-center justify-center rounded-full border border-white bg-foreground 
                  after:block data-[state=checked]:after:size-[16px] data-[state=unchecked]:after:size-[0px] after:rounded-full data-[state=checked]:after:bg-white
                  `}
          items={[
            {
              label: (
                <label
                  htmlFor="r0"
                  className={`pl-[15px] text-[15px] leading-none ${
                    proposalParams.vote === 'yay' ? 'text-white' : 'text-grey'
                  } whitespace-nowrap cursor-pointer hover:text-white`}
                >
                  Yay
                </label>
              ),
              value: 'yay',
              className:
                'size-[25px] cursor-pointer rounded-full border border-white shadow-[0_2px_10px] shadow-black outline-none hover:bg-white focus:shadow-[0_0_0_2px] focus:shadow-black transition-all',
            },
            {
              label: (
                <label
                  htmlFor="r0"
                  className={`pl-[15px] text-[15px] leading-none ${
                    proposalParams.vote === 'Nay' ? 'text-white' : 'text-grey'
                  } whitespace-nowrap cursor-pointer hover:text-white`}
                >
                  Nay
                </label>
              ),
              value: 'nay',
              className:
                'size-[25px] cursor-pointer rounded-full border border-white shadow-[0_2px_10px] shadow-black outline-none hover:bg-white focus:shadow-[0_0_0_2px] focus:shadow-black transition-all',
            },
            {
              label: (
                <label
                  htmlFor="r0"
                  className={`pl-[15px] text-[15px] leading-none ${
                    proposalParams.vote === 'Nay' ? 'text-white' : 'text-grey'
                  } whitespace-nowrap cursor-pointer hover:text-white`}
                >
                  No Vote
                </label>
              ),
              value: 'none',
              className:
                'size-[25px] cursor-pointer rounded-full border border-white shadow-[0_2px_10px] shadow-black outline-none hover:bg-white focus:shadow-[0_0_0_2px] focus:shadow-black transition-all',
            },
          ].filter((item) => {
            if (proposalId) return item.value !== 'none';
            else return true;
          })}
        />
        <ProcessInfoCard
          processId={
            proposalId ? proposal?.processId : proposalParams.processId
          }
        />
        <VAOTVotesTable vaotId={vaotId} proposalId={proposalId} />
      </div>
      <Editor
        key={'eval-proposal-' + (proposalId ? proposalId : 'new')}
        theme="vs-dark"
        height={'100%'}
        options={{
          readOnly: readOnly,
        }}
        language="lua"
        value={proposalId ? proposal?.evalStr : proposalParams.evalStr}
        onChange={(v) => {
          setProposalParams({ ...proposalParams, evalStr: v ?? '' });
        }}
      />
    </div>
  );
}

export default EvalProposalForm;
