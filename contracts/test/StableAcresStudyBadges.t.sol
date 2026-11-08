// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {StableAcresStudyBadges} from "../StableAcresStudyBadges.sol";

contract StableAcresStudyBadgesTest is Test {
    StableAcresStudyBadges internal c;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    event BadgeClaimed(address indexed account, uint8 indexed lessonId);

    function setUp() public {
        c = new StableAcresStudyBadges();
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    function _claim(address who, uint8 id) internal {
        vm.prank(who);
        c.claimBadge(id);
    }

    function _bit(uint8 id) internal pure returns (uint256) {
        return uint256(1) << (id - 1);
    }

    // ------------------------------------------------------------------
    // Initial state
    // ------------------------------------------------------------------

    function test_UntouchedAddressMaskIsZero() public view {
        assertEq(c.claimedMask(alice), 0);
        assertEq(c.claimedMask(address(0)), 0);
        assertEq(c.claimedMask(address(c)), 0);
    }

    function test_HasBadgeFalseForAllLessonsInitially() public view {
        for (uint8 id = 1; id <= 7; id++) {
            assertFalse(c.hasBadge(alice, id));
        }
    }

    // ------------------------------------------------------------------
    // Happy path: each lesson sets exactly its bit + event
    // ------------------------------------------------------------------

    function _claimAndCheck(uint8 id, uint256 expectedMask) internal {
        vm.expectEmit(true, true, false, true, address(c));
        emit BadgeClaimed(alice, id);
        _claim(alice, id);
        assertEq(c.claimedMask(alice), expectedMask);
        assertTrue(c.hasBadge(alice, id));
        for (uint8 other = 1; other <= 7; other++) {
            if (other != id) assertFalse(c.hasBadge(alice, other));
        }
    }

    function test_Claim_Lesson1() public {
        _claimAndCheck(1, 1);
    }

    function test_Claim_Lesson2() public {
        _claimAndCheck(2, 2);
    }

    function test_Claim_Lesson3() public {
        _claimAndCheck(3, 4);
    }

    function test_Claim_Lesson4() public {
        _claimAndCheck(4, 8);
    }

    function test_Claim_Lesson5() public {
        _claimAndCheck(5, 16);
    }

    function test_Claim_Lesson6() public {
        _claimAndCheck(6, 32);
    }

    function test_Claim_Lesson7() public {
        _claimAndCheck(7, 64);
    }

    function test_ClaimEventHasIndexedTopics() public {
        vm.recordLogs();
        _claim(bob, 5);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].emitter, address(c));
        assertEq(logs[0].topics.length, 3);
        assertEq(logs[0].topics[0], keccak256("BadgeClaimed(address,uint8)"));
        assertEq(logs[0].topics[1], bytes32(uint256(uint160(bob))));
        assertEq(logs[0].topics[2], bytes32(uint256(5)));
        assertEq(logs[0].data.length, 0);
    }

    function test_ClaimAllSevenGivesMask127() public {
        for (uint8 id = 1; id <= 7; id++) {
            vm.expectEmit(true, true, false, true, address(c));
            emit BadgeClaimed(alice, id);
            _claim(alice, id);
        }
        assertEq(c.claimedMask(alice), 127);
        assertEq(c.claimedMask(alice) >> 7, 0, "no bits beyond bit 6");
        for (uint8 id = 1; id <= 7; id++) {
            assertTrue(c.hasBadge(alice, id));
        }
    }

    function test_ClaimInOrderAccumulatesMask() public {
        uint256 expected;
        for (uint8 id = 1; id <= 7; id++) {
            _claim(alice, id);
            expected |= _bit(id);
            assertEq(c.claimedMask(alice), expected);
        }
    }

    function test_OutOfOrderClaimsDoNotClearEarlierBits() public {
        uint8[7] memory order = [uint8(5), 2, 7, 1, 4, 6, 3];
        uint256 expected;
        for (uint256 i = 0; i < order.length; i++) {
            uint256 before = c.claimedMask(alice);
            _claim(alice, order[i]);
            expected |= _bit(order[i]);
            uint256 afterMask = c.claimedMask(alice);
            assertEq(afterMask, expected);
            assertEq(afterMask & before, before, "earlier bits preserved");
        }
        assertEq(c.claimedMask(alice), 127);
    }

    function test_DescendingClaimsDoNotClearEarlierBits() public {
        _claim(alice, 7);
        assertEq(c.claimedMask(alice), 64);
        _claim(alice, 1);
        assertEq(c.claimedMask(alice), 65);
        _claim(alice, 4);
        assertEq(c.claimedMask(alice), 73);
    }

    // ------------------------------------------------------------------
    // Invalid lesson ids
    // ------------------------------------------------------------------

    function test_RevertClaim_Lesson0() public {
        vm.prank(alice);
        vm.expectRevert(StableAcresStudyBadges.InvalidLesson.selector);
        c.claimBadge(0);
    }

    function test_RevertClaim_Lesson8() public {
        vm.prank(alice);
        vm.expectRevert(StableAcresStudyBadges.InvalidLesson.selector);
        c.claimBadge(8);
    }

    function test_RevertClaim_Lesson255() public {
        vm.prank(alice);
        vm.expectRevert(StableAcresStudyBadges.InvalidLesson.selector);
        c.claimBadge(255);
    }

    function test_RevertHasBadge_Lesson0() public {
        vm.expectRevert(StableAcresStudyBadges.InvalidLesson.selector);
        c.hasBadge(alice, 0);
    }

    function test_RevertHasBadge_Lesson8() public {
        vm.expectRevert(StableAcresStudyBadges.InvalidLesson.selector);
        c.hasBadge(alice, 8);
    }

    function test_RevertHasBadge_Lesson255() public {
        vm.expectRevert(StableAcresStudyBadges.InvalidLesson.selector);
        c.hasBadge(alice, 255);
    }

    function test_InvalidClaimLeavesMaskUnchanged() public {
        _claim(alice, 3);
        vm.prank(alice);
        vm.expectRevert(StableAcresStudyBadges.InvalidLesson.selector);
        c.claimBadge(0);
        assertEq(c.claimedMask(alice), 4);
    }

    function testFuzz_RevertClaim_InvalidIdAbove7(uint8 id, address sender) public {
        id = uint8(bound(id, 8, 255));
        vm.prank(sender);
        vm.expectRevert(StableAcresStudyBadges.InvalidLesson.selector);
        c.claimBadge(id);
        assertEq(c.claimedMask(sender), 0);
    }

    function testFuzz_RevertHasBadge_InvalidIdAbove7(uint8 id, address who) public {
        id = uint8(bound(id, 8, 255));
        vm.expectRevert(StableAcresStudyBadges.InvalidLesson.selector);
        c.hasBadge(who, id);
    }

    // ------------------------------------------------------------------
    // Duplicate claims
    // ------------------------------------------------------------------

    function _duplicateCheck(uint8 id) internal {
        _claim(alice, id);
        uint256 maskBefore = c.claimedMask(alice);
        vm.prank(alice);
        vm.expectRevert(StableAcresStudyBadges.AlreadyClaimed.selector);
        c.claimBadge(id);
        assertEq(c.claimedMask(alice), maskBefore);
        assertTrue(c.hasBadge(alice, id));
    }

    function test_RevertDuplicate_Lesson1() public {
        _duplicateCheck(1);
    }

    function test_RevertDuplicate_Lesson2() public {
        _duplicateCheck(2);
    }

    function test_RevertDuplicate_Lesson3() public {
        _duplicateCheck(3);
    }

    function test_RevertDuplicate_Lesson4() public {
        _duplicateCheck(4);
    }

    function test_RevertDuplicate_Lesson5() public {
        _duplicateCheck(5);
    }

    function test_RevertDuplicate_Lesson6() public {
        _duplicateCheck(6);
    }

    function test_RevertDuplicate_Lesson7() public {
        _duplicateCheck(7);
    }

    function test_DuplicateAfterAllClaimedKeepsMask127() public {
        for (uint8 id = 1; id <= 7; id++) {
            _claim(alice, id);
        }
        for (uint8 id = 1; id <= 7; id++) {
            vm.prank(alice);
            vm.expectRevert(StableAcresStudyBadges.AlreadyClaimed.selector);
            c.claimBadge(id);
            assertEq(c.claimedMask(alice), 127);
        }
    }

    // ------------------------------------------------------------------
    // Wallet independence
    // ------------------------------------------------------------------

    function test_WalletsAreIndependent() public {
        _claim(alice, 1);
        _claim(alice, 7);
        assertEq(c.claimedMask(alice), 65);
        assertEq(c.claimedMask(bob), 0);
        assertEq(c.claimedMask(carol), 0);

        _claim(bob, 3);
        assertEq(c.claimedMask(alice), 65);
        assertEq(c.claimedMask(bob), 4);
        assertEq(c.claimedMask(carol), 0);

        _claim(carol, 2);
        _claim(carol, 3);
        assertEq(c.claimedMask(alice), 65);
        assertEq(c.claimedMask(bob), 4);
        assertEq(c.claimedMask(carol), 6);

        assertTrue(c.hasBadge(alice, 1));
        assertFalse(c.hasBadge(bob, 1));
        assertFalse(c.hasBadge(carol, 7));
        assertTrue(c.hasBadge(bob, 3));
        assertTrue(c.hasBadge(carol, 3));
    }

    function test_SameLessonClaimableByEachWallet() public {
        for (uint8 id = 1; id <= 7; id++) {
            _claim(alice, id);
            _claim(bob, id);
            _claim(carol, id);
            assertTrue(c.hasBadge(alice, id));
            assertTrue(c.hasBadge(bob, id));
            assertTrue(c.hasBadge(carol, id));
        }
        assertEq(c.claimedMask(alice), 127);
        assertEq(c.claimedMask(bob), 127);
        assertEq(c.claimedMask(carol), 127);
    }

    function test_DuplicateRevertDoesNotAffectOtherWallet() public {
        _claim(alice, 4);
        vm.prank(alice);
        vm.expectRevert(StableAcresStudyBadges.AlreadyClaimed.selector);
        c.claimBadge(4);
        _claim(bob, 4);
        assertEq(c.claimedMask(alice), 8);
        assertEq(c.claimedMask(bob), 8);
    }

    function test_EventAccountIsMsgSender() public {
        vm.expectEmit(true, true, false, true, address(c));
        emit BadgeClaimed(bob, 6);
        _claim(bob, 6);
        assertEq(c.claimedMask(alice), 0);
    }

    // ------------------------------------------------------------------
    // Fuzz vs model
    // ------------------------------------------------------------------

    /// @dev Random subset (7 low bits of `subset`) of lessons claimed in a
    ///      pseudo-random order by a random sender; compare against a model mask.
    function testFuzz_RandomSubsetMatchesModel(address sender, uint8 subset, uint256 seed) public {
        uint256 model;
        uint8[7] memory ids = [uint8(1), 2, 3, 4, 5, 6, 7];
        // Fisher-Yates shuffle driven by seed
        for (uint256 i = 6; i > 0; i--) {
            uint256 j = uint256(keccak256(abi.encode(seed, i))) % (i + 1);
            (ids[i], ids[j]) = (ids[j], ids[i]);
        }
        for (uint256 i = 0; i < 7; i++) {
            uint8 id = ids[i];
            if ((subset >> (id - 1)) & 1 == 1) {
                vm.expectEmit(true, true, false, true, address(c));
                emit BadgeClaimed(sender, id);
                vm.prank(sender);
                c.claimBadge(id);
                model |= _bit(id);
                assertEq(c.claimedMask(sender), model);
            }
        }
        assertEq(c.claimedMask(sender), uint256(subset & 0x7f));
        for (uint8 id = 1; id <= 7; id++) {
            assertEq(c.hasBadge(sender, id), (model & _bit(id)) != 0);
            if (model & _bit(id) != 0) {
                vm.prank(sender);
                vm.expectRevert(StableAcresStudyBadges.AlreadyClaimed.selector);
                c.claimBadge(id);
            }
        }
        assertEq(c.claimedMask(sender) >> 7, 0);
        assertEq(address(c).balance, 0);
    }

    function testFuzz_TwoSendersIndependent(address s1, address s2, uint8 subset1, uint8 subset2) public {
        vm.assume(s1 != s2);
        uint256 m1;
        uint256 m2;
        for (uint8 id = 1; id <= 7; id++) {
            if ((subset1 >> (id - 1)) & 1 == 1) {
                _claim(s1, id);
                m1 |= _bit(id);
            }
            if ((subset2 >> (id - 1)) & 1 == 1) {
                _claim(s2, id);
                m2 |= _bit(id);
            }
            assertEq(c.claimedMask(s1), m1);
            assertEq(c.claimedMask(s2), m2);
        }
    }

    function testFuzz_UntouchedAddressMaskIsZero(address who) public view {
        assertEq(c.claimedMask(who), 0);
    }

    // ------------------------------------------------------------------
    // No-value policy
    // ------------------------------------------------------------------

    function test_RevertClaimWithValue() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(c).call{value: 1 ether}(abi.encodeCall(StableAcresStudyBadges.claimBadge, (1)));
        assertFalse(ok, "claimBadge with value must revert");
        assertEq(alice.balance, 1 ether);
        assertEq(address(c).balance, 0);
        assertEq(c.claimedMask(alice), 0);
        assertFalse(c.hasBadge(alice, 1));
    }

    function test_ClaimWithoutValueViaLowLevelCallSucceeds() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(c).call(abi.encodeCall(StableAcresStudyBadges.claimBadge, (1)));
        assertTrue(ok);
        assertEq(alice.balance, 1 ether);
        assertEq(address(c).balance, 0);
        assertEq(c.claimedMask(alice), 1);
    }

    function testFuzz_RevertClaimWithAnyValue(uint8 idSeed, uint96 value) public {
        uint8 id = uint8(bound(idSeed, 1, 7));
        value = uint96(bound(value, 1, type(uint96).max));
        vm.deal(alice, value);
        vm.prank(alice);
        (bool ok,) = address(c).call{value: value}(abi.encodeCall(StableAcresStudyBadges.claimBadge, (id)));
        assertFalse(ok);
        assertEq(alice.balance, value);
        assertEq(address(c).balance, 0);
        assertEq(c.claimedMask(alice), 0);
    }

    function test_RevertPlainEthSendEmptyCalldata() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(c).call{value: 1 ether}("");
        assertFalse(ok, "no receive function");
        assertEq(alice.balance, 1 ether);
        assertEq(address(c).balance, 0);
    }

    function test_RevertEthSendUnknownSelector() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(c).call{value: 1 ether}(hex"deadbeef");
        assertFalse(ok, "no fallback function");
        assertEq(alice.balance, 1 ether);
        assertEq(address(c).balance, 0);
    }

    function test_RevertEmptyCalldataWithoutValue() public {
        vm.prank(alice);
        (bool ok,) = address(c).call("");
        assertFalse(ok);
    }

    function test_RevertUnknownSelectorWithoutValue() public {
        vm.prank(alice);
        (bool ok,) = address(c).call(hex"deadbeef");
        assertFalse(ok);
    }

    function test_ContractBalanceStaysZeroAfterActivity() public {
        for (uint8 id = 1; id <= 7; id++) {
            _claim(alice, id);
            _claim(bob, id);
        }
        assertEq(address(c).balance, 0);
    }
}
