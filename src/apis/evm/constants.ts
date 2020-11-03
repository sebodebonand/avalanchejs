/**
 * @packageDocumentation
 * @module API-EVM-Constants
 */

export class EVMConstants {
  static LATESTCODEC:number = 0;

  static SECPFXID:number = 0;

  static SECPXFEROUTPUTID:number = 7;
  
  static EVMOUTPUTID:number = 22;

  static SECPINPUTID:number = 5;

  static EVMINPUTID:number = 21;

  static LOCKEDSTAKEABLES:Array<number> = [EVMConstants.EVMINPUTID, EVMConstants.EVMOUTPUTID];

  static BASETX:number = 0;

  static IMPORTTX:number = 0;

  static EXPORTTX:number = 1;

  static SECPCREDENTIAL:number = 9;

  static ASSETIDLEN:number = 32;

  static BLOCKCHAINIDLEN:number = 32;

  static SYMBOLMAXLEN:number = 4;

  static ASSETNAMELEN:number = 128;

  static ADDRESSLENGTH:number = 20;
}
