import { describe, it, before, beforeEach } from 'node:test';
import { getControllers, getProposals, handle, normalizeObject, parseEventsFromResult, rubberStampProposal } from './helpers.mjs';
import {
  PROCESS_OWNER,
  STUB_MESSAGE_ID,
} from '../tools/constants.mjs';
import assert from 'node:assert';

describe('AOS Handlers:', () => {
  let testMemory;
  let initialTestMemory;
  before(async () => {
    // Establishes the PROCESS_OWNER as the first controller by way of lazy initialization
    const result = await handle({
      options: {
        Tags: [
          { name: 'Action', value: 'Get-Controllers' },
        ],
      },
    });
    initialTestMemory = result.Memory;
  });

  beforeEach(async () => {
    testMemory = initialTestMemory;
  });


  it('should have the process owner as the only controller on boot', async () => {
    assert.deepStrictEqual(await getControllers(testMemory), [PROCESS_OWNER]);
  });

  it('should have no proposals on boot', async () => {
    assert.deepStrictEqual(await getProposals(testMemory), {});
  });

  describe("'Propose' Handler", () => {
    const controllerProposalTypes = [
      "Add-Controller",
      "Remove-Controller",
    ];
    const proposalTypes = [
      ...controllerProposalTypes,
      "Eval"
    ];

    const invalidProposalTest = async (options, expectedError) => {
      const result = await handle({ options, mem: testMemory });
      if (result.Error) {
        assert(result.Error.includes(expectedError), `Error message '${result.Error}' did not include expected error: ${expectedError}`);
      } else {
        assert.equal(result.Messages?.length, 1, "Expected one message");
        const replyMessage = result.Messages[0];
        const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
        assert.notEqual(actionTag, undefined, "Expected an action tag");
        assert.equal(actionTag.value, "Invalid-Propose-Notice");
        const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
        assert(errorTag.value.includes(expectedError), `Error message '${errorTag.value}' did not include expected error: ${expectedError}`);
        assert(replyMessage.Data.includes(expectedError), `Reply message Data did not include expected error message: ${expectedError}`);
      }
      return result;
    };

    for (const proposalType of proposalTypes) {
      it(`should not allow submitting ${proposalType} proposals from a non-controller`, async () => {
        await invalidProposalTest(
          {
            Tags: [
              { name: 'Action', value: "Propose" },
              { name: 'Proposal-Type', value: proposalType },
              { name: 'Controller', value: 'non-controller' },
            ],
            From: "non-controller",
            Owner: "non-controller",
          },
          'Sender is not a registered Controller!');
      });
    }

    // TODO: Validation of proposal pass/fail messages
    const validProposalTest = async (proposalType, options, expectedProposalName, expectedProposal, expectProposalEnd = true) => {
      const result = await handle({ options, mem: testMemory });
      const replyMessage = result.Messages[0];
      const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
      assert.notEqual(actionTag, undefined, "Expected an action tag");
      assert.equal(actionTag.value, `Propose-${proposalType}-Notice`);
      assert.deepEqual(JSON.parse(replyMessage.Data), { proposalName: expectedProposalName, ...expectedProposal});
      const proposals = await getProposals(result.Memory);
      assert.deepEqual(proposals, expectProposalEnd ? {} : { [expectedProposalName]: expectedProposal });
      return result.Memory;
    };

    describe("Add/Remove-Controller", () => {
      for (const proposalType of controllerProposalTypes) {
        it(`should require a Controller tag for ${proposalType} proposals`, async () => {
          await invalidProposalTest(
            {
              Tags: [
                { name: 'Action', value: "Propose" },
                { name: 'Proposal-Type', value: proposalType },
              ],
            },
            'Controller is required');
        });

        it(`should successfully create a ${proposalType} proposal`, async () => {
          const controller = proposalType === "Add-Controller" ? 'new-controller' : PROCESS_OWNER;
          await validProposalTest(
            proposalType,
            {
              Tags: [
                { name: 'Action', value: "Propose" },
                { name: 'Proposal-Type', value: proposalType },
                { name: 'Controller', value: controller },
              ],
            },
            `${proposalType}_${controller}`,
            {
              proposalNumber: 1,
              msgId: STUB_MESSAGE_ID,
              yays: [],
              nays: [],
              controller,
              type: proposalType,
            },
            false,
          );
        });
    
        it(`should allow casting a "yay" vote along with the ${proposalType} proposal`, async () => {
          const controller = proposalType === "Add-Controller" ? 'new-controller' : PROCESS_OWNER;
          const resultMemory = await validProposalTest(
            proposalType,
            {
              Tags: [
                { name: 'Action', value: "Propose" },
                { name: 'Proposal-Type', value: proposalType },
                { name: 'Controller', value: controller },
                { name: 'Vote', value: 'yay' },
              ],
            },
            `${proposalType}_${controller}`,
            {
              proposalNumber: 1,
              msgId: STUB_MESSAGE_ID,
              yays: {
                [PROCESS_OWNER]: true
              },
              nays: [],
              controller,
              type: proposalType,
            }
          );
    
          // The proposal should now be completed
          assert.deepEqual(await getProposals(resultMemory), {});
    
          // The controller should now be added/removed
          assert.deepEqual(
            await getControllers(resultMemory),
            proposalType === "Add-Controller" ? [ PROCESS_OWNER, 'new-controller' ] : [],
          );
        });
    
        it(`should allow casting a "nay" vote along with the ${proposalType} proposal`, async () => {
          const controller = proposalType === "Add-Controller" ? 'new-controller' : PROCESS_OWNER;
          const resultMemory = await validProposalTest(
            proposalType,
            {
              Tags: [
                { name: 'Action', value: "Propose" },
                { name: 'Proposal-Type', value: proposalType },
                { name: 'Controller', value: controller },
                { name: 'Vote', value: 'nay' },
              ],
            },
            `${proposalType}_${controller}`,
            {
              proposalNumber: 1,
              msgId: STUB_MESSAGE_ID,
              yays: [],
              nays: {
                [PROCESS_OWNER]: true
              },
              controller,
              type: proposalType,
            }
          );
    
          // The proposal should now be completed
          const proposals = await getProposals(resultMemory);
          assert.deepEqual(proposals, {});
    
          // The controller should not have been added/removed
          assert.deepEqual(await getControllers(resultMemory), [
            PROCESS_OWNER,
          ]);
        });

        it(`should disallow casting a vote other than exactly "yay" or "nay" along with the ${proposalType} proposal`, async () => {
          const controller = proposalType === "Add-Controller" ? 'new-controller' : PROCESS_OWNER;
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: "Propose" },
                { name: 'Proposal-Type', value: proposalType },
                { name: 'Controller', value: controller },
                { name: 'Vote', value: ' nay ' },
              ],
            },
            mem: testMemory,
          });
          const replyMessage = result.Messages[0];
          const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
          assert.notEqual(actionTag, undefined, "Expected an action tag");
          assert.equal(actionTag.value, "Invalid-Propose-Notice");
          const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
          assert(errorTag.value.includes("Vote, if provided, must be 'yay' or 'nay'"));
        });
    
        it(`should disallow creation of duplicate ${proposalType} proposals`, async () => {
          const controller = proposalType === "Add-Controller" ? 'new-controller' : PROCESS_OWNER;
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: "Propose" },
                { name: 'Proposal-Type', value: proposalType },
                { name: 'Controller', value: controller },
              ],
            },
            mem: testMemory,
          });
          const result2 = await handle({
            options: {
              Tags: [
                { name: 'Action', value: "Propose" },
                { name: 'Proposal-Type', value: proposalType },
                { name: 'Controller', value: controller },
              ],
            },
            mem: result.Memory,
          });
    
          const replyMessage = result2.Messages[0];
          const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
          assert.notEqual(actionTag, undefined, "Expected an action tag");
          assert.equal(actionTag.value, "Invalid-Propose-Notice");
          const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
          assert(errorTag.value.includes('Proposal already exists'));
        });
      }
    });

    describe("Add-Controller", () => {
      it('should not allow proposing an existing controller', async () => {
        await invalidProposalTest({
          Tags: [
            { name: 'Action', value: 'Propose' },
            { name: 'Proposal-Type', value: 'Add-Controller' },
            { name: 'Controller', value: PROCESS_OWNER },
          ],
          }, 'Controller already exists');
      });
    
      // TODO: Refactor "Vote" block to support both Add-Controller and Remove-Controller proposals
      describe("Vote", () => {
        let testMemory;
        before(async () => {
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Propose' },
                { name: 'Proposal-Type', value: 'Add-Controller' },
                { name: 'Controller', value: 'new-controller' },
              ],
            },
          });
          testMemory = result.Memory;
        });
    
        it('should not allow submitting the vote from a non-controller', async () => {
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '1' },
                { name: 'Vote', value: 'yay' },
              ],
              From: "non-controller",
              Owner: "non-controller",
            },
            mem: testMemory,
          });
          assert.equal(result.Messages?.length, 1, "Expected one message");
          const replyMessage = result.Messages[0];
          const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
          assert.notEqual(actionTag, undefined, "Expected an action tag");
          assert.equal(actionTag.value, 'Invalid-Vote-Notice');
          const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
          assert(errorTag.value.includes('Sender is not a registered Controller!'));
          assert(replyMessage.Data.includes('Sender is not a registered Controller!'));
        });
    
        it('should not allow voting on a non-existent proposal', async () => {
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '2' },
                { name: 'Vote', value: 'yay' },
              ],
            },
            mem: testMemory,
          });
          const { Memory, ...rest } = result;
          const replyMessage = result.Messages[0];
          const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
          assert.notEqual(actionTag, undefined, "Expected an action tag");
          assert.equal(actionTag.value, 'Invalid-Vote-Notice');
          const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
          assert(errorTag.value.includes('Proposal does not exist'));
          assert(replyMessage.Data.includes('Proposal does not exist'));
        });

        it("should not allow voting anything other than 'yay' or 'nay' on a proposal", async () => {
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '1' },
                { name: 'Vote', value: ' yay ' },
              ],
            },
            mem: testMemory,
          });
    
          const replyMessage = result.Messages[0];
          const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
          assert.notEqual(actionTag, undefined, "Expected an action tag");
          assert.equal(actionTag.value, 'Invalid-Vote-Notice');
          const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
          assert(errorTag.value.includes("A Vote of 'yay' or 'nay' is required"), `Error message '${errorTag.value}' was unexpected.`);
        });
    
        it("should allow voting yay on a proposal", async () => {
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '1' },
                { name: 'Vote', value: 'yay' },
              ],
            },
            mem: testMemory,
          });
    
          const replyMessage = result.Messages[0];
          const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
          assert.notEqual(actionTag, undefined, "Expected an action tag");
          assert.equal(actionTag.value, 'Vote-Notice');
          assert.deepEqual(JSON.parse(replyMessage.Data), {
            proposalNumber: 1,
            msgId: STUB_MESSAGE_ID,
            yays: {
              [PROCESS_OWNER]: true
            },
            nays: [],
            controller: 'new-controller',
            type: "Add-Controller",
          });
    
          // Ensure that the vote is now over
          const proposals = await getProposals(result.Memory);
          assert.deepEqual(proposals, {});
        });
    
        it("should allow voting nay on a proposal", async () => {
          const result2 = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '1' },
                { name: 'Vote', value: 'nay' },
              ],
            },
            mem: testMemory,
          });
    
          const replyMessage = result2.Messages[0];
          const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
          assert.notEqual(actionTag, undefined, "Expected an action tag");
          assert.equal(actionTag.value, 'Vote-Notice');
          assert.deepEqual(JSON.parse(replyMessage.Data), {
            proposalNumber: 1,
            msgId: STUB_MESSAGE_ID,
            yays: [],
            nays: {
              [PROCESS_OWNER]: true
            },
            controller: 'new-controller',
            type: "Add-Controller",
          });
    
          // Ensure that the vote is now over
          const proposals = await getProposals(result2.Memory);
          assert.deepEqual(proposals, {});
        });
    
        describe("with multiple controllers", () => {
          // Approve the addition of new-controller to the Controllers pool
          // Then create a new proposal to add new-controller2 to the Controllers pool
          before(async () => {
            const result = await handle({
              options: {
                Tags: [
                  { name: 'Action', value: 'Vote' },
                  { name: 'Proposal-Number', value: '1' },
                  { name: 'Vote', value: 'yay' }, // this should cause immediate passing of the proposal
                ],
              },
              mem: testMemory,
            });
            const controllers = await getControllers(result.Memory);
            assert.deepStrictEqual(controllers, [PROCESS_OWNER, 'new-controller']);
            const result2 = await handle({
              options: {
                Tags: [
                  { name: 'Action', value: 'Propose' },
                  { name: 'Proposal-Type', value: 'Add-Controller' },
                  { name: 'Controller', value: 'new-controller2' },
                  // Don't vote yay to allow for both yay, nay, and quorum outcome tests
                ],
              },
              mem: result.Memory,
            });
            testMemory = result2.Memory;
          });
    
          it("should not complete the non-voted proposal with an initial yay vote", async () => {
            const result = await handle({
              options: {
                Tags: [
                  { name: 'Action', value: 'Vote' },
                  { name: 'Proposal-Number', value: '2' },
                  { name: 'Vote', value: 'yay' },
                ],
                From: "new-controller",
                Owner: "new-controller",
              },
              mem: testMemory,
            });
            const proposals = JSON.parse(result.Messages[0].Data);
            assert.deepEqual(proposals, {
              proposalNumber: 2,
              msgId: STUB_MESSAGE_ID,
              yays: {
                ['new-controller']: true
              },
              nays: [],
              controller: 'new-controller2',
              type: "Add-Controller",
            });
          });

          it('should allow you to change your vote', async () => {
            const result = await handle({
              options: {
                Tags: [
                  { name: 'Action', value: 'Vote' },
                  { name: 'Proposal-Number', value: '2' },
                  { name: 'Vote', value: 'nay' },
                ],
              },
              mem: testMemory,
            });
            assert.deepEqual(JSON.parse(result.Messages[0].Data), {
              proposalNumber: 2,
              msgId: STUB_MESSAGE_ID,
              yays: [],
              nays: {
                [PROCESS_OWNER]: true,
              },
              controller: 'new-controller2',
              type: "Add-Controller",
            });
          });

          it('should remove the existing votes of removed controllers', async () => {
            // Add a third controller so that a single nay won't end a proposal
            const { memory: rubberStampMemory } = await rubberStampProposal({
              proposalTags: [
                { name: 'Action', value: 'Propose' },
                { name: 'Proposal-Type', value: 'Add-Controller' },
                { name: 'Controller', value: 'new-controller3' },
              ],
              memory: testMemory,
            });

            // Ensure that there's 3 controllers
            const controllers = await getControllers(rubberStampMemory);
            assert.deepEqual(controllers, [PROCESS_OWNER, 'new-controller', 'new-controller3']);

            // Establish a nay vote by new-controller on the new-controller2 proposal
            const nayVoteResult = await handle({
              options: {
                Tags: [
                  { name: 'Action', value: 'Vote' },
                  { name: 'Proposal-Number', value: '2' },
                  { name: 'Vote', value: 'nay' },
                ],
                From: "new-controller",
                Owner: "new-controller",
              },
              mem: rubberStampMemory,
            });
            assert.deepEqual(JSON.parse(nayVoteResult.Messages[0].Data), {
              proposalNumber: 2,
              msgId: STUB_MESSAGE_ID,
              yays: [],
              nays: {
                ['new-controller']: true,
              },
              controller: 'new-controller2',
              type: "Add-Controller",
            });

            // Assert that the proposal is in memory
            const proposalsBefore = await getProposals(nayVoteResult.Memory);
            assert.deepEqual(proposalsBefore, {
              ['Add-Controller_new-controller2']: {
                proposalNumber: 2,
                msgId: STUB_MESSAGE_ID,
                yays: [],
                nays: {
                  ['new-controller']: true,
                },
                controller: 'new-controller2',
                type: "Add-Controller",
              },
            });

            // Remove new-controller from the Controllers pool
            const { memory: removeNewControllerMemory } = await rubberStampProposal({
              proposalTags: [
                { name: 'Action', value: 'Propose' },
                { name: 'Proposal-Type', value: 'Remove-Controller' },
                { name: 'Controller', value: 'new-controller' },
              ],
              memory: nayVoteResult.Memory,
            });

            // Assert that the new-controller2 proposal now has no votes
            const proposals = await getProposals(removeNewControllerMemory);
            assert.deepEqual(proposals, {
              ['Add-Controller_new-controller2']: {
                proposalNumber: 2,
                msgId: STUB_MESSAGE_ID,
                yays: [],
                nays: [],
                controller: 'new-controller2',
                type: "Add-Controller",
              },
            });
          });

          it("should fail proposals that can no longer pass when their controller's critical yay vote has been removed", async () => {
            // We'll need 5 Controllers for this test. We already have PROCESS_OWNER and 'new-controller'
            const { memory: rubberStampMemory } = await rubberStampProposal({
              proposalTags: [
                { name: 'Action', value: 'Propose' },
                { name: 'Proposal-Type', value: 'Add-Controller' },
                { name: 'Controller', value: 'new-controller3' },
              ],
              memory: testMemory,
            });
            const { memory: rubberStampMemory2 } = await rubberStampProposal({
              proposalTags: [
                { name: 'Action', value: 'Propose' },
                { name: 'Proposal-Type', value: 'Add-Controller' },
                { name: 'Controller', value: 'new-controller4' },
              ],
              memory: rubberStampMemory,
            });
            const { memory: rubberStampMemory3 } = await rubberStampProposal({
              proposalTags: [
                { name: 'Action', value: 'Propose' },
                { name: 'Proposal-Type', value: 'Add-Controller' },
                { name: 'Controller', value: 'new-controller5' },
              ],
              memory: rubberStampMemory2,
            });
            const controllersBefore = await getControllers(rubberStampMemory3);
            assert.deepEqual(controllersBefore, [PROCESS_OWNER, 'new-controller', 'new-controller3', 'new-controller4', 'new-controller5']);

            // Add 2 yays and 2 nays to the new-controller2 proposal
            const { Memory: yayVote1Memory } = await handle({
              options: {
                Tags: [
                  { name: 'Action', value: 'Vote' },
                  { name: 'Proposal-Number', value: '2' },
                  { name: 'Vote', value: 'yay' },
                ],
                From: 'new-controller',
                Owner: 'new-controller',
              },
              mem: rubberStampMemory3,
            });
            const { Memory: yayVote2Memory } = await handle({
              options: {
                Tags: [
                  { name: 'Action', value: 'Vote' },
                  { name: 'Proposal-Number', value: '2' },
                  { name: 'Vote', value: 'yay' },
                ],
                From: 'new-controller3',
                Owner: 'new-controller3',
              },
              mem: yayVote1Memory,
            });
            const { Memory: nayVote1Memory } = await handle({
              options: {
                Tags: [
                  { name: 'Action', value: 'Vote' },
                  { name: 'Proposal-Number', value: '2' },
                  { name: 'Vote', value: 'nay' },
                ],
                From: 'new-controller4',
                Owner: 'new-controller4',
              },
              mem: yayVote2Memory,
            });
            const { Memory: nayVote2Memory } = await handle({
              options: {
                Tags: [
                  { name: 'Action', value: 'Vote' },
                  { name: 'Proposal-Number', value: '2' },
                  { name: 'Vote', value: 'nay' },
                ],
                From: 'new-controller5',
                Owner: 'new-controller5',
              },
              mem: nayVote1Memory,
            });

            // Ensure that proposal 2 has 2 yays and 2 nays
            const proposals = await getProposals(nayVote2Memory);
            assert.deepEqual(proposals, {
              ['Add-Controller_new-controller2']: {
                proposalNumber: 2,
                msgId: STUB_MESSAGE_ID,
                yays: {
                  ['new-controller']: true,
                  ['new-controller3']: true,
                },
                nays: {
                  ['new-controller4']: true,
                  ['new-controller5']: true,
                },
                controller: 'new-controller2',
                type: "Add-Controller",  
              }
            })

            // Remove 'new-controller' from the Controllers pool
            const { memory: removeNewControllerMemory, result: removeNewControllerResult } = await rubberStampProposal({
              proposalTags: [
                { name: 'Action', value: 'Propose' },
                { name: 'Proposal-Type', value: 'Remove-Controller' },
                { name: 'Controller', value: 'new-controller' },
              ],
              memory: nayVote2Memory,
            });

            const finalMessages = removeNewControllerResult.Messages?.reduce((acc, message) => {
              if (message.Tags.find(tag => tag.name === 'Action')?.value === 'Proposal-Accepted-Notice') {
                acc.acceptedNotices.push(message);
              } else if (message.Tags.find(tag => tag.name === 'Action')?.value === 'Proposal-Rejected-Notice') {
                acc.rejectedNotices.push(message);
              }
              return acc;
            }, {
              acceptedNotices: [],
              rejectedNotices: [],
            });

            // All the controllers find out that one of them is getting removed
            assert.deepEqual(finalMessages.acceptedNotices.length, 5);

            // The remaining controllers find out that a proposal has failed now that new-controller's critical yay vote is removed
            assert.deepEqual(finalMessages.rejectedNotices.length, 4);

            // Assert that 2 events were printed as a result of the chain of events
            const events = parseEventsFromResult(removeNewControllerResult);
            assert.deepEqual(normalizeObject(events), normalizeObject([
              {
                "Yays": [
                  "1111111111111111111111111111111111111111111",
                  "new-controller",
                  "new-controller3"
                ],
                "Removed-Yays": [
                  "2"
                ],
                "Proposal-Type": "Remove-Controller",
                "_e": 1,
                "Controllers": [
                  "new-controller4",
                  "1111111111111111111111111111111111111111111",
                  "new-controller5",
                  "new-controller",
                  "new-controller3"
                ],
                "From-Formatted": "new-controller3",
                "Fail-Threshold": 3,
                "Removed-Yays-Count": 1,
                "Vote": "yay",
                "Nays-Count": 0,
                "Timestamp": 21600000,
                "Action": "Vote",
                "Nays": [],
                "Proposal-Name": "Remove-Controller_new-controller",
                "Proposal-Number": 6,
                "Pass-Threshold": 3,
                "Message-Id": "mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
                "Controller": "new-controller",
                "Yays-Count": 3,
                "Proposal-Status": "Passed",
                "From": "new-controller3",
                "Controllers-Count": 5
              },
              {
                "Yays": [
                  "new-controller3"
                ],
                "Proposal-Type": "Add-Controller",
                "_e": 1,
                "Controllers": [
                  "new-controller4",
                  "1111111111111111111111111111111111111111111",
                  "new-controller5",
                  "new-controller3"
                ],
                "From-Formatted": "new-controller3",
                "Fail-Threshold": 2,
                "Vote": "yay",
                "Nays-Count": 2,
                "Timestamp": 21600000,
                "Action": "Vote",
                "Nays": [
                  "new-controller4",
                  "new-controller5"
                ],
                "Proposal-Name": "Add-Controller_new-controller2",
                "Proposal-Number": 2,
                "Pass-Threshold": 3,
                "Message-Id": "mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
                "Controller": "new-controller2",
                "Yays-Count": 1,
                "Proposal-Status": "Failed",
                "From": "new-controller3",
                "Controllers-Count": 4
              }
            ]));

            // Assert that the proposal 2 has been removed due to now-insufficient available yay votes
            const proposalsAfter = await getProposals(removeNewControllerMemory);
            assert.deepEqual(proposalsAfter, {});
          });

          it("should pass proposals that clear the pass threshold when a controller is removed", async () => {
            // We'll need 4 Controllers for this test. We already have PROCESS_OWNER and 'new-controller'
            const { memory: rubberStampMemory } = await rubberStampProposal({
              proposalTags: [
                { name: 'Action', value: 'Propose' },
                { name: 'Proposal-Type', value: 'Add-Controller' },
                { name: 'Controller', value: 'new-controller3' },
              ],
              memory: testMemory,
            });
            const { memory: rubberStampMemory2 } = await rubberStampProposal({
              proposalTags: [
                { name: 'Action', value: 'Propose' },
                { name: 'Proposal-Type', value: 'Add-Controller' },
                { name: 'Controller', value: 'new-controller4' },
              ],
              memory: rubberStampMemory,
            });

            const controllers = await getControllers(rubberStampMemory2);
            assert.deepEqual(controllers, [PROCESS_OWNER, 'new-controller', 'new-controller3', 'new-controller4']);
            
            // Add 2 yays to the new-controller2 proposal
            const { Memory: yayVote1Memory } = await handle({
              options: {
                Tags: [
                  { name: 'Action', value: 'Vote' },
                  { name: 'Proposal-Number', value: '2' },
                  { name: 'Vote', value: 'yay' },
                ],
                From: 'new-controller3',
                Owner: 'new-controller3',
              },
              mem: rubberStampMemory2,
            });
            
            const { Memory: yayVote2Memory } = await handle({
              options: {
                Tags: [
                  { name: 'Action', value: 'Vote' },
                  { name: 'Proposal-Number', value: '2' },
                  { name: 'Vote', value: 'yay' },
                ],
                From: 'new-controller4',
                Owner: 'new-controller4',
              },
              mem: yayVote1Memory,
            });

            // Ensure that proposal 2 has 2 yays and 0 nays
            const proposals = await getProposals(yayVote2Memory);
            assert.deepEqual(proposals, {
              ['Add-Controller_new-controller2']: {
                proposalNumber: 2,
                msgId: STUB_MESSAGE_ID,
                yays: {
                  ['new-controller3']: true,
                  ['new-controller4']: true,
                },
                nays: [],
                controller: 'new-controller2',
                type: "Add-Controller",
              },
            });

            // Remove 'new-controller' from the Controllers pool
            const { memory: removeNewControllerMemory, result: removeNewControllerResult } = await rubberStampProposal({
              proposalTags: [ 
                { name: 'Action', value: 'Propose' },
                { name: 'Proposal-Type', value: 'Remove-Controller' },
                { name: 'Controller', value: 'new-controller' },
              ],
              memory: yayVote2Memory,
            });

            const finalMessages = removeNewControllerResult.Messages?.reduce((acc, message) => {
              if (message.Tags.find(tag => tag.name === 'Action')?.value === 'Proposal-Accepted-Notice') {
                acc.acceptedNotices.push(message);
              } else if (message.Tags.find(tag => tag.name === 'Action')?.value === 'Proposal-Rejected-Notice') {
                acc.rejectedNotices.push(message);
              }
              return acc;
            }, {
              acceptedNotices: [],
              rejectedNotices: [],
            });

            // All 4 controllers find out that one of them is getting removed. Additionally, the remaining 3 controllers
            // find out that a proposal has passed now that new-controller's removal clears the pass threshold
            assert.deepEqual(finalMessages.acceptedNotices.length, 7);            
            assert.deepEqual(finalMessages.rejectedNotices.length, 0);

            // Assert that all the proposals are now completed
            const proposalsAfter = await getProposals(removeNewControllerMemory);
            assert.deepEqual(proposalsAfter, {});

            // Assert that 2 events were printed as a result of the chain of events
            const events = parseEventsFromResult(removeNewControllerResult);
            assert.deepEqual(normalizeObject(events), normalizeObject([
              {
                "_e": 1,
                "From-Formatted": "new-controller3",
                "Nays": [],
                "Yays-Count": 3,
                "Action": "Vote",
                "From": "new-controller3",
                "Controllers": [
                  "new-controller3",
                  "new-controller",
                  "1111111111111111111111111111111111111111111",
                  "new-controller4"
                ],
                "Proposal-Name": "Remove-Controller_new-controller",
                "Controllers-Count": 4,
                "Nays-Count": 0,
                "Fail-Threshold": 2,
                "Proposal-Type": "Remove-Controller",
                "Yays": [
                  "new-controller",
                  "1111111111111111111111111111111111111111111",
                  "new-controller3"
                ],
                "Proposal-Status": "Passed",
                "Vote": "yay",
                "Pass-Threshold": 3,
                "Controller": "new-controller",
                "Timestamp": 21600000,
                "Message-Id": "mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
                "Proposal-Number": 5
              },
              {
                "_e": 1,
                "From-Formatted": "new-controller3",
                "Nays": [],
                "Yays-Count": 2,
                "Action": "Vote",
                "From": "new-controller3",
                "Controllers": [
                  "new-controller3",
                  "1111111111111111111111111111111111111111111",
                  "new-controller4"
                ],
                "Proposal-Name": "Add-Controller_new-controller2",
                "Controllers-Count": 3,
                "Nays-Count": 0,
                "Fail-Threshold": 2,
                "Proposal-Type": "Add-Controller",
                "Yays": [
                  "new-controller4",
                  "new-controller3"
                ],
                "Proposal-Status": "Passed",
                "Vote": "yay",
                "Pass-Threshold": 2,
                "Controller": "new-controller2",
                "Timestamp": 21600000,
                "Message-Id": "mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
                "Proposal-Number": 2
              }
            ]));
          });
        });
    
        it("should pass the proposal when yay votes clear the pass threshold", async () => {
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '2' },
                { name: 'Vote', value: 'yay' },
              ],
              From: "new-controller",
              Owner: "new-controller",
            },
            mem: testMemory,
          });
          const result2 = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '2' },
                { name: 'Vote', value: 'yay' },
              ],
            },
            mem: result.Memory,
          });
          assert.deepEqual(JSON.parse(result2.Messages[0].Data), {
            proposalNumber: 2,
            msgId: STUB_MESSAGE_ID,
            yays: {
              ['new-controller']: true,
              [PROCESS_OWNER]: true,
            },
            nays: [],
            controller: 'new-controller2',
            type: "Add-Controller",
          });
    
          // Ensure the proposal is now completed
          const proposals = await getProposals(result2.Memory);
          assert.deepEqual(proposals, {});
    
          // Ensure that the new controller is now added
          const controllers = await getControllers(result2.Memory);
          assert.deepEqual(controllers, [PROCESS_OWNER, 'new-controller', 'new-controller2']);
        });
    
        it("should fail the proposal when nay votes clear the fail threshold", async () => {
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '2' },
                { name: 'Vote', value: 'nay' },
              ],
              From: "new-controller",
              Owner: "new-controller",
            },
            mem: testMemory,
          });
          assert.deepEqual(JSON.parse(result.Messages[0].Data), {
            proposalNumber: 2,
            msgId: STUB_MESSAGE_ID,
            yays: [],
            nays: {
              ['new-controller']: true,
            },
            controller: 'new-controller2',
            type: "Add-Controller",
          });
    
          // Ensure the proposal is now completed
          const proposals = await getProposals(result.Memory);
          assert.deepEqual(proposals, {});
    
          // Ensure that the controller was NOT added
          const controllers = await getControllers(result.Memory);
          assert.deepEqual(controllers, [PROCESS_OWNER, 'new-controller']);
        });
    
        it("should pass the proposal with 2 out of 3 yay votes", async () => {
          // After this, PROCESS_OWNER, 'new-controller', and 'new-controller3' should be controllers
          const { memory: rubberStampMemory } = await rubberStampProposal({
            proposalTags: [
              { name: 'Action', value: 'Propose' },
              { name: 'Proposal-Type', value: 'Add-Controller' },
              { name: 'Controller', value: 'new-controller3' },
            ],
            memory: testMemory,
          })
          const controllers = await getControllers(rubberStampMemory);
          assert.deepEqual(controllers, [PROCESS_OWNER, 'new-controller', 'new-controller3']);
          
          // The vote for 'new-controller2' now needs 2 of 3 yay votes to pass and has none yet
          const nayVoteResult = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '2' },
              ],
              From: "new-controller",
              Owner: "new-controller",
            },
            mem: rubberStampMemory,
          });

          const firstYayResult = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '2' },
                { name: 'Vote', value: 'yay' },
              ],
              From: "new-controller3",
              Owner: "new-controller3",
            },
            mem: nayVoteResult.Memory,
          });
    
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '2' },
                { name: 'Vote', value: 'yay' },
              ],
            },
            mem: firstYayResult.Memory,
          });
    
          // Ensure that 'new-controller2' is now added
          const controllers2 = await getControllers(result.Memory);
          assert.deepEqual(controllers2, [PROCESS_OWNER, 'new-controller', 'new-controller2', 'new-controller3']);
        });
      });
    });
  
    describe("Remove-Controller", () => {
      it('should not allow proposing removal of an unknown controller', async () => {
        await invalidProposalTest({
          Tags: [
            { name: 'Action', value: 'Propose' },
            { name: 'Proposal-Type', value: 'Remove-Controller' },
            { name: 'Controller', value: 'new-controller' },
          ],
          }, 'Controller is not recognized');
      });
    });

    describe("Eval", () => {
      it('should require a Process-Id', async () => {
        await invalidProposalTest({
          Tags: [
            { name: 'Action', value: 'Propose' },
            { name: 'Proposal-Type', value: 'Eval' },
          ],
        }, 'Process-Id is required');
      });

      it('should require a Process-Id with non-zero length', async () => {
        await invalidProposalTest({
          Tags: [
            { name: 'Action', value: 'Propose' },
            { name: 'Proposal-Type', value: 'Eval' },
            { name: 'Process-Id', value: '' },
          ],
        }, 'Value for Process-Id cannot be empty');
      });

      it('should require a non-whitespace Process-Id', async () => {
        await invalidProposalTest({
          Tags: [
            { name: 'Action', value: 'Propose' },
            { name: 'Proposal-Type', value: 'Eval' },
            { name: 'Process-Id', value: ' ' },
          ],
        }, 'Value for Process-Id cannot be only whitespace');
      });

      it('should require Data with non-zero length', async () => {
        await invalidProposalTest({
          Tags: [
            { name: 'Action', value: 'Propose' },
            { name: 'Proposal-Type', value: 'Eval' },
            { name: 'Process-Id', value: 'target-process-id' },
          ],
        }, 'Eval string is expected in message Data');
      });

      it('should successfully create and execute an Eval proposal', async () => {
        const result = await handle({
          options: {
            Tags: [
              { name: 'Action', value: 'Propose' },
              { name: 'Proposal-Type', value: 'Eval' },
              { name: 'Process-Id', value: 'target-process-id' },
              { name: 'Vote', value: 'yay' },
            ],
            Data: 'print("Hello, World!")',
          },
          mem: testMemory,
        });
        assert.equal(result.Messages?.length, 3, "Expected 3 outgoing messages");
        const messageActions = result.Messages.map(message => message.Tags.find(tag => tag.name === 'Action')?.value).sort();
        assert.deepEqual(messageActions, ['Eval', 'Proposal-Accepted-Notice', 'Propose-Eval-Notice']);
        const evalMessage = result.Messages.find(message => message.Tags.find(tag => tag.name === 'Action')?.value === 'Eval');
        assert.deepEqual(evalMessage.Data, 'print("Hello, World!")');
        // TODO: More thorough testing here
      });
    });
  });
});
