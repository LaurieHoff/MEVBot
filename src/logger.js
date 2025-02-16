const config = require('./config');

class Logger {
    constructor() {
        this.logLevel = config.monitoring.logLevel;
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = this.getPrefix(level);
        
        let logMessage = `[${timestamp}] ${prefix} ${message}`;
        
        if (data) {
            logMessage += ` | ${JSON.stringify(data)}`;
        }
        
        return logMessage;
    }

    getPrefix(level) {
        const prefixes = {
            error: '❌ ERROR',
            warn: '⚠️  WARN ',
            info: 'ℹ️  INFO ',
            debug: '🔍 DEBUG'
        };
        return prefixes[level] || 'LOG';
    }

    error(message, data = null) {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, data));
        }
    }

    warn(message, data = null) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, data));
        }
    }

    info(message, data = null) {
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', message, data));
        }
    }

    debug(message, data = null) {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, data));
        }
    }

    arbitrage(opportunity, action = 'detected') {
        const message = `Arbitrage ${action}: ${opportunity.profitPercent.toFixed(2)}% between ${opportunity.pair1.exchange} and ${opportunity.pair2.exchange}`;
        
        if (action === 'executed' || opportunity.profitPercent > 1.0) {
            this.info(message, {
                profit: opportunity.profitPercent,
                exchanges: [opportunity.pair1.exchange, opportunity.pair2.exchange],
                token0: opportunity.token0,
                token1: opportunity.token1
            });
        } else {
            this.debug(message, opportunity);
        }
    }

    performance(operation, duration, success = true) {
        const status = success ? 'completed' : 'failed';
        this.debug(`${operation} ${status} in ${duration}ms`);
    }

    trade(tradeData) {
        this.info('Trade executed', {
            amount: tradeData.tradeAmount,
            profit: tradeData.estimatedProfit,
            gasUsed: tradeData.gasUsed,
            exchanges: tradeData.exchangeUsed
        });
    }
}

module.exports = new Logger();