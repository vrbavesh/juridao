// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IJuriCourt - the court surface JuriEscrow depends on (boundary B1)
/// @notice Deliberately minimal: only what JuriEscrow calls. The full
///         frontend-facing surface lives on JuriCourt itself and reaches the
///         web app only via the generated ABIs (never hand-written).
interface IJuriCourt {
    function arbitrationCost(uint256 courtId, uint256 numJurors) external view returns (uint256);

    function createDispute(
        uint256 courtId,
        uint256 numJurors,
        address partyA,
        address partyB,
        string calldata metaURI
    ) external payable returns (uint256 disputeId);
}
