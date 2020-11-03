/**
 * @packageDocumentation
 * @module API-EVM
 */
import { Buffer } from 'buffer/';
import BN from 'bn.js';
import AvalancheCore from '../../avalanche';
import { JRPCAPI } from '../../common/jrpcapi';
import { RequestResponseData } from '../../common/apibase';
import BinTools from '../../utils/bintools';
import { KeyChain } from './keychain';
import { Defaults, PlatformChainID, ONEAVAX } from '../../utils/constants';
import { EVMConstants } from './constants';
import { UnsignedTx, Tx } from './tx';
import { PayloadBase } from '../../utils/payload';
import { UnixNow, NodeIDStringToBuffer } from '../../utils/helperfunctions';
import { UTXOSet } from './utxos';
import { PersistanceOptions } from '../../utils/persistenceoptions';

/**
 * @ignore
 */
const bintools:BinTools = BinTools.getInstance();

/**
 * Class for interacting with a node's ContractVMAPI 
 *
 * @category RPCAPIs
 *
 * @remarks This extends the [[JRPCAPI]] class. This class should not be directly called. Instead, use the [[Avalanche.addAPI]] function to register this interface with Avalanche.
 */
export class ContractVMAPI extends JRPCAPI {

  /**
   * @ignore
   */
  protected keychain:KeyChain = new KeyChain('', '');

  protected blockchainID:string = '';

  protected blockchainAlias:string = undefined;

  protected AVAXAssetID:Buffer = undefined;

  protected txFee:BN = undefined;

  protected creationTxFee:BN = undefined;

  /**
   * Gets the alias for the blockchainID if it exists, otherwise returns `undefined`.
   *
   * @returns The alias for the blockchainID
   */
  getBlockchainAlias = ():string => {
    if(typeof this.blockchainAlias === "undefined"){
      const netid:number = this.core.getNetworkID();
      if (netid in Defaults.network && this.blockchainID in Defaults.network[netid]) {
        this.blockchainAlias = Defaults.network[netid][this.blockchainID].alias;
        return this.blockchainAlias;
      } else {
        /* istanbul ignore next */
        return undefined;
      }
    } 
    return this.blockchainAlias;
  };

  /**
   * Sets the alias for the blockchainID.
   * 
   * @param alias The alias for the blockchainID.
   * 
   */
  setBlockchainAlias = (alias:string):string => {
    this.blockchainAlias = alias;
    /* istanbul ignore next */
    return undefined;
  };

  /**
   * Gets the blockchainID and returns it.
   *
   * @returns The blockchainID
   */
  getBlockchainID = ():string => this.blockchainID;

  /**
   * Refresh blockchainID, and if a blockchainID is passed in, use that.
   *
   * @param Optional. BlockchainID to assign, if none, uses the default based on networkID.
   *
   * @returns The blockchainID
   */
  refreshBlockchainID = (blockchainID:string = undefined):boolean => {
    const netid:number = this.core.getNetworkID();
    if (typeof blockchainID === 'undefined' && typeof Defaults.network[netid] !== "undefined") {
      this.blockchainID = PlatformChainID; //default to P-Chain
      return true;
    } if (typeof blockchainID === 'string') {
      this.blockchainID = blockchainID;
      return true;
    }
    return false;
  };

  /**
   * Takes an address string and returns its {@link https://github.com/feross/buffer|Buffer} representation if valid.
   *
   * @returns A {@link https://github.com/feross/buffer|Buffer} for the address if valid, undefined if not valid.
   */
  parseAddress = (addr:string):Buffer => {
    const alias:string = this.getBlockchainAlias();
    const blockchainID:string = this.getBlockchainID();
    return bintools.parseAddress(addr, blockchainID, alias, EVMConstants.ADDRESSLENGTH);
  };

  addressFromBuffer = (address:Buffer):string => {
    const chainid:string = this.getBlockchainAlias() ? this.getBlockchainAlias() : this.getBlockchainID();
    return bintools.addressToString(this.core.getHRP(), chainid, address);
  };

