import { APR_TO_MPR, MAX_APR, WAD, RAY } from "./constants";
import { rdiv, wdiv } from "./math";
import { BigNumber } from "ethers";

function mpr(numerator: BigNumber, denominator: BigNumber) {
  const utilRatio = wdiv(numerator, denominator);
  return BigNumber.from(APR_TO_MPR[apr(utilRatio).toString()]);
}

function apr(utilRatio: BigNumber) {
  let apr;
  if (utilRatio.gte(WAD)) {
    return MAX_APR;
  } else {
    const oneMinusUtilization = RAY.sub(utilRatio.mul(1e9));
    const oneDividedByOneMinusUtilization = rdiv(
      RAY.div(100),
      oneMinusUtilization
    );

    const round = RAY.div(400);
    apr = oneDividedByOneMinusUtilization.add(RAY);
    apr = apr.add(round.sub(1)).div(round).mul(round);
    if (apr > MAX_APR) {
      apr = MAX_APR;
    }
  }
  return apr;
}

export { apr, mpr };
