var web3;
var mainNetHost = 'http://frontier-lb.ether.camp';
var testNetHost = 'https://morden.infura.io:8545';
var mainNetAddr = '0x41f274c0023f83391de4e0733c609df5a124c3d4';
var testNetAddr = '0x5770345100a27b15f5b40bec86a701f888e8c601';
var mainNetStats = 'https://ethstats.net';
var testNetStats = 'https://morden.io';
var heightPerRelay;
var relayAddr;
var gMerkleProof;
var gBlockHashOfTx;
var gFeeVerifyFinney;
var ContractClass;
var ContractObject;
var lastNet = null;
var isRelay = false;
var gProcessorAddr = '0x59c9fb53d658b15a7dded65c693703baf58cf63c'; // testnet Morden

var btcproof = require('bitcoin-proof');

/**
 *  Status Page
 */

function updatePage(net) {
  if (lastNet !== net) {
    lastNet = net;
    relayAddr = net === 'main' ? mainNetAddr : testNetAddr;

    web3 = new Web3(new Web3.providers.HttpProvider(net === 'main' ? mainNetHost : testNetHost));

    $('#relayAddr').text(relayAddr);
    $('#relayAddr').attr('href', 'http://' + (net === 'test' ? 'testnet.' : '') + 'etherscan.io/address/' + relayAddr);
    $('#relayAddr1').text(relayAddr);
    $('#relayAddr1').attr('href', 'http://' + (net === 'test' ? 'testnet.' : '') + 'etherscan.io/address/' + relayAddr);

    $('#latestBlockHeight').text('# -');
    $('#bciBlockHeight').text('# -');
    $('#blockrBlockHeight').text('# -');
    $('#latestBlockHash').text('-');
    $('#feeRecipient').text('-');
    $('#feeRecipient').attr('href', '#');
    $('#feeVTX').text('-');
  }
  $('#header').html((net === 'main' ? 'Main' : 'Test') + ' net live status' + (net === 'test' ? ' <small>(may need relayers)</small>' : ''));

  $('#warnSync').hide();

  setTimeout(function() {getStatus(net);}, 400);
}

function getStatus(net) {
  updateBCI();
  updateBlockr();

  ContractClass = web3.eth.contract(btcRelayAbi);
  ContractObject = ContractClass.at(relayAddr);

  heightPerRelay = ContractObject.getLastBlockHeight.call().toString();
  $('#latestBlockHeight').text('# ' + heightPerRelay);

  var headHash = ContractObject.getBlockchainHead.call();
  $('#latestBlockHash').text(formatHash(headHash));

  var feeVTX = web3.fromWei(ContractObject.getFeeAmount.call(headHash), 'ether');
  $('#feeVTX').text(feeVTX);

  var feeRecipient = ContractObject.getFeeRecipient.call(headHash).toString(16);
  $('#feeRecipient').text('0x' + formatETHAddress(feeRecipient));
  $('#feeRecipient').attr('href', 'http://' + (net === 'test' ? 'testnet.' : '') + 'etherscan.io/address/' + feeRecipient);

  window.btcrelayTester = ContractObject;

  setTimeout(checkHeights, 1000);
}

function updateBCI() {
  $.getJSON('https://blockchain.info/q/getblockcount?cors=true', function(data) {
    $('#bciBlockHeight').text('# ' + data);
  });
}

function updateBlockr() {
  $.getJSON('http://btc.blockr.io/api/v1/block/info/last', function(data) {
    $('#blockrBlockHeight').text('# ' + data.data.nb);
  });
}

function checkHeights() {
  var bciHeight = $('#bciBlockHeight').text().replace('# ', '');
  var blockrHeight = $('#blockrBlockHeight').text().replace('# ', '');
  if (!bciHeight || !blockrHeight ||
    heightPerRelay === bciHeight || heightPerRelay === blockrHeight) {
      $('#warnSync').hide();
  }
  else {
    $('#nodeBlockNum').text('# ' + web3.eth.blockNumber);
    $('#statsLink').attr('href', (lastNet === 'test' ? testNetStats : mainNetStats));
    $('#warnSync').show();
  }
}

function formatHash(bnHash) {
  var hash = bnHash.toString(16);
  return Array(64 - hash.length + 1).join('0') + hash;
}

function formatETHAddress(bnEthAddress) {
  var ethAddress = bnEthAddress.toString(16);
  return Array(40 - ethAddress.length + 1).join('0') + ethAddress;
}


/**
 *  Verify page
 */

// shows how to use web3 to make an eth_call to the relay contract
// verifyTx returns 1 (success) or 0 (verify failed)
function callVerifyTx(txBytes, txIndex, merkleSibling, txBlockHash) {
  // gFeeVerifyFinney is transferred!  coinbase must have it or verifyTx fails
  var feeWei = web3.toWei(gFeeVerifyFinney, 'finney');
  // var objParam = { from: web3.eth.coinbase, value: feeWei, gas: 3000000 };
  var objParam = { from: '0x102e61f5d8f9bc71d0ad4a084df4e65e05ce0e1c', value: feeWei, gas: 3000000 };
  var res = ContractObject.verifyTx.call(txBytes, txIndex, merkleSibling, txBlockHash, objParam);

  $('#txReturned').text(res.toString(16));
  $('.status-box .glyphicon').removeClass('glyphicon-repeat').removeClass('glyphicon-ok').removeClass('glyphicon-remove').removeClass('spinning');

  if(res.toString(16) === $('#btcTxHash').val()) {
    $('.status-box').addClass('success');
    $('.status-box .glyphicon').addClass('glyphicon-ok');
  } else {
    $('.status-box').addClass('danger');
    $('.status-box .glyphicon').addClass('glyphicon-remove');
  }
}

