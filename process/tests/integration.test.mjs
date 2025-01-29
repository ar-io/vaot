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
          yays: {
            [PROCESS_OWNER]: true
          },
          nays: [],
          controller: 'new-controller',
          type: "Add-Controller",
        }
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
          nays: {
            [PROCESS_OWNER]: true
          },
          controller: 'new-controller',
          type: "Add-Controller",
        }
      });
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
});
