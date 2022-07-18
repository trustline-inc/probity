console.log(`
{
  USD: {
    address: "${process.env.USD}",
    abi: UsdABI.abi
  },
  AUCTIONEER: {
    address: "${process.env.AUCTIONEER}",
    abi: AuctioneerABI.abi
  },
  // NOTE: BRIDGE is deployed from https://github.com/trustline-inc/solaris-sdk
  BRIDGE: {
    address: "",
    abi: BridgeABI.abi
  },
  LIQUIDATOR: {
    address: "${process.env.LIQUIDATOR}",
    abi: LiquidatorABI.abi
  },
  USD_MANAGER: {
    address: "${process.env.USD_MANAGER}",
    abi: Erc20AssetManagerABI.abi
  },
  PRICE_FEED: {
    address: "${process.env.PRICE_FEED}",
    abi: PriceFeedABI.abi
  },
  NATIVE_ASSET_MANAGER: {
    address: "${process.env.NATIVE_ASSET_MANAGER}",
    abi: NativeAssetManagerABI.abi
  },
  REGISTRY: {
    address: "${process.env.REGISTRY}",
    abi: RegistryABI.abi
  },
  PBT: {
    address: "${process.env.PBT}",
    abi: PbtABI.abi
  },
  RESERVE_POOL: {
    address: "${process.env.RESERVE_POOL}",
    abi: ReservePoolABI.abi
  },
  TELLER: {
    address: "${process.env.TELLER}",
    abi: TellerABI.abi
  },
  TREASURY: {
    address: "${process.env.TREASURY}",
    abi: TreasuryABI.abi
  },
  VAULT_ENGINE: {
    address: "${process.env.VAULT_ENGINE}",
    abi: VaultEngineLimitedABI.abi
  },
  INTERFACES: {
    "${process.env.USD}": UsdABI,
    "${process.env.AUCTIONEER}": AuctioneerABI,
    "${process.env.LIQUIDATOR}": LiquidatorABI,
    "${process.env.PRICE_FEED}": PriceFeedABI,
    "${process.env.NATIVE_ASSET_MANAGER}": NativeAssetManagerABI,
    "${process.env.ERC20_ASSET_MANAGER}": Erc20AssetManagerABI,
    "${process.env.REGISTRY}": RegistryABI,
    "${process.env.PBT}": PbtABI,
    "${process.env.RESERVE_POOL}": ReservePoolABI,
    "${process.env.TELLER}": TellerABI,
    "${process.env.TREASURY}": TreasuryABI,
    "${process.env.VAULT_ENGINE}": VaultEngineLimitedABI
  }
}
`);
