// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "./FractalRespect.sol";

/**
 * @dev Like FractalRespect except it is meant to be used as an upgrade to PeriodicRespect (to upgrade from PeriodicRespect to FractalRespect)
 */
contract FractalRespectUpgraded is FractalRespect {
    function initializeV2(
        address executor_,
        uint64 ranksDelay_
    ) public virtual reinitializer(2) {
        executor = executor_;
        ranksDelay = ranksDelay_;
    }


}