const { ethers } = require('ethers');
const config = require('./config');

// Simplified Uniswap V2 Router ABI - just what we need
const UNISWAP_V2_ROUTER_ABI = [
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
    'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)'
];

// ERC20 ABI for token operations
const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
];

class ArbitrageExecutor {
    constructor(provider, wallet) {
        this.provider = provider;
        this.wallet = wallet;
        this.gasLimit = 300000; // Standard gas limit for swaps
        
        // Uniswap V2 Router address
        this.uniswapRouter = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
        this.routerContract = new ethers.Contract(this.uniswapRouter, UNISWAP_V2_ROUTER_ABI, this.wallet);
    }

    async executeArbitrage(opportunity) {
        if (!this.wallet) {
            console.log('⚠️  Cannot execute arbitrage - no wallet configured');
            return null;
        }

        console.log(`🚀 Attempting arbitrage execution: ${opportunity.profitPercent.toFixed(2)}% profit`);
        
        try {
            // Calculate optimal trade size
            const tradeAmount = await this.calculateOptimalTradeSize(opportunity);
            if (!tradeAmount) {
                console.log('❌ Could not calculate optimal trade size');
                return null;
            }

            // Check if we have enough balance
            const hasEnoughBalance = await this.checkBalance(opportunity.token0, tradeAmount);
            if (!hasEnoughBalance) {
                console.log('❌ Insufficient balance for arbitrage');
                return null;
            }

            // Execute the arbitrage transaction
            const result = await this.performArbitrageTrade(opportunity, tradeAmount);
            return result;

        } catch (error) {
            console.error('❌ Arbitrage execution failed:', error.message);
            return null;
        }
    }

    async calculateOptimalTradeSize(opportunity) {
        try {
            // For simplicity, start with a small fixed amount (0.1 ETH worth)
            // In production, this would use more sophisticated calculations
            return ethers.parseEther('0.1');
        } catch (error) {
            console.error('Error calculating trade size:', error.message);
            return null;
        }
    }

    async checkBalance(tokenAddress, requiredAmount) {
        try {
            if (tokenAddress === ethers.ZeroAddress || tokenAddress.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') {
                // ETH or WETH
                const balance = await this.provider.getBalance(this.wallet.address);
                return balance >= requiredAmount;
            } else {
                // ERC20 token
                const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
                const balance = await tokenContract.balanceOf(this.wallet.address);
                return balance >= requiredAmount;
            }
        } catch (error) {
            console.error('Error checking balance:', error.message);
            return false;
        }
    }

    async performArbitrageTrade(opportunity, tradeAmount) {
        console.log('📊 Simulating arbitrage trade (not actually executing)...');
        
        // In a real implementation, this would:
        // 1. Approve tokens if necessary
        // 2. Calculate exact amounts with slippage
        // 3. Execute first swap on exchange 1
        // 4. Execute second swap on exchange 2
        // 5. Calculate actual profit
        
        const simulatedResult = {
            success: true,
            tradeAmount: tradeAmount.toString(),
            estimatedProfit: opportunity.profitPercent,
            gasUsed: this.gasLimit,
            exchangeUsed: [opportunity.pair1.exchange, opportunity.pair2.exchange],
            timestamp: Date.now()
        };

        console.log(`✅ Arbitrage simulation completed - estimated profit: ${opportunity.profitPercent.toFixed(2)}%`);
        return simulatedResult;
    }

    async estimateGasCost() {
        try {
            const gasPrice = await this.provider.getFeeData();
            const estimatedCost = BigInt(this.gasLimit) * gasPrice.gasPrice;
            return estimatedCost;
        } catch (error) {
            console.error('Error estimating gas cost:', error.message);
            return ethers.parseEther('0.01'); // Fallback estimate
        }
    }

    async isArbitrageProfitable(opportunity) {
        const gasCost = await this.estimateGasCost();
        const gasCostEth = Number(ethers.formatEther(gasCost));
        const minProfitEth = config.mev.minProfitEth;
        
        // Simple profitability check
        const estimatedProfitEth = (opportunity.profitPercent / 100) * 0.1; // Assuming 0.1 ETH trade
        const netProfit = estimatedProfitEth - gasCostEth;
        
        return netProfit >= minProfitEth;
    }
}

module.exports = ArbitrageExecutor;