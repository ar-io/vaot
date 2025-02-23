import assert from 'node:assert';
import {
  VAOT_WASM,
  AO_LOADER_HANDLER_ENV,
  AO_LOADER_OPTIONS,
  DEFAULT_HANDLE_OPTIONS,
  BUNDLED_SOURCE_CODE,
} from '../tools/constants.mjs';
import AoLoader from '@permaweb/ao-loader';

/**
 * Loads the aos wasm binary and returns the handle function with program memory
 * @returns {Promise<{handle: Function, memory: WebAssembly.Memory}>}
 */
export async function createAosLoader() {
  const handle = await AoLoader(VAOT_WASM, AO_LOADER_OPTIONS);
  const evalRes = await handle(
    null,
    {
      ...DEFAULT_HANDLE_OPTIONS,
      Tags: [
        { name: 'Action', value: 'Eval' },
        { name: 'Module', value: ''.padEnd(43, '1') },
      ],
      Data: BUNDLED_SOURCE_CODE,
    },
    AO_LOADER_HANDLER_ENV,
  );
  return {
    handle,
    memory: evalRes.Memory,
  };
}

export function assertNoResultError(result) {
  const errorTag = result.Messages?.[0]?.Tags?.find(
    (tag) => tag.name === 'Error',
  );
  assert.strictEqual(errorTag, undefined);
}

const { handle: originalHandle, memory } = await createAosLoader();
export const startMemory = memory;

export async function handle({ options = {}, mem = startMemory }) {
  return originalHandle(
    mem,
    {
      ...DEFAULT_HANDLE_OPTIONS,
      ...options,
    },
    AO_LOADER_HANDLER_ENV,
  );
}

export function parseEventsFromResult(result) {
  return (
    result?.Output?.data
      ?.split('\n')
      ?.filter((line) => line.trim().startsWith('{"'))
      ?.map((line) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return {};
        }
      })
      ?.filter((event) => Object.keys(event).length && event['_e']) || []
  );
}

export async function getControllers(memory) {
  const result = await handle({
    options: {
      Tags: [{ name: 'Action', value: 'Get-Controllers' }],
    },
    mem: memory,
  });
  return JSON.parse(result.Messages[0].Data).sort();
}

export async function getProposals(memory) {
  const result = await handle({
    options: {
      Tags: [{ name: 'Action', value: 'Get-Proposals' }],
    },
    mem: memory,
  });
  const proposals = JSON.parse(result.Messages[0].Data);
  return Array.isArray(proposals) ? {} : proposals;
}

export async function rubberStampProposal({
  proposalTags,
  memory,
}){
  const controllers = await getControllers(memory);
  const passThreshold = Math.floor(controllers.length / 2) + 1;
  let finalResult;
  const proposeResult = await handle({
    options: {
      Tags: [
        ...proposalTags,
        { name: 'Vote', value: 'yay' },
      ],
      From: controllers[0],
      Owner: controllers[0],
    },
    mem: memory,
  });
  finalResult = proposeResult;
  const proposalNumber = JSON.parse(proposeResult.Messages[0].Data).proposalNumber;
  let workingMemory = proposeResult.Memory;
  for (const controller of controllers.slice(1, passThreshold)) {
    const voteResult = await handle({
      options: {
        Tags: [
          { name: 'Action', value: 'Vote' },
          { name: 'Proposal-Number', value: proposalNumber },
          { name: 'Vote', value: 'yay' },
        ],
        From: controller,
        Owner: controller,
      },
      mem: workingMemory,
    });
    finalResult = voteResult;
    workingMemory = voteResult.Memory;
  }
  const proposals = await getProposals(workingMemory);
  const maybeProposal = Object.values(proposals).filter((p) => p.proposalNumber === proposalNumber).shift();
  assert(!maybeProposal, "Proposal not successfully rubber stamped!");
  return {
    memory: workingMemory,
    proposalNumber,
    result: finalResult,
  };
}

// NOTE: Presumes that input array ordering is not precious
export function normalizeObject(obj) {
  if (Array.isArray(obj)) {
    // Recursively normalize array elements and sort the array
    return obj.map(normalizeObject).sort();
  } else if (obj !== null && typeof obj === "object") {
    // Get keys in alphabetical order
    const sortedKeys = Object.keys(obj).sort();
    
    // Create a new object with sorted keys
    const normalized = {};
    for (const key of sortedKeys) {
      normalized[key] = normalizeObject(obj[key]); // Recursively normalize values
    }
    return normalized;
  }
  return obj; // Return primitives as-is
}
