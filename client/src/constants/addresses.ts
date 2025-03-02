import { normalizeAddress } from '@shared/utils/address';

export const TOKEN_ADDRESSES = {
  USDC: normalizeAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')!,
  WETH: normalizeAddress('0x4200000000000000000000000000000000000006')!,
  USDbC: normalizeAddress('0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA')!,
  USDBC: normalizeAddress('0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA')!,
};

export const DEX_ADDRESSES = {
  uniswap: {
    factory: normalizeAddress('0x33128a8fc17869897dce68ed026d694621f6fdfd')!,
    router: normalizeAddress('0x2626664c2603336E57B271c5C0b26F421741e481')!,
    positionManager: normalizeAddress('0x03a520b32C04Bf3bE5F46762FCe6Cd5031F498c2')!,
  },
  aerodrome: {
    factory: normalizeAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40Da')!,
    router: normalizeAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43')!,
    voter: normalizeAddress('0x16613524e02ad97eDfeF371bC883F2F5d6C480A5')!,
    positionManager: normalizeAddress('0x82792F8f57635DC7e4C78fEB5a7a2CFD102A1cC3')!,
    slipstreamPositionManager: normalizeAddress('0x827922686190790b37229fd06084350E74485b72')!,
  },
};