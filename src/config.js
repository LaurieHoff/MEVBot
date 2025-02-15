require('dotenv').config();

class Config {
    constructor() {
        this.validateEnvironmentVariables();
    }

    validateEnvironmentVariables() {
        const required = ['ETHEREUM_RPC_URL'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
            console.warn('Using default values for development...');
        }
    }

    get ethereum() {
        return {
            rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
            wsUrl: process.env.ETHEREUM_WS_URL,
            chainId: parseInt(process.env.CHAIN_ID) || 1
        };
    }

    get wallet() {
        return {
            privateKey: process.env.PRIVATE_KEY,
            address: process.env.WALLET_ADDRESS
        };
    }

    get mev() {
        return {
            minProfitEth: parseFloat(process.env.MIN_PROFIT_ETH) || 0.01,
            maxGasPrice: parseInt(process.env.MAX_GAS_PRICE) || 50,
            slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE) || 0.5,
            maxSlippage: 3.0 // Maximum allowed slippage
        };
    }

    get exchanges() {
        return {
            uniswapV2Factory: process.env.UNISWAP_V2_FACTORY || '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
            uniswapV3Factory: process.env.UNISWAP_V3_FACTORY || '0x1F98431c8aD98523631AE4a59f267346ea31F984',
            sushiswapFactory: process.env.SUSHISWAP_FACTORY || '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac'
        };
    }

    get monitoring() {
        return {
            logLevel: process.env.LOG_LEVEL || 'info',
            enableTelegramNotifications: process.env.ENABLE_TELEGRAM_NOTIFICATIONS === 'true',
            telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
            telegramChatId: process.env.TELEGRAM_CHAT_ID
        };
    }

    get isDevelopment() {
        return process.env.NODE_ENV !== 'production';
    }
}

module.exports = new Config();