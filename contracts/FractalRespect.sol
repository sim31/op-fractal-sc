// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "./Respect.sol";

struct TokenIdData {
    uint64 periodNumber;
    address owner;
    uint8 mintType;
}

struct RespectEarner {
    address addr;
    uint256 respect;
}

enum MintTypes { RespectGame }

/**
 * 256 bits (32 bytes):
 * First least-significant 20 bytes is address (owner of an NTT).
 * next 8 bytes is MeetingNumber (when NTT was issued)
 * next 1 byte is for identifying type of mint
 *  * mint issued from submitranks should have 0;
 *  * other types of mints should have something else;
 * remaining 3 bytes are reserved;
 */
function packTokenId(TokenIdData memory value) pure returns (TokenId) {
    return TokenId.wrap(
        (uint256(value.mintType) << 232)
        | (uint256(value.periodNumber) << 160)
        | uint256(uint160(value.owner))
    );
}

function unpackTokenId(TokenId packed) pure returns (TokenIdData memory) {
    TokenIdData memory r;
    r.owner = ownerFromTokenId(packed);
    uint256 i = uint256(TokenId.unwrap(packed));
    r.periodNumber = uint64(i >> 160);
    r.mintType = uint8(i >> 232);
    return r;
}

contract FractalRespect is Respect {
    struct GroupRanks {
        uint8 groupNum;
        address[6] ranks;
    }

    // Fibonacci starting from 5 in hex (1 byte per number)
    bytes constant _rewards = hex"05080D152237";

    address public issuer;
    address public executor;
    uint public lastRanksTime;
    uint64 public ranksDelay;
    uint64 public periodNumber = 0;

    string private _baseURIVal;

    constructor(
        string memory name_,
        string memory symbol_,
        address issuer_,
        address executor_,
        uint64 ranksDelay_
    ) Respect(name_, symbol_) {
        issuer = issuer_;
        executor = executor_;
        ranksDelay = ranksDelay_;
    }

    function setBaseURI(string calldata baseURI) public virtual {
        require(msg.sender == executor || msg.sender == issuer, "Only executor or issuer can do this");
        _baseURIVal = baseURI;
    }

    function setRanksDelay(uint64 ranksDelay_) public virtual {
        require(msg.sender == issuer, "Only issuer can do this");
        ranksDelay = ranksDelay_;
    }

    function setIssuer(address newIssuer) public virtual {
        require(msg.sender == issuer, "Only issuer can do this");
        issuer = newIssuer;
    }

    function setExecutor(address newExecutor) public virtual {
        require(msg.sender == issuer || msg.sender == executor, "Only issuer or executor can do this");
        executor = newExecutor;
    }

    function mint(address to, uint64 value, uint8 mintType, uint64 periodNumber_) public virtual {
        require(msg.sender == issuer, "Only issuer can do this");

        TokenIdData memory tokenIdData = TokenIdData({
            periodNumber: periodNumber_,
            owner: to,
            mintType: mintType
        });
        TokenId tokenId = packTokenId(tokenIdData);

         _mint(tokenId, value);
    }

    function burn(TokenId tokenId) public virtual {
        require(msg.sender == issuer, "Only issuer can do this");

        _burn(tokenId);
    }

    function submitRanks(GroupRanks[] calldata allRanks) public virtual {
        require(msg.sender == executor || msg.sender == issuer, "Only executor or issuer can do this");

        uint timeSinceLast = block.timestamp - lastRanksTime;
        require(timeSinceLast >= ranksDelay, "ranksDelay amount of time has to pass before next submitRanks");

        periodNumber += 1;

        for (uint i = 0; i < allRanks.length; i++) {
            GroupRanks calldata group = allRanks[i];
            for (uint r = 0; r < 6; r++) {
                address rankedAddr = group.ranks[r];
                require(rankedAddr != address(0) || r < 4, "At least 3 non-zero addresses have to be ranked");
                if (rankedAddr != address(0)) {
                    uint8 reward = uint8(_rewards[r]);

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

    function respectEarnedPerLastPeriods(address addr, uint64 periodCount) public view returns (uint256) {
        uint256 remTokens = tokenSupplyOfOwner(addr);

        uint256 respectSum = 0;

        uint64 periodsEnd = periodNumber - periodCount;
        while (remTokens > 0) { // We also break the loop inside
            TokenId tokenId = TokenId.wrap(tokenOfOwnerByIndex(addr, remTokens - 1));
            TokenIdData memory tIdData = unpackTokenId(tokenId);

            if (tIdData.periodNumber <= periodsEnd) {
                break;
            }

            // Should never happen (this would mean that tokens were issued for future period)
            assert(tIdData.periodNumber > periodNumber);

            uint64 value = _valueOf(tokenId);
            respectSum += value;

            remTokens -= 1;
        }

        return respectSum;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseURIVal;
    }

}