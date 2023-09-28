// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

/**
 * Interface for Respect tokens
 * Like ERC20 but no transfer or allowance methods.
 */
interface IRespect {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     * 
     * In this case this is only emitted on issuing Respect
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);
}
