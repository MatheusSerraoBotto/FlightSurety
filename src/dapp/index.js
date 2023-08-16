
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';

let contract;
const TIMMEOUT = 5000;
(async() => {

    contract = new Contract('localhost');

    const callback = () => {
        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });
    

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            // Write transaction
            contract.fetchFlightStatus(flight, (error, result) => {
                // make a http request to get the flight status
                
                setTimeout(() => {
                    fetch(`http://localhost:3000/status`).then(res => res.json()).then(data => {
                        console.log(data);
                        document.getElementById('flight-status').innerHTML = data.message;
                    });
                    fetch(`http://localhost:3000/refunds`).then(res => res.json()).then(data => {
                        processRefunds(flight, data.message);
                    });
                    // fetch(`http://localhost:3000/status`).then(res => res.json()).then(data => {
                    //     console.log(data);
                    //     document.getElementById('flight-status').innerHTML = data.message;
                    // });
                }, TIMMEOUT);
            });
        })
    }

    await contract.initializeConnectionWithDataContract(callback)
})();



function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section)
}

const refundedRead = []
function processRefunds(flight_code, arr) {
    console.log(arr);
    console.log(flight_code)
    const passangerAddress = contract.passengers[document.getElementById('accounts').selectedIndex];
    // filter the array to get the refunds for the current passanger
    const refunds = arr.filter(refund => refund.passengerID === passangerAddress);
    console.log(refunds);
    console.log(refundedRead);
    for (let i = 0; i < refunds.length; i++) { 
        let amount = refunds[i].amount  / 1000000000000000000;
        const key = refunds[i].timestamp.toString() + flight_code + passangerAddress;
        if (!refundedRead.includes(key) && refunds[i].flight_code == flight_code){
            alert(`A refund of ${amount} Ether was sent to your balance due to flight ${refunds[i].flight_code} being delayed`);
            refundedRead.push(key);
        }
    }
}

function processWithdraws(arr){
    const passangerAddress = contract.passengers[document.getElementById('accounts').selectedIndex];
    const withdraws = arr.filter(refund => refund.passengerID === passangerAddress);
    // get first element in array
    const withdraw = withdraws[0];
    if (withdraw) {
        let amount = withdraw.amount  / 1000000000000000000;
        alert(`A withdraw of ${amount} Ether was sent to your account`);
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const dialog = document.getElementById('dialog-buy');
    const openDialogButton = document.getElementById('buy');
    const cancelButton = document.getElementById('cancel');
    const confirmButton = document.getElementById('confirm-buy');
    const withdrawButton = document.getElementById('withdraw');
    // Open dialog
    openDialogButton.addEventListener('click', function() {
        // get selected value in select with id flights-select
        const select = document.getElementById('flights-select');
        const selectedFlight = select.options[select.selectedIndex].text;

        // change text in p 
        const p = document.getElementById('dialog-details');
        p.innerHTML = `You are buying insurance for flight ${selectedFlight}, please enter the amount you want to insure for and click Confirm`;
        dialog.showModal();
    });

    // Close dialog
    cancelButton.addEventListener('click', function() {
        dialog.close();
    });

    withdrawButton.addEventListener('click', function() {
        contract.withdraw((error, result) => {
            setTimeout(() => {
                console.log('fetching withdraws');
                fetch(`http://localhost:3000/withdraws`).then(res => res.json()).then(data => {
                    processWithdraws(data.message);
                });
            }, TIMMEOUT);
        });
    });

    confirmButton.addEventListener('click', function() {
        const amount = document.getElementById('amount').value;
        contract.buyInsurance(amount, (error, result) => {
            console.log(error, result);
            if (error) {
                alert(error);
            } else {
                alert('Insurance bought successfully');
                dialog.close();
            }
        }
        );
    });
});








