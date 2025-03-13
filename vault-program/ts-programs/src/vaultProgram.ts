import { Account, Pubkey, Result, Signer, SystemAccount, SystemProgram, UncheckedAccount, u64, u8 } from "@solanaturbine/poseidon";

/**
 * A Solana program for managing a simple SOL vault using Poseidon framework
 * Allows users to create vaults, deposit and withdraw SOL
 */
export default class VaultProgram {
    // Unique identifier for this program on Solana blockchain
    static PROGRAM_ID = new Pubkey("CsSzWLts5c6Aw9Ab6FMKDd7XGJ2SdhJgkZm5TbY3nhdQ");

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