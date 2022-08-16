import { expect } from "chai";

async function assertRevert(promise: Promise<any>, message: string) {
  try {
    await promise;
    throw new Error("Assert Revert call did not throw an revert");
  } catch (err: any) {
    expect(err.message).to.include(message);
  }
}

export default assertRevert;
