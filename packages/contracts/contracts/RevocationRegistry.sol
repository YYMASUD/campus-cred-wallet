// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RevocationRegistry
 * @notice Bitmap-based revocation status list. One bitmap per issuer.
 * @dev The status index is assigned at issuance and is not linked to any
 *      personal data on-chain. A verifier only learns one bit: revoked or not.
 */
contract RevocationRegistry is AccessControl {
    uint256 public constant BITMAP_SIZE = 1024; // statuses per issuer page
    uint256 public constant WORDS = BITMAP_SIZE / 256;

    /// @dev issuer did hash => page => bitmap words
    mapping(bytes32 => mapping(uint256 => uint256[WORDS])) private _bitmaps;
    /// @dev issuer did hash => next free status index
    mapping(bytes32 => uint256) public issuedIndices;

    address public immutable issuerAdminProvider;

    event CredentialRevoked(bytes32 indexed issuerDidHash, uint256 statusIndex, uint256 page, uint256 bit);
    event CredentialUnrevoked(bytes32 indexed issuerDidHash, uint256 statusIndex);

    error IndexOutOfRange();
    error AlreadyRevoked();
    error NotRevoked();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        issuerAdminProvider = admin;
    }

    modifier onlyIssuerController(address controller) {
        require(controller != address(0), "zero controller");
        _;
    }

    /// @notice Allocate the next status index for an issuer. Called at issuance
    ///         by the issuer service's controller account.
    function allocateIndex(bytes32 issuerDidHash) external returns (uint256 index) {
        index = issuedIndices[issuerDidHash]++;
    }

    function revoke(bytes32 issuerDidHash, uint256 statusIndex) external {
        _set(issuerDidHash, statusIndex, true);
        emit CredentialRevoked(issuerDidHash, statusIndex, statusIndex / BITMAP_SIZE, statusIndex % 256);
    }

    function unrevoke(bytes32 issuerDidHash, uint256 statusIndex) external {
        _set(issuerDidHash, statusIndex, false);
        emit CredentialUnrevoked(issuerDidHash, statusIndex);
    }

    function isRevoked(bytes32 issuerDidHash, uint256 statusIndex) public view returns (bool) {
        uint256 page = statusIndex / BITMAP_SIZE;
        uint256 bit = statusIndex % BITMAP_SIZE;
        uint256 word = _bitmaps[issuerDidHash][page][bit / 256];
        return (word >> (bit % 256)) & 1 == 1;
    }

    function _set(bytes32 h, uint256 statusIndex, bool value) private {
        if (statusIndex >= BITMAP_SIZE * 16) revert IndexOutOfRange(); // 16 pages
        uint256 page = statusIndex / BITMAP_SIZE;
        uint256 bit = statusIndex % BITMAP_SIZE;
        uint256 wordIndex = bit / 256;
        uint256 mask = uint256(1) << (bit % 256);

        uint256 current = _bitmaps[h][page][wordIndex];
        bool already = (current & mask) != 0;
        if (value && already) revert AlreadyRevoked();
        if (!value && !already) revert NotRevoked();

        _bitmaps[h][page][wordIndex] = value ? (current | mask) : (current & ~mask);
    }
}
