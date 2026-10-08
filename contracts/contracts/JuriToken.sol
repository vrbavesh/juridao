// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title JuriToken - JURI, the staking token of JuriDAO
/// @notice Demo ERC-20: buy with ETH at a fixed rate, or faucet claim.
contract JuriToken is ERC20, Ownable, ReentrancyGuard {
    uint256 public immutable tokensPerEth;
    uint256 public immutable faucetAmount;
    uint256 public immutable faucetCooldown;

    mapping(address => uint256) public lastFaucetAt;

    event TokensBought(address indexed buyer, uint256 ethIn, uint256 tokensOut);
    event FaucetClaimed(address indexed user, uint256 amount);

    constructor(
        address owner,
        uint256 tokensPerEth_,
        uint256 faucetAmount_,
        uint256 faucetCooldown_
    ) ERC20("JuriDAO", "JURI") Ownable(owner) {
        tokensPerEth = tokensPerEth_;
        faucetAmount = faucetAmount_;
        faucetCooldown = faucetCooldown_;
    }

    /// @notice Mint tokens in exchange for ETH: msg.value * tokensPerEth.
    function buyTokens() external payable nonReentrant {
        require(msg.value > 0, "amount is zero");
        uint256 tokensOut = msg.value * tokensPerEth;
        _mint(msg.sender, tokensOut);
        emit TokensBought(msg.sender, msg.value, tokensOut);
    }

    /// @notice Demo faucet. mints faucetAmount; enforces per-address cooldown if set.
    function faucet() external {
        if (faucetCooldown > 0) {
            require(block.timestamp >= lastFaucetAt[msg.sender] + faucetCooldown, "faucet cooldown");
        }
        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, faucetAmount);
        emit FaucetClaimed(msg.sender, faucetAmount);
    }

    /// @notice Owner may pull the ETH accumulated from buyTokens.
    function withdrawEth(address payable to) external onlyOwner {
        require(to != address(0), "zero address");
        (bool ok, ) = to.call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }
}