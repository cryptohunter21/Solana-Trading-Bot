require("dotenv").config();
const axios = require("axios");
const { Jupiter, RouteInfo, TOKEN_LIST_URL } = require("@jup-ag/core");
const {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  Keypair,
  Authorized,
} = require("@solana/web3.js");
const fs = require("fs");
// ==================== config variable ================
const tokenPath = "./helper/testToken.txt";
const tokenInfoPath = "./helper/tokenHistory.txt";
// ==================== env variable ===================
const RPC_CHAIN = process.env.RPC_CHAIN;
const TOKEN_AMOUNT = process.env.TOKEN_AMOUNT;
const TRADE_SIZE = process.env.TRADE_SIZE;
const WSOL_ADDRESS = process.env.WSOL_ADDRESS;
const MAX_MARKETCAP = process.env.MAX_MARKETCAP;
const TRADE_WINDOW = process.env.TRADE_WINDOW;
const PROFIT_RATIO = process.env.PROFIT_RATIO;
const WALLET_SECRET_KEY = process.env.WALLET_SECRET_KEY;
// =====================================================

const connection = new Connection(clusterApiUrl(RPC_CHAIN), "confirmed");
const cmcTokenURL = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest`;
const cmcPriceURL = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/price-performance-stats/latest`;
const coinmarketcap_key = "4206945b-936f-4b90-a409-5576fb0d6f1c";
const intervalTimeline = 10000;

//  step1: if no data, store specified tokens
const tokenInfo = async () => {
  const tokens = [];
  const list = await (await fetch(TOKEN_LIST_URL[RPC_CHAIN])).json();
  for (let i = 0; i < TOKEN_AMOUNT; i++) tokens.push(list[i]);

  const arrayTokenString = JSON.stringify(tokens);

  fs.writeFile("./helper/token.txt", arrayTokenString, (err) => {
    if (err) console.error("Error writing to file: ", err);
    else {
      console.log("Array has been stored in txt");
    }
  });
  console.log("value: ", tokens);
};
//  step2: SOL of wallet swap to spcified tokens
const tokenSwap = async (input, output, inputAmount, JUPITER) => {
  const routes = await JUPITER.computeRoutes({
    inputMint: new PublicKey(input),
    outputMint: new PublicKey(output),
    inputAmount,
    slippage: inputAmount,
    forceFetch: false,
  });
  const { execute } = await JUPITER.exchange({
    routeInfo: routes.routesInfos[0],
  });
  const swapResult = await execute();
  return swapResult;
};
//  step3: monitor market and if condition is OK, perform swap again.
const monitoringMarket = async () => {
  const tokenInfo = JSON.parse(fs.readFileSync(tokenInfoPath, "utf8"));
  if (TRADE_WINDOW == 0) {
    //   if TRADE_WINDOW is null, MAX_MARKETCAP is active!
    const RANGE = {
      MIN: JSON.parse(MAX_MARKETCAP)[0],
      MAX: JSON.parse(MAX_MARKETCAP)[1],
    };
    await axios
      .get(cmcURL, {
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
  } else {
    //   if TRADE_WINDOW is not null, MAX_MARKETCAP is not active!
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
            const currentPrice = [];
            for (let i = 0; i < tokenInfo.length; i++) {
              if (tokenInfo[i] * PROFIT_RATIO >= currentPrice[i]) {
                // swap token to SOL again
              }
            }
          });
      } else {
        console.log("Time is over!");
      }
    }, intervalTimeline);
  }
};

const run = async () => {
  // ======================== jupiter variable setting ============================
  const payer = Keypair.fromSecretKey(WALLET_SECRET_KEY);
  const jupiter = await Jupiter.load({
    connection,
    cluster: RPC_CHAIN,
    user: payer,
  });
  const routeMap = jupiter.getRouteMap();
  // ==============================================================================

  //   await tokenInfo();
  //   tokenSwap();
  monitoringMarket();
};

run();
