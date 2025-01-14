# ARIO Airdrop Registration

This repository contains two main components for managing the $ARIO token airdrop registration system:

## Process

The `process/` directory contains the Lua-based AO process code that manages the $ARIO token airdrop registration. This includes:

- Core airdrop distribution logic
- Recipient validation and verification
- Manage airdrop wallets and airdrop amounts

## App

The `app/` directory contains a React application that provides the user interface for airdrop registration. Key features:

- Connect wallet and verify eligibility
- Claim airdrop rewards
- View claim status and history
- Direct integration with the AO process via `@permaweb/aoconnect`
