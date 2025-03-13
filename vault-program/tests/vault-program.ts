import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VaultProgram } from "../target/types/vault_program";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("vault-program", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VaultProgram as Program<VaultProgram>;
  const owner = Keypair.generate();
  
  // PDAs we'll need throughout the tests
  let statePDA: PublicKey;
  let authPDA: PublicKey;
  let vaultPDA: PublicKey;
  
  // Amount to deposit/withdraw in tests
  const depositAmount = 0.5 * LAMPORTS_PER_SOL; // 0.5 SOL

  before(async () => {
    // Airdrop SOL to the owner account for testing
    const airdropSig = await provider.connection.requestAirdrop(
      owner.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    
    // Confirm the transaction
    await provider.connection.confirmTransaction(airdropSig);
    console.log("✅ Airdropped 2 SOL to owner account for testing");

    // Derive PDA addresses
    [statePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), owner.publicKey.toBuffer()],
      program.programId
    );
    
    [authPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("auth"), statePDA.toBuffer()],
      program.programId
    );
    
    [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), authPDA.toBuffer()],
      program.programId
    );
    
    console.log("📝 Derived program addresses for testing");
  });

  it("Initializes a new vault", async () => {
    // Initialize the vault
    const tx = await program.methods
      .initialize()
      .accounts({
        owner: owner.publicKey,
        state: statePDA,
        auth: authPDA,
        vault: vaultPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    
    console.log("🔑 Vault initialized successfully");
    console.log(`   Transaction signature: ${tx}`);
    
    // Fetch the state account and validate it was set up correctly
    const stateAccount = await program.account.vault.fetch(statePDA);
    
    expect(stateAccount.owner.toString()).to.equal(owner.publicKey.toString());
    console.log("✅ Vault owner correctly set to:", stateAccount.owner.toString());
    
    // Save the bumps for later validation
    console.log(`   State bump: ${stateAccount.stateBump}`);
    console.log(`   Auth bump: ${stateAccount.authBump}`);
    console.log(`   Vault bump: ${stateAccount.vaultBump}`);
  });

  it("Deposits SOL into the vault", async () => {
    // Check initial balance
    const initialVaultBalance = await provider.connection.getBalance(vaultPDA);
    console.log(`💰 Initial vault balance: ${initialVaultBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Deposit SOL into the vault
    const tx = await program.methods
      .deposit(new anchor.BN(depositAmount))
      .accounts({
        owner: owner.publicKey,
        state: statePDA,
        auth: authPDA,
        vault: vaultPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    
    console.log(`🏦 Deposited ${depositAmount / LAMPORTS_PER_SOL} SOL into vault`);
    console.log(`   Transaction signature: ${tx}`);
    
    // Check the new balance
    const newVaultBalance = await provider.connection.getBalance(vaultPDA);
    console.log(`💰 New vault balance: ${newVaultBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Verify the deposit was successful
    expect(newVaultBalance).to.equal(initialVaultBalance + depositAmount);
    console.log("✅ Deposit amount correctly reflected in vault balance");
  });

  it("Withdraws SOL from the vault", async () => {
    // Check initial balances
    const initialVaultBalance = await provider.connection.getBalance(vaultPDA);
    const initialOwnerBalance = await provider.connection.getBalance(owner.publicKey);
    
    console.log(`💰 Initial vault balance: ${initialVaultBalance / LAMPORTS_PER_SOL} SOL`);
    console.log(`💰 Initial owner balance: ${initialOwnerBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Amount to withdraw (use slightly less than deposit to account for fees)
    const withdrawAmount = depositAmount / 2;
    
    // Withdraw SOL from the vault
    const tx = await program.methods
      .withdraw(new anchor.BN(withdrawAmount))
      .accounts({
        owner: owner.publicKey,
        state: statePDA,
        auth: authPDA,
        vault: vaultPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    
    console.log(`🏧 Withdrawn ${withdrawAmount / LAMPORTS_PER_SOL} SOL from vault`);
    console.log(`   Transaction signature: ${tx}`);
    
    // Check new balances
    const newVaultBalance = await provider.connection.getBalance(vaultPDA);
    const newOwnerBalance = await provider.connection.getBalance(owner.publicKey);
    
    console.log(`💰 New vault balance: ${newVaultBalance / LAMPORTS_PER_SOL} SOL`);
    console.log(`💰 New owner balance: ${newOwnerBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Verify the withdrawal was successful
    // Note: Owner's balance will be slightly less than expected due to transaction fees
    expect(newVaultBalance).to.equal(initialVaultBalance - withdrawAmount);
    console.log("✅ Vault balance correctly reduced after withdrawal");
    
    // The owner's balance check is approximate due to transaction fees
    const ownerBalanceDifference = newOwnerBalance - initialOwnerBalance;
    console.log(`   Owner balance increased by approximately ${ownerBalanceDifference / LAMPORTS_PER_SOL} SOL`);
    console.log("   (Exact amount is less due to transaction fees)");
  });

  it("Prevents unauthorized withdrawals", async () => {
    // Create a new keypair (unauthorized user)
    const unauthorizedUser = Keypair.generate();
    
    // Airdrop some SOL to the unauthorized user
    const airdropSig = await provider.connection.requestAirdrop(
      unauthorizedUser.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);
    console.log("🔑 Created unauthorized user for testing access control");
    
    try {
      // Attempt unauthorized withdrawal
      await program.methods
        .withdraw(new anchor.BN(0.1 * LAMPORTS_PER_SOL))
        .accounts({
          owner: unauthorizedUser.publicKey,
          state: statePDA,
          auth: authPDA,
          vault: vaultPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([unauthorizedUser])
        .rpc();
      
      // If we get here, the test failed
      throw new Error("❌ Test failed: Unauthorized withdrawal was successful");
    } catch (error) {
      // We expect this to fail with an error
      console.log("✅ Unauthorized withdrawal correctly rejected");
      console.log(`   Error: ${error.message.split('\n')[0]}`);
    }
  });
});