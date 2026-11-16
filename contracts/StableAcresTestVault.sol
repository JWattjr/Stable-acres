// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Stable Acres Arc Testnet Classroom Vault
/// @notice Testnet-only lesson for Arc (chain ID 5042002), using NATIVE test USDC
/// (the 18-decimal gas token), not ERC-20 transfers. Test USDC has no cash value.
/// Yield is a fixed CLASSROOM RATE paid only from a pre-funded reserve. It is NOT
/// a real, market or sustainable yield source and is NOT an APY. At the intended
/// rate, 1% of principal per hour is roughly 8,760% per year SIMPLE (not compounded);
/// this is only affordable because this is a small, capped test-USDC lesson.
/// There are no owner/admin powers. Depositors can always withdraw principal
/// independently of reserve funding, provided their recipient accepts the payout.
/// Unpaid yield remains owed; competition for a thin reserve is first-come-first-served.
/// @dev Intended network only; the constructor does not enforce a chain ID.
/// Accounting invariant: address(this).balance >= totalPrincipal + reserve.
/// Forced native transfers (e.g. via selfdestruct) only increase unaccounted surplus;
/// no function accounts for or retrieves that surplus. Yield accrues on principal
/// only, never on pending yield. Checked uint256 arithmetic applies to accrual.
contract StableAcresTestVault {
    error InvalidConfig();
    error ZeroAmount();
    error CapExceeded();
    error InsufficientPrincipal();
    error NothingToWithdraw();
    error TransferFailed();
    error Reentrancy();

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 principal, uint256 yield);
    event ReserveFunded(address indexed from, uint256 amount);

    uint256 public constant SCALE = 1e18;
    uint256 public immutable ratePerSecond;
    uint256 public immutable perWalletCap;

    mapping(address => uint256) private principal;
    mapping(address => uint256) private pendingYield;
    mapping(address => uint256) private lastSettled;

    uint256 public totalPrincipal;
    uint256 private reserve;
    uint256 private status = 1;

    modifier nonReentrant() {
        if (status != 1) revert Reentrancy();
        status = 2;
        _;
        status = 1;
    }

    /// @notice Configure the fixed classroom rate and per-wallet principal cap.
    /// @dev Intended values: ratePerSecond_ = 2777777777777 and perWalletCap_ = 50e18.
    /// The rate is floor(0.01e18 / 3600), so it is slightly below exactly 1% per hour.
    /// @param ratePerSecond_ Per-second principal fraction, scaled by SCALE; in (0, SCALE].
    /// @param perWalletCap_ Nonzero maximum active principal per wallet, in native wei.
    constructor(uint256 ratePerSecond_, uint256 perWalletCap_) {
        if (ratePerSecond_ == 0 || ratePerSecond_ > SCALE || perWalletCap_ == 0) {
            revert InvalidConfig();
        }
        ratePerSecond = ratePerSecond_;
        perWalletCap = perWalletCap_;
    }

    /// @notice Deposit native test USDC as your principal, up to the wallet cap.
    function deposit() external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (principal[msg.sender] + msg.value > perWalletCap) revert CapExceeded();

        _settle(msg.sender);
        principal[msg.sender] += msg.value;
        totalPrincipal += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw a nonzero principal amount plus any reserve-funded yield.
    /// @dev An empty reserve never reduces the principal payout. Unpaid yield stays owed.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > principal[msg.sender]) revert InsufficientPrincipal();
        _withdraw(amount);
    }

    /// @notice Withdraw all principal and available yield, or collect leftover owed yield.
    /// @dev With zero principal, succeeds only if the reserve can pay some owed yield.
    function withdrawAll() external nonReentrant {
        _withdraw(principal[msg.sender]);
    }

    /// @notice Anyone may contribute native test USDC to the yield reserve.
    /// @dev Contributions confer no ownership, principal balance or withdrawal rights.
    function fundReserve() external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        reserve += msg.value;
        emit ReserveFunded(msg.sender, msg.value);
    }

    /// @notice Return the account's active principal in native wei.
    function principalOf(address account) external view returns (uint256) {
        return principal[account];
    }

    /// @notice Return all owed yield, including unsettled accrual, without a reserve cap.
    /// @dev Uses the same floor-rounded, noncompounding formula as settlement.
    function pendingYieldOf(address account) public view returns (uint256) {
        return pendingYield[account]
            + principal[account] * ratePerSecond * (block.timestamp - lastSettled[account]) / SCALE;
    }

    /// @notice Return yield payable from the current reserve; other withdrawals may consume it.
    function claimableYieldOf(address account) external view returns (uint256) {
        uint256 owed = pendingYieldOf(account);
        return owed < reserve ? owed : reserve;
    }

    /// @notice Return the tracked yield reserve, excluding principal and forced surplus.
    function reserveBalance() external view returns (uint256) {
        return reserve;
    }

    /// @dev Round down at each settlement, favoring the reserve. Frequent settlement
    /// can lose sub-wei fractions. Pending yield itself never compounds.
    function _settle(address account) private {
        pendingYield[account] +=
            principal[account] * ratePerSecond * (block.timestamp - lastSettled[account]) / SCALE;
        lastSettled[account] = block.timestamp;
    }

    /// @dev Shared payout path: all accounting effects precede the single external call.
    function _withdraw(uint256 amount) private {
        _settle(msg.sender);
        principal[msg.sender] -= amount;
        totalPrincipal -= amount;

        uint256 owed = pendingYield[msg.sender];
        uint256 pay = owed < reserve ? owed : reserve;
        pendingYield[msg.sender] -= pay;
        reserve -= pay;

        uint256 payout = amount + pay;
        if (payout == 0) revert NothingToWithdraw();

        (bool success,) = payable(msg.sender).call{value: payout}("");
        if (!success) revert TransferFailed();
        emit Withdrawn(msg.sender, amount, pay);
    }
}
