# 🔱 Poseidon Workshop

[![Rust](https://img.shields.io/badge/Rust-1.27.1-orange)](https://www.rust-lang.org/)
[![Solana](https://img.shields.io/badge/Solana-2.0.17-blue)](https://solana.com/)
[![Anchor](https://img.shields.io/badge/Anchor-0.29.0-purple)](https://www.anchor-lang.com/)

> Write Solana programs in TypeScript, transpile to Rust/Anchor automatically

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Making Poseidon Accessible](#making-poseidon-accessible)
- [Your First Solana Program](#your-first-solana-program)
  - [Program Setup](#program-setup)
  - [Program Code](#program-code)
  - [Testing Your Program](#testing-your-program)
- [Key Concepts](#key-concepts)
- [References](#references)

## Overview

Poseidon is a tool designed for developers without Rust experience who want to quickly develop Solana programs using TypeScript. It transpiles your TypeScript code into the Anchor Solana framework, providing a practical introduction to Solana development.

**Note**: While Poseidon is an excellent starting point, eventual proficiency in Anchor and Rust is recommended for deeper understanding of Solana development.

## Prerequisites

This tutorial requires the following tools:

```bash
$ rustup --version
rustup 1.27.1 (54dd3d00f 2024-04-24)
$ solana --version
solana-cli 2.0.17 (src:aab790b8; feat:607245837, client:Agave)
$ yarn --version
1.22.22
$ anchor --version
anchor-cli 0.29.0
```

If you haven't installed these tools yet, follow the [Solana Installation Guide](https://solana.com/docs/intro/installation).

## Installation

```bash
# Clone the repository
git clone https://github.com/Turbin3/poseidon.git
cd poseidon

# Build the Poseidon binary
cargo build --release
```

## Making Poseidon Accessible

### Linux
```bash
# Copy to PATH
sudo cp target/release/poseidon /usr/local/bin/

# Update PATH (add to ~/.bashrc)
export PATH="$PATH:/path/to/poseidon/target/release"

# Create alias (add to ~/.bashrc)
alias poseidon="/path/to/poseidon/target/release/poseidon"
```

### macOS
```bash
# Copy to PATH
sudo cp target/release/poseidon /usr/local/bin/

# Update PATH (add to ~/.zshrc or ~/.bash_profile)
export PATH="$PATH:/path/to/poseidon/target/release"

# Create alias (add to ~/.zshrc or ~/.bash_profile)
alias poseidon="/path/to/poseidon/target/release/poseidon"
```

### Windows
1. Copy `target\release\poseidon.exe` to `C:\Windows\System32\`
2. Add poseidon directory to PATH via System Properties → Environment Variables
3. Create a batch file (`poseidon.bat`) with:
   ```
   @echo off
   C:\path\to\poseidon\target\release\poseidon.exe %*
   ```

## Your First Solana Program

We'll build a simple vault program with three instructions: `initialize`, `deposit`, and `withdraw`.

### Program Setup

Initialize a new Poseidon project:

```bash
poseidon init vault-program
```

### Program Code

Open `vault-program/ts-programs/vaultProgram.ts` and replace with:

```typescript
import { Account, Pubkey, Result, Signer, SystemAccount, SystemProgram, UncheckedAccount, u64, u8 } from "@solanaturbine/poseidon";

export default class VaultProgram {
    static PROGRAM_ID = new Pubkey("update with your program id");

    /**
     * Creates a new vault owned by the signer
     */
    initialize(
        owner: Signer,
        state: Vault,
        auth: UncheckedAccount,
        vault: SystemAccount
    ): Result {
        auth.derive(['auth', state.key])
        state.derive(['state', owner.key]).init(owner)
        vault.derive(['vault', auth.key])
        
        state.owner = owner.key;
        state.stateBump = state.getBump()
        state.authBump = auth.getBump()
        state.vaultBump = vault.getBump()
    }
    
    /**
     * Deposits SOL into the vault
     */
    deposit(
        owner: Signer,
        state: Vault,
        auth: UncheckedAccount,
        vault: SystemAccount,
        amount: u64
    ) {
        state.deriveWithBump(['state', owner.key], state.stateBump)
        auth.deriveWithBump(['auth', state.key], state.authBump)
        vault.deriveWithBump(['vault', auth.key], state.vaultBump)
        
        SystemProgram.transfer(
            owner, 
            vault,
            amount
        )
    }

    /**
     * Withdraws SOL from the vault to the owner
     */
    withdraw(
        owner: Signer,
        state: Vault,
        auth: UncheckedAccount,
        vault: SystemAccount,
        amount: u64
    ) {        
        state.deriveWithBump(['state', owner.key], state.stateBump)
        auth.deriveWithBump(['auth', state.key], state.authBump)
        vault.deriveWithBump(['vault', auth.key], state.vaultBump)
        
        SystemProgram.transfer(
            vault,
            owner,
            amount,
            ['vault', state.key, state.authBump]
        )
    }
}

/**
 * Structure for vault state data
 */
export interface Vault extends Account {
    owner: Pubkey      
    stateBump: u8      
    authBump: u8       
    vaultBump: u8      
}
```

Sync your program ID:

```bash
poseidon sync
```

### Testing Your Program

Replace the contents of `tests/vault-program.ts` with:

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VaultProgram } from "../target/types/vault_program";
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("vault-program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VaultProgram as Program<VaultProgram>;
  const owner = provider.wallet;

  // We'll store these for use across tests
  let statePda: PublicKey;
  let authPda: PublicKey;
  let vaultPda: PublicKey;
  let stateBump: number;
  let authBump: number;
  let vaultBump: number;

  before(async () => {
    // Generate PDAs
    [statePda, stateBump] = await PublicKey.findProgramAddress(
      [Buffer.from("state"), owner.publicKey.toBuffer()],
      program.programId
    );

    [authPda, authBump] = await PublicKey.findProgramAddress(
      [Buffer.from("auth"), statePda.toBuffer()],
      program.programId
    );

    [vaultPda, vaultBump] = await PublicKey.findProgramAddress(
      [Buffer.from("vault"), authPda.toBuffer()],
      program.programId
    );
  });

  it("Initializes the vault", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        state: statePda,
        auth: authPda,
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Fetch the created state account
    const stateAccount = await program.account.vault.fetch(statePda);
    
    // Verify the state account was initialized correctly
    expect(stateAccount.owner.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(stateAccount.stateBump).to.equal(stateBump);
    expect(stateAccount.authBump).to.equal(authBump);
    expect(stateAccount.vaultBump).to.equal(vaultBump);
  });

  it("Deposits SOL into the vault", async () => {
    const depositAmount = new anchor.BN(LAMPORTS_PER_SOL); // 1 SOL
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);

    await program.methods
      .deposit(depositAmount)
      .accounts({
        owner: owner.publicKey,
        vault: vaultPda,
        auth: authPda,
        state: statePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);
    expect(vaultBalanceAfter).to.equal(vaultBalanceBefore + depositAmount.toNumber());
  });

  it("Withdraws SOL from the vault", async () => {
    const withdrawAmount = new anchor.BN(LAMPORTS_PER_SOL / 2); // 0.5 SOL
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);
    const ownerBalanceBefore = await provider.connection.getBalance(owner.publicKey);

    try {
        await program.methods
            .withdraw(withdrawAmount)
            .accounts({
                owner: owner.publicKey,
                vault: vaultPda,
                auth: authPda,
                state: statePda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);
        const ownerBalanceAfter = await provider.connection.getBalance(owner.publicKey);

        // Account for transaction fees in owner balance check
        expect(vaultBalanceAfter).to.equal(vaultBalanceBefore - withdrawAmount.toNumber());
        expect(ownerBalanceAfter).to.be.greaterThan(ownerBalanceBefore);
    } catch (error) {
        console.error("Detailed error:", error);
        throw error;
    }
  });
});
```

Build the program with Poseidon:

```bash
poseidon build
anchor build
```

Run the tests:

```bash
# For local testing:
poseidon test

# For devnet testing:
anchor test --provider.cluster devnet
```

## Key Concepts

- **Program Derived Address (PDA)**: An account controlled by a specific program. PDAs use seeds (byte arrays derived from strings, public keys, integers, etc.) to create deterministic addresses.
- **Rent**: Payment required to store data on Solana's blockchain. Accounts must maintain sufficient SOL to cover rent for the space they utilize.
- **Transpilation**: Poseidon converts TypeScript code to Rust code in the Anchor framework format, allowing developers to write in a familiar language.

## References

- [Solana Accounts](https://solana.com/docs/core/accounts)
- [Solana Rent](https://docs.solanalabs.com/implemented-proposals/rent)
- [Program Derived Addresses](https://solana.com/docs/core/pda)

---

## 🎉 Conclusion

Congratulations on completing your first Solana program using TypeScript and Poseidon! This tutorial introduced you to fundamental Solana concepts while leveraging the convenience of TypeScript. As you continue your Solana development journey, exploring Rust and Anchor directly will provide deeper insights into the underlying mechanics.

## 📝 License

[MIT](LICENSE)
