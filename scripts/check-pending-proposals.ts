import { connect } from '@permaweb/aoconnect';

const ao = connect({
  MODE: 'legacy',
  CU_URL: 'https://cu.ardrive.io',
});

const vaot_processes = [
  {
    id: '4Ko7JmGPtbKLLqctNFr6ukWqX0lt4l0ktXgYKyMlbsM',
    name: 'ANT Registry VAOT',
    description: 'Main and staging registry process',
    mentions: [
      '<@U044BQZ9CJY>', // atticus
    ],
  },
  {
    id: 'My21NOHZyyeQG0t0yANsWjRakNDM7CJvd8urtdMLEDE',
    name: 'AR.IO Network VAOT',
    description: 'AR.IO network process',
    mentions: [],
  },
];

// Global mentions for all VAOT alerts (optional)
const globalMentions = [
  '<@U023GFXA4A1>', // ariel
  '<@U03H8L2F42J>', // dylan
];

interface ProposalInfo {
  vaotId: string;
  vaotName: string;
  proposalCount: number;
  mentions: string[];
}

async function getProposals(vaot_id: string) {
  try {
    const proposals = await ao.dryrun({
      process: vaot_id,
      tags: [{ name: 'Action', value: 'Get-Proposals' }],
    });
    if (!proposals.Messages[0]?.Data) {
      return {};
    }

    const parsedProposals = JSON.parse(proposals.Messages[0].Data);

    return parsedProposals;
  } catch (error) {
    console.error(error);
    return {};
  }
}

async function sendSlackNotification(proposalsWithPending: ProposalInfo[]) {
  const webhookUrl = process.env.PROPOSAL_MONITOR_SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(
      '⚠️  PROPOSAL_MONITOR_SLACK_WEBHOOK_URL not set, skipping notification',
    );
    return;
  }

  // Build the proposals summary with VAOT names
  const proposalsInfo = proposalsWithPending
    .map(
      ({ vaotId, vaotName, proposalCount }) =>
        `• **${vaotName}** has ${proposalCount} pending proposal${proposalCount > 1 ? 's' : ''} - <https://vaot.ar.io/#/${vaotId}|View in VAOT>`,
    )
    .join('\n');

  // Collect all mentions from processes with pending proposals
  const allMentions = [
    ...globalMentions,
    ...proposalsWithPending.flatMap(({ mentions }) => mentions),
  ];
  const uniqueMentions = [...new Set(allMentions)];
  const mentionsText =
    uniqueMentions.length > 0 ? uniqueMentions.join(' ') : '';

  const payload = {
    text: mentionsText
      ? `🚨 VAOT Proposals Require Review! Calling ${mentionsText} for review and voting.`
      : '🚨 VAOT Proposals Require Review!',
    attachments: [
      {
        fallback: 'VAOT Proposals Require Review!',
        color: 'warning',
        title: 'Pending Proposals Alert',
        text: 'There are pending proposals in VAOT that require your review and voting. \n',
        fields: [
          {
            title: 'Proposals Summary',
            value: proposalsInfo,
            short: false,
          },
          {
            title: 'Action Required',
            value:
              'Please review and vote on these proposals to help maintain the network.',
            short: false,
          },
          {
            title: 'Repository',
            value: process.env.GITHUB_REPOSITORY
              ? `<https://github.com/${process.env.GITHUB_REPOSITORY}|${process.env.GITHUB_REPOSITORY}>`
              : 'ar-io/vaot',
            short: true,
          },
          {
            title: 'Workflow Run',
            value: process.env.GITHUB_RUN_ID
              ? `<https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}|View Details>`
              : 'Manual execution',
            short: true,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('✅ Slack notification sent successfully');
    } else {
      console.error(
        '❌ Failed to send Slack notification:',
        response.status,
        response.statusText,
      );
    }
  } catch (error) {
    console.error('❌ Error sending Slack notification:', error);
  }
}

async function main() {
  const proposalsWithPending: ProposalInfo[] = [];

  for (const vaot_process of vaot_processes) {
    const proposals = await getProposals(vaot_process.id);
    const proposalCount = Object.keys(proposals).length;

    console.log(
      `VAOT [${vaot_process.name}] has [${proposalCount}] pending proposals`,
    );

    if (proposalCount > 0) {
      proposalsWithPending.push({
        vaotId: vaot_process.id,
        vaotName: vaot_process.name,
        proposalCount,
        mentions: vaot_process.mentions,
      });
    }
  }

  if (proposalsWithPending.length > 0) {
    console.log(
      `\n🚨 Found ${proposalsWithPending.length} VAOT process(es) with pending proposals`,
    );
    await sendSlackNotification(proposalsWithPending);
  } else {
    console.log('\n✅ No pending proposals found. All good!');
  }
}

main().catch(console.error);
