# vAOt - A Lightweight Proposal and Voting System in AO
![image](https://github.com/user-attachments/assets/f89c8c96-911c-4cfc-8ba9-f63502690553)

Propse and vAOt to:
- add other wallet addresses, known as Controllers, that will have the right to propose votes and vote on proposals
- remove existing controllers
- have the process send an `Eval` message to another AO process (think: multi-sig-like. remote process control)

# Handlers
- Action: Propose; Proposal-Type: Add-Controller/Remove-Controller/Eval; Controller: <wallet address>/Process-Id: <process ID for Eval targeting>; Vote: yay/nay (OPTIONAL)
- Action: Vote; Proposal-ID: <proposal ID string>; Vote: yay/nay
- Action: Get-Controllers
- Action: Get-Proposals
