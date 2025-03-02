import { ethers } from 'ethers';
import { normalizeAddress } from '../../shared/utils/address';

const VAULT_ADDRESS = '0x2B0E79CbE7C268997EF4E6E86ee0e98856DAbE3d';

const VAULT_ABI = [
  'function getPoolTokens(bytes32 poolId) view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock)',
  'function getPool(bytes32 poolId) view returns (address poolAddress, uint8 poolType)',
  'function getUserBalances(bytes32 poolId, address user) view returns (uint256[] memory)'
];

export async function fetchSlipstreamPositions(address: string, provider: ethers.Provider) {
  console.log('Fetching Slipstream positions for address:', address);

  const normalized = normalizeAddress(address);
  if (!normalized) {
    console.warn('Invalid address for Slipstream position fetch');
    return null;
  }

  try {
    const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);

    // Implementation simplified to basic balance check
    const userBalances = await vault.getUserBalances(normalized);
    if (!userBalances || userBalances.length === 0) {
      console.log('No Slipstream positions found');
      return null;
    }

    return {
      protocol: 'slipstream',
      balances: userBalances.map(b => b.toString())
    };
  } catch (error) {
    console.warn('Error fetching Slipstream position:', error);
    return null;
  }
}