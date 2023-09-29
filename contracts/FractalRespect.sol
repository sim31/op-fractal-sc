// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "./Respect.sol";

struct TokenIdUnpacked {
    uint64 meetingNumber;
    address owner;
    uint32 mintNumber;
}
/**
 * 256 bits (32 bytes):
 * First (leftmost) 20 bytes is address (owner of an NTT).
 * first (leftmost) 8 bytes is MeetingNumber (when NTT was issued)
 * next 20 bytes is address (owner of an NTT)
 * remaining 4 bytes is for MintNumber (first mint for the meeting for owner has 0 here);
 */
type TokenId is uint256;

function packTokenId(TokenIdUnpacked calldata value) pure returns (TokenId) {
    return TokenId.wrap(
        (uint256(value.meetingNumber) << 192)
        | (uint256(uint160(value.owner)) << 172)
        | value.mintNumber
    );
}

function unpackOwner(TokenId packed) pure returns (address) {
    return address(0);
}

function unpackTokenId(TokenId packed) pure returns (TokenIdUnpacked memory) {
    TokenIdUnpacked memory r;
    return r;
    // TODO:
}


contract FractalRespect is Respect {
    struct GroupRanks {
        uint8 groupNum;
        address[6] ranks;
    }

    // Fibonacci starting from 5 in hex
    bytes constant _rewards = hex"05080D152237";

    address public issuer;
    address public executor;
    uint public lastRanksTime;
    uint public ranksDelay;

    function setRanksDelay(uint ranksDelay_) public virtual {
        require(msg.sender == issuer, "Only issuer can do this");
        ranksDelay = ranksDelay_;
    }

    function setIssuer(address newIssuer) public virtual {
        require(msg.sender == issuer, "Only issuer can do this");
        issuer = newIssuer;
    }

    function setExecutor(address newExecutor) public virtual {
        require(msg.sender == issuer, "Only issuer can do this");
        executor = newExecutor;
    }

    function mint(address to, uint amount) public virtual {
        require(msg.sender == issuer, "Only issuer can do this");
         _mint(to, amount);
    }

    function burn(address from, uint amount) public virtual {
        require(msg.sender == issuer, "Only issuer can do this");
        _burn(from, amount);
    }

    function submitRanks(GroupRanks[] calldata allRanks) public virtual {
        require(msg.sender == executor || msg.sender == issuer, "Only executor or issuer can do this");

        uint timeSinceLast = block.timestamp - lastRanksTime;
        require(timeSinceLast >= ranksDelay, "ranksDelay amount of time has to pass before next submitRanks");

        for (uint i = 0; i < allRanks.length; i++) {
            GroupRanks calldata res = allRanks[i];
            for (uint r = 0; r < 6; r++) {
                address rankedAddr = res.ranks[r];
                require(rankedAddr != address(0) || r < 4, "At least 3 non-zero addresses have to be ranked");
                if (rankedAddr != address(0)) {
                    uint8 reward = uint8(_rewards[r]);
                    _mint(rankedAddr, reward);
                }
            }
        }

        lastRanksTime = block.timestamp;
    }


}