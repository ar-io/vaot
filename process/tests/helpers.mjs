import assert from 'node:assert';
import {
  AOS_WASM,
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
  const handle = await AoLoader(AOS_WASM, AO_LOADER_OPTIONS);
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
