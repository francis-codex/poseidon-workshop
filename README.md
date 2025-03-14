# Poseidon Workshop

## Overview

This tutorial is for people without experience in Rust who want to write a Solana program in TypeScript quickly. Poseidon will help you transpile your TypeScript code into the Anchor Solana framework, allowing you to understand how Solana works through practical examples.

Please note that if your goal is to become a protocol engineer on Solana, you'll eventually need to learn Anchor and Rust to understand how Solana works at a lower level.

Without further ado, let’s get your hands dirty!

## Environment Setup

### Prerequisites

> If you’ve already installed Solana and Anchor, feel free to skip the `prerequisites` part

During this tutorial, we will be using the following tools:

```bash
$ rustup --version
rustup 1.27.1 (54dd3d00f 2024-04-24)
$ solana --version
solana-cli 2.0.17 (src:aab790b8; feat:607245837, client:Agave)
 yarn --version
1.22.22
$ anchor --version
anchor-cli 0.29.0
```

If you haven't installed all of them yet, go to [Solana Installation Guide]((https://solana.com/docs/intro/installation))

### Install Poseidon

```bash
git clone https://github.com/Turbin3/poseidon.git
cd poseidon
# Build poseidon binary file
cargo build --release
```

## Make Poseidon Accessible System-wide

### Linux
1. **Copy to PATH**: `sudo cp target/release/poseidon /usr/local/bin/`
2. **Update PATH**: Add `export PATH="$PATH:/path/to/poseidon/target/release"` to `~/.bashrc`
3. **Create alias**: Add `alias poseidon="/path/to/poseidon/target/release/poseidon"` to `~/.bashrc`

### macOS
1. **Copy to PATH**: `sudo cp target/release/poseidon /usr/local/bin/`
2. **Update PATH**: Add `export PATH="$PATH:/path/to/poseidon/target/release"` to `~/.zshrc` or `~/.bash_profile`
3. **Create alias**: Add `alias poseidon="/path/to/poseidon/target/release/poseidon"` to `~/.zshrc` or `~/.bash_profile`

### Windows
1. **Copy to PATH**: Copy `target\release\poseidon.exe` to `C:\Windows\System32\`
2. **Update PATH**: Add poseidon directory to PATH via System Properties → Environment Variables
3. **Create shortcut**: Create a batch file (`poseidon.bat`) with `@echo off` and `C:\path\to\poseidon\target\release\poseidon.exe %*`

Congratulations! You’ve completed the most challenging part! Setting up the environment can be a hassle, but once it's done, the rest will be much simpler and easier.

## Your First Solana Program with TypeScript

> We’ll build a simple vault program with three instructions: `initialize`, `deposit`, and `withdraw`.

Remember what Poseidon does for you? Here’s a quick recap:

> Poseidon helps by transpiling your TypeScript code into Anchor.

Let’s use `poseidon init` to set up a scaffold, and then we can start writing our program in TypeScript.

```bash
# Feel free to switch to wherever you prefer.
$ poseidon init vault-program
```

## Imports and Program Declaration
The program is defined as a TypeScript class with a static PROGRAM_ID specifying the program ID. The `@solanaturbine/poseidon` package provides the necessary types for defining instructions, such as Rust types (`u8`, `u64`, `i8`, `i128`, `boolean`, `string`), SPL types (`Pubkey`, `AssociatedTokenAccount`, `Mint`, `TokenAccount`, `TokenProgram`) and Anchor account types (`Signer`, `UncheckedAccount`, `SystemAccount`).

```typescript
import { Account, Pubkey, Result, Signer, SystemAccount, SystemProgram, UncheckedAccount, u64, u8 } from "@solanaturbine/poseidon";

