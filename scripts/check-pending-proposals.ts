import { connect } from '@permaweb/aoconnect';

const ao = connect({
  MODE: 'legacy',
  CU_URL: 'https://cu.ardrive.io',
});

const vaot_ids = [
  '4Ko7JmGPtbKLLqctNFr6ukWqX0lt4l0ktXgYKyMlbsM', // ant registry main and staging
  'My21NOHZyyeQG0t0yANsWjRakNDM7CJvd8urtdMLEDE', // ario network process
];

interface ProposalInfo {
  vaotId: string;
  proposalCount: number;
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
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('⚠️  SLACK_WEBHOOK_URL not set, skipping notification');
    return;
  }

  // Build the proposals summary
  const proposalsInfo = proposalsWithPending
    .map(
      ({ vaotId, proposalCount }) =>
        `• VAOT [${vaotId}] has ${proposalCount} pending proposals - <https://vaot.ar.io/#/${vaotId}|View in VAOT>`,
    )
    .join('\n');

  const payload = {
    attachments: [
      {
        fallback: 'VAOT Proposals Require Review!',
        color: 'warning',
        title: 'Pending Proposals Alert',
        text: 'There are pending proposals in VAOT that require your review and voting.',
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

  for (const vaot_id of vaot_ids) {
    const proposals = await getProposals(vaot_id);
    const proposalCount = Object.keys(proposals).length;

    console.log(`VAOT [${vaot_id}] has [${proposalCount}] pending proposals`);

    if (proposalCount > 0) {
      proposalsWithPending.push({ vaotId: vaot_id, proposalCount });
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
