const logger = require('./logger');

class PerformanceMetrics {
    constructor() {
        this.metrics = {
            // Timing metrics
            scanDurations: [],
            executionTimes: [],
            
            // Counter metrics
            totalScans: 0,
            successfulScans: 0,
            failedScans: 0,
            opportunitiesDetected: 0,
            opportunitiesExecuted: 0,
            
            // Trading metrics
            totalProfit: 0,
            totalLoss: 0,
            totalGasCost: 0,
            averageTradeSize: 0,
            
            // Error tracking
            errors: [],
            errorCounts: {},
            
            // Performance tracking
            startTime: Date.now(),
            lastResetTime: Date.now()
        };
        
        this.maxHistorySize = 100; // Keep last 100 entries
    }

    recordScanDuration(duration, success = true) {
        this.metrics.totalScans++;
        
        if (success) {
            this.metrics.successfulScans++;
        } else {
            this.metrics.failedScans++;
        }

        this.addToHistory(this.metrics.scanDurations, duration);
    }

    recordOpportunity(opportunity, executed = false) {
        this.metrics.opportunitiesDetected++;
        
        if (executed) {
            this.metrics.opportunitiesExecuted++;
        }
    }

    recordTrade(result) {
        if (!result) return;

        this.addToHistory(this.metrics.executionTimes, result.executionTime || 0);
        
        const profit = result.profit || 0;
        const gasCost = result.gasCost || 0;
        
        if (profit > 0) {
            this.metrics.totalProfit += profit;
        } else {
            this.metrics.totalLoss += Math.abs(profit);
        }
        
        this.metrics.totalGasCost += gasCost;
        
        // Update average trade size
        const tradeValue = result.tradeAmount || 0;
        this.updateAverage('averageTradeSize', tradeValue);
    }

    recordError(error, context = 'general') {
        const errorEntry = {
            message: error.message || error,
            context,
            timestamp: Date.now(),
            stack: error.stack
        };
        
        this.addToHistory(this.metrics.errors, errorEntry);
        
        // Count error types
        const errorType = error.name || 'UnknownError';
        this.metrics.errorCounts[errorType] = (this.metrics.errorCounts[errorType] || 0) + 1;
        
        logger.error('Error recorded in metrics', { errorType, context });
    }

    addToHistory(array, item) {
        array.push(item);
        if (array.length > this.maxHistorySize) {
            array.shift();
        }
    }

    updateAverage(metricName, newValue) {
        const currentAvg = this.metrics[metricName] || 0;
        const count = this.getTradeCount();
        
        if (count === 0) {
            this.metrics[metricName] = newValue;
        } else {
            this.metrics[metricName] = (currentAvg * count + newValue) / (count + 1);
        }
    }

    getTradeCount() {
        return this.metrics.opportunitiesExecuted;
    }

    getAverageScanDuration() {
        if (this.metrics.scanDurations.length === 0) return 0;
        
        const sum = this.metrics.scanDurations.reduce((acc, duration) => acc + duration, 0);
        return sum / this.metrics.scanDurations.length;
    }

    getSuccessRate() {
        if (this.metrics.totalScans === 0) return 0;
        return (this.metrics.successfulScans / this.metrics.totalScans) * 100;
    }

    getExecutionRate() {
        if (this.metrics.opportunitiesDetected === 0) return 0;
        return (this.metrics.opportunitiesExecuted / this.metrics.opportunitiesDetected) * 100;
    }

    getProfitabilityRatio() {
        const totalActivity = this.metrics.totalProfit + this.metrics.totalLoss;
        if (totalActivity === 0) return 0;
        return (this.metrics.totalProfit / totalActivity) * 100;
    }

    getNetProfit() {
        return this.metrics.totalProfit - this.metrics.totalLoss - this.metrics.totalGasCost;
    }

    getRecentErrors(minutes = 30) {
        const cutoff = Date.now() - (minutes * 60 * 1000);
        return this.metrics.errors.filter(error => error.timestamp > cutoff);
    }

    getPerformanceSummary() {
        const runtime = Date.now() - this.metrics.startTime;
        const runtimeHours = runtime / (1000 * 60 * 60);
        
        return {
            runtime: {
                milliseconds: runtime,
                formatted: this.formatDuration(runtime)
            },
            scanning: {
                totalScans: this.metrics.totalScans,
                successRate: this.getSuccessRate(),
                averageDuration: this.getAverageScanDuration(),
                scansPerHour: runtimeHours > 0 ? this.metrics.totalScans / runtimeHours : 0
            },
            opportunities: {
                detected: this.metrics.opportunitiesDetected,
                executed: this.metrics.opportunitiesExecuted,
                executionRate: this.getExecutionRate()
            },
            trading: {
                totalProfit: this.metrics.totalProfit,
                totalLoss: this.metrics.totalLoss,
                netProfit: this.getNetProfit(),
                totalGasCost: this.metrics.totalGasCost,
                profitabilityRatio: this.getProfitabilityRatio(),
                averageTradeSize: this.metrics.averageTradeSize
            },
            errors: {
                totalErrors: this.metrics.errors.length,
                recentErrors: this.getRecentErrors(60).length, // Last hour
                errorTypes: Object.keys(this.metrics.errorCounts).length,
                mostCommonError: this.getMostCommonError()
            }
        };
    }

    getMostCommonError() {
        const errorEntries = Object.entries(this.metrics.errorCounts);
        if (errorEntries.length === 0) return null;
        
        return errorEntries.reduce((max, current) => 
            current[1] > max[1] ? current : max
        )[0];
    }

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    exportMetrics() {
        return {
            timestamp: Date.now(),
            summary: this.getPerformanceSummary(),
            rawMetrics: { ...this.metrics }
        };
    }

    reset() {
        const currentTime = Date.now();
        this.metrics = {
            scanDurations: [],
            executionTimes: [],
            totalScans: 0,
            successfulScans: 0,
            failedScans: 0,
            opportunitiesDetected: 0,
            opportunitiesExecuted: 0,
            totalProfit: 0,
            totalLoss: 0,
            totalGasCost: 0,
            averageTradeSize: 0,
            errors: [],
            errorCounts: {},
            startTime: currentTime,
            lastResetTime: currentTime
        };
        
        logger.info('Performance metrics reset');
    }

    generateReport() {
        const summary = this.getPerformanceSummary();
        
        let report = '\n📊 PERFORMANCE REPORT\n';
        report += '='.repeat(50) + '\n';
        
        report += `🕒 Runtime: ${summary.runtime.formatted}\n`;
        report += `📊 Scans: ${summary.scanning.totalScans} (${summary.scanning.successRate.toFixed(1)}% success)\n`;
        report += `⚡ Avg Scan Time: ${summary.scanning.averageDuration.toFixed(0)}ms\n`;
        report += `🔍 Opportunities: ${summary.opportunities.detected} detected, ${summary.opportunities.executed} executed\n`;
        report += `💰 Net Profit: ${summary.trading.netProfit.toFixed(6)} ETH\n`;
        report += `⚠️  Errors: ${summary.errors.totalErrors} total, ${summary.errors.recentErrors} recent\n`;
        
        if (summary.errors.mostCommonError) {
            report += `❌ Most Common Error: ${summary.errors.mostCommonError}\n`;
        }
        
        report += '='.repeat(50);
        
        return report;
    }
}

module.exports = PerformanceMetrics;