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
const initialTokenStorage = "./helper/initialToken.txt";
const tradeTokenStorage = "./helper/tradeToken.txt";
const logStorage = "./helper/log.txt";
// ==================== env variable ========================
const RPC_CHAIN = process.env.RPC_CHAIN;
const TOKEN_AMOUNT = process.env.TOKEN_AMOUNT;
const TRADE_SIZE = process.env.TRADE_SIZE;
const WSOL_ADDRESS = process.env.WSOL_ADDRESS;
const SELL_MARKETCAP = process.env.SELL_MARKETCAP;
const TRADE_WINDOW = process.env.TRADE_WINDOW;
const PROFIT_RATIO = process.env.PROFIT_RATIO;
const WALLET_SECRET_KEY = process.env.WALLET_SECRET_KEY;
const MAX_LAST_LOST_TRADES = process.env.MAX_LAST_LOST_TRADES;
// =================== local variable =======================
const connection = new Connection(clusterApiUrl(RPC_CHAIN), "confirmed");
// const cmcTokenURL = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest`;
const cmcTokenURL = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest`;
// const cmcPriceURL = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/price-performance-stats/latest`;
const coinmarketcap_key = "4206945b-936f-4b90-a409-5576fb0d6f1c";
// const payer = Keypair.fromSecretKey(WALLET_SECRET_KEY);
// const jupiter = Jupiter.load({
//   connection,
//   cluster: RPC_CHAIN,
//   user: payer,
// });
const logTime = `log time: ${new Date()}`;
const LOG_TAG = {
  solSwap: `\n--------------- sol swap -----------------\n ${logTime} \n`,
  tokenSwap: `\n------------- token swap ---------------\n ${logTime} \n`,
  tradeResult: `\n--------------- trade result -----------------\n ${logTime} \n`,
  botStarted: `\n---------------- bot started ------------------\n ${logTime} \n`,
  botStopped: `\n----------------- bot stopped -------------------\n ${logTime} \n`,
  buyToken: `\n------------------ buy Token --------------------\n ${logTime} \n`,
  sellToken: `\n------------------ sell Token --------------------\n ${logTime} \n`,
};
const sleepTime = 2000;
const timeDuration = sleepTime;
let STOP = true;
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
  let logTxt = fs.readFileSync(logStorage, "utf8");
  const RANGE = {
    MIN: JSON.parse(SELL_MARKETCAP)[0],
    MAX: JSON.parse(SELL_MARKETCAP)[1],
  };
  const tempTokens = tokens.map((token) => {
    if (
      token.currentPrice >= token.initialPrice * PROFIT_RATIO ||
      (token.marketCap >= RANGE.MIN && token.marketCap <= RANGE.MAX)
    ) {
      // await swap(token.address, WSOL_ADDRESS, token.amount);
      token = { ...token, changed: 1, lostTime: 0 };
      logTxt += LOG_TAG.tokenSwap + JSON.stringify(token);
      return token;
    } else return token;
  });
  fs.writeFileSync(tradeTokenStorage, JSON.stringify(tempTokens), "utf8");
  fs.writeFileSync(logStorage, logTxt, "utf8");
};

//  monitor trade with TRADE_WINDOW
const tradeWithTradeWindow = async (tokens) => {
  let logTxt = fs.readFileSync(logStorage, "utf8");
  const tempTokens = tokens.map((token) => {
    if (token.currentPrice >= token.initialPrice * PROFIT_RATIO) {
      // await swap(token.address, WSOL_ADDRESS, token.amount);
      token = { ...token, changed: 1, lostTime: 0 };
      logTxt += LOG_TAG.tokenSwap + JSON.stringify(token);
      return token;
    } else return token;
  });
  // console.log("window: ", tempTokens);
  fs.writeFileSync(tradeTokenStorage, JSON.stringify(tempTokens), "utf8");
  fs.writeFileSync(logStorage, logTxt, "utf8");
};

