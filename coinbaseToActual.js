(async () => {
  var crypto = require("crypto");
  let api = require("@actual-app/api");
  var authKey = require("./keys.json");
  var axios = require("axios");

  // Variables
  var btcBalance;
  var btcResponse;
  var usdBalance;
  var usdResponse;
  var totalBalance;
  var correctBalance;

  // Get date in format YYYY-MM-DD
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1; //January is 0!
  var yyyy = today.getFullYear();
  if (dd < 10) {
    dd = "0" + dd;
  }
  if (mm < 10) {
    mm = "0" + mm;
  }
  var today = yyyy + "-" + mm + "-" + dd;

  // Get time in format HH:MM (24 hour)
  var time = new Date();
  var hours = time.getHours();
  var minutes = time.getMinutes();
  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  var time = hours + ":" + minutes;


  /*******************************************************
   *                  Get Coinbase Balance               *
   *******************************************************/

  // Coinbase Keys
  var apiKey = authKey.coinbaseKey;
  var apiSecret = authKey.coinbaseSecret;

  // Get BTC Balance from Wallet (in USD)
  async function getBTC() {

    // Get the current unix timestamp
    var timestamp = Math.floor(Date.now() / 1000);

    // Request BTC Balance
    var req = {
      method: "GET",
      path: "/v2/accounts/BTC",
      body: "",
    };
    var message = timestamp + req.method + req.path + req.body;
    var signature = crypto
      .createHmac("sha256", apiSecret)
      .update(message)
      .digest("hex");
    var options = {
      url: "https://api.coinbase.com" + req.path,
      method: req.method,
      headers: {
        "CB-ACCESS-SIGN": signature,
        "CB-ACCESS-TIMESTAMP": timestamp,
        "CB-ACCESS-KEY": apiKey,
        "CB-VERSION": "2015-07-22",
      },
    };

    // Save response
    return axios(options).then((resp) => {
      return resp.data;
    });
  }

  // Get USD Balance from Wallet (in USD)
  async function getUSD() {

    // Get the current unix timestamp
    var timestamp = Math.floor(Date.now() / 1000);

    // Request USD Balance
    var req = {
      method: "GET",
      path: "/v2/accounts/USD",
      body: "",
    };
    var message = timestamp + req.method + req.path + req.body;
    var signature = crypto
      .createHmac("sha256", apiSecret)
      .update(message)
      .digest("hex");
    var options = {
      url: "https://api.coinbase.com" + req.path,
      method: req.method,
      headers: {
        "CB-ACCESS-SIGN": signature,
        "CB-ACCESS-TIMESTAMP": timestamp,
        "CB-ACCESS-KEY": apiKey,
        "CB-VERSION": "2015-07-22",
      },
    };

    // Save response
    return axios(options).then((resp) => {
      return resp.data;
    });
  }

  // Parse response data
  btcResponse = await getBTC();
  btcBalance = JSON.parse(btcResponse.data.native_balance.amount);
  usdResponse = await getUSD();
  usdBalance = JSON.parse(usdResponse.data.native_balance.amount);
  totalBalance = btcBalance + usdBalance;

  // Initialize connection to ActualBudget
  await api.init({
    // Budget data will be cached locally here, in subdirectories for each file.
    dataDir: "/Users/swade/Documents/Scripts/FinanceScripts/temp",
    // This is the URL of your running server
    serverURL: authKey.actualURL,
    // This is the password you use to log into the server
    password: authKey.actualPassword,
  });

  // This is the ID from Settings → Show advanced settings → Sync ID
  await api.downloadBudget(authKey.actualBudgetID);

  // Get all transactions from the Coinbase account in ActualBudget
  let temp = await api.getTransactions(authKey.actualWalletID);

  // Loop through all transactions and sum up the total amount
  var total = 0;
  for (var i = 0; i < temp.length; i++) {
    total += temp[i].amount;
  }

  // Subtract the Coinbase balance from the wallet balance
  correctBalance = (totalBalance - total / 100).toFixed(2);

  // If the difference is 0, then there is no need to update the transaction
  if (correctBalance == 0) {

    // Close out connection to the server
    await api.shutdown();

    // Quit program
    process.exit();

  } else {
    // Create a new transaction
    let newTransaction = {
      account: authKey.actualBudgetID,
      date: today,
      payee_name: "Coinbase",
      amount: correctBalance * 100,
      notes: "Adjustment from server at " + time + "",
    };

    // Add the new transaction to the account
    await api.addTransactions(authKey.actualWalletID, [
      newTransaction,
    ]);

    // Save the budget to the server
    await api.downloadBudget(authKey.actualBudgetID);

    // Close out connection to the server
    await api.shutdown();

    // Quit program
    process.exit();
  }
})();
