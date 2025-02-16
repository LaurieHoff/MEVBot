const { ethers } = require('ethers');
const DexMonitor = require('./monitor');
const ArbitrageExecutor = require('./executor');
const logger = require('./logger');
const config = require('./config');

class MEVBot {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.monitor = null;
        this.executor = null;
        this.isRunning = false;
        this.scanInterval = 15000; // 15 seconds
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

            // Initialize arbitrage executor
            this.executor = new ArbitrageExecutor(this.provider, this.wallet);

            logger.info('MEV Bot initialized successfully', {
                walletAddress: this.wallet ? this.wallet.address : 'none',
                scanInterval: this.scanInterval
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
        const watchedPairs = Array.from(this.monitor.watchedPairs.keys());
        
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
                console.error(`Failed to scan pair ${watchedPairs[index]}`);
            }
        });

        if (successfulScans > 0) {
            const opportunities = await this.monitor.scanForArbitrageOpportunities();
            
            if (opportunities.length > 0) {
                console.log(`💰 Found ${opportunities.length} arbitrage opportunities:`);
                
                for (let i = 0; i < Math.min(3, opportunities.length); i++) {
                    const opp = opportunities[i];
                    console.log(`  ${i + 1}. ${opp.profitPercent.toFixed(2)}% profit between ${opp.pair1.exchange} and ${opp.pair2.exchange}`);
                    
                    logger.arbitrage(opp, 'detected');
                    
                    // Check if profitable enough to execute
                    if (this.executor && await this.executor.isArbitrageProfitable(opp)) {
                        logger.info('Executing profitable arbitrage opportunity');
                        const result = await this.executor.executeArbitrage(opp);
                        
                        if (result && result.success) {
                            logger.trade(result);
                            logger.arbitrage(opp, 'executed');
                        }
                    }
                }
            } else {
                logger.debug(`Scanned ${successfulScans} pairs - no opportunities found`);
            }
        }
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