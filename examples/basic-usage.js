const MEVBot = require('../src/index');

async function basicExample() {
    console.log('🤖 MEV Bot Basic Usage Example');
    console.log('================================\n');

    const bot = new MEVBot();

    try {
        // Start the bot
        console.log('Starting bot...');
        await bot.start();

        // Let it run for a demo period
        console.log('Bot is now running. Press Ctrl+C to stop.\n');

        // Example: Check stats every 30 seconds
        setInterval(() => {
            const stats = bot.getStats();
            console.log(`📊 Stats: ${stats.scansCompleted} scans, ${stats.opportunitiesFound} opportunities found`);
        }, 30000);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    process.exit(0);
});

// Run example if this file is executed directly
if (require.main === module) {
    basicExample().catch(console.error);
}