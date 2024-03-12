const tokenSwap = async (input, output, inputAmount = TRADE_SIZE) => {
  const payer = Keypair.fromSecretKey(WALLET_SECRET_KEY);
  const initialTokenHistory = [];
  const rawData = fs.readFileSync(tokenPath, "utf8");
  const jupiter = await Jupiter.load({
    connection,
    cluster: RPC_CHAIN,
    user: payer,
  });
  const routeMap = jupiter.getRouteMap();
  const tokens = JSON.parse(rawData);
  const inputToken = WSOL_ADDRESS;
  const slippage = inputAmount;
  await tokens.forEach(async (token) => {
    const outputToken = token.address;
    const routes = await jupiter.computeRoutes({
      inputMint: new PublicKey(input),
      outputMint: new PublicKey(outputToken),
      inputAmount,
      slippage,
      forceFetch: false,
    });
    const { execute } = await jupiter.exchange({
      routeInfo: routes.routesInfos[0],
    });
    const swapResult = await execute();
    initialTokenHistory.push({
      name: token.name,
      symbol: token.symbol,
      address: token.address,
      price: 0,
      date: new Date(),
      amount: Math.random(100 % 4),
    });
  });
  fs.writeFileSync(tokenInfoPath, JSON.stringify(initialTokenHistory, null, 4));
};
