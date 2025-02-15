const { ethers } = require('ethers');
const config = require('./config');

const UNISWAP_V2_PAIR_ABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)'
];

class DexMonitor {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
        this.watchedPairs = new Map();
        this.priceCache = new Map();
    }

    async addWatchPair(pairAddress, exchangeName = 'unknown') {
        try {
            const pairContract = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, this.provider);
            
            const [token0, token1] = await Promise.all([
                pairContract.token0(),
                pairContract.token1()
            ]);

            this.watchedPairs.set(pairAddress, {
                contract: pairContract,
                token0,
                token1,
                exchange: exchangeName,
                lastUpdate: 0
            });

            console.log(`👀 Watching pair ${pairAddress} on ${exchangeName}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to add watch pair ${pairAddress}:`, error.message);
            return false;
        }
    }

    async fetchPairPrice(pairAddress) {
        const pair = this.watchedPairs.get(pairAddress);
        if (!pair) {
            throw new Error(`Pair ${pairAddress} not being watched`);
        }

        try {
            const reserves = await pair.contract.getReserves();
            const reserve0 = BigInt(reserves.reserve0.toString());
            const reserve1 = BigInt(reserves.reserve1.toString());

            if (reserve0 === 0n || reserve1 === 0n) {
                return null;
            }

            const price0 = Number(reserve1) / Number(reserve0);
            const price1 = Number(reserve0) / Number(reserve1);

            const priceData = {
                pairAddress,
                token0: pair.token0,
                token1: pair.token1,
                reserve0: reserve0.toString(),
                reserve1: reserve1.toString(),
                price0, // token1 per token0
                price1, // token0 per token1
                exchange: pair.exchange,
                timestamp: Date.now()
            };

            this.priceCache.set(pairAddress, priceData);
            return priceData;

        } catch (error) {
            console.error(`❌ Failed to fetch price for ${pairAddress}:`, error.message);
            return null;
        }
    }

    async scanForArbitrageOpportunities() {
        const opportunities = [];
        const prices = Array.from(this.priceCache.values());

        for (let i = 0; i < prices.length; i++) {
            for (let j = i + 1; j < prices.length; j++) {
                const price1 = prices[i];
                const price2 = prices[j];

                if (this.hasSameTokenPair(price1, price2)) {
                    const arbitrageOpp = this.calculateArbitrage(price1, price2);
                    if (arbitrageOpp && arbitrageOpp.profitPercent > config.mev.minProfitEth * 100) {
                        opportunities.push(arbitrageOpp);
                    }
                }
            }
        }

        return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
    }

    hasSameTokenPair(price1, price2) {
        return (
            (price1.token0 === price2.token0 && price1.token1 === price2.token1) ||
            (price1.token0 === price2.token1 && price1.token1 === price2.token0)
        );
    }

    calculateArbitrage(price1, price2) {
        try {
            const priceDiff = Math.abs(price1.price0 - price2.price0);
            const avgPrice = (price1.price0 + price2.price0) / 2;
            const profitPercent = (priceDiff / avgPrice) * 100;

            if (profitPercent < 0.1) return null;

            return {
                pair1: {
                    address: price1.pairAddress,
                    exchange: price1.exchange,
                    price: price1.price0
                },
                pair2: {
                    address: price2.pairAddress,
                    exchange: price2.exchange,
                    price: price2.price0
                },
                profitPercent,
                token0: price1.token0,
                token1: price1.token1,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error calculating arbitrage:', error);
            return null;
        }
    }

    getCachedPrice(pairAddress) {
        return this.priceCache.get(pairAddress);
    }

    clearCache() {
        this.priceCache.clear();
    }
}

module.exports = DexMonitor;