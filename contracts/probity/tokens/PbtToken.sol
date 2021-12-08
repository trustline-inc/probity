// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../dependencies/SafeMath.sol";
import "../../interfaces/IPbtToken.sol";
import "../../dependencies/Stateful.sol";

/**
 * Based upon OpenZeppelin's ERC20 contract:
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol
 *
 * and their EIP2612 (ERC20Permit / ERC712) functionality:
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/53516bc555a454862470e7860a9b5254db4d00f5/contracts/token/ERC20/ERC20Permit.sol
 */
contract PbtToken is IPbtToken, Stateful {
    using SafeMath for uint256;

    // --- Data ---

    uint256 private _totalSupply;
    string internal constant _NAME = "Trustline Credit Network Token";
    string internal constant _SYMBOL = "PBT";
    string internal constant _VERSION = "1.0.0";
    uint8 internal constant _DECIMALS = 18;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowed;

    /**
     * @dev Builds the domain separator
     */
    constructor(address registryAddress) Stateful(registryAddress) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
    }

    // --- ERC20 Functions ---

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowed[owner][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function decimals() external pure override returns (uint8) {
        return _DECIMALS;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external override returns (bool) {
        _approve(
            msg.sender,
            spender,
            _allowed[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero")
        );
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) external override returns (bool) {
        _approve(msg.sender, spender, _allowed[msg.sender][spender].add(addedValue));
        return true;
    }

    function name() external pure override returns (string memory) {
        return _NAME;
    }

    function symbol() external pure override returns (string memory) {
        return _SYMBOL;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _requireValidRecipient(recipient);
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function mint(address account, uint256 amount) external override onlyBy("treasury") {
        _requireValidRecipient(account);

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    function burn(address account, uint256 amount) external override onlyBy("treasury") {
        _requireValidRecipient(account);

        _balances[account] = _balances[account].sub(amount, "ERC20: burn amount exceeds balance");
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external override returns (bool) {
        _requireValidRecipient(recipient);
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            msg.sender,
            _allowed[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance")
        );
        return true;
    }

    function version() external pure returns (string memory) {
        return _VERSION;
    }

    // --- Internal operations ---

    function _approve(
        address,
        address,
        uint256
    ) internal pure {
        revert("Approve is disabled for PBT token");
    }

    function _transfer(
        address,
        address,
        uint256
    ) internal pure {
        revert("Transfer is disabled for PBT token");
    }

    // --- 'require' functions ---

    function _requireValidRecipient(address _recipient) internal view {
        require(
            _recipient != address(0) && _recipient != address(this),
            "PBT/_requireValidRecipient: Cannot transfer tokens directly to the PBT token contract or the zero address"
        );
    }
}
