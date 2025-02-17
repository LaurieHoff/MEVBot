const { ethers } = require('ethers');

class Web3Utils {
    static formatAddress(address) {
        if (!address) return 'N/A';
        if (address === ethers.ZeroAddress) return '0x0';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    static formatTokenAmount(amount, decimals = 18, precision = 4) {
        if (!amount) return '0';
        const formatted = ethers.formatUnits(amount, decimals);
        return parseFloat(formatted).toFixed(precision);
    }

    static formatPercentage(value, precision = 2) {
        return `${value.toFixed(precision)}%`;
    }

    static formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    static async retry(fn, maxRetries = 3, delayMs = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                
                console.warn(`Attempt ${i + 1} failed, retrying in ${delayMs}ms:`, error.message);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                delayMs *= 2; // Exponential backoff
            }
        }
    }

    static async withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        );
        
        return Promise.race([promise, timeout]);
    }

    static isValidAddress(address) {
        try {
            return ethers.isAddress(address);
        } catch {
            return false;
        }
    }

    static isValidPrivateKey(privateKey) {
        try {
            new ethers.Wallet(privateKey);
            return true;
        } catch {
            return false;
        }
    }

    static calculateSlippage(expectedAmount, actualAmount) {
        if (expectedAmount === 0n) return 0;
        const diff = expectedAmount - actualAmount;
        return Number((diff * 10000n) / expectedAmount) / 100; // Percentage
    }

    static generateNonce() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 5);
    }

    static async getBlockTimestamp(provider, blockNumber = 'latest') {
        const block = await provider.getBlock(blockNumber);
        return block ? block.timestamp : null;
    }

    static async waitForTransaction(provider, txHash, confirmations = 1, timeoutMs = 300000) {
        return Web3Utils.withTimeout(
            provider.waitForTransaction(txHash, confirmations),
            timeoutMs,
            `Transaction ${txHash} timed out after ${timeoutMs}ms`
        );
    }

    static compareBigNumbers(a, b) {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    }

    static async checkContractExists(provider, address) {
        try {
            const code = await provider.getCode(address);
            return code !== '0x';
        } catch {
            return false;
        }
    }

    static encodeParameters(types, values) {
        return ethers.AbiCoder.defaultAbiCoder().encode(types, values);
    }

    static decodeParameters(types, data) {
        return ethers.AbiCoder.defaultAbiCoder().decode(types, data);
    }

    static keccak256(data) {
        return ethers.keccak256(data);
    }

    static randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    static async batchCall(provider, calls, chunkSize = 10) {
        const chunks = Web3Utils.chunk(calls, chunkSize);
        const results = [];
        
        for (const chunk of chunks) {
            const chunkResults = await Promise.allSettled(chunk);
            results.push(...chunkResults);
        }
        
        return results;
    }

    static createRateLimiter(maxCalls, windowMs) {
        const calls = [];
        
        return async function rateLimitedCall(fn) {
            const now = Date.now();
            
            // Remove old calls outside the window
            while (calls.length > 0 && calls[0] <= now - windowMs) {
                calls.shift();
            }
            
            if (calls.length >= maxCalls) {
                const oldestCall = calls[0];
                const waitTime = oldestCall + windowMs - now;
                await Web3Utils.sleep(waitTime);
                return rateLimitedCall(fn);
            }
            
            calls.push(now);
            return fn();
        };
    }

    static parseError(error) {
        if (typeof error === 'string') return error;
        
        if (error.reason) return error.reason;
        if (error.message) return error.message;
        if (error.data && error.data.message) return error.data.message;
        
        return 'Unknown error';
    }

    static formatGasPrice(gasPrice) {
        return `${ethers.formatUnits(gasPrice, 'gwei')} gwei`;
    }

    static calculateGasCost(gasLimit, gasPrice) {
        return gasLimit * gasPrice;
    }

    static toChecksumAddress(address) {
        return ethers.getAddress(address.toLowerCase());
    }
}

module.exports = Web3Utils;