
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
            accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      let reverted = false;
      try 
      {
          const list = await config.flightSuretyApp.getListOfFlights();
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
        await config.flightSuretyData.registerAirline('Airline 2', newAirline, {from: config.firstAirline});
    }
    catch(e) {
      console.log(e);
    }
    let result = await config.flightSuretyData.checkIfAirlineValid(newAirline); 

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

  });

  it('(airline) after submit funds Airline is valid', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
        await config.flightSuretyData.submitFunds({from: newAirline, value: web3.utils.toWei("11", "ether")});
    }
    catch(e) {
      console.log(e);
    }
    let result = await config.flightSuretyData.checkIfAirlineValid(newAirline); 

    // ASSERT
    assert.equal(result, true, "Airline should be able to register another airline if it has provided funding");
  });

  it('(airline) after 4 Airline the follow registration need be approved by vote', async () => {
    
    // ARRANGE
    let newAirline3 = accounts[3];
    let newAirline4 = accounts[4];
    let newAirline5 = accounts[5];

    // ACT
    try {
        await config.flightSuretyData.registerAirline('Airline 3', newAirline3, {from: config.firstAirline});
        await config.flightSuretyData.submitFunds({from: newAirline3, value: web3.utils.toWei("11", "ether")});

        await config.flightSuretyData.registerAirline('Airline 4', newAirline4, {from: config.firstAirline});
        await config.flightSuretyData.submitFunds({from: newAirline4, value: web3.utils.toWei("11", "ether")});

        // register 5th airline, this should be approved by vote
        await config.flightSuretyData.registerAirline('Airline 5', newAirline5, {from: config.firstAirline});
    }
    catch(e) {
      console.log(e);
    }
    let result3 = await config.flightSuretyData.checkIfAirlineRegistered(newAirline3); 
    let result4 = await config.flightSuretyData.checkIfAirlineRegistered(newAirline4); 
    let result5 = await config.flightSuretyData.checkIfAirlineRegistered(newAirline5); 

    // ASSERT
    assert.equal(result3, true, "Airline3 should be registered");
    assert.equal(result4, true, "Airline4 should be registered");
    assert.equal(result5, false, "Airline5 should not be registered");
  });

  it('(airline) after one more vote in Airline 5 it should be a registered airline', async () => {
    
    // ARRANGE
    let newAirline2 = accounts[2];
    let newAirline5 = accounts[5];

    // ACT
    try {
        await config.flightSuretyData.registerAirline('Airline 5', newAirline5, {from: newAirline2});
    }
    catch(e) {
      console.log(e);
    }
    let result = await config.flightSuretyData.checkIfAirlineRegistered(newAirline5); 

    // ASSERT
    assert.equal(result, true, "Airline5 should be registered");
  });
 

});
