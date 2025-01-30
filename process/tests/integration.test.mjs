import { describe, it, before } from 'node:test';
import { handle, parseEventsFromResult } from './helpers.mjs';
import {
  PROCESS_OWNER,
  STUB_MESSAGE_ID,
  STUB_TIMESTAMP,
} from '../tools/constants.mjs';
import assert from 'node:assert';

describe('AOS Handlers:', () => {
  // it('should return hello world', async () => {
  //   const result = await handle({
  //     options: {
  //       Tags: [{ name: 'Action', value: 'Whatever' }],
  //     },
  //   });
  //   assert.equal(result.Messages?.[0]?.Data, 'Hello World');
  //   const events = parseEventsFromResult(result);
  //   assert.equal(events.length, 1);
  //   assert.deepStrictEqual(events[0], {
  //     Action: 'Whatever',
  //     Timestamp: STUB_TIMESTAMP,
  //     _e: 1,
  //     'Message-Id': STUB_MESSAGE_ID,
  //     'From-Formatted': PROCESS_OWNER,
  //     From: PROCESS_OWNER,
  //   });
  // });

  it('should have the process owner as the only controller on boot', async () => {
    const result = await handle({
      options: {
        Tags: [{ name: 'Action', value: 'Get-Controllers' }],
      },
    });
    assert.deepStrictEqual(result.Messages?.[0]?.Data, JSON.stringify({
      [PROCESS_OWNER]: true,
    }));
  });

  it('should have no proposals on boot', async () => {
    const result = await handle({
      options: {
        Tags: [{ name: 'Action', value: 'Get-Proposals' }],
      },
    });
    assert.deepStrictEqual(result.Messages?.[0]?.Data, JSON.stringify([]));
  });

  describe("Propose-Add-Controller", () => {
    let testMemory;
    before(async () => {
      const result = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Get-Controllers' },
          ],
        },
      });
      testMemory = result.Memory;
    });

    it('should not allow submitting the proposal from a non-controller', async () => {
      const result = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
            { name: 'Controller', value: 'non-controller' },
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
      assert.equal(actionTag.value, 'Invalid-Propose-Add-Controller-Notice');
      const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
      assert(errorTag.value.includes('Sender is not a registered Controller!'));
      assert(replyMessage.Data.includes('Sender is not a registered Controller!'));
    });

    it('should not allow proposing an existing controller', async () => {
      const result = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
            { name: 'Controller', value: PROCESS_OWNER },
          ],
        },
        mem: testMemory,
      });
      assert.equal(result.Messages?.length, 1, "Expected one message");
      const replyMessage = result.Messages[0];
      const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
      assert.notEqual(actionTag, undefined, "Expected an action tag");
      assert.equal(actionTag.value, 'Invalid-Propose-Add-Controller-Notice');
      const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
      assert(errorTag.value.includes('Controller already exists'));
      assert(replyMessage.Data.includes('Controller already exists'));
    });

    it('should require a Controller tag', async () => {
      const result = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
          ],
        },
        mem: testMemory,
      });
      const replyMessage = result.Messages[0];
      const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
      assert.notEqual(actionTag, undefined, "Expected an action tag");
      assert.equal(actionTag.value, 'Invalid-Propose-Add-Controller-Notice');
      const errorTag = replyMessage.Tags.find(tag => tag.name === 'Error');
      assert(errorTag.value.includes('Controller is required'));
      assert(replyMessage.Data.includes('Controller is required'));
    });

    it('should successfully create a proposal', async () => {
      const result = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
            { name: 'Controller', value: 'new-controller' },
          ],
        },
        mem: testMemory,
      });
      const replyMessage = result.Messages[0];
      const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
      assert.notEqual(actionTag, undefined, "Expected an action tag");
      assert.equal(actionTag.value, 'Propose-Add-Controller-Notice');
      assert.deepEqual(JSON.parse(replyMessage.Data), {
        proposalNumber: 1,
        yays: [],
        nays: [],
        proposalName: "Add-Controller_new-controller",
        controller: 'new-controller',
        type: "Add-Controller",
      });

      const getProposalsResult = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Get-Proposals' },
          ],
        },
        mem: result.Memory,
      });
      const proposals = JSON.parse(getProposalsResult.Messages[0].Data);
      assert.deepEqual(proposals, {
        "Add-Controller_new-controller": {
          proposalNumber: 1,
          yays: [],
          nays: [],
          controller: 'new-controller',
          type: "Add-Controller",
        }
      });
    });

    it('should allow casting a "Yay" vote along with the proposal', async () => {
      const result = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
            { name: 'Controller', value: 'new-controller' },
            { name: 'Vote', value: 'Yay' },
          ],
        },
        mem: testMemory,
      });
      const replyMessage = result.Messages[0];
      const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
      assert.notEqual(actionTag, undefined, "Expected an action tag");
      assert.equal(actionTag.value, 'Propose-Add-Controller-Notice');
      assert.deepEqual(JSON.parse(replyMessage.Data), {
        proposalNumber: 1,
        yays: {
          [PROCESS_OWNER]: true
        },
        nays: [],
        proposalName: "Add-Controller_new-controller",
        controller: 'new-controller',
        type: "Add-Controller",
      });

      // The proposal should now be completed
      const getProposalsResult = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Get-Proposals' },
          ],
        },
        mem: result.Memory,
      });
      const proposals = JSON.parse(getProposalsResult.Messages[0].Data);
      assert.deepEqual(proposals, []);

      // The controller should now be added
      const getControllersResult = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Get-Controllers' },
          ],
        },
        mem: result.Memory,
      });
      assert.deepEqual(JSON.parse(getControllersResult.Messages[0].Data), {
        [PROCESS_OWNER]: true,
        ['new-controller']: true,
      });
    });

    it('should allow casting a "Nay" vote along with the proposal', async () => {
      const result = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Propose-Add-Controller' },
            { name: 'Controller', value: 'new-controller' },
            { name: 'Vote', value: 'nay' },
          ],
        },
        mem: testMemory,
      });
      const replyMessage = result.Messages[0];
      const actionTag = replyMessage.Tags.find(tag => tag.name === 'Action');
      assert.notEqual(actionTag, undefined, "Expected an action tag");
      assert.equal(actionTag.value, 'Propose-Add-Controller-Notice');
      assert.deepEqual(JSON.parse(replyMessage.Data), {
        proposalNumber: 1,
        yays: [],
        nays: {
          [PROCESS_OWNER]: true
        },
        proposalName: "Add-Controller_new-controller",
        controller: 'new-controller',
        type: "Add-Controller",
      });

      // The proposal should now be completed
      const getProposalsResult = await handle({
        options: {
          Tags: [
            { name: 'Action', value: 'Get-Proposals' },
          ],
        },
        mem: result.Memory,
      });
      const proposals = JSON.parse(getProposalsResult.Messages[0].Data);
      assert.deepEqual(proposals, []);
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
  });

  describe("Vote", () => {
    describe("for a proposal to add a controller", () => {
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
        const getProposalsResult = await handle({
          options: {
            Tags: [
              { name: 'Action', value: 'Get-Proposals' },
            ],
          },
          mem: result.Memory,
        });
        const proposals = JSON.parse(getProposalsResult.Messages[0].Data);
        assert.deepEqual(proposals, []);
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
        const getProposalsResult = await handle({
          options: {
            Tags: [
              { name: 'Action', value: 'Get-Proposals' },
            ],
          },
          mem: result2.Memory,
        });
        const proposals = JSON.parse(getProposalsResult.Messages[0].Data);
        assert.deepEqual(proposals, []);
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
          const controllersResult = await handle({
            options: {
              Tags: [{ name: 'Action', value: 'Get-Controllers' }],
            },
            mem: result.Memory,
          });
          assert.deepStrictEqual(JSON.parse(controllersResult.Messages?.[0]?.Data), {
            [PROCESS_OWNER]: true,
            ['new-controller']: true,
          });
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
        const getProposalsResult = await handle({
          options: {
            Tags: [
              { name: 'Action', value: 'Get-Proposals' },
            ],
          },
          mem: result2.Memory,
        });
        const proposals = JSON.parse(getProposalsResult.Messages[0].Data);
        assert.deepEqual(proposals, []);

        // Ensure that the new controller is now added
        const getControllersResult = await handle({
          options: {
            Tags: [
              { name: 'Action', value: 'Get-Controllers' },
            ],
          },
          mem: result2.Memory,
        });
        assert.deepEqual(JSON.parse(getControllersResult.Messages[0].Data), {
          [PROCESS_OWNER]: true,
          ['new-controller']: true,
          ['new-controller2']: true,
        });
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
        const getProposalsResult = await handle({
          options: {
            Tags: [
              { name: 'Action', value: 'Get-Proposals' },
            ],
          },
          mem: result2.Memory,
        });
        const proposals = JSON.parse(getProposalsResult.Messages[0].Data);
        assert.deepEqual(proposals, []);

        // Ensure that the controller was NOT added
        const getControllersResult = await handle({
          options: {
            Tags: [
              { name: 'Action', value: 'Get-Controllers' },
            ],
          },
          mem: result2.Memory,
        });
        assert.deepEqual(JSON.parse(getControllersResult.Messages[0].Data), {
          [PROCESS_OWNER]: true,
          ['new-controller']: true,
        });
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
        const getProposalsResult = await handle({
          options: {
            Tags: [
              { name: 'Action', value: 'Get-Proposals' },
            ],
          },
          mem: result2.Memory,
        });
        const proposals = JSON.parse(getProposalsResult.Messages[0].Data);
        assert.deepEqual(proposals, []);

        // Ensure that the controller was NOT added
        const getControllersResult = await handle({
          options: {
            Tags: [
              { name: 'Action', value: 'Get-Controllers' },
            ],
          },
          mem: result2.Memory,
        });
        assert.deepEqual(JSON.parse(getControllersResult.Messages[0].Data), {
          [PROCESS_OWNER]: true,
          ['new-controller']: true,
        });
      });
    });
  });
});
