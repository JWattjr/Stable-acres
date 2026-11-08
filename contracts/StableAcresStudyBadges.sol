// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Stable Acres Study Badges
/// @notice A self-reported commemorative registry for the Stable Acres Arc testnet edition
/// (chain ID 5042002). Callers claim their own badges; the contract does NOT
/// cryptographically verify any quiz. Badges are not tokens or verified qualifications.
contract StableAcresStudyBadges {
    error InvalidLesson();
    error AlreadyClaimed();

    event BadgeClaimed(address indexed account, uint8 indexed lessonId);

    mapping(address => uint256) private _claimedMasks;

    /// @notice Claim your own commemorative badge for a lesson numbered 1 through 7.
    /// @dev Self-reported only; no quiz completion is cryptographically verified.
    /// Reverts for an invalid lesson or a badge already claimed by the caller.
    /// @param lessonId The lesson number, from 1 through 7 inclusive.
    function claimBadge(uint8 lessonId) external {
        uint256 bit = _lessonBit(lessonId);
        uint256 mask = _claimedMasks[msg.sender];
        if ((mask & bit) != 0) revert AlreadyClaimed();

        _claimedMasks[msg.sender] = mask | bit;
        emit BadgeClaimed(msg.sender, lessonId);
    }

    /// @notice Return the account's claimed badges; bits 0 through 6 represent lessons 1 through 7.
    /// @param account The account whose commemorative records are queried.
    /// @return The account's claimed lesson bitmask.
    function claimedMask(address account) external view returns (uint256) {
        return _claimedMasks[account];
    }

    /// @notice Return whether an account claimed a badge for a valid lesson.
    /// @param account The account whose commemorative records are queried.
    /// @param lessonId The lesson number, from 1 through 7 inclusive.
    /// @return Whether the account claimed the lesson's badge.
    function hasBadge(address account, uint8 lessonId) external view returns (bool) {
        uint256 bit = _lessonBit(lessonId);
        return (_claimedMasks[account] & bit) != 0;
    }

    function _lessonBit(uint8 lessonId) private pure returns (uint256) {
        if (lessonId == 0 || lessonId > 7) revert InvalidLesson();
        return uint256(1) << (lessonId - 1);
    }
}
