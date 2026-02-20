import {
  VAOTControllerProposalData,
  VAOTEvalProposalData,
} from './vaot';

export interface HyperbeamState {
  controllers: string[];
  proposals: Record<string, VAOTControllerProposalData | VAOTEvalProposalData>;
}

function buildStateUrl(
  hyperbeamUrl: string,
  processId: string,
  forceRefresh: boolean,
): string {
  const mode = forceRefresh ? 'now' : 'compute';
  return `${hyperbeamUrl}/${processId}~process@1.0/${mode}/state?require-codec=application/json&accept-bundle=true`;
}

/**
 * Recursively strip HyperBEAM metadata fields (commitments, ao-types)
 * from the response objects.
 */
function cleanObject(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(cleanObject);
  if (obj !== null && typeof obj === 'object') {
    const { commitments, 'ao-types': _aoTypes, ...rest } = obj as Record<
      string,
      unknown
    >;
    return Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, cleanObject(v)]),
    );
  }
  return obj;
}

/**
 * Normalize HyperBEAM JSON response into the shapes the UI expects.
 *
 * - Empty Lua tables serialize as `[]` in JSON; convert them to `{}` where
 *   the app expects an object (controllers, proposals, yays, nays).
 * - Controller values come as `"true"` strings; extract the keys as `string[]`.
 */
function normalizeState(raw: Record<string, unknown>): HyperbeamState {
  const cleaned = cleanObject(raw) as Record<string, unknown>;
  delete cleaned.status;

  const rawControllers = Array.isArray(cleaned.controllers)
    ? {}
    : ((cleaned.controllers as Record<string, unknown>) ?? {});

  const rawProposals = Array.isArray(cleaned.proposals)
    ? {}
    : ((cleaned.proposals as Record<string, unknown>) ?? {});

  const proposals: Record<
    string,
    VAOTControllerProposalData | VAOTEvalProposalData
  > = {};
  for (const [name, value] of Object.entries(rawProposals)) {
    const p = value as Record<string, unknown>;
    proposals[name] = {
      ...p,
      proposalNumber: Number(p.proposalNumber),
      yays: Array.isArray(p.yays) ? {} : ((p.yays as Record<string, unknown>) ?? {}),
      nays: Array.isArray(p.nays) ? {} : ((p.nays as Record<string, unknown>) ?? {}),
    } as VAOTControllerProposalData | VAOTEvalProposalData;
  }

  return {
    controllers: Object.keys(rawControllers),
    proposals,
  };
}

export async function fetchHyperbeamState(
  hyperbeamUrl: string,
  processId: string,
  forceRefresh = false,
): Promise<HyperbeamState> {
  const url = buildStateUrl(hyperbeamUrl, processId, forceRefresh);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `HyperBEAM request failed: ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.json();
  return normalizeState(data);
}
