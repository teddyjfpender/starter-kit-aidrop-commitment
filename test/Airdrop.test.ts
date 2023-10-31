import "reflect-metadata";

import { TestingAppChain } from "@proto-kit/sdk";
import { MerkleMap, Poseidon, PrivateKey, PublicKey, UInt64 } from "o1js";
import { Balances, Airdrop } from "../src";

describe("Balances", () => {
  let appChain: TestingAppChain<{ Balances: typeof Balances; Airdrop: typeof Airdrop}>;
  let totalSupply: UInt64;
  let alicePrivateKey: PrivateKey;
  let alicePublicKey: PublicKey;
  let bobPrivateKey: PrivateKey;
  let bobPublicKey: PublicKey;
  let airdropTree: MerkleMap;
  let airdropAmount: UInt64;
  
  beforeAll(() => {
    totalSupply = UInt64.from(10_000);

    appChain = TestingAppChain.fromRuntime({
      modules: {
        Balances,
        Airdrop,
      },
      config: {
        Balances: {
          totalSupply,
        },
        Airdrop: {} as unknown
      },
    });

    const PRIVATE_KEY_0 = "EKE1h2CEeYQxDaPfjSGNNB83tXYSpn3Cqt6B3vLBHuLixZLApCpd"
    const PRIVATE_KEY_1 = "EKEU31uonuF2rhG5f8KW4hRseqDjpPVysqcfKCKxqvs7x5oRviN1"

    alicePrivateKey = PrivateKey.fromBase58(PRIVATE_KEY_0);
    alicePublicKey = alicePrivateKey.toPublicKey();
    bobPrivateKey = PrivateKey.fromBase58(PRIVATE_KEY_1);
    bobPublicKey = bobPrivateKey.toPublicKey();

    // the desired airdrop amount for bob
    airdropAmount = UInt64.from(100);

    // populate the airdrop tree
    airdropTree = new MerkleMap();
    airdropTree.set(
      // the key is the hash of the public key
      Poseidon.hash(alicePublicKey.toFields()),
      Poseidon.hash(airdropAmount.toFields())
    );
  })

  it("should demonstrate how balances work", async () => {

    await appChain.start();

    appChain.setSigner(alicePrivateKey);
    // this is almost equivalent to obtaining the contract ABI in solidity
    const balances = appChain.runtime.resolve("Balances");
    // set alice's balance to 1000
    const tx1 = appChain.transaction(alicePublicKey, () => {
      balances.setBalance(alicePublicKey, UInt64.from(1000));
    });

    await tx1.sign();
    await tx1.send();

    const startTime = new Date().getTime();
    const block1 = await appChain.produceBlock();
    const endTime = new Date().getTime();
    console.log(`Block Production time: ${endTime - startTime} milliseconds`);

    const aliceBalance = await appChain.query.runtime.Balances.balances.get(
      alicePublicKey
    );

    expect(block1?.txs[0].status).toBe(true);
    expect(aliceBalance?.toBigInt()).toBe(1000n);

    // send tokens to Bob    
    // alice's new balance is 900
    const tx2 = appChain.transaction(alicePublicKey, () => {
      balances.sendTo(bobPrivateKey.toPublicKey(), UInt64.from(100));
    }, { nonce: 1 });

    await tx2.sign();
    await tx2.send();

    const startTimeTx = new Date().getTime();
    const block2 = await appChain.produceBlock();
    const endTimeTx = new Date().getTime();
    console.log(`Block Production time (1 txs): ${endTimeTx - startTimeTx} milliseconds`);

    // check bob has 100 tokens
    const bobBalance = await appChain.query.runtime.Balances.balances.get(
      bobPublicKey
    )

    expect(bobBalance?.toBigInt()).toBe(100n);


    // resolve the airdrop module
    const airdrop = appChain.runtime.resolve("Airdrop");

    // set the rewards merkle tree root
    const tx3 = appChain.transaction(alicePublicKey, () => {
      airdrop.setAirdropCommitment(airdropTree.getRoot());
    }, { nonce: 2});

    await tx3.sign();
    await tx3.send();

    const startTimeAirdrop = new Date().getTime();
    const block3 = await appChain.produceBlock();
    const endTimeAirdrop = new Date().getTime();
    console.log(`Set Commitment, Block Production time (1 txs): ${endTimeAirdrop - startTimeAirdrop} milliseconds`);

    const airdropCommitment = await appChain.query.runtime.Airdrop.commitment.get();
    console.log("Airdrop Commitment: ", airdropCommitment?.toBigInt());
    expect(airdropCommitment?.toBigInt()).toBe(airdropTree.getRoot().toBigInt());
    expect(block3?.txs[0].status).toBe(true);

    // Alice claims her airdrop
    const tx4 = appChain.transaction(alicePublicKey, () => {
      airdrop.claim(airdropTree.getWitness(Poseidon.hash(alicePublicKey.toFields())), airdropAmount);
    }, { nonce: 3 });

    await tx4.sign();
    await tx4.send();

    const startTimeClaim = new Date().getTime();
    const block4 = await appChain.produceBlock();
    const endTimeClaim = new Date().getTime();
    console.log(`Alice Claim, Block Production time (1 txs): ${endTimeClaim - startTimeClaim} milliseconds`);

    expect(block4?.txs[0].status).toBe(true);
    // get alice's new balance
    const aliceBalanceAfterClaim = await appChain.query.runtime.Balances.balances.get(
      alicePublicKey
    );

    expect(aliceBalanceAfterClaim?.toBigInt()).toBe(1000n);
  });
});