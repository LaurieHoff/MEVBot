const { ethers } = require('ethers');
const config = require('./config');
const logger = require('./logger');

class RiskManager {
    constructor() {
        this.maxSlippage = config.mev.maxSlippage;
        this.maxGasPrice = config.mev.maxGasPrice;
        this.minProfitEth = config.mev.minProfitEth;
        
        // Risk metrics
        this.dailyLossLimit = ethers.parseEther('0.5'); // Max 0.5 ETH loss per day
        this.maxTradeSize = ethers.parseEther('1.0'); // Max 1 ETH per trade
        this.dailyStats = {
            trades: 0,
            totalProfit: 0n,
            totalLoss: 0n,
            date: new Date().toDateString()
        };
    }

    resetDailyStats() {
        const today = new Date().toDateString();
        if (this.dailyStats.date !== today) {
            logger.info('Resetting daily statistics', {
                previousProfit: ethers.formatEther(this.dailyStats.totalProfit),
                previousLoss: ethers.formatEther(this.dailyStats.totalLoss),
                previousTrades: this.dailyStats.trades
            });
            
            this.dailyStats = {
                trades: 0,
                totalProfit: 0n,
                totalLoss: 0n,
                date: today
            };
        }
    }

    async assessTradeRisk(opportunity, tradeAmount, gasPrice) {
        this.resetDailyStats();

        const risks = [];

        // Check profit threshold
        if (opportunity.profitPercent < this.minProfitEth * 100) {
            risks.push({
                level: 'high',
                reason: `Profit ${opportunity.profitPercent.toFixed(2)}% below threshold ${this.minProfitEth * 100}%`
            });
        }

        // Check slippage risk
        if (opportunity.profitPercent < this.maxSlippage) {
            risks.push({
                level: 'medium',
                reason: `Low profit margin vulnerable to slippage`
            });
        }

        // Check gas price
        if (gasPrice > ethers.parseUnits(this.maxGasPrice.toString(), 'gwei')) {
            risks.push({
                level: 'high',
                reason: `Gas price ${ethers.formatUnits(gasPrice, 'gwei')} gwei exceeds limit ${this.maxGasPrice} gwei`
            });
        }

        // Check trade size
        if (tradeAmount > this.maxTradeSize) {
            risks.push({
                level: 'high', 
                reason: `Trade size ${ethers.formatEther(tradeAmount)} ETH exceeds maximum ${ethers.formatEther(this.maxTradeSize)} ETH`
            });
        }

        // Check daily loss limit
        if (this.dailyStats.totalLoss >= this.dailyLossLimit) {
            risks.push({
                level: 'critical',
                reason: `Daily loss limit ${ethers.formatEther(this.dailyLossLimit)} ETH reached`
            });
        }

        // Check for suspicious price movements (basic frontrunning detection)
        const suspiciousActivity = this.detectSuspiciousActivity(opportunity);
        if (suspiciousActivity) {
            risks.push({
                level: 'medium',
                reason: 'Potential frontrunning or sandwich attack detected'
            });
        }

        return this.calculateRiskScore(risks);
    }

    detectSuspiciousActivity(opportunity) {
        // Simple heuristic: very high profit margins might indicate manipulation
        return opportunity.profitPercent > 10.0; // More than 10% profit is suspicious
    }

    calculateRiskScore(risks) {
        if (risks.length === 0) {
            return { approved: true, score: 0, risks: [] };
        }

        let score = 0;
        const criticalCount = risks.filter(r => r.level === 'critical').length;
        const highCount = risks.filter(r => r.level === 'high').length;
        const mediumCount = risks.filter(r => r.level === 'medium').length;

        score = criticalCount * 100 + highCount * 25 + mediumCount * 5;

        const approved = score < 50 && criticalCount === 0;

        logger.debug('Risk assessment completed', {
            score,
            approved,
            riskCount: risks.length,
            criticalRisks: criticalCount
        });

        return {
            approved,
            score,
            risks,
            recommendation: this.getRiskRecommendation(score)
        };
    }

    getRiskRecommendation(score) {
        if (score >= 100) return 'REJECT - Critical risks present';
        if (score >= 50) return 'REJECT - High risk';
        if (score >= 25) return 'CAUTION - Medium risk';
        if (score >= 10) return 'PROCEED - Low risk';
        return 'PROCEED - Minimal risk';
    }

    recordTradeResult(tradeAmount, profit, gasUsed) {
        this.dailyStats.trades++;
        
        if (profit > 0) {
            this.dailyStats.totalProfit += BigInt(Math.floor(profit * 1e18));
            logger.info('Profitable trade recorded', {
                profit: profit.toFixed(6),
                totalDailyProfit: ethers.formatEther(this.dailyStats.totalProfit)
            });
        } else {
            const loss = BigInt(Math.floor(Math.abs(profit) * 1e18));
            this.dailyStats.totalLoss += loss;
            logger.warn('Loss recorded', {
                loss: Math.abs(profit).toFixed(6),
                totalDailyLoss: ethers.formatEther(this.dailyStats.totalLoss)
            });
        }
    }

    getDailyStats() {
        return {
            ...this.dailyStats,
            totalProfitEth: ethers.formatEther(this.dailyStats.totalProfit),
            totalLossEth: ethers.formatEther(this.dailyStats.totalLoss),
            netProfitEth: ethers.formatEther(this.dailyStats.totalProfit - this.dailyStats.totalLoss)
        };
    }

    shouldHaltTrading() {
        this.resetDailyStats();
        return this.dailyStats.totalLoss >= this.dailyLossLimit;
    }
}

module.exports = RiskManager;