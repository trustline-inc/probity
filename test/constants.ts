import BigNumber from "bignumber.js";

BigNumber.config({
  POW_PRECISION: 27,
  DECIMAL_PLACES: 27,
  EXPONENTIAL_AT: 1e9,
});

export const SECONDS_IN_YEAR = 31557600;
export const RAY = new BigNumber("1e27");
export const WAD = new BigNumber("1e18");
