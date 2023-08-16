import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network) {

        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.owner = null;
        this.airlines = [];
        this.flights = [];
        this.passengers = [];

        // this.webWs = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')))
        // this.eventsApp = new this.webWs.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        // this.eventsData = null;
    }

    async initializeConnectionWithDataContract(callback) {
        this.web3.eth.getAccounts(async (error, accts) => {
            console.log("Accounts: ", accts);
           
            this.owner = accts[0];
            console.log("Owner: ", this.owner);
            const firstAirline = '0xf17f52151EbEF6C7334FAD080c5704D77216b732';
            this.airlines = [firstAirline, accts[2], accts[3], accts[4]];
            this.passengers = [accts[5], accts[6], accts[7], accts[8], accts[9]];
            
            this.insertPassengers()
            console.log("FlightSuretyData: ", this.flightSuretyData);

            setTimeout(() => {
                console.log("Authorizing Caller");
                this.flightSuretyData.methods.authorizeCaller(Config.localhost.appAddress).send({ from: this.owner }, (error, result) => {
                    console.log("authorizeCaller: ", error, result);
                    this.insertAirlines();
                    callback();                    
                });
            }, 2000);

            
        });
    }

    insertAirlines() {
        const firstAirline = this.airlines[0];
        console.log("Registering Airlines");
        for (let i = 1; i < this.airlines.length; i++) {
            this.flightSuretyData.methods.registerAirline('Airline' + i, this.airlines[i]).send({ from: firstAirline }, (error, result) => {
                console.log("registerAirline: ", error, result);
                if(!error) {
                    this.flightSuretyData.methods.submitFunds().send({ from: this.airlines[i], value: this.web3.utils.toWei("11", "ether")}, (error, result) => {
                        console.log("submitFunding: ", error, result);
                    });
                }
            }); 
        }
            
        setTimeout(() => {
            this.insertFlights()
        }, 2000);
    }

    insertFlights() {
        const list = document.getElementById('flight-list')
        const select = document.getElementById('flights-select');
    
        // for range 10
        for (let i = 0; i < 10; i++) {

            // generate random number of 4 digits
            let flightNumber = Math.floor(Math.random() * 9000) + 1000;
        
            let flight = 'FLIGHT ' + flightNumber;
            let timestamp = Math.floor(Date.now() / 1000);
            let airline = this.airlines[i % this.airlines.length];
        
            this.flightSuretyData.methods.registerFlight(flight, timestamp).send({ from: airline}, (error, result) => {
                console.log("Registering Flight: ", flight, timestamp, airline, error, result);

                const airlineName = 'Airline' + (i % this.airlines.length);
                this.flights.push({
                    flight: flight,
                    timestamp: timestamp,
                    airlineAddress: airline,
                    airlineName: airlineName
                });
                const text = flight + ' - ' + airlineName + ' - ' + airline.substring(0, 5) + ' - ' + timestamp;
                const listItem = document.createElement('li');
                listItem.textContent = text;
                list.appendChild(listItem);
                //
                const optionElement = document.createElement('option');
                optionElement.textContent = text;
                optionElement.value = i;
                select.appendChild(optionElement);
            });
        }
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(flight_code, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .fetchFlightStatus(flight_code)
            .send({ from: self.owner }, (error, result) => {
                callback(error, result);
            });
    }

    insertPassengers() {
        const selectElement = document.getElementById('accounts');
    
        this.passengers.forEach((optionText, index) => {
            const optionElement = document.createElement('option');
            optionElement.value = index; // Setting a value (can be adjusted as needed)
            optionElement.textContent = optionText;
    
            // Set the default option
            if (index === 0) {
                optionElement.selected = true;
            }
    
            selectElement.appendChild(optionElement);
        });
    }

    buyInsurance(insuranceAmount, callback) {
        const flight = this.flights[document.getElementById('flights-select').selectedIndex].flight
        console.log("Flight: ", flight);
        const passenger = this.passengers[document.getElementById('accounts').selectedIndex];
        console.log("Buying Insurance: ", flight, passenger, insuranceAmount);
        this.flightSuretyApp.methods
            .buyInsurance(flight)
            .send({ from: passenger, value: this.web3.utils.toWei(insuranceAmount, "ether"), gas: 3000000}, (error, result) => {
                callback(error, result);
            });
    }

    withdraw(callback) {
        const passenger = this.passengers[document.getElementById('accounts').selectedIndex];
        console.log("Withdrawing: ", passenger);
        this.flightSuretyApp.methods
            .withdraw()
            .send({ from: passenger, gas: 3000000}, (error, result) => {
                console.log("Withdraw: ", error, result);
                if (!error) {
                    callback(error, result);
                }
            });
    }
}