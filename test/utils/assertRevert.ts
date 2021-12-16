import { expect } from "chai";

async function assertRevert(promise, errorString) {
  try {
    await promise;
    throw new Error("Assert Revert call did not throw an revert");
  } catch (err) {
    expect(err.message).to.include(errorString);
  }
}

export default assertRevert;
