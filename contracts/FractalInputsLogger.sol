// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;


contract FractalInputsLogger {
    struct GroupResults {
        uint8 groupNum;
        address[6] ranks;
        address delegate;
    }

    event ConsensusSubmission(address submitter, GroupResults results);

    function submitCons(GroupResults calldata results) public {
        emit ConsensusSubmission(msg.sender, results);
    } 
}
