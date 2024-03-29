import { BigNumber } from "ethers";
import { RAD, WAD, RAY } from "./constants";

function wdiv(x: BigNumber, y: BigNumber) {
  return x.mul(WAD).add(y.div(2)).div(y);
}

function rdiv(x: BigNumber, y: BigNumber) {
  return x.mul(RAY).add(y.div(2)).div(y);
}

function rmul(x: BigNumber, y: BigNumber) {
  return x.mul(y).add(RAY.div(2)).div(RAY);
}

function rpow(x: BigNumber, n: number) {
  let z = n % 2 != 0 ? x : RAY;

  for (n /= 2; n != 0; n /= 2) {
    n = Math.floor(n);
    x = rmul(x, x);

    if (n % 2 != 0) {
      z = rmul(z, x);
    }
  }
  return z;
}

export { wdiv, rdiv, rmul, rpow };
