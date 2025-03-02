import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { ethers } from 'ethers';
import type { Request, Response } from 'express';


export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // Wallet routes
  app.get("/api/wallet/:address", getWalletHandler);
  app.get("/api/wallet/:address/assets", getWalletAssetsHandler);
  app.get("/api/wallet/:address/positions", getWalletPositionsHandler);
  app.get("/api/wallet/:address/strategies", getWalletStrategiesHandler);
  app.get("/api/wallet/:address/nfts", getNFTsHandler);
  app.post("/api/wallet/:address/sync", syncWalletHandler);

  // Automation routes  
  app.get("/api/wallet/:address/positions/:positionId/automation", getAutomationRulesHandler);
  app.post("/api/wallet/:address/automation", createAutomationRuleHandler);
  app.patch("/api/wallet/:address/automation/:ruleId", updateAutomationRuleHandler);

  // Price feed route (placeholder)
  app.get("/api/price/:token", getPriceHandler);

  return httpServer;
}

// Wallet handlers
async function getWalletHandler(req: Request, res: Response) {
  try {
    let address = req.params.address;

    try {
      // Normalize address - this will throw if invalid
      address = ethers.getAddress(address);
    } catch (addressError) {
      console.error('Invalid address format:', address, addressError);
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

    try {
      // Get balance
      const balance = await provider.getBalance(address);

      // Get token balances
      const tokenBalances = await fetchTokenBalances(address);

      // Get NFT positions
      const nftPositions = await fetchNFTPositions(address);

      res.json({
        address,
        balance: ethers.formatEther(balance),
        tokens: tokenBalances,
        nfts: nftPositions
      });
    } catch (fetchError) {
      console.error('Error fetching wallet data:', fetchError);
      res.status(500).json({ error: 'Failed to fetch wallet data', details: fetchError.message });
    }
  } catch (error) {
    console.error('Unexpected error in getWalletHandler:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
}

async function getWalletAssetsHandler(req: Request, res: Response) {
  const wallet = await storage.getWallet(req.params.address);
  if (!wallet) {
    return res.status(404).json({ message: "Wallet not found" });
  }
  const assets = await storage.getAssetsByWallet(wallet.id);
  res.json(assets);
}

async function getWalletPositionsHandler(req:Request, res: Response) {
  const wallet = await storage.getWallet(req.params.address);
  if (!wallet) {
    return res.status(404).json({ message: "Wallet not found" });
  }
  const positions = await storage.getPositionsByWallet(wallet.id);
  res.json(positions);
}

async function getWalletStrategiesHandler(req: Request, res: Response) {
  const wallet = await storage.getWallet(req.params.address);
  if (!wallet) {
    return res.status(404).json({ message: "Wallet not found" });
  }
  const strategies = await storage.getStrategiesByWallet(wallet.id);
  res.json(strategies);
}

async function syncWalletHandler(req: Request, res: Response) {
  const address = req.params.address;
  const now = new Date();

  const wallet = await storage.upsertWallet({
    address,
    lastUpdated: now
  });

  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo");
  const positions = await fetchUniswapV3Positions(provider, address);

  for (const pos of positions) {
    await storage.upsertPosition({
      walletId: wallet.id,
      protocol: pos.protocol,
      type: pos.type,
      apy: "0",
      tvl: pos.liquidity,
      lastUpdated: now
    });
  }

  res.json({ success: true });
}

// Automation handlers
async function getAutomationRulesHandler(req: Request, res: Response) {
  const wallet = await storage.getWallet(req.params.address);
  if (!wallet) {
    return res.status(404).json({ message: "Wallet not found" });
  }
  const rules = await storage.getAutomationRules(wallet.id, Number(req.params.positionId));
  res.json(rules);
}

async function createAutomationRuleHandler(req: Request, res: Response) {
  const wallet = await storage.getWallet(req.params.address);
  if (!wallet) {
    return res.status(404).json({ message: "Wallet not found" });
  }

  const rule = await storage.upsertAutomationRule({
    ...req.body,
    walletId: wallet.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  res.json(rule);
}

async function updateAutomationRuleHandler(req: Request, res: Response) {
  const wallet = await storage.getWallet(req.params.address);
  if (!wallet) {
    return res.status(404).json({ message: "Wallet not found" });
  }

  const rules = await storage.getAutomationRules(wallet.id);
  const rule = rules.find(r => r.id === Number(req.params.ruleId));

  if (!rule) {
    return res.status(404).json({ message: "Rule not found" });
  }

  const updatedRule = await storage.upsertAutomationRule({
    ...rule,
    ...req.body,
    updatedAt: new Date(),
  });

  res.json(updatedRule);
}

async function fetchAerodromeSlipstreamPositions(provider, walletAddress) {
  const positions = [];

  // Verified correct Slipstream Position Manager address based on successful NFT metadata retrieval
  const slipstreamAddress = "0x827922686190790b37229fd06084350E74485b72";

  // Alternative addresses as fallbacks
  const alternateAddresses = [
    "0x82792F8F57635DC7e4C78FeB5A7A2CFD102A1cC3",
    "0x8279226865B008CdaCd9Ccd970d000B4b8C3fA58"
  ];

  console.log(`Fetching Aerodrome Slipstream positions from ${slipstreamAddress} for wallet ${walletAddress}`);

  // Expanded ABI with all possibly needed functions for more reliable interactions
  const positionABI = [
    // Core NFT functions
    "function balanceOf(address) view returns (uint256)",
    "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
    "function ownerOf(uint256) view returns (address)",
    "function tokenURI(uint256) view returns (string)",

    // Position data with complete struct
    "function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",

    // Alternative position functions that might be used
    "function getPosition(uint256) view returns (address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity)",
    "function fees(uint256) view returns (uint256 token0Fees, uint256 token1Fees)",
    "function collectFees(uint256) view returns (uint256 amount0, uint256 amount1)"
  ];

  try {
    const slipstream = new ethers.Contract(slipstreamAddress, positionABI, provider);

    // First check the contract's existence by trying a simple call
    try {
      console.log("Verifying contract responsiveness...");
      // Try to get the NFT balance to verify contract is operational
      const balance = await slipstream.balanceOf(walletAddress);
      console.log(`NFT balance confirmed: ${balance.toString()}`);

      // Verify the wallet actually has some NFTs
      if (balance.toString() === "0") {
        console.log("Wallet has no Slipstream positions. Checking alternate addresses...");

        // Before giving up, check alternate addresses
        for (const altAddress of alternateAddresses) {
          try {
            console.log(`Trying alternate address: ${altAddress}`);
            const altContract = new ethers.Contract(altAddress, positionABI, provider);
            const altBalance = await altContract.balanceOf(walletAddress);

            if (altBalance.toString() !== "0") {
              console.log(`Found ${altBalance} positions in alternate contract ${altAddress}`);

              // If successful, process this contract instead
              for (let i = 0; i < Number(altBalance); i++) {
                await processPositionToken(altContract, walletAddress, i, positions, provider);
              }
            }
          } catch (altError) {
            console.log(`Alternative address ${altAddress} check failed:`, altError.message);
          }
        }

        return positions;
      }

      // Process each position in the main contract
      for (let i = 0; i < Number(balance); i++) {
        await processPositionToken(slipstream, walletAddress, i, positions, provider);
      }

    } catch (error) {
      console.error("Contract unresponsive or error:", error);
      console.log("Checking if RPC endpoint is reliable...");

      // Check if RPC is working by getting chain ID
      try {
        const network = await provider.getNetwork();
        console.log(`Network check successful, chain ID: ${network.chainId}`);
      } catch (netError) {
        console.error("RPC endpoint error:", netError);
        console.log("Consider using an alternative RPC like Alchemy or Infura");
      }
    }
  } catch (error) {
    console.error(`Error initializing Slipstream contract:`, error);
  }

  return positions;
}

// Helper function to process a single position token
async function processPositionToken(contract, walletAddress, index, positions, provider) {
  try {
    console.log(`Processing token at index ${index}...`);

    // Get token ID safely
    let tokenId;
    try {
      tokenId = await contract.tokenOfOwnerByIndex(walletAddress, index);
      console.log(`Found token ID: ${tokenId.toString()}`);

      // Optional: Verify ownership to ensure the token hasn't been transferred
      try {
        const owner = await contract.ownerOf(tokenId);
        if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
          console.warn(`Token ${tokenId} owner mismatch. Expected ${walletAddress}, got ${owner}`);
          return; // Skip this token
        }
        console.log(`Ownership verified for token ${tokenId}`);
      } catch (ownerError) {
        console.warn(`Could not verify ownership for token ${tokenId}:`, ownerError.message);
      }

    } catch (tokenError) {
      console.error(`Error getting token ID at index ${index}:`, tokenError.message);
      return;
    }

    // Try to get position details using the positions function with retry logic
    try {
      console.log(`Fetching position data for token ${tokenId}...`);

      // First attempt: direct call using contract method with retry logic
      let position;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          // Add a small delay between retries to avoid rate limiting
          if (retryCount > 0) {
            console.log(`Retry attempt ${retryCount} for token ${tokenId}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }

          position = await contract.positions(tokenId);
          console.log(`Successfully retrieved position data for token ${tokenId}`);

          // Format position details and add to result
          addPositionToResults(positions, tokenId, contract.address, position);
          break; // Success, exit the retry loop

        } catch (attemptError) {
          retryCount++;
          if (retryCount >= maxRetries) {
            // Rethrow the last error if we've exhausted retries
            throw attemptError;
          }
          console.log(`Position data attempt ${retryCount} failed: ${attemptError.message}`);
        }
      }
    } catch (posError) {
      console.warn(`Standard positions call failed for token ${tokenId} after retries:`, posError.message);

      // DEBUGGING: Try raw call and manual decoding
      try {
        console.log(`Attempting raw call for positions data...`);
        const rawData = await provider.call({
          to: contract.address,
          data: contract.interface.encodeFunctionData("positions", [tokenId])
        });

        console.log(`Raw positions data received: ${rawData.slice(0, 66)}...`);

        // Try to decode the raw data
        try {
          const decodedPosition = contract.interface.decodeFunctionResult("positions", rawData);
          console.log(`Successfully decoded raw data for token ${tokenId}`);

          // Format and add to results
          const positionObj = {
            token0: decodedPosition[2], // Based on the positions ABI structure
            token1: decodedPosition[3],
            fee: decodedPosition[4],
            tickLower: decodedPosition[5],
            tickUpper: decodedPosition[6],
            liquidity: decodedPosition[7]
          };

          addPositionToResults(positions, tokenId, contract.address, positionObj);

        } catch (decodeError) {
          console.error(`Raw data decode failed for token ${tokenId}:`, decodeError.message);
          console.log(`Raw data length: ${rawData.length}`);

          // Try alternative function: getPosition
          try {
            console.log(`Trying alternative getPosition function...`);
            const altPosition = await contract.getPosition(tokenId);
            console.log(`getPosition successful for token ${tokenId}`);

            addPositionToResults(positions, tokenId, contract.address, {
              token0: altPosition.token0,
              token1: altPosition.token1,
              tickLower: altPosition.tickLower,
              tickUpper: altPosition.tickUpper,
              liquidity: altPosition.liquidity,
              fee: "100" // Default for Aerodrome
            });

          } catch (altPosError) {
            console.warn(`Alternative getPosition failed:`, altPosError.message);

            // Last resort: Get metadata from tokenURI
            await getPositionFromMetadata(contract, tokenId, positions);
          }
        }
      } catch (rawError) {
        console.error(`Raw call failed for token ${tokenId}:`, rawError.message);

        // Fall back to metadata
        await getPositionFromMetadata(contract, tokenId, positions);
      }
    }
  } catch (error) {
    console.error(`Error processing token at index ${index}:`, error);
  }
}

// Helper to get position from metadata
async function getPositionFromMetadata(contract, tokenId, positions) {
  try {
    console.log(`Attempting to get metadata for token ${tokenId}...`);
    const tokenURI = await contract.tokenURI(tokenId);

    if (tokenURI && tokenURI.startsWith('data:application/json;base64,')) {
      const base64Data = tokenURI.replace('data:application/json;base64,', '');
      const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
      const metadata = JSON.parse(jsonString);

      console.log(`Successfully parsed metadata for token ${tokenId}`);
      console.log(`Token name: ${metadata.name}`);

      // Extract position details directly from metadata
      const poolAddressMatch = metadata.description?.match(/Pool Address:\s*(0x[a-fA-F0-9]{40})/i);
      const token0Match = metadata.description?.match(/(?:USDC|Token0) Address:\s*(0x[a-fA-F0-9]{40})/i);
      const token1Match = metadata.description?.match(/(?:ETH|Token1) Address:\s*(0x[a-fA-F0-9]{40})/i);
      const tickSpacingMatch = metadata.description?.match(/Tick Spacing:\s*(\d+)/i);

      // Extract price range from name (format often like "CL - USDC/ETH - 2257.5<>3047.3")
      const priceRangeMatch = metadata.name?.match(/(\d+\.?\d*)<>(\d+\.?\d*)/);

      let positionDetails = {
        token0: token0Match ? ethers.getAddress(token0Match[1]) : undefined,
        token1: token1Match ? ethers.getAddress(token1Match[1]) : undefined,
        poolAddress: poolAddressMatch ? ethers.getAddress(poolAddressMatch[1]) : undefined,
        fee: 100, // Default fee tier for Aerodrome
        liquidity: ethers.parseUnits("1", 18) // Placeholder value 
      };

      // Calculate approximate tick values from price range if available
      if (priceRangeMatch && priceRangeMatch.length >= 3) {
        const lowerPrice = parseFloat(priceRangeMatch[1]);
        const upperPrice = parseFloat(priceRangeMatch[2]);
        const tickSpacing = tickSpacingMatch ? parseInt(tickSpacingMatch[1], 10) : 100;

        // Convert price to ticks (approximation)
        positionDetails.tickLower = Math.floor(Math.log(lowerPrice) / Math.log(1.0001));
        positionDetails.tickUpper = Math.floor(Math.log(upperPrice) / Math.log(1.0001));

        // Ensure ticks are divisible by tickSpacing
        positionDetails.tickLower = Math.floor(positionDetails.tickLower / tickSpacing) * tickSpacing;
        positionDetails.tickUpper = Math.floor(positionDetails.tickUpper / tickSpacing) * tickSpacing;

        console.log(`Extracted price range: ${lowerPrice} to ${upperPrice}`);
        console.log(`Calculated ticks: ${positionDetails.tickLower} to ${positionDetails.tickUpper}`);
      }

      // Add to results if we have the minimum info needed
      if (positionDetails.token0 && positionDetails.token1) {
        addPositionToResults(positions, tokenId, contract.address, positionDetails);
        console.log(`Successfully added position from metadata for token ${tokenId}`);
      } else {
        console.warn(`Insufficient token data in metadata for token ${tokenId}`);
      }
    } else {
      console.warn(`Token URI not in expected format:`, tokenURI?.substring(0, 50));
    }
  } catch (metadataError) {
    console.error(`Failed to get metadata for token ${tokenId}:`, metadataError);
  }
}

// Helper to add position to results array
function addPositionToResults(positions, tokenId, contractAddress, position) {
  // Get token symbols if available
  let token0Symbol = "Unknown";
  let token1Symbol = "Unknown";

  if (position.token0 && tokenSymbols[position.token0.toLowerCase()]) {
    token0Symbol = tokenSymbols[position.token0.toLowerCase()];
  }

  if (position.token1 && tokenSymbols[position.token1.toLowerCase()]) {
    token1Symbol = tokenSymbols[position.token1.toLowerCase()];
  }

  // Calculate price range from ticks if available
  let priceLower = "0";
  let priceUpper = "0";

  if (position.tickLower !== undefined && position.tickUpper !== undefined) {
    try {
      // Simplified price calculation from ticks
      // For more accurate calculation, you'd need the token decimals and base currency
      const tickToPrice = (tick) => (1.0001 ** tick).toFixed(6);
      priceLower = tickToPrice(position.tickLower);
      priceUpper = tickToPrice(position.tickUpper);
    } catch (error) {
      console.warn(`Error calculating price range:`, error.message);
    }
  }

  positions.push({
    id: tokenId.toString(),
    name: `Aerodrome Position #${tokenId}`,
    imageUrl: "/nft-position.png",
    collectionName: "Aerodrome Slipstream",
    contractAddress: contractAddress,
    details: {
      token0: position.token0,
      token1: position.token1,
      token0Symbol: token0Symbol,
      token1Symbol: token1Symbol,
      fee: position.fee?.toString() || "100",
      liquidity: position.liquidity?.toString() || "0",
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      priceLower: priceLower,
      priceUpper: priceUpper
    }
  });

  console.log(`Successfully added position ${tokenId} to results`);
}

async function getNFTsHandler(req: Request, res: Response) {
  try {
    if (!req.params.address) {
      return res.status(400).json({ error: "Address is required" });
    }

    // Create provider with error handling and retries
    let provider;
    const baseRpcUrls = [
      "https://mainnet.base.org",
      // Add fallback RPCs if you have any, like your Alchemy/Infura API endpoints
      // "https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
      // "https://base-mainnet.infura.io/v3/YOUR_API_KEY"
    ];

    // Try connecting to each RPC endpoint
    for (let i = 0; i < baseRpcUrls.length; i++) {
      const rpcUrl = baseRpcUrls[i];
      try {
        console.log(`Attempting to connect to Base RPC (attempt ${i+1}/${baseRpcUrls.length}):`, rpcUrl);
        provider = new ethers.JsonRpcProvider(rpcUrl, {
          chainId: 8453,
          name: 'base'
        });

        // Test connection by getting network info
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        console.log(`Successfully connected to Base network, current block:`, blockNumber);
        break; // Exit loop if successful
      } catch (error) {
        console.error(`Failed to connect to ${rpcUrl}:`, error.message);
        if (i === baseRpcUrls.length - 1) {
          return res.status(500).json({ 
            error: "Failed to connect to Base network RPC endpoints", 
            details: error.message 
          });
        }
      }
    }

    let address;
    try {
      address = ethers.getAddress(req.params.address);
    } catch (error) {
      console.error("Address validation error:", error);
      return res.status(400).json({ error: "Invalid address format" });
    }

    // Base Uniswap V3 Position Manager with complete ABI
    const positionManagerAddress = "0x03a520b32c04bf3beef7beb72e6bc4c84c44f9fb";

    // Additional NFT contract to check
    const additionalContracts = [
      {
        address: "0x8279226865b008cdacd9ccd970d000b4b8c3fa58",
        name: "Aerodrome Slipstream Positions"
      }
    ];
    // Most comprehensive ABI for Slipstream Position Manager - supports multiple signature variants
const SLIPSTREAM_ABI = [
      // Core NFT functions for token ownership and enumeration
      'function balanceOf(address) view returns (uint256)',
      'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
      'function ownerOf(uint256) view returns (address)',

      // Position data (Uniswap V3 style with different possible variants)
      // Standard Uniswap V3 format
      'function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',

      // Aerodrome may have added a pool address field
      'function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1, address pool)',

      // Simplified variant that some implementations use
      'function positions(uint256) view returns (address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity)',

      // Additional position accessors
      'function getPosition(uint256) view returns (address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity)',
      'function positionDetails(uint256) view returns (address pool, int24 tickLower, int24 tickUpper, uint128 liquidity)',

      // Fee related functions
      'function fees(uint256) view returns (uint256 token0Fees, uint256 token1Fees)',
      'function unclaimedFees(uint256) view returns (uint256 token0Fees, uint256 token1Fees)',
      'function collectFees(uint256) view returns (uint256 amount0, uint256 amount1)',

      // Metadata related functions
      'function symbol() view returns (string)',
      'function tokenURI(uint256) view returns (string)',
      'function getPool(address, address, uint24) view returns (address)'
    ];
    const positionManagerABI = [
      "function balanceOf(address) view returns (uint256)",
      "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
      "function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
      "function ownerOf(uint256) view returns (address)"
    ];

    console.log("Connecting to position manager at:", positionManagerAddress);

    console.log("Fetching NFTs for address:", address);

    const positionManager = new ethers.Contract(positionManagerAddress, positionManagerABI, provider);
    const balance = await positionManager.balanceOf(address);

    console.log("NFT balance:", balance.toString());

    const nfts = [];
    const balanceNum = Number(balance);

    if (balanceNum > 0) {
      for (let i = 0; i < balanceNum; i++) {
        try {
          let tokenId;
          try {
            tokenId = await positionManager.tokenOfOwnerByIndex(address, i);
            console.log("Found token ID:", tokenId.toString());
          } catch (tokenError: any) {
            if (tokenError.code === 'BAD_DATA') {
              console.warn("Could not decode tokenOfOwnerByIndex result. Trying alternate method.");

              // Try with direct call
              const nftInterface = new ethers.Interface([
                'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)'
              ]);

              const callData = nftInterface.encodeFunctionData('tokenOfOwnerByIndex', [address, i]);
              const result = await provider.call({
                to: positionManagerAddress,
                data: callData
              });

              if (result && result !== '0x') {
                tokenId = ethers.toBigInt(result);
                console.log(`Found token ID (alternate method): ${tokenId.toString()}`);
              } else {
                console.warn(`No token ID data returned at index ${i}`);
                continue;
              }
            } else {
              console.error("Error getting token ID:", tokenError);
              continue;
            }
          }

          let position;
          try {
            position = await positionManager.positions(tokenId);
            console.log(`Successfully retrieved position data for token ${tokenId}`);
          } catch (posError: any) {
            console.warn(`Error getting position for token ${tokenId}:`, posError.message || posError);

            try {
              // Determine if this is Aerodrome Slipstream, which might have a different positions struct
              const isAerodromeSlipstream = positionManagerAddress.toLowerCase() === "0x8279226865b008cdacd9ccd970d000b4b8c3fa58".toLowerCase();

              // Use appropriate interface based on the contract
              let posInterface;
              if (isAerodromeSlipstream) {
                // Slipstream might have a different struct arrangement
                posInterface = new ethers.Interface([
                  'function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1, address pool)'
                ]);
                console.log(`Using Aerodrome Slipstream-specific ABI for token ${tokenId}`);
              } else {
                // Standard Uniswap V3 interface
                posInterface = new ethers.Interface([
                  'function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
                ]);
              }

              console.log(`Attempting alternate method for token ${tokenId}`);
              const callData = posInterface.encodeFunctionData('positions', [tokenId]);

              // Use retryRpcCall to handle potential rate limiting
              const result = await retryRpcCall(async () => {
                return await provider.call({
                  to: positionManagerAddress,
                  data: callData
                });
              }, 5, 2000); // Increase initial delay to 2 seconds

              if (result && result !== '0x') {
                console.log(`Received raw position data for token ${tokenId}, length: ${result.length}`);
                try {
                  const decoded = posInterface.decodeFunctionResult('positions', result);
                  console.log(`Successfully decoded position data for token ${tokenId}`);

                  // Create a simplified position object with the essential data
                  position = {
                    token0: decoded[2], // token0 is at index 2
                    token1: decoded[3], // token1 is at index 3
                    fee: decoded[4],    // fee is at index 4
                    tickLower: decoded[5], // tickLower is at index 5
                    tickUpper: decoded[6], // tickUpper is at index 6
                    liquidity: decoded[7]  // liquidity is at index 7
                  };

                  // If this is Aerodrome Slipstream, also get the pool address
                  if (isAerodromeSlipstream && decoded.length > 12) {
                    position.pool = decoded[12]; // pool address might be at index 12
                  }

                } catch (decodeError) {
                  console.error(`Failed to decode position data for token ${tokenId}:`, decodeError);

                  // Try alternative decoders or fallback to metadata
                  // Check if we can get this data from the NFT metadata
                  try {
                    const nftContract = new ethers.Contract(
                      positionManagerAddress,
                      [
                        "function tokenURI(uint256) view returns (string)"
                      ],
                      provider
                    );

                    const tokenURI = await nftContract.tokenURI(tokenId);
                    if (tokenURI && tokenURI.startsWith('data:application/json;base64,')) {
                      console.log(`Found token URI with embedded metadata for ${tokenId}`);
                      const base64Data = tokenURI.replace('data:application/json;base64,', '');
                      const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
                      const metadata = JSON.parse(jsonString);

                      if (metadata.description) {
                        // Extract data from NFT description
                        const poolAddressMatch = metadata.description.match(/Pool Address:\s*(0x[a-fA-F0-9]{40})/);
                        const token0Match = metadata.description.match(/(USDC|ETH|DAI|WETH|Token0) Address:\s*(0x[a-fA-F0-9]{49]{40})/);
                        const token1Match = metadata.description.match(/(ETH|USDC|DAI|WETH|Token1) Address:\s*(0x[a-fA-F0-9]{40})/);

                        position = {
                          token0: token0Match && token0Match[2] ? ethers.getAddress(token0Match[2].trim()) : undefined,
                          token1: token1Match && token1Match[2] ? ethers.getAddress(token1Match[2].trim()) : undefined,
                          pool: poolAddressMatch && poolAddressMatch[1] ? ethers.getAddress(poolAddressMatch[1].trim()) : undefined,
                          fee: 100, // Default for Aerodrome Slipstream
                          liquidity: ethers.parseUnits("1", 18) // Placeholder
                        };

                        console.log(`Successfully extracted position data from metadata for token ${tokenId}`);
                      }
                    }
                  } catch (metadataError) {
                    console.error(`Failed to get metadata for token ${tokenId}:`, metadataError);
                  }

                  if (!position) {
                    // Try parsing the raw data manually as a last resort
                    if (result.length >= 2 + 32*12) { // Minimum expected length for the struct
                      console.log(`Attempting manual parsing of position data for token ${tokenId}`);
                      try {
                        // Skip first 32 bytes (nonce) and second 32 bytes (operator)
                        const token0Hex = '0x' + result.slice(2 + 64, 2 + 64 + 40);
                        const token1Hex = '0x' + result.slice(2 + 96 + 24, 2 + 96 + 64);
                        const liquidityHex = '0x' + result.slice(2 + 256, 2 + 256 + 64);

                        position = {
                          token0: ethers.getAddress(token0Hex),
                          token1: ethers.getAddress(token1Hex),
                          fee: 100, // Default for Aerodrome Slipstream
                          liquidity: ethers.toBigInt(liquidityHex)
                        };
                      } catch (manualError) {
                        console.error(`Manual parsing failed for token ${tokenId}:`, manualError);
                        continue;
                      }
                    } else {
                      console.warn(`Insufficient data length for manual parsing of token ${tokenId}`);
                      continue;
                    }
                  }
                }
              } else {
                console.warn(`No position data returned for token ${tokenId}`);
                continue;
              }
            } catch (alternateError) {
              console.error(`Alternate method failed for token ${tokenId}:`, alternateError);
              continue;
            }
          }

          // Format position details with proper names and information
          let name = `Position #${tokenId}`;
          let collectionName = "Liquidity Position";

          if (positionManagerAddress.toLowerCase() === "0x03a520b32c04bf3beef7beb72e6bc4c84c44f9fb".toLowerCase()) {
            collectionName = "Uniswap V3";
            name = `Uniswap V3 Position #${tokenId}`;
          } else if (
            positionManagerAddress.toLowerCase() === "0x82792f8f57635dc7e4c78feb5a7a2cfd102a1cc3".toLowerCase() ||
            positionManagerAddress.toLowerCase() === "0x8279226865b008cdacd9ccd970d000b4b8c3fa58".toLowerCase()
          ) {
            collectionName = "Aerodrome";
            name = `Aerodrome Position #${tokenId}`;
          } else if (contract?.name) {
            collectionName = contract.name;
          }

          // Get token symbols if available
          let token0Symbol = "Unknown";
          let token1Symbol = "Unknown";

          if (position.token0 && tokenSymbols[position.token0.toLowerCase()]) {
            token0Symbol = tokenSymbols[position.token0.toLowerCase()];
          }

          if (position.token1 && tokenSymbols[position.token1.toLowerCase()]) {
            token1Symbol = tokenSymbols[position.token1.toLowerCase()];
          }

          // Create price range info if available
          let priceRangeInfo = {};
          if (position.tickLower !== undefined && position.tickUpper !== undefined) {
            // Calculate price range if ticks are available (simplified example)
            const tickToPrice = (tick) => (1.0001 ** tick).toFixed(6);
            priceRangeInfo = {
              tickLower: position.tickLower,
              tickUpper: position.tickUpper,
              priceLower: tickToPrice(position.tickLower),
              priceUpper: tickToPrice(position.tickUpper)
            };
          }

          nfts.push({
            id: tokenId.toString(),
            name: name,
            imageUrl: "/nft-position.png",
            collectionName: collectionName,
            details: {
              token0: position.token0,
              token1: position.token1,
              token0Symbol: token0Symbol,
              token1Symbol: token1Symbol,
              fee: position.fee?.toString() || "0",
              liquidity: position.liquidity?.toString() || "0",
              ...priceRangeInfo
            }
          });

          console.log(`Successfully added NFT position${tokenId} to list`);
        } catch (error) {
          console.error("Error fetching position:", i, error);
        }
      }
    }

    // Helper function for retrying RPC calls with improved error handling
    const retryRpcCall = async (fn, maxRetries = 5, initialDelay = 1000) => {
      let lastError;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;

          // Expanded list of retryable errors
          const isRetryable =
            error.code === "SERVER_ERROR" ||
            error.code === "TIMEOUT" ||
            error.code === "NETWORK_ERROR" ||
            error.code === "UNKNOWN_ERROR" ||
            error.code === "BAD_DATA" || // Sometimes BAD_DATA is temporary
            error.message?.includes("429") ||
            error.message?.includes("too many requests") ||
            error.message?.includes("timeout") ||
            error.message?.includes("rate limit") ||
            error.message?.includes("could not decode") || // Sometimes decode errors are from node issues
            error.message?.includes("temporarily") ||
            error.message?.includes("temporarily unavailable");

          if (isRetryable) {
            const delay = initialDelay * Math.pow(2, attempt);
            const maxDelay = 10000; // Cap at 10 seconds
            const actualDelay = Math.min(delay, maxDelay);

            console.log(
              `RPC call failed with "${
                error.message || error
              }" (attempt ${attempt + 1}/${maxRetries}). Retrying in ${actualDelay}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, actualDelay));
            continue;
          }

          // For non-retryable errors, throw immediately
          console.error(`Non-retryable error encountered:`, error);
          throw error;
        }
      }

      console.error(
        `All ${maxRetries} retry attempts failed with error:`,
        lastError
      );
      throw lastError;
    };

 // Directly check for Aerodrome Slipstream positions
    if (
      additionalContracts.some(
        (c) =>
          c.address.toLowerCase() ===
          "0x8279226865b008cdacd9ccd970d000b4b8c3fa58".toLowerCase()
      )
    ) {
      console.log("Fetching Aerodrome Slipstream positions...");
      const slipstreamPositions = await fetchAerodromeSlipstreamPositions(
        provider,
        address
      );
      nfts.push(...slipstreamPositions);
    }

    // Check additional contracts
    for (const contract of additionalContracts) {
      // Skip Aerodrome Slipstream as we've already processed it
      if (
        contract.address.toLowerCase() ===
        "0x8279226865b008cdacd9ccd970d000b4b8c3fa58".toLowerCase()
      ) {
        continue;
      }

      try {
        console.log(
          `Checking additional NFT collection: ${contract.name} at ${contract.address}`
        );

        const nftContract = new ethers.Contract(
          contract.address,
          [
            "function balanceOf(address) view returns (uint256)",
            "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
            "function tokenURI(uint256) view returns (string)"
          ],
          provider
        );

        // Try to get balance with retry logic
        let balance;
        try {
          balance = await retryRpcCall(() => nftContract.balanceOf(address));
          console.log(
            `NFT balance for ${contract.name}:`,
            balance.toString()
          );
        } catch (balanceError) {
          console.warn(
            `Error getting balance for ${contract.name}:`,
            balanceError
          );
          continue;
        }

        // Fetch tokens
        const balanceNum = Number(balance);
        if (balanceNum > 0) {
          for (let i = 0; i < balanceNum; i++) {
            try {
              const tokenId = await nftContract.tokenOfOwnerByIndex(
                address,
                i
              );
              console.log(`Found token ID: ${tokenId.toString()}`);

              // Try to fetch token metadata if tokenURI function exists
              let metadata = null;
              try {
                const tokenURI = await nftContract.tokenURI(tokenId);
                console.log(
                  `Token URI for ${tokenId.toString()}:`,
                  tokenURI
                );

                // Parse base64 encoded JSON if applicable
                if (tokenURI.startsWith("data:application/json;base64,")) {
                  const base64Data = tokenURI.replace(
                    "data:application/json;base64,",
                    ""
                  );
                  const jsonString = Buffer.from(
                    base64Data,
                    "base64"
                  ).toString("utf-8");
                  metadata = JSON.parse(jsonString);
                  console.log(
                    `Metadata fetched for token ${tokenId.toString()}:`,
                    metadata
                  );
                }
              } catch (metadataError) {
                console.error(
                  `Error fetching metadata for token ${tokenId.toString()}:`,
                  metadataError
                );
              }

              // Add to NFTs list with enhanced metadata if available
              nfts.push({
                id: `${contract.address}-${tokenId.toString()}`,
                name: metadata?.name || `${contract.name} #${tokenId}`,
                imageUrl: metadata?.image || "/nft-position.png", // Use metadata image if available
                collectionName: contract.name,
                details: {
                  tokenId: tokenId.toString(),
                  contractAddress: contract.address,
                  description: metadata?.description,
                  // Parse metadata description to extract key information if it exists
                  ...(metadata?.description
                    ? parseNFTDescription(metadata.description, metadata.name)
                    : {})
                }
              });
            } catch (tokenError) {
              console.error(
                `Error fetching token for ${contract.name}:`,
                tokenError
              );
            }
          }
        }
      } catch (contractError) {
        console.error(`Error checking ${contract.name}:`, contractError);
      }
        }

        console.log("Returning NFTs:", nfts.length);
        res.json(nfts);
      } catch (error) {
        console.error("Error in getNFTsHandler:", error);
        res.status(500).json({
          error: "Failed to fetch NFTs",
          details: error.message,
          address: address
        });
      }
    }

// Helper functions
async function fetchUniswapV3Positions(
  provider: ethers.JsonRpcProvider,
  address: string
): Promise<any[]> {
  // Implementation to fetch from Uniswap V3 goes here
  return [];
}

// Price feed handler (placeholder)
async function getPriceHandler(req: Request, res: Response) {
  const token = req.params.token;
  const price = await getChainlinkPrice(token); // Placeholder function

  if (price === null) {
    return res.status(404).json({ message: "Price not found" });
  }

  res.json({ token, price });
}

async function getChainlinkPrice(token: string): Promise<number | null> {
  // Replace with actual Chainlink price feed integration
  // This is a placeholder, replace with your actual price feed logic.
  // Consider error handling and rate limiting.
  if (token === "ETH") return 1800; //Example price
  if (token === "USDC") return 1; //Example price
  return null;
}

const tokenSymbols = {
  // Base network tokens
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC", // USDC on Base
  "0x4200000000000000000000000000000000000006": "ETH",  // Wrapped ETH on Base
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": "DAI",  // DAI on Base
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": "USDbC", // USD Base Coin
  "0x2ae3f1ec7f1f5012cfc6c13c20c163c6969c28f2": "cbETH", // Coinbase ETH
  "0xb6fe221fe9eef5aba221c348ba20a1bf5e73624c": "BALD", // Bald token
  "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d": "BAYC", // Bored Ape Yacht Club

  // Ethereum mainnet tokens (for reference)
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",  // USDC on Ethereum
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "ETH",   // Native ETH
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",  // Wrapped ETH on Ethereum
  "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",   // DAI on Ethereum

  // Aliases for contract interactions
  "0x0000000000000000000000000000000000000000": "ETH"    // Sometimes used for ETH
};

function parseNFTDescription(description: string, name: string): any {
  try {
    // Extract data from NFT description
    const result: Record<string, string> = {};

    // Parse pool address
    const poolAddressMatch = description.match(/Pool Address:\s*(0x[a-fA-F0-9]{40})/);
    if (poolAddressMatch && poolAddressMatch[1]) {
      result.poolAddress = ethers.getAddress(poolAddressMatch[1].trim());
    }

    // Parse token addresses
    const token0Match = description.match(/(USDC|ETH|DAI|WETH|Token0) Address:\s*(0x[a-fA-F0-9]{40})/);
    const token1Match = description.match(/(ETH|USDC|DAI|WETH|Token1) Address:\s*(0x[a-fA-F0-9]{40})/);

    if (token0Match && token0Match[2]) {
      result.token0Address = ethers.getAddress(token0Match[2].trim());
      result.token0Symbol = token0Match[1];
    }

    if (token1Match && token1Match[2]) {
      result.token1Address = ethers.getAddress(token1Match[2].trim());
      result.token1Symbol = token1Match[1];
    }

    // Parse token ID
    const tokenIdMatch = description.match(/Token ID:\s*(\d+)/);
    if (tokenIdMatch && tokenIdMatch[1]) {
      result.tokenId = tokenIdMatch[1];
    }

    // Parse price range from name
    if (name) {
      const priceRangeMatch = name.match(/(\d+\.?\d*)<>(\d+\.?\d*)/);
      if (priceRangeMatch && priceRangeMatch.length >= 3) {
        result.lowerPrice = priceRangeMatch[1];
        result.upperPrice = priceRangeMatch[2];
      }
    }

    console.log("// Parsed NFT metadata:", result);
    return result;
  } catch (error) {
    console.error("Error parsing NFT description:", error);
    return {};
  }
}

// Enhanced helper to extract position details from NFT metadata
async function extractPositionDetailsFromMetadata(metadata, provider) {
  try {
    if (!metadata || !metadata.description) {
      return null;
    }

    // Extract pool and token addresses from the NFT metadata
    const poolAddressMatch = metadata.description.match(/Pool Address:\s*(0x[a-fA-F0-9]{40})/);
    const token0Match = metadata.description.match(/(USDC|ETH|DAI|WETH|Token0) Address:\s*(0x[a-fA-F0-9]{40})/);
    const token1Match = metadata.description.match(/(ETH|USDC|DAI|WETH|Token1) Address:\s*(0x[a-fA-F0-9]{40})/);
    const tokenIdMatch = metadata.description.match(/Token ID:\s*(\d+)/);
    const tickSpacingMatch = metadata.description.match(/Tick Spacing:\s*(\d+)/);

    // Extract price range from name
    const priceRangeMatch = metadata.name?.match(/(\d+\.?\d*)<>(\d+\.?\d*)/);

    const poolAddress = poolAddressMatch && poolAddressMatch[1] ? ethers.getAddress(poolAddressMatch[1].trim()) : undefined;
    const token0 = token0Match && token0Match[2] ? ethers.getAddress(token0Match[2].trim()) : undefined;
    const token1 = token1Match && token1Match[2] ? ethers.getAddress(token1Match[2].trim()) : undefined;
    const tokenId = tokenIdMatch && tokenIdMatch[1] ? tokenIdMatch[1] : undefined;
    const tickSpacing = tickSpacingMatch && tickSpacingMatch[1] ? Number(tickSpacingMatch[1]) : 100;

    // Calculate approximate tick values from price range
    let tickLower, tickUpper;
    if (priceRangeMatch && priceRangeMatch.length >= 3) {
      const lowerPrice = parseFloat(priceRangeMatch[1]);
      const upperPrice = parseFloat(priceRangeMatch[2]);

      // Convert price to ticks (approximation)
      tickLower = Math.floor(Math.log(lowerPrice) / Math.log(1.0001));
      tickUpper = Math.floor(Math.log(upperPrice) / Math.log(1.0001));

      // Ensure ticks are divisible by tickSpacing
      tickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
      tickUpper = Math.floor(tickUpper / tickSpacing) * tickSpacing;
    }

    // If we have the pool address and token info, try to get liquidity
    let liquidityInfo = {};
    if (poolAddress && provider && (tickLower !== undefined && tickUpper !== undefined)) {
      try {
        const poolContract = new ethers.Contract(
          poolAddress,
          ["function liquidity() view returns (uint128)"],
          provider
        );
        const totalLiquidity = await poolContract.liquidity();

        // For now, we'll use a placeholder value based on the total pool liquidity
        // In a real scenario, you'd calculate the specific position's share
        liquidityInfo = {
          liquidity: totalLiquidity.toString(),
          tickLower,
          tickUpper
        };
      } catch (error) {
        console.warn(`Could not get liquidity info from pool ${poolAddress}:`, error.message);
      }
    }

    return {
      poolAddress,
      token0,
      token1,
      token0Symbol: token0Match ? token0Match[1] : "Unknown",
      token1Symbol: token1Match ? token1Match[1] : "Unknown",
      tokenId,
      tickSpacing,
      lowerPrice: priceRangeMatch ? priceRangeMatch[1] : "0",
      upperPrice: priceRangeMatch ? priceRangeMatch[2] : "0",
      ...liquidityInfo
    };
  } catch (error) {
    console.error("Error extracting position details from metadata:", error);
    return null;
  }
}

async function fetchTokenBalances(address: string): Promise<any[]> {
    //Implementation to fetch token balances goes here
    return [];
}

async function fetchNFTPositions(address: string):Promise<any[]> {
    //Implementation to fetch NFT positions goes here
    return [];
}