export default class VaultProgram {
    static PROGRAM_ID = new Pubkey("update with you program id");
```

## Instructions
We typically define methods inside the program class to define instructions with Poseidon. The context for each instruction is implicit in the method parameters. To define an account as a program derived address (PDA) with `@solanaturbine/poseidon`, we use the `derive` method to specify the seed as the first parameter within an array.

```typescript
   /**
     * Creates a new vault owned by the signer
     * @param owner The account that will own this vault
     * @param state Account to store vault configuration data
     * @param auth Intermediary account for security
     * @param vault Account where SOL will be stored
     */
    initialize(
        owner: Signer,
        state: Vault,
        auth: UncheckedAccount,
        vault: SystemAccount
    ): Result {
        // Create deterministic addresses (PDAs) for each account
        auth.derive(['auth', state.key])
        state.derive(['state', owner.key]).init(owner)
        vault.derive(['vault', auth.key])
        
        // Store owner's address in vault state
        state.owner = owner.key;
        
        // Store bump seeds for future PDA derivation
        state.stateBump = state.getBump()
        state.authBump = auth.getBump()
        state.vaultBump = vault.getBump()
    }

    /**
     * Deposits SOL into the vault
     * @param owner Vault owner who is sending SOL
     * @param state Vault configuration account
     * @param auth Security account
     * @param vault Account receiving the SOL
     * @param amount Amount of SOL to deposit
     */
    deposit(
        owner: Signer,
        state: Vault,
        auth: UncheckedAccount,
        vault: SystemAccount,
        amount: u64
    ) {
        // Re-derive all account addresses using stored bumps
        state.deriveWithBump(['state', owner.key], state.stateBump)
        auth.deriveWithBump(['auth', state.key], state.authBump)
        vault.deriveWithBump(['vault', auth.key], state.vaultBump)
        
        // Transfer SOL from owner to vault
        SystemProgram.transfer(
            owner, // from
            vault, // to
            amount // amount in lamports
        )
    }

    /**
     * Withdraws SOL from the vault to the owner
     * @param owner Vault owner receiving SOL
     * @param state Vault configuration account
     * @param auth Security account
     * @param vault Account that holds the SOL
     * @param amount Amount of SOL to withdraw
     */
    withdraw(
        owner: Signer,
        state: Vault,
        auth: UncheckedAccount,
        vault: SystemAccount,
        amount: u64
    ) {        
        // Re-derive all account addresses using stored bumps
        state.deriveWithBump(['state', owner.key], state.stateBump)
        auth.deriveWithBump(['auth', state.key], state.authBump)
        vault.deriveWithBump(['vault', auth.key], state.vaultBump)
        
        // Transfer SOL from vault to owner
        // The seeds are required because vault is a PDA and needs program signature
        SystemProgram.transfer(
            vault,
            owner,
            amount,
            ['vault', state.key, state.authBump]
        )
    }
}
```

## Account State
Custom state accounts are defined as an interface that extends Account. The fields of the custom state account can be defined using types from the `@solanaturbine/Poseidon` package.

```typescript
/**
 * Structure for vault state data
 * Stores ownership and PDA derivation information
 */
export interface Vault extends Account {
    owner: Pubkey      // Public key of vault owner
    stateBump: u8      // Bump seed for state PDA
    authBump: u8       // Bump seed for auth PDA
    vaultBump: u8      // Bump seed for vault PDA
}
```

Open `vault-program/ts-programs/vaultProgram.ts` in VS Code (or any IDE you prefer), Replace the code with this:

```typescript
import { Account, Pubkey, Result, Signer, SystemAccount, SystemProgram, UncheckedAccount, u64, u8 } from "@solanaturbine/poseidon";

