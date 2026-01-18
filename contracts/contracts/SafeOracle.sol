// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SafeOracle
 * @dev A stub Oracle that effectively disables the "public assertion" flow 
 *      in PredictionMarket contracts, ensuring ONLY Admin Resolution is used.
 *      This saves gas and prevents malicious users from triggering incorrect resolutions.
 */
contract SafeOracle {
    struct Assertion {
        address asserter;
        bool settled;
        bool assertedTruthfully;
        uint64 assertionTime;
        uint64 expirationTime;
    }

    function assertTruth(
        bytes memory,
        address,
        address,
        address,
        uint64,
        IERC20,
        uint256,
        bytes32,
        bytes32
    ) external pure returns (bytes32) {
        // Return a dummy ID. We don't store state to save gas.
        return keccak256("SAFE_ORACLE_DISABLED");
    }

    function settleAssertion(bytes32) external pure {
        // Revert to prevent any settlement via this path
        revert("Oracle Disabled: Use Admin Resolution");
    }

    function getAssertion(bytes32) external pure returns (Assertion memory) {
        // Always return unsettled, blocking the V2 contract from finalizing via this path
        return Assertion({
            asserter: address(0),
            settled: false,
            assertedTruthfully: false,
            assertionTime: 0,
            expirationTime: 0
        });
    }
}
