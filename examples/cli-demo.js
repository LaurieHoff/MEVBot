const CLIInterface = require('../src/cli');

async function cliDemo() {
    console.log('🖥️  CLI Interface Demo');
    console.log('======================\n');
    
    console.log('This demonstrates the interactive CLI interface.');
    console.log('To start the CLI, run: npm run cli\n');
    
    console.log('Available commands in the CLI:');
    console.log('• start    - Initialize and start the bot');
    console.log('• stop     - Stop the bot'); 
    console.log('• status   - Show bot status');
    console.log('• stats    - Show performance statistics');
    console.log('• config   - Show current configuration');
    console.log('• pairs    - Show watched trading pairs');
    console.log('• gas      - Show gas price information');
    console.log('• risk     - Show risk management status');
    console.log('• help     - Show help message');
    console.log('• exit     - Exit the CLI\n');
    
    console.log('Example workflow:');
    console.log('1. npm run cli');
    console.log('2. start');
    console.log('3. status');
    console.log('4. stats');
    console.log('5. stop\n');

    console.log('For automated usage, you can also:');
    console.log('• npm start     - Start bot directly');
    console.log('• node examples/basic-usage.js - Run basic example\n');

    // Start CLI if requested
    if (process.argv.includes('--interactive')) {
        const cli = new CLIInterface();
        await cli.start();
    }
}

if (require.main === module) {
    cliDemo().catch(console.error);
}