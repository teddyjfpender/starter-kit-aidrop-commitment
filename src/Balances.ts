import {
  RuntimeModule,
  runtimeModule,
  state,
  runtimeMethod,
} from "@proto-kit/module";

import { State, StateMap, assert } from "@proto-kit/protocol";
import { Provable, PublicKey, UInt64 } from "snarkyjs";

interface BalancesConfig {
  totalSupply: UInt64;
}

@runtimeModule()
export class Balances extends RuntimeModule<BalancesConfig> {
  @state() public balances = StateMap.from<PublicKey, UInt64>(
    PublicKey,
    UInt64
  );

  @state() public circulatingSupply = State.from<UInt64>(UInt64);

  @state() public random = State.from<UInt64>(UInt64);

  @runtimeMethod()
  public setBalance(address: PublicKey, amount: UInt64) {
    const circulatingSupply = this.circulatingSupply.get();
    const newCirculatingSupply = circulatingSupply.value.add(amount);

    assert(
      newCirculatingSupply.lessThanOrEqual(this.config.totalSupply),
      "Circulating supply would be higher than total supply"
    );

    this.circulatingSupply.set(newCirculatingSupply);

    const currentBalance = this.balances.get(address);
    const newBalance = currentBalance.value.add(amount);

    this.balances.set(address, newBalance);
  }

  /**
     * Transfer tokens from the transaction sender to a given address.
     * 
     * @param address - The public key of the recipient address.
     * @param amount - The amount to transfer.
     * 
     * @remarks
     * This method ensures that the sender has sufficient balance before transferring.
     * The balances of the sender and recipient are updated accordingly.
     */
  @runtimeMethod()
  public sendTo(address: PublicKey, amount: UInt64) {
      // Retrieve the public key of the transaction sender
      const sender = this.transaction.sender;
      
      // Fetch current balance of the sender and recipient from the state
      const senderBalance = this.balances.get(sender);
      const recipientBalance = this.balances.get(address);

      // Ensure the sender has a balance that is greater than or equal to the amount they wish to send
      assert(
        senderBalance.value.greaterThanOrEqual(amount),
        "Sender does not have enough balance"
      );

      const senderBalanceTrue = Provable.if(
          senderBalance.value.greaterThanOrEqual(amount),
          senderBalance.value,
          senderBalance.value.add(amount)
      );
      
      // Deduct the specified amount from the sender's balance and add it to the recipient's balance
      this.balances.set(sender, senderBalanceTrue.sub(amount));
      this.balances.set(address, recipientBalance.value.add(amount));
  }
}
