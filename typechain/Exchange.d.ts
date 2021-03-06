/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  ethers,
  EventFilter,
  Signer,
  BigNumber,
  BigNumberish,
  PopulatedTransaction,
} from "ethers";
import {
  Contract,
  ContractTransaction,
  Overrides,
  CallOverrides,
} from "@ethersproject/contracts";
import { BytesLike } from "@ethersproject/bytes";
import { Listener, Provider } from "@ethersproject/providers";
import { FunctionFragment, EventFragment, Result } from "@ethersproject/abi";

interface ExchangeInterface extends ethers.utils.Interface {
  functions: {
    "MIN_COLLATERAL_RATIO()": FunctionFragment;
    "ONE_HUNDRED_PERCENT()": FunctionFragment;
    "executeOrder(address,address,uint256,uint256)": FunctionFragment;
    "initializeContract()": FunctionFragment;
    "isOwner()": FunctionFragment;
    "owner()": FunctionFragment;
    "registry()": FunctionFragment;
    "teller()": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "MIN_COLLATERAL_RATIO",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "ONE_HUNDRED_PERCENT",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "executeOrder",
    values: [string, string, BigNumberish, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "initializeContract",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "isOwner", values?: undefined): string;
  encodeFunctionData(functionFragment: "owner", values?: undefined): string;
  encodeFunctionData(functionFragment: "registry", values?: undefined): string;
  encodeFunctionData(functionFragment: "teller", values?: undefined): string;

  decodeFunctionResult(
    functionFragment: "MIN_COLLATERAL_RATIO",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ONE_HUNDRED_PERCENT",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "executeOrder",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "initializeContract",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "isOwner", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "registry", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "teller", data: BytesLike): Result;

  events: {
    "OwnershipTransferred(address,address)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "OwnershipTransferred"): EventFragment;
}

export class Exchange extends Contract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  on(event: EventFilter | string, listener: Listener): this;
  once(event: EventFilter | string, listener: Listener): this;
  addListener(eventName: EventFilter | string, listener: Listener): this;
  removeAllListeners(eventName: EventFilter | string): this;
  removeListener(eventName: any, listener: Listener): this;

  interface: ExchangeInterface;

  functions: {
    MIN_COLLATERAL_RATIO(
      overrides?: CallOverrides
    ): Promise<{
      0: BigNumber;
    }>;

    "MIN_COLLATERAL_RATIO()"(
      overrides?: CallOverrides
    ): Promise<{
      0: BigNumber;
    }>;

    ONE_HUNDRED_PERCENT(
      overrides?: CallOverrides
    ): Promise<{
      0: BigNumber;
    }>;

    "ONE_HUNDRED_PERCENT()"(
      overrides?: CallOverrides
    ): Promise<{
      0: BigNumber;
    }>;

    executeOrder(
      lender: string,
      borrower: string,
      amount: BigNumberish,
      rate: BigNumberish,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    "executeOrder(address,address,uint256,uint256)"(
      lender: string,
      borrower: string,
      amount: BigNumberish,
      rate: BigNumberish,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    initializeContract(overrides?: Overrides): Promise<ContractTransaction>;

    "initializeContract()"(overrides?: Overrides): Promise<ContractTransaction>;

    isOwner(
      overrides?: CallOverrides
    ): Promise<{
      0: boolean;
    }>;

    "isOwner()"(
      overrides?: CallOverrides
    ): Promise<{
      0: boolean;
    }>;

    owner(
      overrides?: CallOverrides
    ): Promise<{
      0: string;
    }>;

    "owner()"(
      overrides?: CallOverrides
    ): Promise<{
      0: string;
    }>;

    registry(
      overrides?: CallOverrides
    ): Promise<{
      0: string;
    }>;

    "registry()"(
      overrides?: CallOverrides
    ): Promise<{
      0: string;
    }>;

    teller(
      overrides?: CallOverrides
    ): Promise<{
      0: string;
    }>;

    "teller()"(
      overrides?: CallOverrides
    ): Promise<{
      0: string;
    }>;
  };

  MIN_COLLATERAL_RATIO(overrides?: CallOverrides): Promise<BigNumber>;

  "MIN_COLLATERAL_RATIO()"(overrides?: CallOverrides): Promise<BigNumber>;

  ONE_HUNDRED_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

  "ONE_HUNDRED_PERCENT()"(overrides?: CallOverrides): Promise<BigNumber>;

  executeOrder(
    lender: string,
    borrower: string,
    amount: BigNumberish,
    rate: BigNumberish,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  "executeOrder(address,address,uint256,uint256)"(
    lender: string,
    borrower: string,
    amount: BigNumberish,
    rate: BigNumberish,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  initializeContract(overrides?: Overrides): Promise<ContractTransaction>;

  "initializeContract()"(overrides?: Overrides): Promise<ContractTransaction>;

  isOwner(overrides?: CallOverrides): Promise<boolean>;

  "isOwner()"(overrides?: CallOverrides): Promise<boolean>;

  owner(overrides?: CallOverrides): Promise<string>;

  "owner()"(overrides?: CallOverrides): Promise<string>;

  registry(overrides?: CallOverrides): Promise<string>;

  "registry()"(overrides?: CallOverrides): Promise<string>;

  teller(overrides?: CallOverrides): Promise<string>;

  "teller()"(overrides?: CallOverrides): Promise<string>;

  callStatic: {
    MIN_COLLATERAL_RATIO(overrides?: CallOverrides): Promise<BigNumber>;

    "MIN_COLLATERAL_RATIO()"(overrides?: CallOverrides): Promise<BigNumber>;

    ONE_HUNDRED_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    "ONE_HUNDRED_PERCENT()"(overrides?: CallOverrides): Promise<BigNumber>;

    executeOrder(
      lender: string,
      borrower: string,
      amount: BigNumberish,
      rate: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    "executeOrder(address,address,uint256,uint256)"(
      lender: string,
      borrower: string,
      amount: BigNumberish,
      rate: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    initializeContract(overrides?: CallOverrides): Promise<void>;

    "initializeContract()"(overrides?: CallOverrides): Promise<void>;

    isOwner(overrides?: CallOverrides): Promise<boolean>;

    "isOwner()"(overrides?: CallOverrides): Promise<boolean>;

    owner(overrides?: CallOverrides): Promise<string>;

    "owner()"(overrides?: CallOverrides): Promise<string>;

    registry(overrides?: CallOverrides): Promise<string>;

    "registry()"(overrides?: CallOverrides): Promise<string>;

    teller(overrides?: CallOverrides): Promise<string>;

    "teller()"(overrides?: CallOverrides): Promise<string>;
  };

  filters: {
    OwnershipTransferred(
      previousOwner: string | null,
      newOwner: string | null
    ): EventFilter;
  };

  estimateGas: {
    MIN_COLLATERAL_RATIO(overrides?: CallOverrides): Promise<BigNumber>;

    "MIN_COLLATERAL_RATIO()"(overrides?: CallOverrides): Promise<BigNumber>;

    ONE_HUNDRED_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    "ONE_HUNDRED_PERCENT()"(overrides?: CallOverrides): Promise<BigNumber>;

    executeOrder(
      lender: string,
      borrower: string,
      amount: BigNumberish,
      rate: BigNumberish,
      overrides?: Overrides
    ): Promise<BigNumber>;

    "executeOrder(address,address,uint256,uint256)"(
      lender: string,
      borrower: string,
      amount: BigNumberish,
      rate: BigNumberish,
      overrides?: Overrides
    ): Promise<BigNumber>;

    initializeContract(overrides?: Overrides): Promise<BigNumber>;

    "initializeContract()"(overrides?: Overrides): Promise<BigNumber>;

    isOwner(overrides?: CallOverrides): Promise<BigNumber>;

    "isOwner()"(overrides?: CallOverrides): Promise<BigNumber>;

    owner(overrides?: CallOverrides): Promise<BigNumber>;

    "owner()"(overrides?: CallOverrides): Promise<BigNumber>;

    registry(overrides?: CallOverrides): Promise<BigNumber>;

    "registry()"(overrides?: CallOverrides): Promise<BigNumber>;

    teller(overrides?: CallOverrides): Promise<BigNumber>;

    "teller()"(overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    MIN_COLLATERAL_RATIO(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "MIN_COLLATERAL_RATIO()"(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    ONE_HUNDRED_PERCENT(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "ONE_HUNDRED_PERCENT()"(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    executeOrder(
      lender: string,
      borrower: string,
      amount: BigNumberish,
      rate: BigNumberish,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "executeOrder(address,address,uint256,uint256)"(
      lender: string,
      borrower: string,
      amount: BigNumberish,
      rate: BigNumberish,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    initializeContract(overrides?: Overrides): Promise<PopulatedTransaction>;

    "initializeContract()"(
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    isOwner(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    "isOwner()"(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    owner(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    "owner()"(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    registry(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    "registry()"(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    teller(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    "teller()"(overrides?: CallOverrides): Promise<PopulatedTransaction>;
  };
}