  /**
   * Fetches the AVAX AssetID and returns it in a Promise.
   *
   * @param refresh This function caches the response. Refresh = true will bust the cache.
   * 
   * @returns The the provided string representing the AVAX AssetID
   */
  getAVAXAssetID = async (refresh:boolean = false):Promise<Buffer> => {
    if (typeof this.AVAXAssetID === 'undefined' || refresh) {
      const assetID:string = await this.getStakingAssetID();
      this.AVAXAssetID = bintools.cb58Decode(assetID);
    }
    return this.AVAXAssetID;
  };
  
  /**
   * Overrides the defaults and sets the cache to a specific AVAX AssetID
   * 
   * @param avaxAssetID A cb58 string or Buffer representing the AVAX AssetID
   * 
   * @returns The the provided string representing the AVAX AssetID
   */
  setAVAXAssetID = (avaxAssetID:string | Buffer) => {
    if(typeof avaxAssetID === "string") {
      avaxAssetID = bintools.cb58Decode(avaxAssetID);
    }
    this.AVAXAssetID = avaxAssetID;
  }

  /**
   * Gets the default tx fee for this chain.
   *
   * @returns The default tx fee as a {@link https://github.com/indutny/bn.js/|BN}
   */
  getDefaultTxFee =  ():BN => {
    return this.core.getNetworkID() in Defaults.network ? new BN(Defaults.network[this.core.getNetworkID()]["P"]["txFee"]) : new BN(0);
  }

  /**
   * Gets the tx fee for this chain.
   *
   * @returns The tx fee as a {@link https://github.com/indutny/bn.js/|BN}
   */
  getTxFee = ():BN => {
    if(typeof this.txFee === "undefined") {
      this.txFee = this.getDefaultTxFee();
    }
    return this.txFee;
  }

  /**
   * Sets the tx fee for this chain.
   *
   * @param fee The tx fee amount to set as {@link https://github.com/indutny/bn.js/|BN}
   */
  setTxFee = (fee:BN) => {
    this.txFee = fee;
  }


  /**
   * Gets the default creation fee for this chain.
   *
   * @returns The default creation fee as a {@link https://github.com/indutny/bn.js/|BN}
   */
  getDefaultCreationTxFee =  ():BN => {
    return this.core.getNetworkID() in Defaults.network ? new BN(Defaults.network[this.core.getNetworkID()]["P"]["creationTxFee"]) : new BN(0);
  }

  /**
   * Gets the creation fee for this chain.
   *
   * @returns The creation fee as a {@link https://github.com/indutny/bn.js/|BN}
   */
  getCreationTxFee = ():BN => {
    if(typeof this.creationTxFee === "undefined") {
      this.creationTxFee = this.getDefaultCreationTxFee();
    }
    return this.creationTxFee;
  }

  /**
   * Sets the creation fee for this chain.
   *
   * @param fee The creation fee amount to set as {@link https://github.com/indutny/bn.js/|BN}
   */
  setCreationTxFee = (fee:BN) => {
    this.creationTxFee = fee;
  }

  /**
   * Gets a reference to the keychain for this class.
   *
   * @returns The instance of [[]] for this class
   */
  keyChain = ():KeyChain => this.keychain;

  /**
   * @ignore
   */
  newKeyChain = ():KeyChain => {
    // warning, overwrites the old keychain
    const alias = this.getBlockchainAlias();
    if (alias) {
      this.keychain = new KeyChain(this.core.getHRP(), alias);
    } else {
      this.keychain = new KeyChain(this.core.getHRP(), this.blockchainID);
    }
    return this.keychain;
  };

