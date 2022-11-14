import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "ethers";

// declare namespace Probity {
//   export interface ConsoleTableRow = {
//     "Contract Name": string;
//     "Contract Address": string;
//   };
//   export interface ContractDict {
//     [key: string]: ContractFactory;
//   }
//   export interface Deployment = {
//     contracts: ContractDict;
//     signers: SignerDict;
//   };
//   export enum Environment {
//     Development = "DEV",
//     Production = "PROD"
//   }
//   export interface SignerDict {
//     owner?: SignerWithAddress;
//     alice?: SignerWithAddress;
//     bob?: SignerWithAddress;
//     charlie?: SignerWithAddress;
//     don?: SignerWithAddress;
//     lender?: SignerWithAddress;
//     borrower?: SignerWithAddress;
//     liquidator?: SignerWithAddress;
//     addrs?: SignerWithAddress[];
//   }  
// }
export interface Deployment = {
  contracts: ContractDict;
  signers: SignerDict;
};