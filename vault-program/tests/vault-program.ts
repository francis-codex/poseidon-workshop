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