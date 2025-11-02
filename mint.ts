import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import fs from 'fs';

async function main() {
  const TOKEN_NAME = "Shmelya_Longshaggydoggo";
  const TOKEN_SYMBOL = "SHMELYA";
  const TOKEN_URI = "https://ipfs.io/ipfs/bafkreihr7jvkfejam6enwqlazrureik433h23iwiggt7drrbcbhdl2q7ca";
  const DECIMALS = 6;
  const AMOUNT_TO_MINT = 1_000_000;

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const secretKey = JSON.parse(fs.readFileSync(
    process.env.HOME + '/.config/solana/id.json', 'utf8'));
  const wallet = Keypair.fromSecretKey(
    new Uint8Array(secretKey));
  console.log("Payer:", wallet.publicKey.toBase58());

  const mintKeypair = Keypair.generate();
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const createMintIx = SystemProgram.createAccount({
    fromPubkey: wallet.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    space: MINT_SIZE,
    lamports,
    programId: TOKEN_PROGRAM_ID,
  });

  const initMintIx = createInitializeMintInstruction(
    mintKeypair.publicKey,
    DECIMALS,
    wallet.publicKey,
    null,
    TOKEN_PROGRAM_ID
  );

  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mintKeypair.publicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );

  const createMetadataIx = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPda,
      mint: mintKeypair.publicKey,
      mintAuthority: wallet.publicKey,
      payer: wallet.publicKey,
      updateAuthority: wallet.publicKey,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name: TOKEN_NAME,
          symbol: TOKEN_SYMBOL,
          uri: TOKEN_URI,
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      },
    }
  );

  const owner = wallet.publicKey;
  const ata = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    owner,
    false,
    TOKEN_PROGRAM_ID
  );

  const createAtaIx = createAssociatedTokenAccountInstruction(
    wallet.publicKey,
    ata,
    owner,
    mintKeypair.publicKey,
    TOKEN_PROGRAM_ID
  );

  const mintToIx = createMintToInstruction(
    mintKeypair.publicKey,
    ata,
    wallet.publicKey,
    AMOUNT_TO_MINT,
    [],
    TOKEN_PROGRAM_ID
  );

  const tx = new Transaction().add(
    createMintIx,
    initMintIx,
    createMetadataIx,
    createAtaIx,
    mintToIx
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [wallet, mintKeypair], {
    commitment: "confirmed",
  });

  console.log("Signature:", sig);
  console.log("Mint:     https://explorer.solana.com/address/" + mintKeypair.publicKey.toBase58() + "?cluster=devnet");
  console.log("ATA:      https://explorer.solana.com/address/" + ata.toBase58() + "?cluster=devnet");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});