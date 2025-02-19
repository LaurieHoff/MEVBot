// Simple test for DexMonitor functionality
// Note: This is a basic test without external testing framework

const DexMonitor = require('../src/monitor');
const { ethers } = require('ethers');

class SimpleTest {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(description, testFn) {
        this.tests.push({ description, testFn });
    }

    async run() {
        console.log(`\n🧪 Running ${this.name}`);
        console.log('='.repeat(50));

        for (const test of this.tests) {
            try {
                await test.testFn();
                console.log(`✅ ${test.description}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${test.description}: ${error.message}`);
                this.failed++;
            }
        }

        console.log(`\nResults: ${this.passed} passed, ${this.failed} failed`);
        return this.failed === 0;
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected}, got ${actual}`);
        }
    }
}

async function testDexMonitor() {
    const suite = new SimpleTest('DexMonitor Tests');
    
    suite.test('Monitor should initialize correctly', async () => {
        const monitor = new DexMonitor();
        suite.assert(monitor.watchedPairs instanceof Map, 'watchedPairs should be a Map');
        suite.assert(monitor.priceCache instanceof Map, 'priceCache should be a Map');
    });

    suite.test('Should detect same token pairs correctly', async () => {
        const monitor = new DexMonitor();
        
        const price1 = {
            token0: '0xA0b86a33E6441c0327b81a4b74C8c6D8e7ff26ba',
            token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
        };
        
        const price2 = {
            token0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            token1: '0xA0b86a33E6441c0327b81a4b74C8c6D8e7ff26ba'
        };
        
        suite.assert(monitor.hasSameTokenPair(price1, price2), 'Should detect same token pairs');
    });

    suite.test('Should calculate arbitrage correctly', async () => {
        const monitor = new DexMonitor();
        
        const price1 = {
            pairAddress: '0x123',
            exchange: 'Uniswap V2',
            price0: 1800,
            token0: '0xA0b86a33E6441c0327b81a4b74C8c6D8e7ff26ba',
            token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
        };
        
        const price2 = {
            pairAddress: '0x456',
            exchange: 'SushiSwap',
            price0: 1900,
            token0: '0xA0b86a33E6441c0327b81a4b74C8c6D8e7ff26ba',
            token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
        };
        
        const arbitrage = monitor.calculateArbitrage(price1, price2);
        suite.assert(arbitrage !== null, 'Should calculate arbitrage');
        suite.assert(arbitrage.profitPercent > 0, 'Should show positive profit');
    });

    return await suite.run();
}

async function testUtils() {
    const suite = new SimpleTest('Utility Tests');
    const Web3Utils = require('../src/utils');

    suite.test('Should format addresses correctly', async () => {
        const address = '0xA0b86a33E6441c0327b81a4b74C8c6D8e7ff26ba';
        const formatted = Web3Utils.formatAddress(address);
        suite.assert(formatted.includes('0xA0b8'), 'Should include address prefix');
        suite.assert(formatted.includes('26ba'), 'Should include address suffix');
    });

    suite.test('Should validate addresses correctly', async () => {
        const validAddress = '0xA0b86a33E6441c0327b81a4b74C8c6D8e7ff26ba';
        const invalidAddress = '0xinvalid';
        
        suite.assert(Web3Utils.isValidAddress(validAddress), 'Should validate correct address');
        suite.assert(!Web3Utils.isValidAddress(invalidAddress), 'Should reject invalid address');
    });

    suite.test('Should format percentages correctly', async () => {
        const percentage = Web3Utils.formatPercentage(2.5678, 2);
        suite.assertEqual(percentage, '2.57%', 'Should format percentage correctly');
    });

    return await suite.run();
}

async function runAllTests() {
    console.log('🚀 Starting MEV Bot Tests');
    console.log('==========================\n');

    let allPassed = true;

    try {
        const monitorPassed = await testDexMonitor();
        allPassed = allPassed && monitorPassed;

        const utilsPassed = await testUtils();
        allPassed = allPassed && utilsPassed;

    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        allPassed = false;
    }

    console.log('\n' + '='.repeat(50));
    if (allPassed) {
        console.log('🎉 All tests passed!');
    } else {
        console.log('💥 Some tests failed!');
        process.exit(1);
    }
}

if (require.main === module) {
    runAllTests().catch(console.error);
}