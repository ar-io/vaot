# vAOt - A Lightweight Proposal and Voting System in AO

![image](https://github.com/user-attachments/assets/f89c8c96-911c-4cfc-8ba9-f63502690553)

Propose and vAOt to:

- add other wallet addresses, known as Controllers, that will have the right to propose votes and vote on proposals
- remove existing controllers
- have the process send an `Eval` message to another AO process (think: multi-sig-like, remote process control) or to itself (e.g. for controllers-sanctioned upgrades or customization of the process)

Suggested workflow for controlling processes with multi-sig-like protections:

1. Instantiate a vAOt process. The initial `Owner` of the vAOt process will be the process creator.
2. Assign ownership of the vAOt process to either: a) the process itself if you want Controllers to manage upgrades or Ownership or state changes of the vAOt process or b) nil if you want the vAOt process to remain unowned
3. Add other Controllers via proposal and voting workflows.
4. Assign the `Owner` of a target process that you'd like to manage via vAOt to the vAOt process. The Controllers can now collectively manage the target process via proposal and voting workflows.

## Handlers

### Action: Propose

Active Controllers may create proposals at any time and may also cast their vote at the time of the proposal's creation.

Required:

```json
{
  "Action": "Propose",
  "Proposal-Type": "Add-Controller"/"Remove-Controller"/"Eval"
}
```

Required for Add/Remove-Controller `Proposal-Type`:

```json
{
  "Controller": "<AO-supported wallet address to use for Add/Remove-Controller"
}
```

Required for Eval `Proposal-Type`:

Tags:

```json
{
  "Process-Id": "<AO Process ID to target for Eval>"
}
```

Data:

```text
<Eval string to send to target Process-Id>
```

Optional for all `Proposal-Type`s:

```json
{
  "Vote": "yay" or "nay"
}
```

### Action: Vote

Any current Controller can cast a vote on an In-Progress Proposal. Proposals are completed when either:

- a (round_down(Num Controllers / 2) + 1) majority has voted "yay", e.g. 1/1, 2/2, 2/3, 3/4, 3/5, 4/6, etc.
- a majority of "yay"s can no longer be established, e.g. "nay"s votes are 1/2, 2/4, 3/6, etc.

If the deciding vote Passes the proposal, the proposal is immediately implemented.

If the outcome of a proposal is to remove a Controller, that Controller's existing votes on In-Progress proposals are revoked. In-Progress proposals are then re-evaluated for quorum immediately and may or may not reach a passable or failed outcome at that time. Proposal re-evaluation is handled in `Proposal-Number` order, i.e. the order in which proposals were created.

Required:

```json
{
  "Action": "Vote",
  "Proposal-Id": "<Proposal ID string>"
  "Vote": "yay" or "nay"
}
```

### Action: Revoke-Proposal

Allows the Controller that proposed a proposal to revoke it before it is finalized.

Required:

```json
{
  "Action": "Revoke-Proposal",
  "Proposal-Number": "<Proposal-Number string>"
}
```

### Action: Get-Controllers

Retrieve the current controller list

### Action: Get-Proposals

Retrieve the current set of active proposals. NOTE: Completed proposals are dropped from state.
