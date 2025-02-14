import { VAOTProposalType } from './services/vaot';

export const ARNS_TX_ID_REGEX = new RegExp('^[a-zA-Z0-9\\-_s+]{43}$');

export const AO_CU_URL = process.env.VITE_AO_CU_URL || 'https://cu.ardrive.io';
export const DEFAULT_ARWEAVE_PROTOCOL =
  process.env.VITE_GATEWAY_PROTOCOL ?? 'https';
export const DEFAULT_ARWEAVE_HOST =
  // process.env.VITE_GATEWAY_HOST ?? 'ar-io.dev';
  process.env.VITE_GATEWAY_HOST ?? 'arweave.net';
export const DEFAULT_ARWEAVE_PORT =
  Number(process.env.VITE_GATEWAY_PORT) ?? 443;

export const APP_NAME = 'AR-IO-Network-Portal-App';
export const APP_VERSION = process.env.npm_package_version || '1.0.0';
export const WRITE_OPTIONS = {
  tags: [
    {
      name: 'App-Name',
      value: APP_NAME,
    },
    { name: 'App-Version', value: APP_VERSION },
  ],
};

export const PROPOSAL_TYPE_PARAM_DEFAULTS: Record<
  VAOTProposalType,
  Record<string, string>
> = {
  'Add-Controller': {
    type: 'Add-Controller',
    controller: '',
    vote: 'yay',
  },
  'Remove-Controller': {
    type: 'Remove-Controller',
    controller: '',
    vote: 'yay',
  },
  Eval: {
    type: 'Eval',
    vote: 'yay',
    evalStr: '',
    processId: '',
  },
};
