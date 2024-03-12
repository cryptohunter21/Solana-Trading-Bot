require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const { Jupiter, RouteInfo, TOKEN_LIST_URL } = require("@jup-ag/core");
const {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  Keypair,
  Authorized,
} = require("@solana/web3.js");
// ==================== txt storage =========================
const tokenStorage = "./helper/token.txt";
const logStrorage = "./helper/log.txt";
// ==================== env variable ========================
const RPC_CHAIN = process.env.RPC_CHAIN;
const TOKEN_AMOUNT = process.env.TOKEN_AMOUNT;
const TRADE_SIZE = process.env.TRADE_SIZE;
const WSOL_ADDRESS = process.env.WSOL_ADDRESS;
const SELL_MARKETCAP = process.env.SELL_MARKETCAP;
const TRADE_WINDOW = process.env.TRADE_WINDOW;
const PROFIT_RATIO = process.env.PROFIT_RATIO;
const WALLET_SECRET_KEY = process.env.WALLET_SECRET_KEY;
const MAX_LOST_LAST_OFF = process.env.MAX_LOST_LAST_OFF;
// =================== local variable =======================
const connection = new Connection(clusterApiUrl(RPC_CHAIN), "confirmed");
const cmcTokenURL = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest`;
const cmcPriceURL = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/price-performance-stats/latest`;
const coinmarketcap_key = "4206945b-936f-4b90-a409-5576fb0d6f1c";
// const payer = Keypair.fromSecretKey(WALLET_SECRET_KEY);
// const jupiter = Jupiter.load({
//   connection,
//   cluster: RPC_CHAIN,
//   user: payer,
// });
const LOG_TAG = {
  tokenSwap: "\n------------- token swap ---------------\n",
  solSwap: "\n--------------- sol swap -----------------\n",
  tradeResult: "\n--------------- trade result -----------------\n",
  botStarted: "\n---------------- bot started ------------------\n",
  botStopped: "\n----------------- bot stopped -------------------\n",
  buyToken: "\n------------------ buy Token --------------------\n",
  sellToken: "\n------------------ sell Token --------------------\n",
};
const intervalTimeline = 10000;
// ==========================================================
//  buy token
const buyToken = async () => {};

//  sell token
const sellToken = async () => {};

//  input swap to output with inputAmount in jupiter
const swap = async (input, output, inputAmount) => {
  const routes = await jupiter.computeRoutes({
    inputMint: new PublicKey(input),
    outputMint: new PublicKey(output),
    inputAmount,
    slippage: inputAmount,
    forceFetch: false,
  });
  const { execute } = await jupiter.exchange({
    routeInfo: routes.routesInfos[0],
  });
  const swapResult = await execute();

  return swapResult;
};

//  monitor trade with SELL_MAKRETCAP
const tradeWithMarketCap = async (tokens) => {
  const RANGE = {
    MIN: JSON.parse(MAX_MARKETCAP)[0],
    MAX: JSON.parse(MAX_MARKETCAP)[1],
  };
  await axios
    .get(cmcTokenURL, {
      headers: {
        "X-CMC_PRO_API_KEY": coinmarketcap_key,
      },
      params: {
        // start: 6,
        // limit: 10,
        market_cap_min: RANGE.MIN,
        market_cap_max: RANGE.MAX,
        cryptocurrency_type: "tokens",
      },
    })
    .then((res) => {
      console.log("res: ", res.data);
    });
};

//  monitor trade with TRADE_WINDOW
const tradeWithTradeWindow = async (tokens) => {
  let logTxt = fs.readFileSync(logStrorage, "utf8");
  const endTime = Date.now() + TRADE_WINDOW * 60 * 1000;
  setTimeout(async () => {
    const currentTime = Date.now();
    if (currentTime < endTime) {
      await axios
        .get(cmcPriceURL, {
          headers: { "X-CMC_PRO_API_KEY": coinmarketcap_key },
          params: {
            slug: "solana",
            symbol: "ORCA",
          },
        })
        .then((res) => {
          // const currentPrice = res.data.prices;
          const currentPrice = [];
          for (let i = 0; i < tokens.length; i++) {
            if (tokens[i] * PROFIT_RATIO >= currentPrice[i]) {
              // swap token to SOL again
              const swatResult = swap(
                tokens[i].address,
                WSOL_ADDRESS,
                tokens[i].amount
              );
              logTxt += LOG_TAG.tokenSwap + JSON.stringify(swatResult);
              tokens[i].lostTime = 0;
            } else {
              // tokens[i].lostTime++;
            }
          }
        });
    } else {
      console.log("Time is over!");
    }
  }, intervalTimeline);

  fs.writeFileSync(tokenStorage, JSON.stringify(tokens), "utf8");
};

//  monitor trade
const monitoringTrade = async () => {
  let logTxt = fs.readFileSync(logStrorage, "utf8");
  const tokens = JSON.parse(fs.readFileSync(tokenStorage, "utf8"));
  if (TRADE_WINDOW == 0) {
    tradeWithMarketCap(tokens);
  } else {
    // if TRADE_WINDOW is not null, MAX_MARKETCAP is not active!
    const stopToken = tokens.filter((each) => each.lostTime == 2);
    if (stopToken.length > 0) {
      logTxt += LOG_TAG.stopTrade;
      stopTrade();
    } else {
      tradeWithTradeWindow(tokens);
    }
  }
  fs.writeFileSync(logStrorage, logTxt, "utf8");
};

//  start trade
const startTrade = async () => {
  //  step1: sol swap to tokens
  const tokens = JSON.parse(fs.readFileSync(tokenStorage, "utf8"));
  const updateTokens = [];
  tokens.forEach(async (token) => {
    // const swapResult = await swap(WSOL_ADDRESS, token.address, TRADE_SIZE);
    const swapResult = { price: 0 };
    updateTokens.push({
      ...token,
      price: swapResult?.price || 0,
      lostTime: 0,
    });
  });
  const logTxt = fs.readFileSync(logStrorage, "utf8");
  fs.writeFileSync(
    logStrorage,
    logTxt +
      "\n" +
      LOG_TAG.solSwap +
      JSON.stringify(updateTokens) +
      `\n log time: ${new Date()}`
  );
  //  step2: filter and monitor trade
};

//  stop trade
const stopTrade = async () => {
  console.log(LOG_TAG.startTrade);
};

//  repeat monitoring trade
const executeBot = async () => {
  await startTrade();
  await monitoringTrade();
};

executeBot();
