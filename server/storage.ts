import { 
  type Wallet, type InsertWallet,
  type Asset, type InsertAsset,
  type Position, type InsertPosition,
  type Strategy, type InsertStrategy,
  type AutomationRule, type InsertAutomationRule
} from "@shared/schema";

export interface IStorage {
  // Wallet operations
  getWallet(address: string): Promise<Wallet | undefined>;
  upsertWallet(wallet: InsertWallet): Promise<Wallet>;

  // Asset operations
  getAssetsByWallet(walletId: number): Promise<Asset[]>;
  upsertAsset(asset: InsertAsset): Promise<Asset>;

  // Position operations
  getPositionsByWallet(walletId: number): Promise<Position[]>;
  upsertPosition(position: InsertPosition): Promise<Position>;

  // Strategy operations
  getStrategiesByWallet(walletId: number): Promise<Strategy[]>;
  upsertStrategy(strategy: InsertStrategy): Promise<Strategy>;

  // Automation operations
  getAutomationRules(walletId: number, positionId?: number): Promise<AutomationRule[]>;
  upsertAutomationRule(rule: InsertAutomationRule): Promise<AutomationRule>;
}

export class MemStorage implements IStorage {
  private wallets: Map<string, Wallet>;
  private assets: Map<number, Asset[]>;
  private positions: Map<number, Position[]>;
  private strategies: Map<number, Strategy[]>;
  private automationRules: Map<number, AutomationRule[]>;
  private currentId: number;

  constructor() {
    this.wallets = new Map();
    this.assets = new Map();
    this.positions = new Map();
    this.strategies = new Map();
    this.automationRules = new Map();
    this.currentId = 1;
  }

  async getWallet(address: string): Promise<Wallet | undefined> {
    return Array.from(this.wallets.values()).find(w => w.address === address);
  }

  async upsertWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const existing = await this.getWallet(insertWallet.address);
    if (existing) {
      const updated = { ...existing, ...insertWallet };
      this.wallets.set(insertWallet.address, updated);
      return updated;
    }
    
    const wallet: Wallet = { ...insertWallet, id: this.currentId++ };
    this.wallets.set(wallet.address, wallet);
    return wallet;
  }

  async getAssetsByWallet(walletId: number): Promise<Asset[]> {
    return this.assets.get(walletId) || [];
  }

  async upsertAsset(asset: InsertAsset): Promise<Asset> {
    const walletAssets = this.assets.get(asset.walletId) || [];
    const newAsset: Asset = { ...asset, id: this.currentId++ };
    
    const index = walletAssets.findIndex(a => a.symbol === asset.symbol);
    if (index >= 0) {
      walletAssets[index] = { ...newAsset, id: walletAssets[index].id };
    } else {
      walletAssets.push(newAsset);
    }
    
    this.assets.set(asset.walletId, walletAssets);
    return newAsset;
  }

  async getPositionsByWallet(walletId: number): Promise<Position[]> {
    return this.positions.get(walletId) || [];
  }

  async upsertPosition(position: InsertPosition): Promise<Position> {
    const walletPositions = this.positions.get(position.walletId) || [];
    const newPosition: Position = { ...position, id: this.currentId++ };
    
    const index = walletPositions.findIndex(
      p => p.protocol === position.protocol && p.type === position.type
    );
    if (index >= 0) {
      walletPositions[index] = { ...newPosition, id: walletPositions[index].id };
    } else {
      walletPositions.push(newPosition);
    }
    
    this.positions.set(position.walletId, walletPositions);
    return newPosition;
  }

  async getStrategiesByWallet(walletId: number): Promise<Strategy[]> {
    return this.strategies.get(walletId) || [];
  }

  async upsertStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const walletStrategies = this.strategies.get(strategy.walletId) || [];
    const newStrategy: Strategy = { ...strategy, id: this.currentId++ };

    const index = walletStrategies.findIndex(
      s => s.protocol === strategy.protocol && s.title === strategy.title
    );
    if (index >= 0) {
      walletStrategies[index] = { ...newStrategy, id: walletStrategies[index].id };
    } else {
      walletStrategies.push(newStrategy);
    }

    this.strategies.set(strategy.walletId, walletStrategies);
    return newStrategy;
  }

  async getAutomationRules(walletId: number, positionId?: number): Promise<AutomationRule[]> {
    const rules = this.automationRules.get(walletId) || [];
    if (positionId) {
      return rules.filter(rule => rule.positionId === positionId);
    }
    return rules;
  }

  async upsertAutomationRule(rule: InsertAutomationRule): Promise<AutomationRule> {
    const walletRules = this.automationRules.get(rule.walletId) || [];
    const newRule: AutomationRule = {
      ...rule,
      id: this.currentId++,
      createdAt: rule.createdAt || new Date(),
      updatedAt: new Date()
    };

    const index = walletRules.findIndex(
      r => r.positionId === rule.positionId && r.ruleType === rule.ruleType
    );
    if (index >= 0) {
      walletRules[index] = { ...newRule, id: walletRules[index].id };
    } else {
      walletRules.push(newRule);
    }

    this.automationRules.set(rule.walletId, walletRules);
    return newRule;
  }
}

export const storage = new MemStorage();