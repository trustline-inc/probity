console.log(`
AUREI: {
  address: "${process.env.AUREI}",
  abi: AureiABI.abi
},
AUCTIONEER: {
  address: "${process.env.AUCTIONEER}",
  abi: AuctioneerABI.abi
},
// NOTE: BRIDGE is deployed from https://github.com/trustline-inc/solaris-sdk
BRIDGE: {
  address: "",
  abi: null
},
LIQUIDATOR: {
  address: "${process.env.LIQUIDATOR}",
  abi: LiquidatorABI.abi
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
PBT_TOKEN: {
  address: "${process.env.PBT_TOKEN}",
  abi: PbtTokenABI.abi
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
  "${process.env.AUREI}": AureiABI,
  "${process.env.AUCTIONEER}": AuctioneerABI,
  "${process.env.LIQUIDATOR}": LiquidatorABI,
  "${process.env.PRICE_FEED}": PriceFeedABI,
  "${process.env.NATIVE_ASSET_MANAGER}": NativeAssetManagerABI,
  "${process.env.REGISTRY}": RegistryABI,
  "${process.env.PBT_TOKEN}": PbtTokenABI,
  "${process.env.RESERVE_POOL}": ReservePoolABI,
  "${process.env.TELLER}": TellerABI,
  "${process.env.TREASURY}": TreasuryABI,
  "${process.env.VAULT_ENGINE}": VaultEngineLimitedABI
}
`);
