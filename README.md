# MEV Bot

A high-performance MEV (Maximum Extractable Value) bot for Ethereum that monitors decentralized exchanges for arbitrage opportunities.

## Features

- Real-time monitoring of multiple DEX platforms
- Automated arbitrage execution  
- Gas optimization strategies
- Risk management and profit analysis
- Support for Uniswap V2/V3, SushiSwap, and other AMMs

## Quick Start

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your settings in `.env`:
   - Add your Ethereum RPC URL
   - Set your private key (keep it secure!)
   - Adjust profit thresholds

5. Choose your preferred interface:

   **Interactive CLI (Recommended):**
   ```bash
   npm run cli
   ```
   
   **Direct start:**
   ```bash
   npm start
   ```
   
   **Run examples:**
   ```bash
   npm run example
   npm run risk-demo
   ```

## Available Scripts

- `npm run cli` - Start interactive CLI interface
- `npm start` - Run bot directly
- `npm run dev` - Run in development mode with auto-reload
- `npm test` - Run basic tests
- `npm run example` - Run usage examples
- `npm run risk-demo` - Demonstrate risk management

## Configuration

Key configuration options in `.env`:

- `MIN_PROFIT_ETH`: Minimum profit threshold in ETH
- `MAX_GAS_PRICE`: Maximum gas price willing to pay
- `SLIPPAGE_TOLERANCE`: Acceptable slippage percentage

## Architecture

The bot consists of several key modules:

- **Monitor** (`src/monitor.js`) - DEX price monitoring and arbitrage detection
- **Executor** (`src/executor.js`) - Trade execution logic (currently simulation mode)
- **Risk Manager** (`src/risk.js`) - Risk assessment and daily limits
- **Gas Optimizer** (`src/gas.js`) - Gas price optimization
- **Token Utils** (`src/tokens.js`) - ERC20 token operations
- **CLI** (`src/cli.js`) - Interactive command-line interface
- **Metrics** (`src/metrics.js`) - Performance monitoring
- **Logger** (`src/logger.js`) - Structured logging system

## Testing

Run the basic test suite:
```bash
npm test
```

The tests cover core functionality including:
- DEX monitoring logic
- Arbitrage calculation
- Utility functions
- Address validation

## Examples

Check the `examples/` directory for:
- Basic usage patterns
- Risk management demonstrations  
- CLI interface examples

## Disclaimer

This bot is for educational purposes. Use at your own risk. Always test on testnets first.

## License

MIT