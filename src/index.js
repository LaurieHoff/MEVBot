const { ethers } = require('ethers');
const DexMonitor = require('./monitor');
const ArbitrageExecutor = require('./executor');
const RiskManager = require('./risk');
const TokenUtils = require('./tokens');
const GasOptimizer = require('./gas');
const logger = require('./logger');
const config = require('./config');

class MEVBot {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.monitor = null;
        this.executor = null;
        this.riskManager = null;
        this.tokenUtils = null;
        this.gasOptimizer = null;
        this.isRunning = false;
        this.scanInterval = 15000; // 15 seconds
        this.stats = {
            scansCompleted: 0,
            opportunitiesFound: 0,
            tradesExecuted: 0,
            startTime: null
        };
    }

    async initialize() {
        console.log('🤖 MEV Bot initializing...');
        
        try {
            // Initialize provider
            this.provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
            console.log('🔗 Connected to Ethereum network');

            // Initialize wallet if private key is provided
            if (config.wallet.privateKey) {
                this.wallet = new ethers.Wallet(config.wallet.privateKey, this.provider);
                console.log(`💰 Wallet loaded: ${this.wallet.address}`);
            } else {
                console.log('⚠️  No wallet configured - running in monitor-only mode');
            }

            // Initialize DEX monitor
            this.monitor = new DexMonitor();
            await this.setupWatchedPairs();

            // Initialize all modules
            this.executor = new ArbitrageExecutor(this.provider, this.wallet);
            this.riskManager = new RiskManager();
            this.tokenUtils = new TokenUtils(this.provider);
            this.gasOptimizer = new GasOptimizer(this.provider);

            // Initialize stats
            this.stats.startTime = Date.now();

            logger.info('MEV Bot initialized successfully', {
                walletAddress: this.wallet ? this.wallet.address : 'none',
                scanInterval: this.scanInterval,
                modules: ['monitor', 'executor', 'riskManager', 'tokenUtils', 'gasOptimizer']
            });
            console.log('✅ MEV Bot initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize MEV Bot:', error.message);
            process.exit(1);
        }
    }

    async setupWatchedPairs() {
        // Add some popular ETH pairs for monitoring
        const popularPairs = [
            { address: '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11', exchange: 'Uniswap V2', name: 'DAI/WETH' },
            { address: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc', exchange: 'Uniswap V2', name: 'USDC/WETH' }
        ];

        console.log('📡 Setting up watched pairs...');
        for (const pair of popularPairs) {
            await this.monitor.addWatchPair(pair.address, pair.exchange);
        }
    }

    async start() {
        if (this.isRunning) {
            console.log('⚠️  Bot is already running');
            return;
        }

        await this.initialize();
        this.isRunning = true;
        
        console.log('🚀 MEV Bot started - monitoring for opportunities...');
        
        // Main bot loop will be implemented here
        this.monitorLoop();
    }

    async monitorLoop() {
        console.log(`🔍 Starting monitor loop (scanning every ${this.scanInterval/1000}s)`);
        
        while (this.isRunning) {
            try {
                await this.scanForOpportunities();
                await new Promise(resolve => setTimeout(resolve, this.scanInterval));
            } catch (error) {
                console.error('❌ Error in monitor loop:', error.message);
                await new Promise(resolve => setTimeout(resolve, this.scanInterval * 2));
            }
        }
    }

    async scanForOpportunities() {
        const startTime = Date.now();
        const watchedPairs = Array.from(this.monitor.watchedPairs.keys());
        
        // Check if trading should be halted due to risk limits
        if (this.riskManager.shouldHaltTrading()) {
            logger.warn('Trading halted due to daily loss limit');
            return;
        }
        
        // Fetch current prices for all watched pairs
        const pricePromises = watchedPairs.map(pairAddress => 
            this.monitor.fetchPairPrice(pairAddress)
        );
        
        const results = await Promise.allSettled(pricePromises);
        let successfulScans = 0;
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                successfulScans++;
            } else if (result.status === 'rejected') {
                logger.error(`Failed to scan pair ${watchedPairs[index]}`, { error: result.reason });
            }
        });

        this.stats.scansCompleted++;

        if (successfulScans > 0) {
            const opportunities = await this.monitor.scanForArbitrageOpportunities();
            
            if (opportunities.length > 0) {
                this.stats.opportunitiesFound += opportunities.length;
                console.log(`💰 Found ${opportunities.length} arbitrage opportunities:`);
                
                for (let i = 0; i < Math.min(3, opportunities.length); i++) {
                    const opp = opportunities[i];
                    console.log(`  ${i + 1}. ${opp.profitPercent.toFixed(2)}% profit between ${opp.pair1.exchange} and ${opp.pair2.exchange}`);
                    
                    logger.arbitrage(opp, 'detected');
                    
                    // Enhanced opportunity evaluation
                    if (await this.evaluateAndExecuteOpportunity(opp)) {
                        this.stats.tradesExecuted++;
                    }
                }
            } else {
                logger.debug(`Scanned ${successfulScans} pairs - no opportunities found`);
            }
        }

        const duration = Date.now() - startTime;
        logger.performance('Scan cycle', duration, successfulScans > 0);
    }

    async evaluateAndExecuteOpportunity(opportunity) {
        try {
            // Get current gas price
            const gasData = await this.gasOptimizer.getCurrentGasPrice();
            const tradeAmount = ethers.parseEther('0.1'); // Default trade size
            
            // Risk assessment
            const riskAssessment = await this.riskManager.assessTradeRisk(
                opportunity,
                tradeAmount,
                gasData.gasPrice
            );
            
            if (!riskAssessment.approved) {
                logger.warn('Opportunity rejected by risk manager', {
                    reason: riskAssessment.recommendation,
                    risks: riskAssessment.risks.length
                });
                return false;
            }

            // Check profitability with current gas prices
            if (this.executor && await this.executor.isArbitrageProfitable(opportunity)) {
                logger.info('Executing profitable arbitrage opportunity', {
                    profit: opportunity.profitPercent,
                    riskScore: riskAssessment.score
                });
                
                const result = await this.executor.executeArbitrage(opportunity);
                
                if (result && result.success) {
                    logger.trade(result);
                    logger.arbitrage(opportunity, 'executed');
                    
                    // Record trade result for risk management
                    const profit = (opportunity.profitPercent / 100) * 0.1; // Simplified calculation
                    this.riskManager.recordTradeResult(tradeAmount, profit, result.gasUsed);
                    
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            logger.error('Error evaluating opportunity', { error: error.message });
            return false;
        }
    }

    getStats() {
        const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
        return {
            ...this.stats,
            runtime: Math.floor(runtime / 1000), // seconds
            dailyStats: this.riskManager ? this.riskManager.getDailyStats() : null,
            gasHistory: this.gasOptimizer ? this.gasOptimizer.getGasHistory().slice(-5) : [],
            tokenCacheSize: this.tokenUtils ? this.tokenUtils.getCacheSize() : 0
        };
    }

    async stop() {
        console.log('🛑 Stopping MEV Bot...');
        this.isRunning = false;
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n📍 Received SIGINT, shutting down gracefully...');
    if (bot) {
        await bot.stop();
    }
    process.exit(0);
});

const bot = new MEVBot();

if (require.main === module) {
    bot.start().catch(console.error);
}

module.exports = MEVBot;