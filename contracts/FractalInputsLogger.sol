// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;


contract FractalInputsLogger {
    struct GroupResultsEF {
        uint8 groupNum;
        address[6] ranks;
        address delegate;
    }
    struct GroupResults {
        uint8 groupNum;
        address[6] ranks;
    }


    event ConsensusSubmissionEF(address submitter, GroupResultsEF results);
    event ConsensusSubmission(address submitter, GroupResults results);

    function submitConsEF(GroupResultsEF calldata results) public {
        emit ConsensusSubmissionEF(msg.sender, results);
    } 

    function submitCons(GroupResults calldata results) public {
        emit ConsensusSubmission(msg.sender, results);
    }
}
