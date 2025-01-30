import { describe, it, before } from 'node:test';
import { getControllers, getProposals, handle, parseEventsFromResult, rubberStampProposal } from './helpers.mjs';
import {
  PROCESS_OWNER,
} from '../tools/constants.mjs';
import assert from 'node:assert';

describe('AOS Handlers:', () => {
  it('should have the process owner as the only controller on boot', async () => {
    assert.deepStrictEqual(await getControllers(), [PROCESS_OWNER]);
  });

  it('should have no proposals on boot', async () => {
    assert.deepStrictEqual(await getProposals(), {});
  });

  describe("Propose-Add-Controller", () => {
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

    const invalidProposalTest = async (options, expectedError) => {
      const result = await handle({ options, mem: testMemory });
      assert.equal(result.Messages?.length, 1, "Expected one message");
      const replyMessage = result.Messages[0];
      const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
      assert.notEqual(actionTag, undefined, "Expected an action tag");
      assert.equal(actionTag.value, 'Invalid-Propose-Add-Controller-Notice');
      const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
      assert(errorTag.value.includes(expectedError));
      assert(replyMessage.Data.includes(expectedError));
    };

    it('should not allow submitting the proposal from a non-controller', async () => {
      await invalidProposalTest({
        Tags: [
          { name: 'Action', value: 'Propose-Add-Controller' },
          { name: 'Controller', value: 'non-controller' },
        ],
        From: "non-controller",
        Owner: "non-controller",
      }, 'Sender is not a registered Controller!');
    });

    it('should not allow proposing an existing controller', async () => {
      await invalidProposalTest({
        Tags: [
          { name: 'Action', value: 'Propose-Add-Controller' },
          { name: 'Controller', value: PROCESS_OWNER },
        ],
        }, 'Controller already exists');
    });

    it('should require a Controller tag', async () => {
      await invalidProposalTest({
        Tags: [
          { name: 'Action', value: 'Propose-Add-Controller' },
        ],
        }, 'Controller is required');
    });

    const validProposalTest = async (options, expectedProposalName, expectedProposal, expectProposalEnd = true) => {
      const result = await handle({ options, mem: testMemory });
      const replyMessage = result.Messages[0];
      const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
      assert.notEqual(actionTag, undefined, "Expected an action tag");
      assert.equal(actionTag.value, 'Propose-Add-Controller-Notice');
      assert.deepEqual(JSON.parse(replyMessage.Data), { proposalName: expectedProposalName, ...expectedProposal});
      const proposals = await getProposals(result.Memory);
      assert.deepEqual(proposals, expectProposalEnd ? {} : { [expectedProposalName]: expectedProposal });
      return result.Memory;
    };

    it('should successfully create a proposal', async () => {
      await validProposalTest(
        {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
            { name: 'Controller', value: 'new-controller' },
          ],
        },
        "Add-Controller_new-controller",
        {
          proposalNumber: 1,
          yays: [],
          nays: [],
          controller: 'new-controller',
          type: "Add-Controller",
        },
        false,
      );
    });

    it('should allow casting a "Yay" vote along with the proposal', async () => {
      const resultMemory = await validProposalTest(
        {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
            { name: 'Controller', value: 'new-controller' },
            { name: 'Vote', value: 'Yay' },
          ],
        },
        "Add-Controller_new-controller",
        {
          proposalNumber: 1,
          yays: {
            [PROCESS_OWNER]: true
          },
          nays: [],
          controller: 'new-controller',
          type: "Add-Controller",
        }
      );

      // The proposal should now be completed
      assert.deepEqual(await getProposals(resultMemory), {});

      // The controller should now be added
      assert.deepEqual(await getControllers(resultMemory), [
        PROCESS_OWNER,
        'new-controller',
      ]);
    });

    it('should allow casting a "Nay" vote along with the proposal', async () => {
      const resultMemory = await validProposalTest(
        {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
            { name: 'Controller', value: 'new-controller' },
            { name: 'Vote', value: 'Nay' },
          ],
        },
        "Add-Controller_new-controller",
        {
          proposalNumber: 1,
          yays: [],
          nays: {
            [PROCESS_OWNER]: true
          },
          controller: 'new-controller',
          type: "Add-Controller",
        }
      );

      // The proposal should now be completed
      const proposals = await getProposals(resultMemory);
      assert.deepEqual(proposals, {});

      // The controller should note have been added
      assert.deepEqual(await getControllers(resultMemory), [
        PROCESS_OWNER,
      ]);
    });

    it('should disallow creation of a duplicate proposal', async () => {
      const result = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
            { name: 'Controller', value: 'new-controller' },
          ],
        },
        mem: testMemory,
      });
      const result2 = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
            { name: 'Controller', value: 'new-controller' },
          ],
        },
        mem: result.Memory,
      });

      const replyMessage = result2.Messages[0];
      const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
      assert.notEqual(actionTag, undefined, "Expected an action tag");
      assert.equal(actionTag.value, 'Invalid-Propose-Add-Controller-Notice');
      const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
      assert(errorTag.value.includes('Proposal already exists'));
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
              { name: 'Vote', value: 'Yay' },
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
              { name: 'Vote', value: 'Yay' },
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
  
      it("should allow voting yay on a proposal", async () => {
        const result = await handle({
          options: {
            Tags: [
              { name: 'Action', value: 'Vote' },
              { name: 'Proposal-Number', value: '1' },
              { name: 'Vote', value: 'Yay' },
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
              { name: 'Vote', value: 'Nay' },
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
                { name: 'Vote', value: 'Yay' }, // this should cause immediate passing of the proposal
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
                { name: 'Vote', value: 'Yay' },
              ],
              From: "new-controller",
              Owner: "new-controller",
            },
            mem: testMemory,
          });
          const proposals = JSON.parse(result.Messages[0].Data);
          assert.deepEqual(proposals, {
            proposalNumber: 2,
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
              { name: 'Vote', value: 'Yay' },
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
              { name: 'Vote', value: 'Yay' },
            ],
          },
          mem: result.Memory,
        });
        assert.deepEqual(JSON.parse(result2.Messages[0].Data), {
          proposalNumber: 2,
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
              { name: 'Vote', value: 'Nay' },
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
              { name: 'Vote', value: 'Nay' },
            ],
          },
          mem: result.Memory,
        });
        assert.deepEqual(JSON.parse(result2.Messages[0].Data), {
          proposalNumber: 2,
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
              { name: 'Vote', value: 'Nay' },
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
              { name: 'Vote', value: 'Yay' },
            ],
          },
          mem: result.Memory,
        });
        assert.deepEqual(JSON.parse(result2.Messages[0].Data), {
          proposalNumber: 2,
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
        const firstVoteresult = await handle({
          options: {
            Tags: [
              { name: 'Action', value: 'Vote' },
              { name: 'Proposal-Number', value: '2' },
              { name: 'Vote', value: 'Yay' },
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
              { name: 'Vote', value: 'Yay' },
            ],
          },
          mem: firstVoteresult.Memory,
        });
  
        // Ensure that 'new-controller2' is now added
        const controllers2 = await getControllers(result.Memory);
        assert.deepEqual(controllers2, [PROCESS_OWNER, 'new-controller', 'new-controller2', 'new-controller3']);
      });
    });
  });
});