function callContract() {
  $('.status-box').removeClass('danger').removeClass('success');
  $('.status-box .glyphicon').removeClass('glyphicon-repeat').removeClass('glyphicon-ok').removeClass('glyphicon-remove').removeClass('spinning').addClass('glyphicon-repeat').addClass('spinning');
  var txBytes = '0x' + $('#rawTransaction').text();
  var txBlockHash = '0x' + gBlockHashOfTx;

  var merkleSibling = gMerkleProof.sibling.map(function(sib) {
    return '0x' + sib;
  });

  callVerifyTx(txBytes, gMerkleProof.txIndex, merkleSibling, txBlockHash);
}

function getTxInfo(isRelay) {
  if (typeof isRelay === 'undefined') {
    isRelay = false;
  }

  $('#rawTransaction').html('-');
  $('#merkleProof').html('-');
  $('#txBlockHash').html('-');
  $('#feeVerifyTx').html('-');
  $('#txReturned').html('-');
  $('.status-box').removeClass('danger').removeClass('success');
  $('.status-box .glyphicon').removeClass('glyphicon-repeat').removeClass('glyphicon-ok').removeClass('glyphicon-remove').removeClass('spinning').addClass('glyphicon-repeat');

  var txid = $('#btcTxHash').val();
  var urlJsonTx = "https://btc.blockr.io/api/v1/tx/raw/" + txid;
  $.getJSON(urlJsonTx, function(data) {
      $('#rawTransaction').text(data.data.tx.hex);

      var blockNum = data.data.tx.blockhash;
      var blockInfoUrl = "http://btc.blockr.io/api/v1/block/raw/"+blockNum;
      $.getJSON(blockInfoUrl, function(res) {
          gBlockHashOfTx = res.data.hash;
          $('#txBlockHash').text(gBlockHashOfTx)

          var txIndex;
          for (var key in res.data.tx) {
            if (res.data.tx[key] == txid) {
              txIndex = key;
              break;
            }
          }

          gMerkleProof = btcproof.getProof(res.data.tx, txIndex);
          console.log('merkle proof: ', gMerkleProof)
          $('#merkleProof').text(JSON.stringify(gMerkleProof));

          if (isRelay) {
            ContractObject.getFeeAmount.call('0x'+gBlockHashOfTx, function(err, feeWei) {
              if (err) {
                console.log('@@@ getFeeAmount error');
                return;
              }

              gFeeVerifyFinney = web3.fromWei(feeWei, 'finney');
              $('#feeVerifyTx').text(gFeeVerifyFinney);
            });
          } else {
            gFeeVerifyFinney = web3.fromWei(ContractObject.getFeeAmount.call('0x'+gBlockHashOfTx), 'finney');
            $('#feeVerifyTx').text(gFeeVerifyFinney);
          }
      })
  })
}

function doRelayTx(txBytes, txIndex, merkleSibling, txBlockHash) {
  // gFeeVerifyFinney is transferred!  coinbase must have it or relayTx fails
  var feeWei = web3.toWei(gFeeVerifyFinney, 'finney');
  // var objParam = { from: web3.eth.coinbase, value: feeWei, gas: 1900000 };
  var objParam = { from: '0x102e61f5d8f9bc71d0ad4a084df4e65e05ce0e1c', value: feeWei, gas: 1900000 };

  ContractObject.relayTx.sendTransaction(txBytes, txIndex, merkleSibling,
      txBlockHash, gProcessorAddr, objParam, function(err, ethTx) {
    if (err) {
      console.log('@@@ relayTx error');
      console.error(err);
      $('#txHashReturned').hide();
      $('#txHashError').show();
      $('.status-box').removeClass('danger').removeClass('success').addClass('danger');
      $('.status-box .glyphicon').removeClass('glyphicon-repeat').removeClass('glyphicon-ok').removeClass('glyphicon-remove').removeClass('spinning').addClass('glyphicon-remove');
      $('#txHashError').text(err.toString());
      return;
    }

    $('#txHashReturned').show();
    $('#txHashError').hide();
    $('.status-box').removeClass('danger').removeClass('success').addClass('success');
    $('.status-box .glyphicon').removeClass('glyphicon-repeat').removeClass('glyphicon-ok').removeClass('glyphicon-remove').removeClass('spinning').addClass('glyphicon-ok');
    $('#txHashReturned').text(ethTx);
    $('#txHashReturned').attr('href', 'http://' + (net === 'test' ? 'testnet.' : '') + 'etherscan.io/tx/' + ethTx);
  });
}

