#!/usr/bin/env node

const readline = require('readline');
const MEVBot = require('./index');
const logger = require('./logger');
const Web3Utils = require('./utils');

class CLIInterface {
    constructor() {
        this.bot = null;
        this.rl = null;
        this.isInteractive = false;
    }

    async start() {
        console.log('🤖 MEV Bot CLI Interface');
        console.log('Type "help" for available commands\n');

        this.bot = new MEVBot();
        
        // Setup readline interface
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'mevbot> '
        });

        this.setupEventHandlers();
        this.showPrompt();
        this.isInteractive = true;
    }

    setupEventHandlers() {
        this.rl.on('line', async (input) => {
            const command = input.trim().toLowerCase();
            await this.handleCommand(command);
            if (this.isInteractive) {
                this.showPrompt();
            }
        });

        this.rl.on('close', () => {
            console.log('\n👋 Goodbye!');
            process.exit(0);
        });

        // Handle Ctrl+C gracefully
        process.on('SIGINT', async () => {
            console.log('\n🛑 Received interrupt signal...');
            if (this.bot && this.bot.isRunning) {
                await this.bot.stop();
            }
            process.exit(0);
        });
    }

    showPrompt() {
        this.rl.prompt();
    }

    async handleCommand(command) {
        const args = command.split(' ');
        const cmd = args[0];

        try {
            switch (cmd) {
                case 'help':
                case 'h':
                    this.showHelp();
                    break;

                case 'start':
                    await this.startBot();
                    break;

                case 'stop':
                    await this.stopBot();
                    break;

                case 'status':
                    this.showStatus();
                    break;

                case 'stats':
                    this.showStats();
                    break;

                case 'config':
                    this.showConfig();
                    break;

                case 'pairs':
                    this.showWatchedPairs();
                    break;

                case 'gas':
                    this.showGasInfo();
                    break;

                case 'risk':
                    this.showRiskInfo();
                    break;

                case 'log':
                case 'logs':
                    this.handleLogCommand(args[1]);
                    break;

                case 'clear':
                    console.clear();
                    break;

                case 'exit':
                case 'quit':
                case 'q':
                    this.isInteractive = false;
                    this.rl.close();
                    break;

                case '':
                    // Empty command, do nothing
                    break;

                default:
                    console.log(`❌ Unknown command: ${cmd}. Type "help" for available commands.`);
            }
        } catch (error) {
            console.error(`❌ Error executing command: ${error.message}`);
        }
    }

    showHelp() {
        console.log(`
🤖 MEV Bot Commands:

Bot Control:
  start          - Initialize and start the bot
  stop           - Stop the bot
  status         - Show bot status
  
Information:
  stats          - Show performance statistics
  config         - Show current configuration
  pairs          - Show watched trading pairs
  gas            - Show gas price information
  risk           - Show risk management status
  
Logging:
  log info       - Set log level to info
  log debug      - Set log level to debug  
  log error      - Set log level to error
  
Utility:
  clear          - Clear the screen
  help, h        - Show this help message
  exit, quit, q  - Exit the CLI
        `);
    }

    async startBot() {
        if (this.bot.isRunning) {
            console.log('⚠️  Bot is already running');
            return;
        }

        console.log('🚀 Starting MEV Bot...');
        try {
            await this.bot.start();
        } catch (error) {
            console.error(`❌ Failed to start bot: ${error.message}`);
        }
    }

    async stopBot() {
        if (!this.bot.isRunning) {
            console.log('⚠️  Bot is not running');
            return;
        }

        console.log('🛑 Stopping MEV Bot...');
        await this.bot.stop();
    }

    showStatus() {
        if (!this.bot) {
            console.log('❌ Bot not initialized');
            return;
        }

        const status = this.bot.isRunning ? '🟢 Running' : '🔴 Stopped';
        const wallet = this.bot.wallet ? Web3Utils.formatAddress(this.bot.wallet.address) : 'None';
        const scanInterval = `${this.bot.scanInterval / 1000}s`;

        console.log(`
📊 Bot Status: ${status}
💰 Wallet: ${wallet}
⏱️  Scan Interval: ${scanInterval}
🔗 Provider: ${this.bot.provider ? 'Connected' : 'Not connected'}
        `);
    }

    showStats() {
        if (!this.bot) {
            console.log('❌ Bot not initialized');
            return;
        }

        const stats = this.bot.getStats();
        const runtime = Web3Utils.formatDuration(stats.runtime * 1000);

        console.log(`
📈 Performance Statistics:
Runtime: ${runtime}
Scans completed: ${stats.scansCompleted}
Opportunities found: ${stats.opportunitiesFound}
Trades executed: ${stats.tradesExecuted}
        `);

        if (stats.dailyStats) {
            console.log(`
💰 Daily Trading Stats:
Trades: ${stats.dailyStats.trades}
Profit: ${stats.dailyStats.totalProfitEth} ETH
Loss: ${stats.dailyStats.totalLossEth} ETH
Net: ${stats.dailyStats.netProfitEth} ETH
            `);
        }
    }

    showConfig() {
        const config = require('./config');
        
        console.log(`
⚙️  Configuration:
Ethereum RPC: ${config.ethereum.rpcUrl}
Min Profit: ${config.mev.minProfitEth} ETH
Max Gas: ${config.mev.maxGasPrice} gwei
Slippage Tolerance: ${config.mev.slippageTolerance}%
Log Level: ${config.monitoring.logLevel}
        `);
    }

    showWatchedPairs() {
        if (!this.bot || !this.bot.monitor) {
            console.log('❌ Bot not initialized');
            return;
        }

        const pairs = Array.from(this.bot.monitor.watchedPairs.entries());
        
        if (pairs.length === 0) {
            console.log('📊 No pairs being watched');
            return;
        }

        console.log('\n👀 Watched Trading Pairs:');
        pairs.forEach(([address, info], index) => {
            console.log(`  ${index + 1}. ${Web3Utils.formatAddress(address)} (${info.exchange})`);
        });
        console.log();
    }

    showGasInfo() {
        if (!this.bot || !this.bot.gasOptimizer) {
            console.log('❌ Bot not initialized');
            return;
        }

        const gasHistory = this.bot.gasOptimizer.getGasHistory();
        const averageGas = this.bot.gasOptimizer.getAverageGasPrice(5);
        const trend = this.bot.gasOptimizer.predictGasTrend();

        console.log(`
⛽ Gas Information:
Recent prices: ${gasHistory.slice(-3).map(g => g.gasPriceGwei).join(' → ')} gwei
Average (5min): ${averageGas ? Web3Utils.formatGasPrice(averageGas) : 'N/A'}
Trend: ${trend}
        `);
    }

    showRiskInfo() {
        if (!this.bot || !this.bot.riskManager) {
            console.log('❌ Bot not initialized');
            return;
        }

        const dailyStats = this.bot.riskManager.getDailyStats();
        const shouldHalt = this.bot.riskManager.shouldHaltTrading();

        console.log(`
⚠️  Risk Management:
Daily trades: ${dailyStats.trades}
Daily profit: ${dailyStats.totalProfitEth} ETH
Daily loss: ${dailyStats.totalLossEth} ETH
Trading status: ${shouldHalt ? '🔴 Halted' : '🟢 Active'}
        `);
    }

    handleLogCommand(level) {
        if (!level) {
            console.log('Current log level:', logger.logLevel);
            console.log('Available levels: error, warn, info, debug');
            return;
        }

        const validLevels = ['error', 'warn', 'info', 'debug'];
        if (!validLevels.includes(level)) {
            console.log(`❌ Invalid log level. Use: ${validLevels.join(', ')}`);
            return;
        }

        logger.logLevel = level;
        console.log(`✅ Log level set to: ${level}`);
    }
}

// Auto-start CLI if this file is run directly
if (require.main === module) {
    const cli = new CLIInterface();
    cli.start().catch(console.error);
}

module.exports = CLIInterface;