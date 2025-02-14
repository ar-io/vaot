import {
  AOProcess,
  AoMessageResult,
  AoSigner,
  InvalidContractConfigurationError,
  ProcessConfiguration,
  WithSigner,
  createAoSigner,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '@ar.io/sdk';
import { Tag } from 'arweave/node/lib/transaction';

export const VAOTReadHandlers = ['Get-Controllers', 'Get-Proposals'] as const;
export const VAOTWriteHandlers = [
  'Propose',
  'Vote',
  'Revoke-Proposal',
] as const;
export const VAOTHandlerTypes = [
  ...VAOTReadHandlers,
  ...VAOTWriteHandlers,
] as const;
export type VAOTHandler = (typeof VAOTHandlerTypes)[number];

export type VAOTVote = 'yay' | 'nay';

export const VAOTProposalTypes = [
  'Add-Controller',
  'Remove-Controller',

  'Eval',
] as const;
export type VAOTProposalType = (typeof VAOTProposalTypes)[number];

export interface VAOTProposalData {
  proposalNumber: number;
  msgId: string;
  type: VAOTProposalType;
  yays: Record<string, number>;
  nays: Record<string, number>;
  proposer: string;
}

export interface VAOTControllerProposalData extends VAOTProposalData {
  controller: string;
  type: 'Add-Controller' | 'Remove-Controller';
}

export interface VAOTEvalProposalData extends VAOTProposalData {
  processId: string;
  evalStr: string;
  type: 'Eval';
}

export interface VAOTRead {
  getControllers(): Promise<string[]>;
  getProposals(): Promise<
    Record<string, VAOTControllerProposalData | VAOTEvalProposalData>
  >;
}

export interface VAOTWrite extends VAOTRead {
  // overload propose for relevant types
  propose({
    type,
    vote,
    controller,
    processId,
    evalStr,
  }: {
    type: VAOTProposalType;
    vote: VAOTVote;
    controller?: string;
    processId?: string;
    evalStr?: string;
  }): Promise<AoMessageResult>;
  vote({
    proposalNumber,
    vote,
  }: {
    proposalNumber: number;
    vote: 'yay' | 'nay';
  }): Promise<AoMessageResult>;
  revokeProposal({
    proposalNumber,
  }: {
    proposalNumber: number;
  }): Promise<AoMessageResult>;
}

type VAOTNoSigner = ProcessConfiguration;
type VAOTWithSigner = WithSigner<ProcessConfiguration>;
type VAOTConfig = VAOTNoSigner | VAOTWithSigner;

export class VAOT {
  static init(config: VAOTNoSigner): VAOTRead;

  // with signer give write
  static init(config: VAOTWithSigner): VAOTWrite;

  static init(config: VAOTConfig): VAOTRead | VAOTWrite {
    if (config !== undefined && 'signer' in config) {
      return new VAOTWriteable(config);
    }
    return new VAOTReadable(config);
  }
}

export class VAOTReadable implements VAOTRead {
  protected process: AOProcess;

  constructor(config: ProcessConfiguration) {
    if (isProcessConfiguration(config)) {
      this.process = config.process;
    } else if (isProcessIdConfiguration(config)) {
      this.process = new AOProcess({
        processId: config.processId,
      });
    } else {
      throw new InvalidContractConfigurationError();
    }
  }

  async getControllers(): Promise<string[]> {
    return this.process.read({
      tags: [{ name: 'Action', value: 'Get-Controllers' }],
    });
  }

  async getProposals(): Promise<
    Record<string, VAOTControllerProposalData | VAOTEvalProposalData>
  > {
    return this.process.read({
      tags: [{ name: 'Action', value: 'Get-Proposals' }],
    });
  }
}

export class VAOTWriteable extends VAOTReadable implements VAOTWrite {
  private signer: AoSigner;

  constructor({ signer, ...config }: WithSigner<ProcessConfiguration>) {
    super(config);
    this.signer = createAoSigner(signer);
  }

  async propose({
    type,
    vote,
    controller,
    processId,
    evalStr,
  }: {
    type: 'Add-Controller' | 'Remove-Controller';
    vote: VAOTVote;
    controller: string;
    processId?: never;
    evalStr?: never;
  }): Promise<AoMessageResult>;
  async propose({
    type,
    vote,
    controller,
    processId,
    evalStr,
  }: {
    type: 'Eval';
    vote: VAOTVote;
    controller?: never;
    processId: string;
    evalStr: string;
  }): Promise<AoMessageResult>;
  async propose({
    type,
    vote,
    controller,
    processId,
    evalStr,
  }: {
    type: VAOTProposalType;
    vote: VAOTVote;
    controller?: string;
    processId?: string;
    evalStr?: string;
  }): Promise<AoMessageResult> {
    const tags = [
      { name: 'Action', value: 'Propose' },
      { name: 'Proposal-Type', value: type },
      { name: 'Vote', value: vote },
      { name: 'Controller', value: controller },
      { name: 'Process-Id', value: processId },
    ].filter((tag) => tag.value !== undefined) as Tag[];
    return this.process.send({
      signer: this.signer,
      tags,
      data: evalStr,
    });
  }

  async vote({
    proposalNumber,
    vote,
  }: {
    proposalNumber: number;
    vote: 'yay' | 'nay';
  }): Promise<AoMessageResult> {
    return await this.process.send({
      signer: this.signer,
      tags: [
        { name: 'Action', value: 'Vote' },
        { name: 'Proposal-Number', value: proposalNumber.toString() },
        { name: 'Vote', value: vote },
      ],
    });
  }

  async revokeProposal({
    proposalNumber,
  }: {
    proposalNumber: number;
  }): Promise<AoMessageResult> {
    return this.process.send({
      signer: this.signer,
      tags: [
        { name: 'Action', value: 'Revoke-Proposal' },
        { name: 'Proposal-Number', value: proposalNumber.toString() },
      ],
    });
  }
}
