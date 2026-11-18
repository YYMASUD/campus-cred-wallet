// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title IssuerRegistry
 * @notice Allowlist of trusted credential issuers (universities, event organizers).
 * @dev Stores ONLY public identifiers: issuer DIDs and controller addresses.
 *      No personal data is ever written here.
 */
contract IssuerRegistry is AccessControl {
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    enum Status {
        None,
        Pending,
        Approved,
        Suspended
    }

    struct Issuer {
        string did;
        address controller;
        string name;
        Status status;
        uint64 registeredAt;
    }

    /// @dev keccak256(did) => Issuer. DIDs are the canonical key.
    mapping(bytes32 => Issuer) private _issuers;
    /// @dev controller address => did hash (one issuer identity per address)
    mapping(address => bytes32) public controllerToDid;
    /// @dev approved issuers, ordered
    bytes32[] private _approved;

    event IssuerRegistered(bytes32 indexed didHash, string did, address indexed controller, string name);
    event IssuerApproved(bytes32 indexed didHash, string did);
    event IssuerSuspended(bytes32 indexed didHash, string did);

    error AlreadyRegistered();
    error NotRegistered();
    error InvalidStatus();
    error ZeroAddress();
    error EmptyDid();

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);
    }

    function didHash(string calldata did) public pure returns (bytes32) {
        return keccak256(bytes(did));
    }

    /// @notice An institution self-registers; governance must approve afterwards.
    function registerIssuer(string calldata did, string calldata name) external {
        if (bytes(did).length == 0) revert EmptyDid();
        bytes32 h = didHash(did);
        if (_issuers[h].status != Status.None) revert AlreadyRegistered();
        if (controllerToDid[msg.sender] != bytes32(0)) revert AlreadyRegistered();

        _issuers[h] = Issuer({
            did: did,
            controller: msg.sender,
            name: name,
            status: Status.Pending,
            registeredAt: uint64(block.timestamp)
        });
        controllerToDid[msg.sender] = h;

        emit IssuerRegistered(h, did, msg.sender, name);
    }

    function approveIssuer(bytes32 h) external onlyRole(GOVERNANCE_ROLE) {
        Issuer storage i = _issuers[h];
        if (i.status == Status.None) revert NotRegistered();
        if (i.status == Status.Approved) revert InvalidStatus();
        i.status = Status.Approved;
        _approved.push(h);
        emit IssuerApproved(h, i.did);
    }

    function suspendIssuer(bytes32 h) external onlyRole(GOVERNANCE_ROLE) {
        Issuer storage i = _issuers[h];
        if (i.status != Status.Approved) revert InvalidStatus();
        i.status = Status.Suspended;
        emit IssuerSuspended(h, i.did);
    }

    function isTrustedIssuer(string calldata did) external view returns (bool) {
        return _issuers[didHash(did)].status == Status.Approved;
    }

    function isTrustedIssuerHash(bytes32 h) external view returns (bool) {
        return _issuers[h].status == Status.Approved;
    }

    function getIssuer(bytes32 h) external view returns (Issuer memory) {
        return _issuers[h];
    }

    function approvedCount() external view returns (uint256) {
        return _approved.length;
    }

    function approvedAt(uint256 index) external view returns (bytes32) {
        return _approved[index];
    }
}
