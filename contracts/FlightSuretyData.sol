pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import "./SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping(address => uint256) private authorizedContracts;

    // Airlines
    struct Airline {       
        string name;
        bool registered;
        bool funded;
    }
    mapping(address => Airline) private airlines;
    uint totalAirlinesFunded = 1;
    uint totalAirlinesRegistered = 0;
    mapping(address => address[]) private votesToRegisterAirline;

    // Flights
    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;  
        address airline;
    }
    mapping(string => Flight) private flights;

    uint public totalFlights = 0;
    string[] public flightCodes;

    // Passengers
    struct Passenger {
        uint256 balance;
    }
    mapping(address => Passenger) private passengers;

    // Tickets
    struct Ticket {
        string flightCode;
        uint256 amount;
        bool isRefunded;
        address passengerID;
    }
    Ticket[] private tickets;
    uint public totalTickets = 0;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    
    event WhoIsCaller(address caller);
    event NewAuthorizedContract(address contractAddress);


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address firstAirline) public{
        contractOwner = msg.sender;
        // Add first airline
        _addAirline("Airline 0", true, true, firstAirline);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    modifier requireIsOperational(){
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    modifier requireContractOwner(){
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireIsAirlineFunded(address airline) {
        require(airlines[airline].funded, "Airline is not funded");
        _;
    }

    modifier requireIsAirlineRegistered(address airline) {
        require(airlines[airline].registered, "Airline is not registered");
        _;
    }

    modifier requireIsNotAirlineFunded(address airline) {
        require(!airlines[airline].funded, "Airline is already registered");
        _;
    }

    modifier giveChange(uint256 amount) {
        _;
        uint256 amountToReturn = msg.value.sub(amount);
        msg.sender.transfer(amountToReturn);
    }

    modifier requireIsCallerAuthorized() {
        emit WhoIsCaller(tx.origin);
        require(authorizedContracts[tx.origin] == 1, "Caller is not authorized");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/
   
    function isOperational() external view returns(bool) {
        return operational;
    }
 
    function setOperatingStatus(bool mode) external requireContractOwner {
        require(mode != operational, "New mode must be different from existing mode");
        operational = mode;
    }

    function authorizeCaller(address contractAddress) external requireContractOwner {
        authorizedContracts[contractAddress] = 1;
        emit NewAuthorizedContract(contractAddress);
    }

    function deauthorizeCaller(address contractAddress) external requireContractOwner {
        delete authorizedContracts[contractAddress];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    event Log(uint256 value1, uint256 value2);
    function registerAirline(string nameAirline, address newAirlineAddress) external requireIsAirlineFunded(msg.sender) requireIsNotAirlineFunded(newAirlineAddress) requireIsOperational{
        if (totalAirlinesRegistered < 4) {
            _addAirline(nameAirline, true, false, newAirlineAddress);
        }else{
            bool isDuplicate = false;
            for(uint c = 0; c < votesToRegisterAirline[newAirlineAddress].length; c++) {
                if (votesToRegisterAirline[newAirlineAddress][c] == msg.sender) {
                    isDuplicate = true;
                    break;
                }
            }

            require(!isDuplicate, "Caller has already voted for this airline.");

            votesToRegisterAirline[newAirlineAddress].push(msg.sender);
            emit Log(votesToRegisterAirline[newAirlineAddress].length, totalAirlinesFunded.div(2));
            if (votesToRegisterAirline[newAirlineAddress].length >= totalAirlinesFunded.div(2)) {
                _addAirline(nameAirline, true, false, newAirlineAddress);
            }
        }
    }

    event TotalFunds(uint totalFunds);
    function submitFunds() external payable requireIsAirlineRegistered(msg.sender) giveChange(10 ether) requireIsOperational{
        require(!airlines[msg.sender].funded, "Airline is already funded");
        require(msg.value >= 10 ether, "Airline must submit 10 ether");

        airlines[msg.sender].funded = true;
        totalAirlinesFunded = totalAirlinesFunded.add(1);
        emit TotalFunds(totalAirlinesFunded);
    }

    // test only
    function checkIfAirlineValid(address airline) external view requireIsOperational returns(bool) {
        if (airlines[airline].funded) {
            return true;
        }else{
            return false;
        }
    }

    // test only
    function checkIfAirlineRegistered(address airline) external view requireIsOperational returns(bool) {
        if (airlines[airline].registered) {
            return true;
        }else{
            return false;
        }
    }

    event TotalRegistered(uint totalRegistered);
    function _addAirline(string name, bool registered, bool funded, address airlineAddress) private{
        airlines[airlineAddress] = Airline({
            name: name,
            registered: registered,
            funded: funded
        });
        totalAirlinesRegistered = totalAirlinesRegistered.add(1);
        emit TotalRegistered(totalAirlinesRegistered);
    }

    function registerFlight(string flight_code, uint256 timestamp) external requireIsAirlineFunded(msg.sender) requireIsOperational{
        require(!flights[flight_code].isRegistered, "Flight is already registered");
        flights[flight_code] = Flight({
            isRegistered: true,
            statusCode: 0,
            updatedTimestamp: timestamp,
            airline: msg.sender
        });
        flightCodes.push(flight_code);
        totalFlights = totalFlights.add(1);
    }

    /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund() public payable{
    }

    /********************************************************************************************/
    /*                                     GET                                                  */
    /********************************************************************************************/

    function getFlight(string key) external view requireIsOperational  returns(Flight memory) {
        return flights[key];
    }

    function getFlights() external view requireIsOperational  returns(string[] memory) {
        return flightCodes;
    }

    function getPassenger(address passengerID) external view requireIsOperational  returns (Passenger memory) {
        return passengers[passengerID];
    }

    function getTicket(uint index) external view requireIsOperational  returns (Ticket memory) {
        return tickets[index];
    }

    /********************************************************************************************/
    /*                                     INSERT                                                  */
    /********************************************************************************************/

    function addTicket(string flightCode, uint256 amount, address passengerID) external requireIsOperational  {
        tickets.push(Ticket({
            flightCode: flightCode,
            amount: amount,
            isRefunded: false,
            passengerID: passengerID
        }));
        totalTickets = totalTickets.add(1);
    }

    /********************************************************************************************/
    /*                                     UPDATE                                                  */
    /********************************************************************************************/

    function updateTicket(uint256 index) external requireIsOperational  {
        tickets[index].isRefunded = true;
    }

    function increaseBalancePassenger(address passengerID, uint256 amount) external requireIsOperational  {
        passengers[passengerID].balance = passengers[passengerID].balance.add(amount);
    }

    function resetBalancePassenger(address passengerID) external requireIsOperational  {
        passengers[passengerID].balance = 0;
    }
}

