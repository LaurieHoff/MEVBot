const { ethers } = require('ethers');
const config = require('./config');
const logger = require('./logger');

class GasOptimizer {
    constructor(provider) {
        this.provider = provider;
        this.maxGasPrice = ethers.parseUnits(config.mev.maxGasPrice.toString(), 'gwei');
        this.gasHistory = [];
        this.maxHistorySize = 10;
    }

    async getCurrentGasPrice() {
        try {
            const feeData = await this.provider.getFeeData();
            
            // Store gas price history for analysis
            this.addToHistory({
                gasPrice: feeData.gasPrice,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                timestamp: Date.now()
            });

            return feeData;
        } catch (error) {
            logger.error('Failed to fetch gas price', error);
            throw error;
        }
    }

    addToHistory(gasData) {
        this.gasHistory.push(gasData);
        if (this.gasHistory.length > this.maxHistorySize) {
            this.gasHistory.shift();
        }
    }

    calculateOptimalGasPrice(urgency = 'normal') {
        if (this.gasHistory.length === 0) {
            logger.warn('No gas history available, using network default');
            return null;
        }

        const recent = this.gasHistory[this.gasHistory.length - 1];
        let multiplier;

        switch (urgency) {
            case 'low':
                multiplier = 0.9; // 10% below current
                break;
            case 'normal':
                multiplier = 1.0; // Current price
                break;
            case 'high':
                multiplier = 1.2; // 20% above current
                break;
            case 'urgent':
                multiplier = 1.5; // 50% above current
                break;
            default:
                multiplier = 1.0;
        }

        // Calculate suggested gas price
        const suggestedGasPrice = recent.gasPrice * BigInt(Math.floor(multiplier * 100)) / 100n;
        
        // Ensure it doesn't exceed our maximum
        const finalGasPrice = suggestedGasPrice > this.maxGasPrice ? this.maxGasPrice : suggestedGasPrice;

        logger.debug('Gas price calculated', {
            urgency,
            current: ethers.formatUnits(recent.gasPrice, 'gwei'),
            suggested: ethers.formatUnits(suggestedGasPrice, 'gwei'),
            final: ethers.formatUnits(finalGasPrice, 'gwei'),
            multiplier
        });

        return {
            gasPrice: finalGasPrice,
            maxFeePerGas: recent.maxFeePerGas ? recent.maxFeePerGas * BigInt(Math.floor(multiplier * 100)) / 100n : null,
            maxPriorityFeePerGas: recent.maxPriorityFeePerGas
        };
    }

    async estimateTransactionGas(transaction) {
        try {
            const gasEstimate = await this.provider.estimateGas(transaction);
            
            // Add 20% buffer to gas limit to ensure transaction doesn't fail
            const gasLimit = gasEstimate * 120n / 100n;
            
            logger.debug('Gas estimation completed', {
                estimated: gasEstimate.toString(),
                withBuffer: gasLimit.toString()
            });

            return gasLimit;
        } catch (error) {
            logger.error('Gas estimation failed', { error: error.message });
            // Return a reasonable default if estimation fails
            return BigInt(300000); // 300k gas limit
        }
    }

    async calculateTransactionCost(gasLimit, urgency = 'normal') {
        const gasPrice = await this.getOptimalGasPrice(urgency);
        const cost = gasLimit * gasPrice.gasPrice;
        
        return {
            gasLimit,
            gasPrice: gasPrice.gasPrice,
            totalCostWei: cost,
            totalCostEth: ethers.formatEther(cost)
        };
    }

    async getOptimalGasPrice(urgency = 'normal') {
        await this.getCurrentGasPrice(); // Refresh gas data
        return this.calculateOptimalGasPrice(urgency);
    }

    isGasPriceAcceptable(gasPrice) {
        return gasPrice <= this.maxGasPrice;
    }

    shouldWaitForBetterGas(currentGasPrice, targetProfitEth) {
        // Simple heuristic: if gas cost is more than 50% of expected profit, wait
        const gasCostEth = Number(ethers.formatEther(currentGasPrice * BigInt(300000))); // Estimate with 300k gas
        const gasCostRatio = gasCostEth / targetProfitEth;
        
        logger.debug('Gas cost analysis', {
            gasCostEth: gasCostEth.toFixed(6),
            targetProfitEth: targetProfitEth.toFixed(6),
            costRatio: (gasCostRatio * 100).toFixed(2) + '%'
        });

        return gasCostRatio > 0.5; // Wait if gas cost is more than 50% of profit
    }

    getGasHistory() {
        return this.gasHistory.map(entry => ({
            ...entry,
            gasPriceGwei: ethers.formatUnits(entry.gasPrice, 'gwei'),
            timestamp: new Date(entry.timestamp).toISOString()
        }));
    }

    getAverageGasPrice(minutes = 5) {
        const cutoff = Date.now() - (minutes * 60 * 1000);
        const recentHistory = this.gasHistory.filter(entry => entry.timestamp > cutoff);
        
        if (recentHistory.length === 0) return null;

        const sum = recentHistory.reduce((acc, entry) => acc + entry.gasPrice, 0n);
        return sum / BigInt(recentHistory.length);
    }

    predictGasTrend() {
        if (this.gasHistory.length < 3) {
            return 'unknown';
        }

        const recent = this.gasHistory.slice(-3);
        const prices = recent.map(entry => Number(ethers.formatUnits(entry.gasPrice, 'gwei')));
        
        const trend = prices[2] - prices[0];
        const threshold = 1.0; // 1 gwei threshold

        if (trend > threshold) return 'increasing';
        if (trend < -threshold) return 'decreasing';
        return 'stable';
    }

    clearHistory() {
        this.gasHistory = [];
    }
}

module.exports = GasOptimizer;