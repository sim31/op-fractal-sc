// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "./PeriodicRespect.sol";
import "./FractalInputsLogger.sol";

contract FractalRespect is PeriodicRespect, FractalInputsLogger {

    struct GroupRanks {
        uint8 groupNum;
        address[6] ranks;
    }

    // Fibonacci starting from 5 in hex (1 byte per number)
    uint8[6] public rewards;
    address public executor;
    uint public lastRanksTime;
    uint64 public ranksDelay;

    string private _baseURIVal;

    // Disable top initializer of PeriodicRespect
    function initialize(
        string calldata,
        string calldata,
        address
    ) public virtual override {
        revert OpNotSupported();
    }

    function initialize(
        string calldata name_,
        string calldata symbol_,
        uint8[6] calldata rewards_,
        address issuer_,
        address executor_,
        uint64 ranksDelay_
    ) public virtual initializer {
        __Respect_init(name_, symbol_);

        executor = executor_;
        ranksDelay = ranksDelay_;
        rewards = rewards_;

        _transferOwnership(issuer_);
    }

    function setRanksDelay(uint64 ranksDelay_) public virtual onlyOwner {
        ranksDelay = ranksDelay_;
    }

    function setExecutor(address newExecutor) public virtual {
        require(_msgSender() == owner() || _msgSender() == executor, "Only issuer or executor can do this");
        executor = newExecutor;
    }

    function setRewards(uint8[6] calldata newRewards) public virtual {
        require(_msgSender() == owner() || _msgSender() == executor, "Only issuer or executor can do this");
        rewards = newRewards;
    }

    function submitRanks(GroupRanks[] calldata allRanks) public virtual {
        require(_msgSender() == executor || _msgSender() == owner(), "Only executor or issuer can do this");

        uint timeSinceLast = block.timestamp - lastRanksTime;
        require(timeSinceLast >= ranksDelay, "ranksDelay amount of time has to pass before next submitRanks");

        periodNumber += 1;

        for (uint i = 0; i < allRanks.length; i++) {
            GroupRanks calldata group = allRanks[i];
            for (uint r = 0; r < 6; r++) {
                address rankedAddr = group.ranks[r];
                require(rankedAddr != address(0) || r < 4, "At least 3 non-zero addresses have to be ranked");
                if (rankedAddr != address(0)) {
                    uint8 reward = rewards[r];

                    TokenIdData memory tIdData = TokenIdData({
                        periodNumber: periodNumber,
                        owner: rankedAddr,
                        mintType: uint8(MintTypes.RespectGame)
                    });
                    TokenId tId = packTokenId(tIdData);

                    // Throws if token with this tId is already issued.
                    // This protects from same account being ranked twice in the same period
                    _mint(tId, reward);
                }
            }
        }

        lastRanksTime = block.timestamp;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseURIVal;
    }

}