function callRelayContract() {
  $('#txHashError').text('');
  $('#txHashError').hide();
  $('.status-box').removeClass('danger').removeClass('success');
  $('.status-box .glyphicon').removeClass('glyphicon-repeat').removeClass('glyphicon-ok').removeClass('glyphicon-remove').removeClass('spinning').addClass('glyphicon-repeat').addClass('spinning');
  var txBytes = '0x' + $('#txHexText').val();
  var txBlockHash = '0x' + gBlockHashOfTx;

  // web3.js wants 0x prepended
  var merkleSibling = gMerkleProof.sibling.map(function(sib) {
    return '0x' + sib;
  });

  doRelayTx(txBytes, gMerkleProof.txIndex, merkleSibling, txBlockHash);
}


/**
 *  Bindings
 */

$(function() {
  function cleanup() {
    $('.example-page').hide();
    $('#sourcePage').hide();
    $('.example-list li').removeClass('active');
    $('.sourcePage').parent().removeClass('active');
    $('#mainNetPanel li.statusBut').removeClass('active');
    $('#testNetPanel li.statusBut').removeClass('active');
  }

  cleanup();
  $('#mainNetPanel li.statusBut').addClass('active');

  $('#mainnetHeading').on('click', function(e) {
    $(this).find('li.header').removeClass('active').addClass('active');
    $('#testnetHeading').find('li.header').removeClass('active');

    cleanup();

    $('#mainNetPanel li.statusBut').addClass('active');

    $('#statusPage').show();
    updatePage('main');
  });

  $('#testnetHeading').on('click', function(e) {
    $(this).find('li.header').removeClass('active').addClass('active');
    $('#mainnetHeading').find('li.header').removeClass('active');

    cleanup();

    $('ul#testNetPanel li.statusBut').addClass('active');

    $('#statusPage').show();
    updatePage('test');
  });

  $('.statusPage').on('click', function(e) {
    $('#' + $(this).data('net') + 'netHeading').trigger('click');
  });


  /*
  Verify TX
   */

  $('.verifyTxPage').on('click', function(e) {
    isRelay = false;
    cleanup();

    $(this).parent().addClass('active');
    $('#statusPage').hide();
    $('#verifyPage').removeClass('verify-active').removeClass('relay-active');

    // Reset fields
    $('#btcTxHash').val('dd059634699e85b51af4964ab97d5e75fb7cd86b748d0ee1c537ca1850101dc7');
    $('#rawTransaction').html('-');
    $('#merkleProof').html('-');
    $('#txBlockHash').html('-');
    $('#feeVerifyTx').html('-');
    $('#txReturned').html('-');
    $('#txHashReturned').text('-');
    $('#txHashReturned').attr('href', '#');
    $('.status-box').removeClass('danger').removeClass('success');
    $('.status-box .glyphicon').removeClass('glyphicon-repeat').removeClass('glyphicon-ok').removeClass('glyphicon-remove').removeClass('spinning').addClass('glyphicon-repeat');
    $('#verifyPage').addClass('verify-active').show();

    $('#header').html('Verify Tx <small>' + (lastNet === 'main' ? '(Main net)' : '(Morden test net)') + '</small>');
  });

  $('.relayTxPage').on('click', function(e) {
    isRelay = true;
    cleanup();

    $(this).parent().addClass('active');
    $('#statusPage').hide();
    $('#verifyPage').removeClass('verify-active').removeClass('relay-active');

    // Reset fields
    $('#btcTxHash').val('dd059634699e85b51af4964ab97d5e75fb7cd86b748d0ee1c537ca1850101dc7');
    $('#rawTransaction').html('-');
    $('#merkleProof').html('-');
    $('#txBlockHash').html('-');
    $('#feeVerifyTx').html('-');
    $('#txReturned').html('-');
    $('#txHashReturned').text('-');
    $('#txHashReturned').attr('href', '#');
    $('#txHashReturned').show();
    $('#txHashError').hide();
    $('.status-box').removeClass('danger').removeClass('success');
    $('.status-box .glyphicon').removeClass('glyphicon-repeat').removeClass('glyphicon-ok').removeClass('glyphicon-remove').removeClass('spinning').addClass('glyphicon-repeat');
    $('#verifyPage').addClass('relay-active').show();

    $('#header').html('Relay Tx <small>' + (lastNet === 'main' ? '(Main net)' : '(Morden test net)') + '</small>');
  });

  $('.sourcePage').on('click', function(e) {
    cleanup();
    $(this).parent().addClass('active');
    $('#statusPage').hide();
    $('#sourcePage').removeClass('mainNet').removeClass('testNet').addClass((lastNet === 'main' ? 'main' : 'test') + 'Net');
     $('#header').html('Verifying the Source Code <small>at ' + (lastNet === 'main' ? mainNetAddr : testNetAddr) + '</small>');
    $('#sourcePage').show();
  });

  $('#btn-get-tx').click(getTxInfo);

  $('#btn-verify-tx').click(callContract);

  $('#btn-relay-tx').click(callRelayContract);


  /*
  Init
   */

  updatePage('main');
});