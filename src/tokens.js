const { ethers } = require('ethers');

// Extended ERC20 ABI with more functions
const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

class TokenUtils {
    constructor(provider) {
        this.provider = provider;
        this.tokenCache = new Map(); // Cache token metadata
        
        // Common token addresses on Ethereum mainnet
        this.COMMON_TOKENS = {
            WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            USDC: '0xA0b86a33E6441c0327b81a4b74C8c6D8e7ff26ba',
            USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
        };
    }

    async getTokenInfo(tokenAddress) {
        // Check cache first
        if (this.tokenCache.has(tokenAddress)) {
            return this.tokenCache.get(tokenAddress);
        }

        try {
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
            
            const [name, symbol, decimals, totalSupply] = await Promise.all([
                contract.name().catch(() => 'Unknown'),
                contract.symbol().catch(() => '???'),
                contract.decimals().catch(() => 18),
                contract.totalSupply().catch(() => 0n)
            ]);

            const tokenInfo = {
                address: tokenAddress,
                name,
                symbol,
                decimals: Number(decimals),
                totalSupply: totalSupply.toString(),
                contract
            };

            // Cache the result
            this.tokenCache.set(tokenAddress, tokenInfo);
            return tokenInfo;

        } catch (error) {
            console.error(`Failed to get token info for ${tokenAddress}:`, error.message);
            return null;
        }
    }

    async getBalance(tokenAddress, walletAddress) {
        try {
            if (this.isETH(tokenAddress)) {
                return await this.provider.getBalance(walletAddress);
            }

            const tokenInfo = await this.getTokenInfo(tokenAddress);
            if (!tokenInfo) return 0n;

            return await tokenInfo.contract.balanceOf(walletAddress);
        } catch (error) {
            console.error(`Failed to get balance for ${tokenAddress}:`, error.message);
            return 0n;
        }
    }

    async getAllowance(tokenAddress, owner, spender) {
        try {
            const tokenInfo = await this.getTokenInfo(tokenAddress);
            if (!tokenInfo) return 0n;

            return await tokenInfo.contract.allowance(owner, spender);
        } catch (error) {
            console.error(`Failed to get allowance:`, error.message);
            return 0n;
        }
    }

    async needsApproval(tokenAddress, owner, spender, amount) {
        if (this.isETH(tokenAddress)) return false;
        
        const allowance = await this.getAllowance(tokenAddress, owner, spender);
        return allowance < amount;
    }

    formatAmount(amount, decimals = 18) {
        return ethers.formatUnits(amount, decimals);
    }

    parseAmount(amount, decimals = 18) {
        return ethers.parseUnits(amount.toString(), decimals);
    }

    isETH(tokenAddress) {
        return tokenAddress === ethers.ZeroAddress || 
               tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    }

    isWETH(tokenAddress) {
        return tokenAddress.toLowerCase() === this.COMMON_TOKENS.WETH.toLowerCase();
    }

    getTokenName(address) {
        const upperAddress = address.toUpperCase();
        for (const [symbol, tokenAddress] of Object.entries(this.COMMON_TOKENS)) {
            if (tokenAddress.toUpperCase() === upperAddress) {
                return symbol;
            }
        }
        return `Token(${address.slice(0, 6)}...${address.slice(-4)})`;
    }

    async validateTokenPair(token0, token1) {
        try {
            const [info0, info1] = await Promise.all([
                this.getTokenInfo(token0),
                this.getTokenInfo(token1)
            ]);

            if (!info0 || !info1) {
                return { valid: false, reason: 'Invalid token contract' };
            }

            if (info0.decimals > 77 || info1.decimals > 77) {
                return { valid: false, reason: 'Unusual decimals count' };
            }

            if (info0.totalSupply === 0n || info1.totalSupply === 0n) {
                return { valid: false, reason: 'Zero total supply' };
            }

            return { 
                valid: true, 
                token0: info0, 
                token1: info1 
            };
        } catch (error) {
            return { valid: false, reason: error.message };
        }
    }

    calculatePriceImpact(reserveBefore, reserveAfter) {
        if (reserveBefore === 0n) return 0;
        
        const impact = ((reserveBefore - reserveAfter) * 10000n) / reserveBefore;
        return Number(impact) / 100; // Return as percentage
    }

    // Helper to find optimal path between tokens (simplified)
    getOptimalPath(tokenA, tokenB) {
        // In a real implementation, this would use graph algorithms
        // to find the most efficient trading path through multiple DEXes
        
        const directPath = [tokenA, tokenB];
        
        // Check if we should route through WETH for better liquidity
        if (!this.isWETH(tokenA) && !this.isWETH(tokenB)) {
            const wethPath = [tokenA, this.COMMON_TOKENS.WETH, tokenB];
            return wethPath; // Assume WETH routing is better for now
        }
        
        return directPath;
    }

    clearCache() {
        this.tokenCache.clear();
    }

    getCacheSize() {
        return this.tokenCache.size;
    }
}

module.exports = TokenUtils;