export default class VaultProgram {
    static PROGRAM_ID = new Pubkey("update with your program id");

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

export interface Vault extends Account {
    owner: Pubkey      
    stateBump: u8      
    authBump: u8       
    vaultBump: u8      
}
```

If a user wants to store anything on Solana, such as `VaultState` in this case, they’ll need to pay [rent](https://docs.solanalabs.com/implemented-proposals/rent) for the space they’re using, as validators need to store the data on their hardware. To cover this rent, we add `owner` with the `Signer` type as a parameter, allowing the user to transfer their SOL to the `VaultState` account to pay for the rent.

We’ve mentioned PDA several times, but what is it? [PDA](https://solana.com/docs/core/pda) (Program Derived Address) is an important concept on Solana. It allows an account to be controlled by a specified program. To construct a PDA, you need a seed—a byte array that can be derived from a string, public key, integer, or even combinations of these!

Every time you use a PDA, you’ll need to specify its seed, but only when creating the account do you need to chain the `init()` at the end.
When you're initializing an account, Poseidon automatically adds the SystemProgram account to the account struct. 

The final step to complete this program is to run the command below to get your correct program ID and replace, if the program ID is not synced yet.

```bash
$ poseidon sync
```

## Test Your Program!

It’s time to verify that the program works as expected! Let’s use the Poseidon command with Anchor to make the magic happen 😉 If you type `poseidon --help` in your terminal, you’ll see:

```bash
poseidon --help
Usage: poseidon <COMMAND>

Commands:
  build    Build Typescript programs in workspace
  test     Run anchor tests in the workspace
  sync     Sync anchor keys in poseidon programs
  compile  Transpile a Typescript program to a Rust program
  init     Initializes a new workspace
  help     Print this message or the help of the given subcommand(s)

Options:
  -h, --help     Print help
  -V, --version  Print version
```

We’ll use the TypeScript code to generate and replace the Rust code that Anchor generated for us. If you’ve followed this tutorial step-by-step, your program structure (under the `vault_program` folder) should be similar to this(not necessarily be the same thing:

```bash
├── .anchor
├── app
├── migrations
│   └── deploy.ts
├── package.json
├── programs
│   └── vault-program
│       ├── Cargo.toml
│       ├── Xargo.toml
│       └── src
│           └── lib.rs      <--------- Output Rust file
├── target
│   └── deploy
│       └── vault_program-keypair.json
├── tests
│   └── vault_program.ts
├── ts-programs
│   ├── package.json
│   └── src
│       └── vaultProgram.ts  <--------- Input Typescript file
├── tsconfig.json
└── yarn.lock
```

If you’re in the root directory of the program, use the following command:

```bash
poseidon build
```

And if you're not in the root directory or just want to compile by specifying the location, use the following command:

```bash
poseidon compile -i ts-programs/src/voteProgram.ts -o programs/vote-program/src/lib.rs
```

Once the code is transpiled to lib.rs

```bash
anchor build
```

Let’s replace the contents of `tests/vault-program.ts` with the code below:

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

For testing it locally, we can run

```bash
poseidon test
```

This command will build the program, start a local validator with the program deployed, and run all the tests in the `tests` folder. This is a quick way to check if your program works correctly. Ideally, you should see all your tests pass like this:

```bash
  vault-program
    ✔️ Initializes the vault (1869ms)
    ✔️ Deposits SOL into the vault (458ms)
    ✔️ Withdraws SOL from the vault (553ms)


  3 passing (3s)
```

If you want to verify it on the Solana Devnet (a network for developers testing their programs), use this command:

```bash
anchor test --provider.cluster devnet
```

After all the tests have passed, you can copy the transaction IDs and verify them on [Solana’s blockchain explorer](https://explorer.solana.com/?cluster=devnet).

## Thoughts & Takeaway

Congratulations! 🎉 You've completed your first Solana program in TypeScript!

Poseidon helps by transpiling your TypeScript program into Rust using the Anchor framework format. You can check out [examples/vote/rust/vote.rs](../../examples/vote/rust/vote.rs) to see what the code looks like in Rust. This will help you better understand Rust syntax and Solana’s design principles.

After finishing this tutorial, we highly recommend going through all the resources in the reference section one-by-one. This will give you a more comprehensive understanding of how Solana works and help clarify some common jargon, such as account, PDA, rent, and more.

We hope you enjoyed this tutorial, and we look forward to seeing you in the wild but exciting Solana space!

## Reference

- [https://solana.com/docs/core/accounts](https://solana.com/docs/core/accounts)
- [https://docs.solanalabs.com/implemented-proposals/rent](https://docs.solanalabs.com/implemented-proposals/rent)
- [https://solana.com/docs/core/pda](https://solana.com/docs/core/pda)
