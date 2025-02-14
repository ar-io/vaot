import {
  AO_CU_URL,
  DEFAULT_ARWEAVE_HOST,
  DEFAULT_ARWEAVE_PORT,
  DEFAULT_ARWEAVE_PROTOCOL,
} from '@src/constants';

import Arweave from 'arweave/web';
import { create } from 'zustand';

export type GlobalState = {
  vaotIds: string[];
  arweave: Arweave;
  aoCuUrl: string;
  gatewayUrl: string;
};

export type GlobalStateActions = {
  setVaotIds: (vaotIds: string[]) => void;
  setArweave: (arweave: Arweave) => void;
  setAoCuUrl: (aoCuUrl: string) => void;
  setGatewayUrl: (gatewayUrl: string) => void;
};

export const initialGlobalState: GlobalState = {
  vaotIds: window.localStorage.getItem('vaotIds')
    ? JSON.parse(window.localStorage.getItem('vaotIds')!)
    : [],
  arweave: Arweave.init({
    host: DEFAULT_ARWEAVE_HOST,
    protocol: DEFAULT_ARWEAVE_PROTOCOL,
    port: DEFAULT_ARWEAVE_PORT,
  }),
  aoCuUrl: AO_CU_URL,
  gatewayUrl: `${DEFAULT_ARWEAVE_PROTOCOL}://${DEFAULT_ARWEAVE_HOST}:${DEFAULT_ARWEAVE_PORT}`,
};
export class GlobalStateActionBase implements GlobalStateActions {
  constructor(
    private set: (props: any, replace?: boolean) => void,
    private get: () => GlobalStateInterface,
    private initialGlobalState: GlobalState,
  ) {}
  setVaotIds = (vaotIds: string[]) => {
    this.set({ vaotIds });
    window.localStorage.setItem('vaotIds', JSON.stringify(vaotIds));
  };
  setArweave = (arweave: Arweave) => {
    this.set({ arweave });
  };
  setAoCuUrl = (aoCuUrl: string) => {
    this.set({ aoCuUrl });
  };
  setGatewayUrl = (gatewayUrl: string) => {
    this.set({ gatewayUrl });
  };
}

export interface GlobalStateInterface extends GlobalState, GlobalStateActions {}
export const useGlobalState = create<GlobalStateInterface>()(
  (set, get) =>
    ({
      ...initialGlobalState,
      ...new GlobalStateActionBase(set, get, initialGlobalState),
    }) as any,
);
