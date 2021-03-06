/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import { Contract, ContractFactory, Overrides } from "@ethersproject/contracts";

import type { Teller } from "./Teller";

export class TellerFactory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(_registry: string, overrides?: Overrides): Promise<Teller> {
    return super.deploy(_registry, overrides || {}) as Promise<Teller>;
  }
  getDeployTransaction(
    _registry: string,
    overrides?: Overrides
  ): TransactionRequest {
    return super.getDeployTransaction(_registry, overrides || {});
  }
  attach(address: string): Teller {
    return super.attach(address) as Teller;
  }
  connect(signer: Signer): TellerFactory {
    return super.connect(signer) as TellerFactory;
  }
  static connect(address: string, signerOrProvider: Signer | Provider): Teller {
    return new Contract(address, _abi, signerOrProvider) as Teller;
  }
}

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_registry",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "lender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "borrower",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "principal",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "rate",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_now",
        type: "uint256",
      },
    ],
    name: "LoanCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    inputs: [],
    name: "MIN_COLLATERAL_RATIO",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "ONE_HUNDRED_PERCENT",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "balances",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "calculateInterest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "lender",
        type: "address",
      },
      {
        internalType: "address",
        name: "borrower",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "principal",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "rate",
        type: "uint256",
      },
    ],
    name: "createLoan",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "custodian",
    outputs: [
      {
        internalType: "contract ICustodian",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "initializeContract",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "isOwner",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "loanBalances",
    outputs: [
      {
        internalType: "uint256",
        name: "interestRate",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "principal",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "duration",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "startDate",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "lender",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "probity",
    outputs: [
      {
        internalType: "contract IProbity",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "registry",
    outputs: [
      {
        internalType: "contract IRegistry",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "treasury",
    outputs: [
      {
        internalType: "contract ITreasury",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const _bytecode =
  "0x60806040523480156200001157600080fd5b50604051620015a8380380620015a8833981810160405281019062000037919062000133565b33806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508073ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35080600660006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050620001ad565b6000815190506200012d8162000193565b92915050565b6000602082840312156200014657600080fd5b600062000156848285016200011c565b91505092915050565b60006200016c8262000173565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6200019e816200015f565b8114620001aa57600080fd5b50565b6113eb80620001bd6000396000f3fe608060405234801561001057600080fd5b50600436106100cf5760003560e01c80637b1039991161008c5780639eb32fdb116100665780639eb32fdb1461020a578063dd0081c714610214578063eb0c495514610232578063f255ec3f1461023c576100cf565b80637b103999146101b05780638da5cb5b146101ce5780638f32d59b146101ec576100cf565b806324fc962e146100d457806327e235e314610108578063375b74c31461013857806348b5801d1461015657806361d027b3146101745780637a9fffb714610192575b600080fd5b6100ee60048036038101906100e99190610e5f565b610258565b6040516100ff95949392919061115e565b60405180910390f35b610122600480360381019061011d9190610daa565b6102bb565b60405161012f919061111a565b60405180910390f35b6101406102d3565b60405161014d9190611053565b60405180910390f35b61015e6102f9565b60405161016b919061106e565b60405180910390f35b61017c61031f565b60405161018991906110a4565b60405180910390f35b61019a610345565b6040516101a7919061111a565b60405180910390f35b6101b8610351565b6040516101c59190611089565b60405180910390f35b6101d6610377565b6040516101e39190610f93565b60405180910390f35b6101f46103a0565b6040516102019190611038565b60405180910390f35b6102126103f7565b005b61021c610704565b604051610229919061111a565b60405180910390f35b61023a610710565b005b61025660048036038101906102519190610dfc565b610712565b005b6002602052816000526040600020602052806000526040600020600091509150508060000154908060010154908060020154908060030154908060040160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905085565b60016020528060005260406000206000915090505481565b600460009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600760009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6714d1120d7b16000081565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614905090565b6103ff6103a0565b61043e576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610435906110fa565b60405180910390fd5b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663f4e5699160016040518263ffffffff1660e01b815260040161049a91906110bf565b60206040518083038186803b1580156104b257600080fd5b505afa1580156104c6573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906104ea9190610dd3565b600460006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663f4e5699160056040518263ffffffff1660e01b815260040161058691906110bf565b60206040518083038186803b15801561059e57600080fd5b505afa1580156105b2573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906105d69190610dd3565b600760006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663f4e5699160036040518263ffffffff1660e01b815260040161067291906110bf565b60206040518083038186803b15801561068a57600080fd5b505afa15801561069e573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906106c29190610dd3565b600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550565b670de0b6b3a764000081565b565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663f4e5699160026040518263ffffffff1660e01b815260040161076e91906110bf565b60206040518083038186803b15801561078657600080fd5b505afa15801561079a573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906107be9190610dd3565b73ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146107f557600080fd5b600061084983600160008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610d0d90919063ffffffff16565b9050600460009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663dedd833682866040518363ffffffff1660e01b81526004016108a8929190611135565b600060405180830381600087803b1580156108c257600080fd5b505af11580156108d6573d6000803e3d6000fd5b5050505061092c83600160008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610d0d90919063ffffffff16565b600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506001600360008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546109bb91906111c2565b600360008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506000600360008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905082600260008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008381526020019081526020016000206000018190555083600260008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000838152602001908152602001600020600101819055506000600260008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008381526020019081526020016000206002018190555085600260008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600083815260200190815260200160002060040160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555042600260008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600083815260200190815260200160002060030181905550600760009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16636d4f7f828787876040518463ffffffff1660e01b8152600401610c9493929190610fae565b600060405180830381600087803b158015610cae57600080fd5b505af1158015610cc2573d6000803e3d6000fd5b505050507fde636d638630facb15ec6c1d7316206e1f6f4ab5ff6d1deca5d52207f567a3348686868642604051610cfd959493929190610fe5565b60405180910390a1505050505050565b6000808284610d1c91906111c2565b905083811015610d61576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610d58906110da565b60405180910390fd5b8091505092915050565b600081359050610d7a81611387565b92915050565b600081519050610d8f81611387565b92915050565b600081359050610da48161139e565b92915050565b600060208284031215610dbc57600080fd5b6000610dca84828501610d6b565b91505092915050565b600060208284031215610de557600080fd5b6000610df384828501610d80565b91505092915050565b60008060008060808587031215610e1257600080fd5b6000610e2087828801610d6b565b9450506020610e3187828801610d6b565b9350506040610e4287828801610d95565b9250506060610e5387828801610d95565b91505092959194509250565b60008060408385031215610e7257600080fd5b6000610e8085828601610d6b565b9250506020610e9185828601610d95565b9150509250929050565b610ea481611218565b82525050565b610eb38161122a565b82525050565b610ec281611273565b82525050565b610ed181611297565b82525050565b610ee0816112bb565b82525050565b610eef816112df565b82525050565b610efe81611303565b82525050565b6000610f11601b836111b1565b91507f536166654d6174683a206164646974696f6e206f766572666c6f7700000000006000830152602082019050919050565b6000610f516020836111b1565b91507f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e65726000830152602082019050919050565b610f8d81611269565b82525050565b6000602082019050610fa86000830184610e9b565b92915050565b6000606082019050610fc36000830186610e9b565b610fd06020830185610e9b565b610fdd6040830184610f84565b949350505050565b600060a082019050610ffa6000830188610e9b565b6110076020830187610e9b565b6110146040830186610f84565b6110216060830185610f84565b61102e6080830184610f84565b9695505050505050565b600060208201905061104d6000830184610eaa565b92915050565b60006020820190506110686000830184610eb9565b92915050565b60006020820190506110836000830184610ec8565b92915050565b600060208201905061109e6000830184610ed7565b92915050565b60006020820190506110b96000830184610ee6565b92915050565b60006020820190506110d46000830184610ef5565b92915050565b600060208201905081810360008301526110f381610f04565b9050919050565b6000602082019050818103600083015261111381610f44565b9050919050565b600060208201905061112f6000830184610f84565b92915050565b600060408201905061114a6000830185610f84565b6111576020830184610e9b565b9392505050565b600060a0820190506111736000830188610f84565b6111806020830187610f84565b61118d6040830186610f84565b61119a6060830185610f84565b6111a76080830184610e9b565b9695505050505050565b600082825260208201905092915050565b60006111cd82611269565b91506111d883611269565b9250827fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0382111561120d5761120c611315565b5b828201905092915050565b600061122382611249565b9050919050565b60008115159050919050565b600081905061124482611373565b919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600061127e82611285565b9050919050565b600061129082611249565b9050919050565b60006112a2826112a9565b9050919050565b60006112b482611249565b9050919050565b60006112c6826112cd565b9050919050565b60006112d882611249565b9050919050565b60006112ea826112f1565b9050919050565b60006112fc82611249565b9050919050565b600061130e82611236565b9050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602160045260246000fd5b6006811061138457611383611344565b5b50565b61139081611218565b811461139b57600080fd5b50565b6113a781611269565b81146113b257600080fd5b5056fea264697066735822122073fb07550d0aefb8cbe20a0956fd2ed900417e582446b8e14997a77d8d017c4964736f6c63430008000033";
