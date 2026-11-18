// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IssuerRegistry} from "./IssuerRegistry.sol";

/**
 * @title CredentialSchemaRegistry
 * @notice Anchors credential JSON Schemas by hash + IPFS CID.
 * @dev Schemas are public metadata (no personal data). The CID points at the
 *      plaintext schema; any *credential instance* metadata on IPFS must be
 *      encrypted client-side.
 */
contract CredentialSchemaRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct Schema {
        bytes32 schemaHash;
        string cid;
        string issuerDid;
        string name;
        string version;
        uint64 registeredAt;
    }

    IssuerRegistry public immutable issuerRegistry;

    mapping(bytes32 => Schema) private _schemas;
    bytes32[] private _all;

    event SchemaRegistered(bytes32 indexed schemaHash, string cid, string issuerDid, string name, string version);

    error SchemaExists();
    error SchemaNotFound();
    error UntrustedIssuer();
    error EmptyCid();

    constructor(address admin, IssuerRegistry registry) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
        issuerRegistry = registry;
    }

    function registerSchema(
        bytes32 schemaHash,
        string calldata cid,
        string calldata issuerDid,
        string calldata name,
        string calldata version
    ) external onlyRole(REGISTRAR_ROLE) {
        if (bytes(cid).length == 0) revert EmptyCid();
        if (_schemas[schemaHash].schemaHash != bytes32(0)) revert SchemaExists();
        if (!issuerRegistry.isTrustedIssuer(issuerDid)) revert UntrustedIssuer();

        _schemas[schemaHash] = Schema({
            schemaHash: schemaHash,
            cid: cid,
            issuerDid: issuerDid,
            name: name,
            version: version,
            registeredAt: uint64(block.timestamp)
        });
        _all.push(schemaHash);

        emit SchemaRegistered(schemaHash, cid, issuerDid, name, version);
    }

    function getSchema(bytes32 schemaHash) external view returns (Schema memory s) {
        s = _schemas[schemaHash];
        if (s.schemaHash == bytes32(0)) revert SchemaNotFound();
    }

    function schemaCount() external view returns (uint256) {
        return _all.length;
    }
}
