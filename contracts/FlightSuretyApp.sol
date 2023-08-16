pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "./SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    FlightSuretyData data;

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract
 
    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational(){
         // Modify to call data contract's status
        require(data.isOperational(), "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner(){
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor(address dataContract) public {
        data = FlightSuretyData(dataContract);
        contractOwner = msg.sender;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns(bool){
        return data.isOperational();
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/
    event Log(bool refunded, bool flight_code, string flight_code1, string flight_code2);
 
    function getListOfFlights() external view requireIsOperational returns (string[] memory) {
        return data.getFlights();
    }
 
    function buyInsurance(string flight_code) external payable requireIsOperational {
        require(msg.value <= 1 ether, "Insurance must be less than or equal to 1 ether");
        
        data.addTicket(flight_code, msg.value, msg.sender);
    }

    function _compareStrings(string memory a, string memory b) private pure returns(bool) {
        bytes memory aBytes = bytes(a);
        bytes memory bBytes = bytes(b);
        
        if (aBytes.length != bBytes.length) {
            return false;
        }
        
        for (uint i = 0; i < aBytes.length; i++) {
            if (aBytes[i] != bBytes[i]) {
                return false;
            }
        }
        return true;
    }

    event Refund(address passengerID, uint256 amount, string flight_code);
    function creditInsuree(string flight_code) private requireIsOperational{
        for(uint index = 0; index < data.totalTickets(); index++) {
            bool isRefundedYet = !data.getTicket(index).isRefunded;
            bool isFlightCode = _compareStrings(data.getTicket(index).flightCode, flight_code);
            emit Log(isRefundedYet, isFlightCode, data.getTicket(index).flightCode, flight_code);
            if (isRefundedYet && isFlightCode) {
                data.updateTicket(index);
                address passengerID = data.getTicket(index).passengerID;
                uint256 amount = data.getTicket(index).amount.mul(3);
                amount = amount.div(2);
                data.increaseBalancePassenger(passengerID, amount);
                emit Refund(passengerID, amount, flight_code);
            }
        }
    }

    event EmitWithdraw(address passengerID, uint256 amount);
    function withdraw() requireIsOperational external payable {
        require(data.getPassenger(msg.sender).balance > 0, "You have no balance to withdraw");
        uint256 amount = data.getPassenger(msg.sender).balance;
        data.resetBalancePassenger(msg.sender);
        msg.sender.transfer(amount);
        emit EmitWithdraw(msg.sender, amount);
    }
    
    function processFlightStatus(string flight_code, uint8 statusCode) requireIsOperational internal { 
        //data.getFlight(flight_code).statusCode = statusCode;
        if (statusCode == STATUS_CODE_LATE_AIRLINE) {
            creditInsuree(flight_code);
        }
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(string flight_code) requireIsOperational external {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, flight_code));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, flight_code);
    }


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(string flight_code, uint8 status);

    event OracleReport(string flight_code, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, string flight_code);


    // Register an oracle with the contract
    function registerOracle() external payable {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3])
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(uint8 index, string flight_code, uint8 statusCode) external {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, flight_code)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(flight_code, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {
            emit FlightStatusInfo(flight_code, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(flight_code, statusCode);
        }
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (                       
                                address account         
                            )
                            internal
                            returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   

contract FlightSuretyData{

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;  
        address airline;
    }

    struct Ticket {
        string flightCode;
        uint256 amount;
        bool isRefunded;
        address passengerID;
    }

    struct Passenger {
        uint256 balance;
    }

    function getFlights() external view returns (string[] memory);
    function getFlight(string key) external view returns (Flight memory);
    function totalFlights() external view returns (uint);

    function addTicket(string flightCode, uint256 amount, address passengerID) external;
    function getTicket(uint index) external view returns (Ticket memory);
    function updateTicket(uint index) external;
    function totalTickets() external view returns (uint);
    function isOperational() external view returns(bool) {}

    function getPassenger(address passengerID) external view returns (Passenger memory);
    function increaseBalancePassenger(address passengerID, uint256 amount) external;
    function resetBalancePassenger(address passengerID) external;
}