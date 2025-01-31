import { describe, it, before } from 'node:test';
import { getControllers, getProposals, handle, parseEventsFromResult, rubberStampProposal } from './helpers.mjs';
import {
  PROCESS_OWNER,
  STUB_MESSAGE_ID,
} from '../tools/constants.mjs';
import assert from 'node:assert';

describe('AOS Handlers:', () => {
  let testMemory;
  before(async () => {
    // Establishes the PROCESS_OWNER as the first controller by way of lazy initialization
    const result = await handle({
      options: {
        Tags: [
          { name: 'Action', value: 'Get-Controllers' },
        ],
      },
    });
    testMemory = result.Memory;
  });

  it('should have the process owner as the only controller on boot', async () => {
    assert.deepStrictEqual(await getControllers(testMemory), [PROCESS_OWNER]);
  });

  it('should have no proposals on boot', async () => {
    assert.deepStrictEqual(await getProposals(testMemory), {});
  });

  describe("Proposal Handlers", () => {
    const controllerProposalTypes = [
      "Add-Controller",
      "Remove-Controller",
    ];
    const proposalTypes = [
      ...controllerProposalTypes,
    ];

    const invalidProposalTest = async (proposalType, options, expectedError) => {
      const result = await handle({ options, mem: testMemory });
      assert.equal(result.Messages?.length, 1, "Expected one message");
      const replyMessage = result.Messages[0];
      const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
      assert.notEqual(actionTag, undefined, "Expected an action tag");
      assert.equal(actionTag.value, `Invalid-Propose-${proposalType}-Notice`);
      const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
      assert(errorTag.value.includes(expectedError));
      assert(replyMessage.Data.includes(expectedError));
      return result;
    };

    for (const proposalType of proposalTypes) {
      it(`should not allow submitting ${proposalType} proposals from a non-controller`, async () => {
        await invalidProposalTest(
          proposalType,
          {
            Tags: [
              { name: 'Action', value: `Propose-${proposalType}` },
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

    for (const proposalType of controllerProposalTypes) {
      it(`should require a Controller tag for ${proposalType} proposals`, async () => {
        await invalidProposalTest(
          proposalType,
          {
            Tags: [
              { name: 'Action', value: `Propose-${proposalType}` },
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
              { name: 'Action', value: `Propose-${proposalType}` },
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
              { name: 'Action', value: `Propose-${proposalType}` },
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
              { name: 'Action', value: `Propose-${proposalType}` },
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
              { name: 'Action', value: `Propose-${proposalType}` },
              { name: 'Controller', value: controller },
              { name: 'Vote', value: ' nay ' },
            ],
          },
          mem: testMemory,
        });
        const replyMessage = result.Messages[0];
        const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
        assert.notEqual(actionTag, undefined, "Expected an action tag");
        assert.equal(actionTag.value, `Invalid-Propose-${proposalType}-Notice`);
        const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
        assert(errorTag.value.includes("Vote, if provided, must be 'yay' or 'nay'"));
      });
  
      it(`should disallow creation of duplicate ${proposalType} proposals`, async () => {
        const controller = proposalType === "Add-Controller" ? 'new-controller' : PROCESS_OWNER;
        const result = await handle({
          options: {
            Tags: [
              { name: 'Action', value: `Propose-${proposalType}` },
              { name: 'Controller', value: controller },
            ],
          },
          mem: testMemory,
        });
        const result2 = await handle({
          options: {
            Tags: [
              { name: 'Action', value: `Propose-${proposalType}` },
              { name: 'Controller', value: controller },
            ],
          },
          mem: result.Memory,
        });
  
        const replyMessage = result2.Messages[0];
        const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
        assert.notEqual(actionTag, undefined, "Expected an action tag");
        assert.equal(actionTag.value, `Invalid-Propose-${proposalType}-Notice`);
        const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
        assert(errorTag.value.includes('Proposal already exists'));
      });
    }

    describe("Propose-Add-Controller", () => {
      it('should not allow proposing an existing controller', async () => {
        await invalidProposalTest("Add-Controller", {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
            { name: 'Controller', value: PROCESS_OWNER },
          ],
          }, 'Controller already exists');
      });
    
      describe("Vote", () => {
        let testMemory;
        before(async () => {
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Propose-Add-Controller' },
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
                  { name: 'Action', value: 'Propose-Add-Controller' },
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
        });
    
        it("should complete the proposal with a quorum of yay votes", async () => {
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
    
        it("should end the proposal with a quorum of nay votes", async () => {
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
          const result2 = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '2' },
                { name: 'Vote', value: 'nay' },
              ],
            },
            mem: result.Memory,
          });
          assert.deepEqual(JSON.parse(result2.Messages[0].Data), {
            proposalNumber: 2,
            msgId: STUB_MESSAGE_ID,
            yays: [],
            nays: {
              ['new-controller']: true,
              [PROCESS_OWNER]: true,
            },
            controller: 'new-controller2',
            type: "Add-Controller",
          });
    
          // Ensure the proposal is now completed
          const proposals = await getProposals(result2.Memory);
          assert.deepEqual(proposals, {});
    
          // Ensure that the controller was NOT added
          const controllers = await getControllers(result2.Memory);
          assert.deepEqual(controllers, [PROCESS_OWNER, 'new-controller']);
        });
    
        it("should end the proposal on a split vote with no majority", async () => {
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
              [PROCESS_OWNER]: true,
            },
            nays: {
              ['new-controller']: true,
            },
            controller: 'new-controller2',
            type: "Add-Controller",
          });
    
          // Ensure the proposal is now completed
          const proposals = await getProposals(result2.Memory);
          assert.deepEqual(proposals, {});
    
          // Ensure that the controller was NOT added
          const controllers = await getControllers(result2.Memory);
          assert.deepEqual(controllers, [PROCESS_OWNER, 'new-controller']);
        });
    
        it("should pass the proposal with 2 out of 3 yay votes", async () => {
          // After this, PROCESS_OWNER, 'new-controller', and 'new-controller3' should be controllers
          const { memory: rubberStampMemory } = await rubberStampProposal({
            proposalTags: [
              { name: 'Action', value: 'Propose-Add-Controller' },
              { name: 'Controller', value: 'new-controller3' },
            ],
            memory: testMemory,
          })
          const controllers = await getControllers(rubberStampMemory);
          assert.deepEqual(controllers, [PROCESS_OWNER, 'new-controller', 'new-controller3']);
          
          // The vote for 'new-controller2' now needs 2 of 3 yay votes to pass and has none yet
          const firstVoteResult = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '2' },
                { name: 'Vote', value: 'yay' },
              ],
              From: "new-controller3",
              Owner: "new-controller3",
            },
            mem: rubberStampMemory,
          });
    
          const result = await handle({
            options: {
              Tags: [
                { name: 'Action', value: 'Vote' },
                { name: 'Proposal-Number', value: '2' },
                { name: 'Vote', value: 'yay' },
              ],
            },
            mem: firstVoteResult.Memory,
          });
    
          // Ensure that 'new-controller2' is now added
          const controllers2 = await getControllers(result.Memory);
          assert.deepEqual(controllers2, [PROCESS_OWNER, 'new-controller', 'new-controller2', 'new-controller3']);
        });
      });
    });
  
    describe("Propose-Remove-Controller", () => {
      it('should not allow proposing removal of an unknown controller', async () => {
        await invalidProposalTest("Remove-Controller", {
          Tags: [
            { name: 'Action', value: 'Propose-Remove-Controller' },
            { name: 'Controller', value: 'new-controller' },
          ],
          }, 'Controller is not recognized');
      });
    });

    // TODO: Refactor "Vote" block to support both Add-Controller and Remove-Controller proposals
  });
});
