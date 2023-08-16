import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';

import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import cors from 'cors';

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
let oracles = [];
async function registerOracles() {
  try {
      const accounts = await web3.eth.getAccounts();
      const oracleAccounts = accounts.slice(10, 50);

      for (let account of oracleAccounts) {
          await flightSuretyApp.methods.registerOracle().send({
              value: web3.utils.toWei("2", "ether"),
              from: account,
              gas: 3000000
          });

          const result = await flightSuretyApp.methods.getMyIndexes().call({ from: account });
          console.log(`Oracle indexes: ${result[0]}, ${result[1]}, ${result[2]} - ${account}`);
          oracles.push({
              indexes: result,
              address: account
          })
      }

  } catch (error) {
      console.error("Erro to register oracles", error);
  }
}
registerOracles();

flightSuretyApp.events.OracleRequest({
    toBlock: 'latest'
}, (error, result) => {
    if (error) console.error(error) 
    console.log(result.returnValues);
    console.log(`ORACLE REQUEST => index: ${result.returnValues.index}, flight_code: ${result.returnValues.flight_code}\n`);
    const index = result.returnValues.index;

    for (let oracle of oracles) {
        if (oracle.indexes.includes(index)) {
            const statusCode = (Math.floor(Math.random() * 6) * 10);
            
            flightSuretyApp.methods.submitOracleResponse(index, result.returnValues.flight_code, statusCode).send({
                from: oracle.address,
                gas: 3000000
            }).then(result => {}).catch(error => {});
        }
    }
});

flightSuretyApp.events.OracleReport({
    toBlock: 'latest'
}, (error, result) => {
    if (error) console.error(error) 
    console.log('ORACLE REPORT => ', result.returnValues);
    console.log(result.returnValues);
});

let refunds = [];
flightSuretyApp.events.Refund({
    toBlock: 'latest'
}, (error, result) => {
    if (error) console.error(error) 
    console.log('REFUND => ', result.returnValues);
    const timestamp = new Date().getTime();
    refunds.push({timestamp, ...result.returnValues});
});

let withdraws = [];
flightSuretyApp.events.EmitWithdraw({
    toBlock: 'latest'
}, (error, result) => {
    if (error) console.error(error) 
    console.log('WITHDRAW => ', result.returnValues);
    const timestamp = new Date().getTime();
    withdraws.push({timestamp, ...result.returnValues});
});

flightSuretyApp.events.Log({
    toBlock: 'latest'
}, (error, result) => {
    if (error) console.error(error) 
    console.log('LOG => ', result.returnValues);

});


// flightSuretyData.events.WhoIsCaller({
//     fromBlock: 0,
// },(error, result) => {
//     if (error) console.log(error);
//     if (result) {
//         console.log("WhoIsCaller: ", result);
//     }
// })

// flightSuretyData.events.NewAuthorizedContract({
//     fromBlock: 0,
//     toBlock: 'latest'
// },(error, result) => {
//     if (error) console.log(error);
//     if (result) {
//         console.log("NewAuthorizedContract: ", result);
//     }
// })

let statusInfo = null;

const FlightStatusCode = {
    0: 'UNKNOWN',
    10: 'ON_TIME',
    20: 'LATE_AIRLINE',
    30: 'LATE_WEATHER',
    40: 'LATE_TECHNICAL',
    50: 'LATE_OTHER'
};

flightSuretyApp.events.FlightStatusInfo({
    toBlock: 'latest'
}, (error, result) => {
    if (error) console.log(error);
    if (!result) return;
    console.log("FlightStatusInfo: ", result.returnValues);
    const { flight_code, status } = result.returnValues;
    statusInfo = `${flight_code} - status: ${FlightStatusCode[status]}`;
});

const app = express();
app.use(cors());
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

app.get('/status', (req, res) => {
    res.send({
        message: statusInfo
    })
})

app.get('/refunds', (req, res) => {
    res.send({
        message: refunds
    })
})

app.get('/withdraws', (req, res) => {
    res.send({
        message: withdraws
    })
})

export default app;


