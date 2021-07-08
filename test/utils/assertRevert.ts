import { expect } from "chai";

async function assertRevert(promise, errorString) {
  try {
    await promise;
  } catch (err) {
    expect(err.message).to.include(errorString);
  }
}

export default assertRevert;
