import * as dotenv from "dotenv";
import * as hre from "hardhat";
dotenv.config();

const possibleTokens = ["CFLR", "FLR", "SGB", "XRP", "ETH"];

export default (): string => {
  const networkName = hre.network.name;

  let nativeToken = process.env.NATIVE_TOKEN?.toUpperCase();
  if (
    ["localhost", "local", "internal"].includes(networkName) &&
    !process.env.NATIVE_TOKEN
  )
    throw Error("Must set the NATIVE_TOKEN environment variable.");
  if (!possibleTokens.includes(process.env.NATIVE_TOKEN!?.toUpperCase()))
    throw Error("Invalid native token type.");
  else {
    if (networkName === "songbird") nativeToken = "SGB";
    if (networkName === "flare") nativeToken = "FLR";
  }

  return nativeToken!;
};
