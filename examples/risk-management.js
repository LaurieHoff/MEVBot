const RiskManager = require('../src/risk');
const { ethers } = require('ethers');

async function riskManagementExample() {
    console.log('⚠️  Risk Management Example');
    console.log('===========================\n');

    const riskManager = new RiskManager();

    // Example opportunity
    const testOpportunity = {
        profitPercent: 2.5,
        pair1: { exchange: 'Uniswap V2', price: 1800 },
        pair2: { exchange: 'SushiSwap', price: 1845 },
        token0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        token1: '0xA0b86a33E6441c0327b81a4b74C8c6D8e7ff26ba'  // USDC
    };

    // Test different scenarios
    const scenarios = [
        {
            name: 'Low Risk Trade',
            tradeAmount: ethers.parseEther('0.05'),
            gasPrice: ethers.parseUnits('20', 'gwei')
        },
        {
            name: 'Medium Risk Trade', 
            tradeAmount: ethers.parseEther('0.5'),
            gasPrice: ethers.parseUnits('50', 'gwei')
        },
        {
            name: 'High Risk Trade',
            tradeAmount: ethers.parseEther('2.0'),
            gasPrice: ethers.parseUnits('100', 'gwei')
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n🎯 Testing: ${scenario.name}`);
        console.log(`Trade Amount: ${ethers.formatEther(scenario.tradeAmount)} ETH`);
        console.log(`Gas Price: ${ethers.formatUnits(scenario.gasPrice, 'gwei')} gwei`);

        const assessment = await riskManager.assessTradeRisk(
            testOpportunity,
            scenario.tradeAmount,
            scenario.gasPrice
        );

        console.log(`Risk Score: ${assessment.score}`);
        console.log(`Approved: ${assessment.approved ? '✅' : '❌'}`);
        console.log(`Recommendation: ${assessment.recommendation}`);
        
        if (assessment.risks.length > 0) {
            console.log('Risks identified:');
            assessment.risks.forEach((risk, index) => {
                console.log(`  ${index + 1}. [${risk.level.toUpperCase()}] ${risk.reason}`);
            });
        }
    }

    // Test daily statistics
    console.log('\n📈 Testing Daily Statistics:');
    
    // Simulate some trades
    riskManager.recordTradeResult(ethers.parseEther('0.1'), 0.002, 21000); // Profit
    riskManager.recordTradeResult(ethers.parseEther('0.2'), -0.001, 21000); // Loss
    riskManager.recordTradeResult(ethers.parseEther('0.05'), 0.001, 21000); // Small profit

    const dailyStats = riskManager.getDailyStats();
    console.log(`Daily trades: ${dailyStats.trades}`);
    console.log(`Daily profit: ${dailyStats.totalProfitEth} ETH`);
    console.log(`Daily loss: ${dailyStats.totalLossEth} ETH`);
    console.log(`Net profit: ${dailyStats.netProfitEth} ETH`);
    console.log(`Trading halted: ${riskManager.shouldHaltTrading() ? 'Yes' : 'No'}`);
}

if (require.main === module) {
    riskManagementExample().catch(console.error);
}