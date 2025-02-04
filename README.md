# vAOt - A Lightweight Proposal and Voting System in AO

![image](https://github.com/user-attachments/assets/f89c8c96-911c-4cfc-8ba9-f63502690553)

Propse and vAOt to:

- add other wallet addresses, known as Controllers, that will have the right to propose votes and vote on proposals
- remove existing controllers
- have the process send an `Eval` message to another AO process (think: multi-sig-like, remote process control)

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

Required for Add/Remove-Controller Proposal-Type:

```json
{
  "Controller": "<AO-supported wallet address to use for Add/Remove-Controller"
}
```

Required for Eval Proposal Type:

```json
{
  "Process-Id": "<AO Process ID to target for Eval>",
  "Data": "<Eval string to send to target Process-Id>"
}
```

Optional for all Proposal-Types:

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

Required:

```json
{
  "Action": "Vote",
  "Proposal-Id": "<Proposal ID string>"
  "Vote": "yay" or "nay"
}
```

### Action: Get-Controllers

Retrieve the current controller list

### Action: Get-Proposals

Retrieve the current set of active proposals. NOTE: Completed proposals are dropped from state.
