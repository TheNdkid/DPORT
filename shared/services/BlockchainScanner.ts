import { ethers } from "ethers";
import { normalizeAddress } from "../utils/address";

export interface Position {
    protocol: string;
    poolAddress: string;
    tokenAmount0: string;
    tokenAmount1: string;
    tokenSymbol0: string;
    tokenSymbol1: string;
    value: string;
}

export class BlockchainScanner {
    protected provider: ethers.JsonRpcProvider;

    constructor() {
        // Connect to Base network
        this.provider = new ethers.JsonRpcProvider("https://base-rpc.publicnode.com");
    }

    protected async validateConnection(): Promise<void> {
        try {
            const network = await this.provider.getNetwork();
            // Use Number() to convert BigInt to number for comparison
            if (Number(network.chainId) !== 8453) { // Base mainnet chainId
                throw new Error("Not connected to Base network");
            }
        } catch (error) {
            console.error("Failed to validate network connection:", error);
            throw new Error("Network connection failed");
        }
    }

    public async getPositions(walletAddress: string): Promise<Position[]> {
        try {
            // Use our updated normalizeAddress function that handles checksums properly
            const normalized = normalizeAddress(walletAddress);
            if (!normalized) {
                console.error("Invalid wallet address provided:", walletAddress);
                return [];
            }

            await this.validateConnection();
            console.log("Fetching positions for:", normalized);

            // Fetch positions from different protocols
            const results = await Promise.allSettled([
                this.fetchUniswapV3Positions(normalized),
                this.fetchAerodromePositions(normalized)
            ]);

            // Combine successful results
            return results
                .filter((result): result is PromiseFulfilledResult<Position[]> => 
                    result.status === 'fulfilled')
                .flatMap(result => result.value);

        } catch (error) {
            console.error("Error fetching positions:", error);
            return [];
        }
    }

    protected async fetchUniswapV3Positions(address: string): Promise<Position[]> {
        try {
            // Implementation will be added
            return [];
        } catch (error) {
            console.error("Error fetching Uniswap V3 positions:", error);
            return [];
        }
    }

    protected async fetchAerodromePositions(address: string): Promise<Position[]> {
        try {
            // Implementation will be added
            return [];
        } catch (error) {
            console.error("Error fetching Aerodrome positions:", error);
            return [];
        }
    }
}