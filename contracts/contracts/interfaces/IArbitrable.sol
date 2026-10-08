// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IArbitrable - anything the court can rule on (boundary B1)
/// @notice Ruling values: 0 = no majority (tie or nothing revealed),
///         1 = side A wins (pay freelancer), 2 = side B wins (refund client).
interface IArbitrable {
    function rule(uint256 disputeId, uint256 ruling) external;
}
