import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROCESS_ID = ''.padEnd(43, '0');
export const PROCESS_OWNER = ''.padEnd(43, '1');
export const STUB_ADDRESS = ''.padEnd(43, '2');
export const STUB_OPERATOR_ADDRESS = ''.padEnd(43, 'E');
export const INITIAL_PROTOCOL_BALANCE = 50_000_000_000_000; // 50M IO
export const INITIAL_OWNER_BALANCE = 950_000_000_000_000; // 950M IO
export const STUB_TIMESTAMP = 21600000; // 01-01-1970 00:00:00
export const STUB_MESSAGE_ID = ''.padEnd(43, 'm');
export const STUB_HASH_CHAIN = 'NGU1fq_ssL9m6kRbRU1bqiIDBht79ckvAwRMGElkSOg';
/* ao READ-ONLY Env Variables */
export const AO_LOADER_HANDLER_ENV = {
  Process: {
    Id: PROCESS_ID,
    Owner: PROCESS_OWNER,
    Tags: [{ name: 'Authority', value: 'XXXXXX' }],
  },
  Module: {
    Id: PROCESS_ID,
    Tags: [{ name: 'Authority', value: 'YYYYYY' }],
  },
};

export const VAOT_WASM = fs.readFileSync(
  path.join(__dirname, '../dist/aos-vaot.wasm'), // MUST load as binary (note no utf-8 flag)
);

export const AO_LOADER_OPTIONS = {
  format: 'wasm32-unknown-emscripten-metering',
  inputEncoding: 'JSON-1',
  outputEncoding: 'JSON-1',
  memoryLimit: '1073741824', // 1 GiB in bytes
  computeLimit: (9e12).toString(),
  extensions: [],
};

export const AOS_WASM = fs.readFileSync(
  path.join(
    __dirname,
    'fixtures/aos-cbn0KKrBZH7hdNkNokuXLtGryrWM--PjSTBqIzw9Kkk.wasm',
  ),
);

export const BUNDLED_SOURCE_CODE = fs.readFileSync(
  path.join(__dirname, '../dist/process.lua'),
  'utf-8',
);

export const DEFAULT_HANDLE_OPTIONS = {
  Id: STUB_MESSAGE_ID,
  Target: PROCESS_ID,
  Module: 'vAOt',
  ['Block-Height']: '1',
  // important to set the address to match the FROM address so that that `Authority` check passes. Else the `isTrusted` with throw an error.
  Owner: PROCESS_OWNER,
  From: PROCESS_OWNER,
  Timestamp: STUB_TIMESTAMP,
  'Hash-Chain': STUB_HASH_CHAIN,
};
