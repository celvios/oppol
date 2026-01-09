// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockOracle {
    struct Assertion {
        address asserter;
        bool settled;
        bool assertedTruthfully;
        uint64 assertionTime;
        uint64 expirationTime;
    }

    mapping(bytes32 => Assertion) public assertions;

    function assertTruth(
        bytes memory claim,
        address asserter,
        address callbackRecipient,
        address escalationManager,
        uint64 liveness,
        IERC20 currency,
        uint256 bond,
        bytes32 identifier,
        bytes32 domainId
    ) external returns (bytes32 assertionId) {
        assertionId = keccak256(abi.encodePacked(claim, block.timestamp, asserter));
        assertions[assertionId] = Assertion({
            asserter: asserter,
            settled: false,
            assertedTruthfully: true, // Default to true for testing
            assertionTime: uint64(block.timestamp),
            expirationTime: uint64(block.timestamp + liveness)
        });
        return assertionId;
    }

    function settleAssertion(bytes32 assertionId) external {
        assertions[assertionId].settled = true;
    }

    function getAssertion(bytes32 assertionId) external view returns (Assertion memory) {
        return assertions[assertionId];
    }
}
