// Common ABIs for DeFi protocols
export const ERC20ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint256)'
];

// Aerodrome ABIs
export const AERODROME_NFT_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function positions(uint256 tokenId) view returns (address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 tokensOwed0, uint256 tokensOwed1)',
  'function symbol() view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function tokens() external view returns (address[] memory)',
  'function stable() external view returns (bool)',
  'function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256)',
  'function metadata() external view returns (uint256 dec0, uint256 dec1, uint256 r0, uint256 r1, bool st, address t0, address t1)'
];

export const VOTER_ABI = [
  'function gauges(address pool) external view returns (address)',
  'function weights(address user, address pool) external view returns (uint256)',
  'function usedWeights(address user) external view returns (uint256)',
  'function isGauge(address gauge) external view returns (bool)'
];

export const SLIPSTREAM_ABI = [
  // Core functions
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  // Position data variations
  'function positions(uint256) view returns (address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity)',
  'function positions(uint256) view returns (tuple(address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity) pos)',
  'function getPosition(uint256) view returns (address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity)',
  // Fee related functions
  'function fees(uint256) view returns (uint256 token0Fees, uint256 token1Fees)',
  'function collectFees(uint256) view returns (uint256 amount0, uint256 amount1)',
  // Additional metadata
  'function symbol() view returns (string)',
  'function tokenURI(uint256) view returns (string)'
];

export const LP_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function stable() view returns (bool)'
];

// Uniswap V3 ABIs
export const UNISWAP_V3_POSITION_NFT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function positions(uint256 tokenId) view returns (address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function symbol() view returns (string)'
];

// Pool ABIs
export const POOL_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function stable() view returns (bool)'
];
export const ERC20ABI = [
  // Read-only functions
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

export const UNISWAPV3_POSITION_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
  "function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function ownerOf(uint256) view returns (address)"
];

export const AERODROME_POSITION_ABI = [
  // Core NFT functions
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  
  // Position data
  "function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function getPosition(uint256) view returns (address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity)"
];