//  monitor trade
const monitoringTrade = async () => {
  // setTimeout(async () => {
  let tokens = JSON.parse(fs.readFileSync(tradeTokenStorage, "utf8"));
  tokens = await updateTokens(tokens);
  if (TRADE_WINDOW == 0) {
    await tradeWithMarketCap(tokens);
    await sleep(sleepTime);
    monitoringTrade();
  } else {
    const endTime = Date.now() + TRADE_WINDOW * 60 * 1000;
    setInterval(async () => {
      const currentTime = Date.now();
      if (currentTime <= endTime) {
        await tradeWithTradeWindow(tokens);
      } else {
        tokens = JSON.parse(fs.readFileSync(tradeTokenStorage, "utf8"));
        let logTxt = fs.readFileSync(logStorage, "utf8");
        const tempTokens = tokens.map((token) => {
          if (token?.changed == 0) {
            // swap(token, WSOL_ADDRESS, token.amount);
            token = { ...token, lostTime: token?.lostTime + 1 };
            logTxt += LOG_TAG.tokenSwap + JSON.stringify(token);
            return token;
          } else return token;
        });

        fs.writeFileSync(tradeTokenStorage, JSON.stringify(tempTokens), "utf8");
        fs.writeFileSync(logStorage, logTxt, "utf8");
        console.log("Time is over!");
        //  check max_lost_last_TRADES
        console.log("MAX_LOST: ", MAX_LAST_LOST_TRADES);
        console.log("tempTokens: ", tempTokens);

        const isLostToken = tempTokens.filter(
          (token) => token.lostTime === Number(MAX_LAST_LOST_TRADES)
        );
        console.log("isLostToken: ", isLostToken);
        if (isLostToken.length > 0) {
          stopTrade();
        } else {
          STOP = false;
          await sleep(sleepTime);
          monitoringTrade();
        }
      }
    }, timeDuration);
  }
  // }, timeDuration);
  //========================================================================================
};

//  udpate tokens
const updateTokens = async (tokens) => {
  let symbolArr = [];
  tokens.map((each) => symbolArr.push(each.symbol));
  const res = await axios.get(cmcTokenURL, {
    headers: {
      "X-CMC_PRO_API_KEY": coinmarketcap_key,
    },
    params: {
      symbol: symbolArr.join(),
    },
  });
  const resdata = res.data.data;
  let Arr = [];
  tokens.map((each) => {
    let temp = each;
    const currentPrice = resdata[each.symbol]?.quote.USD.price;
    const marketCap = resdata[each.symbol]?.quote.USD.market_cap;
    temp = { ...each, currentPrice, marketCap };
    Arr.push(temp);
  });

  return Arr;
};

//  start trade
const startTrade = async () => {
  // STOP = false;
  console.log(LOG_TAG.botStarted);
  //  step1: sol swap to tokens
  const logTxt = fs.readFileSync(logStorage, "utf8");
  const tokens = JSON.parse(
    fs.readFileSync(STOP ? initialTokenStorage : tradeTokenStorage, "utf8")
  );
  const updateTokens = [];
  tokens.forEach(async (token) => {
    // const swapResult = await swap(WSOL_ADDRESS, token.address, TRADE_SIZE);
    const swapResult = {
      price: Math.random() * (4.455555 - 0.000001) + 0.000001,
      amount: Math.random() * (45.888784 - 10.5453763) + 10.5453763,
    };
    updateTokens.push({
      ...token,
      initialPrice:
        swapResult?.price || Math.random() * (4.455555 - 0.000001) + 0.000001,
      amount:
        swapResult?.amount ||
        Math.random() * (45.888784 - 10.5453763) + 10.5453763,
      changed: STOP ? 0 : token.changed,
      lostTime: STOP ? 0 : token.lostTime,
    });
  });
  fs.writeFileSync(tradeTokenStorage, JSON.stringify(updateTokens));
  //  step2: filter and monitor trade
};

//  stop trade
const stopTrade = async () => {
  STOP = true;
  console.log(LOG_TAG.botStopped);
};

// sleep
const sleep = async (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
//  repeat monitoring trade
const executeBot = async () => {
  await startTrade();
  await monitoringTrade();
};

executeBot();
