// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EventTicket
 * @notice Non-transferable (soulbound) event tickets, ERC-5192 style.
 * @dev Tickets are bound to a holder DID hash. Only issuance/revocation ids are
 *      stored; no attendee personal data is written on-chain.
 */
contract EventTicket is ERC721URIStorage, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    uint256 private _nextId = 1;

    struct Ticket {
        bytes32 eventId;
        bytes32 holderDidHash;
        bool revoked;
    }

    mapping(uint256 => Ticket) public tickets;
    mapping(bytes32 => uint256) public ticketIdForHash;

    event TicketIssued(uint256 indexed tokenId, bytes32 indexed eventId, bytes32 holderDidHash);
    event TicketRevoked(uint256 indexed tokenId);
    event Locked(uint256 tokenId);

    error Soulbound();
    error AlreadyRevoked();
    error TicketExists();

    constructor(address admin) ERC721("Campus Event Ticket", "CCTKT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    function issueTicket(bytes32 eventId, bytes32 holderDidHash, string calldata uri) external onlyRole(ISSUER_ROLE) returns (uint256) {
        bytes32 key = keccak256(abi.encode(eventId, holderDidHash));
        if (ticketIdForHash[key] != 0) revert TicketExists();

        uint256 id = _nextId++;
        tickets[id] = Ticket({eventId: eventId, holderDidHash: holderDidHash, revoked: false});
        ticketIdForHash[key] = id;
        _safeMint(msg.sender, id);
        if (bytes(uri).length > 0) _setTokenURI(id, uri);

        emit TicketIssued(id, eventId, holderDidHash);
        emit Locked(id);
        return id;
    }

    function revokeTicket(uint256 tokenId) external onlyRole(ISSUER_ROLE) {
        if (tickets[tokenId].revoked) revert AlreadyRevoked();
        tickets[tokenId].revoked = true;
        emit TicketRevoked(tokenId);
    }

    function isRevoked(uint256 tokenId) external view returns (bool) {
        return tickets[tokenId].revoked;
    }

    /// @inheritdoc ERC721
    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert Soulbound();
    }

    /// @dev ERC-5192: locked tokens can never be transferred.
    function locked(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // allow mint (from == 0) and burn, block transfers
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return interfaceId == 0x2b3e2a2c /* ERC-5192 */ || super.supportsInterface(interfaceId);
    }
}