  /**
   * Helper function which determines if a tx is a goose egg transaction. 
   *
   * @param utx An UnsignedTx
   *
   * @returns boolean true if passes goose egg test and false if fails.
   *
   * @remarks
   * A "Goose Egg Transaction" is when the fee far exceeds a reasonable amount
   */
  checkGooseEgg = async (utx:UnsignedTx, outTotal:BN = new BN(0)): Promise<boolean> => {
    const avaxAssetID:Buffer = await this.getAVAXAssetID();
    let outputTotal:BN = outTotal.gt(new BN(0)) ? outTotal : utx.getOutputTotal(avaxAssetID);
    const fee:BN = utx.getBurn(avaxAssetID);
    if(fee.lte(ONEAVAX.mul(new BN(10))) || fee.lte(outputTotal)) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Retrieves an assetID for a subnet's staking assset.
   *
   * @returns Returns a Promise<string> with cb58 encoded value of the assetID.
   */
  getStakingAssetID = async ():Promise<string> => {
    const params:any = {};
    return this.callMethod('platform.getStakingAssetID', params).then((response:RequestResponseData) => (response.data.result.assetID));
  };

  /**
   * Creates a new blockchain.
   *
   * @param username The username of the Keystore user that controls the new account
   * @param password The password of the Keystore user that controls the new account
   * @param subnetID Optional. Either a {@link https://github.com/feross/buffer|Buffer} or an cb58 serialized string for the SubnetID or its alias.
   * @param vmID The ID of the Virtual Machine the blockchain runs. Can also be an alias of the Virtual Machine.
   * @param FXIDs The ids of the FXs the VM is running.
   * @param name A human-readable name for the new blockchain
   * @param genesis The base 58 (with checksum) representation of the genesis state of the new blockchain. Virtual Machines should have a static API method named buildGenesis that can be used to generate genesisData.
   *
   * @returns Promise for the unsigned transaction to create this blockchain. Must be signed by a sufficient number of the Subnet’s control keys and by the account paying the transaction fee.
   */
  createBlockchain = async (
    username: string,
    password:string,
    subnetID:Buffer | string = undefined,
    vmID:string,
    fxIDs: Array<number>,
    name:string,
    genesis:string,
    )
  :Promise<string> => {
    const params:any = {
      username, 
      password,
      fxIDs,
      vmID,
      name,
      genesisData: genesis,
    };
    if (typeof subnetID === 'string') {
      params.subnetID = subnetID;
    } else if (typeof subnetID !== 'undefined') {
      params.subnetID = bintools.cb58Encode(subnetID);
    }
    return this.callMethod('platform.createBlockchain', params)
      .then((response:RequestResponseData) => response.data.result.txID);
  };

  /**
   * Gets the status of a blockchain.
   *
   * @param blockchainID The blockchainID requesting a status update
   *
   * @returns Promise for a string of one of: "Validating", "Created", "Preferred", "Unknown".
   */
  getBlockchainStatus = async (blockchainID: string):Promise<string> => {
    const params:any = {
      blockchainID,
    };
    return this.callMethod('platform.getBlockchainStatus', params)
      .then((response:RequestResponseData) => response.data.result.status);
  };

  /**
   * Create an address in the node's keystore.
   *
   * @param username The username of the Keystore user that controls the new account
   * @param password The password of the Keystore user that controls the new account
   *
   * @returns Promise for a string of the newly created account address.
   */
  createAddress = async (
    username: string,
    password:string
  )
  :Promise<string> => {
    const params:any = {
      username,
      password,
    };
    return this.callMethod('platform.createAddress', params)
      .then((response:RequestResponseData) => response.data.result.address);
  };

  /**
   * Gets the balance of a particular asset.
   *
   * @param address The address to pull the asset balance from
   *
   * @returns Promise with the balance as a {@link https://github.com/indutny/bn.js/|BN} on the provided address.
   */
  getBalance = async (address:string):Promise<object> => {
    if (typeof this.parseAddress(address) === 'undefined') {
      /* istanbul ignore next */
      throw new Error(`Error - ContractVMAPI.getBalance: Invalid address format ${address}`);
    }
    const params:any = {
      address
    };
    return  this.callMethod('platform.getBalance', params).then((response:RequestResponseData) => response.data.result);
  };
  
  /**
   * List the addresses controlled by the user.
   *
   * @param username The username of the Keystore user
   * @param password The password of the Keystore user
   *
   * @returns Promise for an array of addresses.
   */
  listAddresses = async (username: string, password:string):Promise<Array<string>> => {
    const params:any = {
      username,
      password,
    };
    return this.callMethod('platform.listAddresses', params)
      .then((response:RequestResponseData) => response.data.result.addresses);
  };

  /**
   * Send AVAX from an account on the P-Chain to an address on the X-Chain. This transaction
   * must be signed with the key of the account that the AVAX is sent from and which pays
   * the transaction fee. After issuing this transaction, you must call the X-Chain’s
   * importAVAX method to complete the transfer.
   *
   * @param username The Keystore user that controls the account specified in `to`
   * @param password The password of the Keystore user
   * @param to The ID of the account the AVAX is sent to. This must be the same as the to
   * argument in the corresponding call to the X-Chain’s exportAVAX
   * @param sourceChain The chainID where the funds are coming from.
   *
   * @returns Promise for a string for the transaction, which should be sent to the network
   * by calling issueTx.
   */
  importAVAX = async (username: string, password:string, to:string, sourceChain:string)
  :Promise<string> => {
    const params:any = {
      to,
      sourceChain,
      username,
      password,
    };
    return this.callMethod('platform.importAVAX', params)
      .then((response:RequestResponseData) => response.data.result.txID);
  };

  /**
   * Calls the node's issueTx method from the API and returns the resulting transaction ID as a string.
   *
   * @param tx A string, {@link https://github.com/feross/buffer|Buffer}, or [[Tx]] representing a transaction
   *
   * @returns A Promise<string> representing the transaction ID of the posted transaction.
   */
  issueTx = async (tx:string | Buffer | Tx):Promise<string> => {
    let Transaction = '';
    if (typeof tx === 'string') {
      Transaction = tx;
    } else if (tx instanceof Buffer) {
      const txobj:Tx = new Tx();
      txobj.fromBuffer(tx);
      Transaction = txobj.toString();
    } else if (tx instanceof Tx) {
      Transaction = tx.toString();
    } else {
      /* istanbul ignore next */
      throw new Error('Error - platform.issueTx: provided tx is not expected type of string, Buffer, or Tx');
    }
    const params:any = {
      tx: Transaction.toString(),
    };
    return this.callMethod('platform.issueTx', params).then((response:RequestResponseData) => response.data.result.txID);
  };

  /**
   * Returns an upper bound on the amount of tokens that exist. Not monotonically increasing because this number can go down if a staker's reward is denied.
   */
  getCurrentSupply = async ():Promise<BN> => {
    const params:any = {};
    return this.callMethod('platform.getCurrentSupply', params)
      .then((response:RequestResponseData) => new BN(response.data.result.supply, 10));
  }

  /**
   * Exports the private key for an address.
   *
   * @param username The name of the user with the private key
   * @param password The password used to decrypt the private key
   * @param address The address whose private key should be exported
   *
   * @returns Promise with the decrypted private key as store in the database
   */
  exportKey = async (username:string, password:string, address:string):Promise<string> => {
    const params:any = {
      username,
      password,
      address,
    };
    return this.callMethod('platform.exportKey', params)
      .then((response:RequestResponseData) => response.data.result.privateKey);
  };

  /**
   * Give a user control over an address by providing the private key that controls the address.
   *
   * @param username The name of the user to store the private key
   * @param password The password that unlocks the user
   * @param privateKey A string representing the private key in the vm's format
   *
   * @returns The address for the imported private key.
   */
  importKey = async (username:string, password:string, privateKey:string):Promise<string> => {
    const params:any = {
      username,
      password,
      privateKey,
    };
    return this.callMethod('platform.importKey', params)
      .then((response:RequestResponseData) => response.data.result.address);
  };

  /**
   * Returns the treansaction data of a provided transaction ID by calling the node's `getTx` method.
   *
   * @param txid The string representation of the transaction ID
   *
   * @returns Returns a Promise<string> containing the bytes retrieved from the node
   */
  getTx = async (txid:string):Promise<string> => {
    const params:any = {
      txID: txid,
    };
    return this.callMethod('platform.getTx', params).then((response:RequestResponseData) => response.data.result.tx);
  };

  /**
   * Returns the status of a provided transaction ID by calling the node's `getTxStatus` method.
   *
   * @param txid The string representation of the transaction ID
   *
   * @returns Returns a Promise<string> containing the status retrieved from the node
   */
  getTxStatus = async (txid:string):Promise<string> => {
    const params:any = {
      txID: txid,
    };
    return this.callMethod('platform.getTxStatus', params).then((response:RequestResponseData) => response.data.result);
  };

  /**
   * Retrieves the UTXOs related to the addresses provided from the node's `getUTXOs` method.
   *
   * @param addresses An array of addresses as cb58 strings or addresses as {@link https://github.com/feross/buffer|Buffer}s
   * @param sourceChain A string for the chain to look for the UTXO's. Default is to use this chain, but if exported UTXOs exist from other chains, this can used to pull them instead.
   * @param limit Optional. Returns at most [limit] addresses. If [limit] == 0 or > [maxUTXOsToFetch], fetches up to [maxUTXOsToFetch].
   * @param startIndex Optional. [StartIndex] defines where to start fetching UTXOs (for pagination.)
   * UTXOs fetched are from addresses equal to or greater than [StartIndex.Address]
   * For address [StartIndex.Address], only UTXOs with IDs greater than [StartIndex.Utxo] will be returned.
   * @param persistOpts Options available to persist these UTXOs in local storage
   *
   * @remarks
   * persistOpts is optional and must be of type [[PersistanceOptions]]
   *
   */
  getUTXOs = async (
    addresses:Array<string> | string,
    sourceChain:string = undefined,
    limit:number = 0,
    startIndex:{address:string, utxo:string} = undefined,
    persistOpts:PersistanceOptions = undefined
  ):Promise<{
    numFetched:number,
    utxos:UTXOSet,
    endIndex:{address:string, utxo:string}
  }> => {
    
    if(typeof addresses === "string") {
      addresses = [addresses];
    }

    const params:any = {
      addresses: addresses,
      limit
    };
    if(typeof startIndex !== "undefined" && startIndex) {
      params.startIndex = startIndex;
    }

    if(typeof sourceChain !== "undefined") {
      params.sourceChain = sourceChain;
    }

    return this.callMethod('platform.getUTXOs', params).then((response:RequestResponseData) => {

      const utxos:UTXOSet = new UTXOSet();
      let data = response.data.result.utxos;
      if (persistOpts && typeof persistOpts === 'object') {
        if (this.db.has(persistOpts.getName())) {
          const selfArray:Array<string> = this.db.get(persistOpts.getName());
          if (Array.isArray(selfArray)) {
            utxos.addArray(data);
            const self:UTXOSet = new UTXOSet();
            self.addArray(selfArray);
            self.mergeByRule(utxos, persistOpts.getMergeRule());
            data = self.getAllUTXOStrings();
          }
        }
        this.db.set(persistOpts.getName(), data, persistOpts.getOverwrite());
      }
      utxos.addArray(data, false);
      response.data.result.utxos = utxos;
      return response.data.result;
    });
  };


/**
 * Helper function which creates an unsigned Import Tx. For more granular control, you may create your own
 * [[UnsignedTx]] manually (with their corresponding [[TransferableInput]]s, [[TransferableOutput]]s, and [[TransferOperation]]s).
 *
 * @param utxoset A set of UTXOs that the transaction is built on
 * @param ownerAddresses The addresses being used to import
 * @param sourceChain The chainid for where the import is coming from.
 * @param toAddresses The addresses to send the funds
 * @param fromAddresses The addresses being used to send the funds from the UTXOs provided
 * @param changeAddresses The addresses that can spend the change remaining from the spent UTXOs
 * @param memo Optional contains arbitrary bytes, up to 256 bytes
 * @param asOf Optional. The timestamp to verify the transaction against as a {@link https://github.com/indutny/bn.js/|BN}
 * @param locktime Optional. The locktime field created in the resulting outputs
 * @param threshold Optional. The number of signatures required to spend the funds in the resultant UTXO
 *
 * @returns An unsigned transaction ([[UnsignedTx]]) which contains a [[ImportTx]].
 *
 * @remarks
 * This helper exists because the endpoint API should be the primary point of entry for most functionality.
 */
  buildImportTx = async (
    utxoset:UTXOSet, 
    ownerAddresses:Array<string>,
    sourceChain:Buffer | string,
    toAddresses:Array<string>, 
    fromAddresses:Array<string>,
    changeAddresses:Array<string> = undefined,
    memo:PayloadBase|Buffer = undefined, 
    asOf:BN = UnixNow(), 
    locktime:BN = new BN(0), 
    threshold:number = 1
  ):Promise<UnsignedTx> => {
    const to:Array<Buffer> = this._cleanAddressArray(toAddresses, 'buildBaseTx').map((a) => bintools.stringToAddress(a));
    const from:Array<Buffer> = this._cleanAddressArray(fromAddresses, 'buildBaseTx').map((a) => bintools.stringToAddress(a));
    const change:Array<Buffer> = this._cleanAddressArray(changeAddresses, 'buildBaseTx').map((a) => bintools.stringToAddress(a));

    let srcChain:string = undefined;

    if(typeof sourceChain === "undefined") {
      throw new Error("Error - ContractVMAPI.buildImportTx: Source ChainID is undefined.");
    } else if (typeof sourceChain === "string") {
      srcChain = sourceChain;
      sourceChain = bintools.cb58Decode(sourceChain);
    } else if(!(sourceChain instanceof Buffer)) {
      srcChain = bintools.cb58Encode(sourceChain);
      throw new Error("Error - ContractVMAPI.buildImportTx: Invalid destinationChain type: " + (typeof sourceChain) );
    }
    const atomicUTXOs:UTXOSet = await (await this.getUTXOs(ownerAddresses, srcChain, 0, undefined)).utxos;
    const avaxAssetID:Buffer = await this.getAVAXAssetID();

    if( memo instanceof PayloadBase) {
      memo = memo.getPayload();
    }

    const atomics = atomicUTXOs.getAllUTXOs();

    const builtUnsignedTx:UnsignedTx = utxoset.buildImportTx(
      this.core.getNetworkID(), 
      bintools.cb58Decode(this.blockchainID), 
      to,
      from,
      change,
      atomics, 
      sourceChain,
      this.getTxFee(), 
      avaxAssetID, 
      memo, asOf, locktime, threshold
    );

    if(! await this.checkGooseEgg(builtUnsignedTx)) {
      /* istanbul ignore next */
      throw new Error("Failed Goose Egg Check");
    }

    return builtUnsignedTx;
  };

  /**
   * Helper function which creates an unsigned Export Tx. For more granular control, you may create your own
   * [[UnsignedTx]] manually (with their corresponding [[TransferableInput]]s, [[TransferableOutput]]s, and [[TransferOperation]]s).
   *
   * @param utxoset A set of UTXOs that the transaction is built on
   * @param amount The amount being exported as a {@link https://github.com/indutny/bn.js/|BN}
   * @param destinationChain The chainid for where the assets will be sent.
   * @param toAddresses The addresses to send the funds
   * @param fromAddresses The addresses being used to send the funds from the UTXOs provided
   * @param changeAddresses The addresses that can spend the change remaining from the spent UTXOs
   * @param memo Optional contains arbitrary bytes, up to 256 bytes
   * @param asOf Optional. The timestamp to verify the transaction against as a {@link https://github.com/indutny/bn.js/|BN}
   * @param locktime Optional. The locktime field created in the resulting outputs
   * @param threshold Optional. The number of signatures required to spend the funds in the resultant UTXO
   *
   * @returns An unsigned transaction ([[UnsignedTx]]) which contains an [[ExportTx]].
   */
  buildExportTx = async (
    utxoset:UTXOSet, 
    amount:BN,
    destinationChain:Buffer | string,
    toAddresses:Array<string>, 
    fromAddresses:Array<string>,
    changeAddresses:Array<string> = undefined,
    memo:PayloadBase|Buffer = undefined, 
    asOf:BN = UnixNow(),
    locktime:BN = new BN(0), 
    threshold:number = 1
  ):Promise<UnsignedTx> => {
    
    let prefixes:object = {};
    toAddresses.map((a) => {
      prefixes[a.split("-")[0]] = true;
    });
    if(Object.keys(prefixes).length !== 1){
      throw new Error("Error - ContractVMAPI.buildExportTx: To addresses must have the same chainID prefix.");
    }

    if(typeof destinationChain === "undefined") {
      throw new Error("Error - ContractVMAPI.buildExportTx: Destination ChainID is undefined.");
    } else if (typeof destinationChain === "string") {
      destinationChain = bintools.cb58Decode(destinationChain); //
    } else if(!(destinationChain instanceof Buffer)) {
      throw new Error("Error - ContractVMAPI.buildExportTx: Invalid destinationChain type: " + (typeof destinationChain) );
    }
    if(destinationChain.length !== 32) {
      throw new Error("Error - ContractVMAPI.buildExportTx: Destination ChainID must be 32 bytes in length.");
    }
    /*
    if(bintools.cb58Encode(destinationChain) !== Defaults.network[this.core.getNetworkID()].X["blockchainID"]) {
      throw new Error("Error - ContractVMAPI.buildExportTx: Destination ChainID must The X-Chain ID in the current version of AvalancheJS.");
    }*/

    let to:Array<Buffer> = [];
    toAddresses.map((a) => {
      to.push(bintools.stringToAddress(a));
    });
    const from:Array<Buffer> = this._cleanAddressArray(fromAddresses, 'buildExportTx').map((a) => bintools.stringToAddress(a));
    const change:Array<Buffer> = this._cleanAddressArray(changeAddresses, 'buildExportTx').map((a) => bintools.stringToAddress(a));

    if( memo instanceof PayloadBase) {
      memo = memo.getPayload();
    }

    const avaxAssetID:Buffer = await this.getAVAXAssetID();

    const builtUnsignedTx:UnsignedTx = utxoset.buildExportTx(
      this.core.getNetworkID(), 
      bintools.cb58Decode(this.blockchainID), 
      amount,
      avaxAssetID, 
      to,
      from,
      change,
      destinationChain,
      this.getTxFee(), 
      avaxAssetID,
      memo, asOf, locktime, threshold
    );

    if(! await this.checkGooseEgg(builtUnsignedTx)) {
      /* istanbul ignore next */
      throw new Error("Failed Goose Egg Check");
    }

    return builtUnsignedTx;
  };

  /**
   * @ignore
   */
  protected _cleanAddressArray(addresses:Array<string> | Array<Buffer>, caller:string):Array<string> {
    const addrs:Array<string> = [];
    const chainid:string = this.getBlockchainAlias() ? this.getBlockchainAlias() : this.getBlockchainID();
    if (addresses && addresses.length > 0) {
      for (let i = 0; i < addresses.length; i++) {
        if (typeof addresses[i] === 'string') {
          if (typeof this.parseAddress(addresses[i] as string) === 'undefined') {
            /* istanbul ignore next */
            throw new Error(`Error - ContractVMAPI.${caller}: Invalid address format ${addresses[i]}`);
          }
          addrs.push(addresses[i] as string);
        } else {
          addrs.push(bintools.addressToString(this.core.getHRP(), chainid, addresses[i] as Buffer));
        }
      }
    }
    return addrs;
  }

  /**
   * This class should not be instantiated directly.
   * Instead use the [[Avalanche.addAPI]] method.
   *
   * @param core A reference to the Avalanche class
   * @param baseurl Defaults to the string "/ext/bc/C/avax" as the path to blockchain's baseurl
   * @param blockchainID The Blockchain's ID. Defaults to an empty string: ''
   */
  constructor(core:AvalancheCore, baseurl:string = '/ext/bc/C/avax', blockchainID:string = '') { 
    super(core, baseurl); 
    this.blockchainID = blockchainID;
    const netid:number = core.getNetworkID();
    if (netid in Defaults.network && this.blockchainID in Defaults.network[netid]) {
      const { alias } = Defaults.network[netid][this.blockchainID];
      this.keychain = new KeyChain(this.core.getHRP(), alias);
    } else {
      this.keychain = new KeyChain(this.core.getHRP(), this.blockchainID);
    }
  }
}

