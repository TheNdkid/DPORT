import { z } from 'zod';

// Base position type with all common fields
export const basePositionSchema = z.object({
  id: z.string(),
  protocol: z.string(),
  type: z.string(),
  token0Symbol: z.string().optional(),
  token1Symbol: z.string().optional(),
  token0Amount: z.string().optional(),
  token1Amount: z.string().optional(),
  sharePercentage: z.string().optional(),
  poolAddress: z.string().optional(),
  liquidity: z.string().optional(), // Add liquidity field
  tickLower: z.number().optional(),
  tickUpper: z.number().optional(),
  priceRange: z.object({
    lower: z.string(),
    upper: z.string()
  }).optional(),
  fee: z.number().optional(),
});

// Aerodrome specific fields
export const aerodromePositionSchema = basePositionSchema.extend({
  tickSpacing: z.number().optional(),
  tokenId: z.string().optional(),
});

// Uniswap V4 specific fields
export const uniswapV4PositionSchema = basePositionSchema.extend({
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
});

// Union type for all position types
export const positionSchema = z.union([
  basePositionSchema,
  aerodromePositionSchema,
  uniswapV4PositionSchema
]);

// Infer TypeScript types
export type BasePosition = z.infer<typeof basePositionSchema>;
export type AerodromePosition = z.infer<typeof aerodromePositionSchema>;
export type UniswapV4Position = z.infer<typeof uniswapV4PositionSchema>;
export type Position = z.infer<typeof positionSchema>;