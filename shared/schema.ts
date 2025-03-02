import { pgTable, text, serial, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  address: text("address").notNull().unique(),
  lastUpdated: timestamp("last_updated").notNull(),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  walletId: serial("wallet_id").references(() => wallets.id),
  symbol: text("symbol").notNull(),
  balance: numeric("balance").notNull(),
  usdValue: numeric("usd_value").notNull(),
  lastUpdated: timestamp("last_updated").notNull(),
});

// Extended Position schema for DeFi positions
export interface DeFiPosition {
  id: string;
  protocol: string;
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  liquidity: string;
  tokenAmount0: string;
  tokenAmount1: string;
  priceRange?: {
    lower: string;
    upper: string;
  };
}

// Update the existing Position type to include DeFi-specific fields
export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  walletId: serial("wallet_id").references(() => wallets.id),
  protocol: text("protocol").notNull(),
  type: text("type").notNull(),
  apy: numeric("apy").notNull(),
  tvl: numeric("tvl").notNull(),
  token0Symbol: text("token0_symbol"),
  token1Symbol: text("token1_symbol"),
  tokenAmount0: text("token_amount_0"),
  tokenAmount1: text("token_amount_1"),
  liquidity: text("liquidity"),
  priceLower: text("price_lower"),
  priceUpper: text("price_upper"),
  lastUpdated: timestamp("last_updated").notNull(),
});

export const liquidityPools = pgTable("liquidity_pools", {
  id: serial("id").primaryKey(),
  protocol: text("protocol").notNull(), // e.g., "uniswap", "aerodrome"
  poolAddress: text("pool_address").notNull().unique(),
  token0Symbol: text("token0_symbol").notNull(),
  token1Symbol: text("token1_symbol").notNull(),
  token0Address: text("token0_address").notNull(),
  token1Address: text("token1_address").notNull(),
  tvlUSD: numeric("tvl_usd").notNull(),
  volumeUSD24h: numeric("volume_usd_24h").notNull(),
  apr: numeric("apr").notNull(),
  feeTier: text("fee_tier"),
  poolType: text("pool_type").notNull(), // "vAMM" or "concentrated"
  gaugeAddress: text("gauge_address"), // For Aerodrome staking
  isStable: boolean("is_stable").default(false), // For Aerodrome's stable vs volatile pools
  lastUpdated: timestamp("last_updated").notNull(),
});

export const liquidityPositions = pgTable("liquidity_positions", {
  id: serial("id").primaryKey(),
  walletId: serial("wallet_id").references(() => wallets.id),
  poolId: serial("pool_id").references(() => liquidityPools.id),
  positionType: text("position_type").notNull(), // "LP_TOKEN" or "NFT"
  tokenId: text("token_id"), // For NFT positions
  token0Deposited: numeric("token0_deposited").notNull(),
  token1Deposited: numeric("token1_deposited").notNull(),
  priceLower: numeric("price_lower"), // For concentrated positions
  priceUpper: numeric("price_upper"), // For concentrated positions
  liquidity: numeric("liquidity").notNull(),
  stakedAmount: numeric("staked_amount"), // Amount staked in gauge
  unstakedAmount: numeric("unstaked_amount"), // Unstaked LP tokens
  rewardsClaimed: numeric("rewards_claimed").default('0'),
  lastUpdated: timestamp("last_updated").notNull(),
});

export const automationRules = pgTable("automation_rules", {
  id: serial("id").primaryKey(),
  walletId: serial("wallet_id").references(() => wallets.id),
  positionId: serial("position_id").references(() => positions.id),
  ruleType: text("rule_type").notNull(),
  targetValue: numeric("target_value").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  frequency: text("frequency").notNull(),
  lastExecuted: timestamp("last_executed"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  walletId: serial("wallet_id").references(() => wallets.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  expectedApy: numeric("expected_apy").notNull(),
  riskLevel: text("risk_level").notNull(),
  protocol: text("protocol").notNull(),
  requiredAssets: text("required_assets").array(),
  lastUpdated: timestamp("last_updated").notNull(),
});

// Insert schemas
export const insertWalletSchema = createInsertSchema(wallets);
export const insertAssetSchema = createInsertSchema(assets);
export const insertPositionSchema = createInsertSchema(positions);
export const insertStrategySchema = createInsertSchema(strategies);
export const insertAutomationRuleSchema = createInsertSchema(automationRules);
export const insertLiquidityPoolSchema = createInsertSchema(liquidityPools);
export const insertLiquidityPositionSchema = createInsertSchema(liquidityPositions);

// Types
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type InsertAutomationRule = z.infer<typeof insertAutomationRuleSchema>;
export type InsertLiquidityPool = z.infer<typeof insertLiquidityPoolSchema>;
export type InsertLiquidityPosition = z.infer<typeof insertLiquidityPositionSchema>;

export type Wallet = typeof wallets.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type Strategy = typeof strategies.$inferSelect;
export type AutomationRule = typeof automationRules.$inferSelect;
export type LiquidityPool = typeof liquidityPools.$inferSelect;
export type LiquidityPosition = typeof liquidityPositions.$inferSelect;

export interface PriceFeedConfig {
  [key: string]: string;
}

export interface Pool {
  id: string;
  protocol: string;
  token0Symbol: string;
  token1Symbol: string;
  tvl: string;
  apr: string;
  volume24h: string;
  fee: number;
  priceRange?: {
    lower: string;
    upper: string;
  };
  isNFT?: boolean;
}