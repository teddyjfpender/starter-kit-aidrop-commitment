import {
  RuntimeModule,
  runtimeModule,
  state,
  runtimeMethod,
} from "@proto-kit/module";

import { StateMap, assert } from "@proto-kit/protocol";
import { Bool, PublicKey, Struct, UInt64 } from "o1js";

interface SBTConfig {
  controller: PublicKey;
}

interface IProperties {
  id: UInt64;
  /* add others */
}

export class Properties extends Struct({
  id: UInt64,
}) implements IProperties {
  constructor(id: UInt64) {
      super({
          id: id,
      })
  }
}

@runtimeModule()
export class SoulBound extends RuntimeModule<SBTConfig> {
  @state() public SBTs = StateMap.from<PublicKey, Properties>(
    PublicKey,
    Properties
  );

  @runtimeMethod()
  public setBalance(address: PublicKey, properties: Properties) {
    const sbt = this.SBTs.get(address).isSome;

    assert(
      sbt.equals(Bool(false)),
      "SBT already exists"
    );

    const sender = this.transaction.sender;

    assert(
      sender.equals(this.config.controller),
      "Sender is not controller"
    );

    this.SBTs.set(address, properties);
  }
}
