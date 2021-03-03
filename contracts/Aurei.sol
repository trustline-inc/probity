// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IAurei.sol";
import "./Interfaces/ITeller.sol";
import "./Dependencies/SafeMath.sol";

/**
 * Based upon OpenZeppelin's ERC20 contract:
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol
 *
 * and their EIP2612 (ERC20Permit / ERC712) functionality:
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/53516bc555a454862470e7860a9b5254db4d00f5/contracts/token/ERC20/ERC20Permit.sol
 */
contract Aurei is IAurei {
	using SafeMath for uint256;

	// --- Data ---

	uint256 private _totalSupply;
	string constant internal _NAME 		= "Aurei Stablecoin";
	string constant internal _SYMBOL 	= "AUR";
	string constant internal _VERSION = "1.0.0";
	uint8 constant internal _DECIMALS = 18;

	mapping (address => uint256) private _balances;
	mapping (address => mapping (address => uint256)) private _allowed;

	address teller;

	// --- ERC2612 Data ---

	bytes32 private immutable _DOMAIN_SEPARATOR;
	bytes32 private constant _PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9; // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

	mapping (address => uint256) private _nonces;

	/**
	 * @dev Builds the domain separator
	 */
	constructor(address _teller) {
		teller = _teller;

		uint256 chainId;
		assembly { chainId := chainid() }
		_DOMAIN_SEPARATOR = keccak256(
			abi.encode(
				keccak256(
					"EIP712Domain("
						"string name,"
						"string version,"
						"uint256 chainId,"
						"address verifyingContract"
					")"
				),
				keccak256(bytes(_NAME)),
				keccak256(bytes(_VERSION)),
				chainId,
				address(this)
			)
		);
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

	function burn(uint256 _amount) external override {
		_burn(_amount);
	}

	function decimals() external pure override returns (uint8) {
		return _DECIMALS;
	}

	function decreaseAllowance(address spender, uint256 subtractedValue) external override returns (bool) {
		_approve(msg.sender, spender, _allowed[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
		return true;
	}

	function increaseAllowance(address spender, uint256 addedValue) external override returns (bool) {
		_approve(msg.sender, spender, _allowed[msg.sender][spender].add(addedValue));
		return true;
	}

	/**
	 * @dev We need to ensure that this is only callable by the Probity contract.
	 * We can use a modifier to ensure this.
	 */
	function mint(uint256 _amount) external override onlyProbity {
		_mint(_amount);
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

	function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
		_requireValidRecipient(recipient);
		_transfer(sender, recipient, amount);
		_approve(sender, msg.sender, _allowed[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));
		return true;
	}

	function version() external pure override returns (string memory) {
		return _VERSION;
	}

	// --- ERC2612 Functions ---

	function DOMAIN_SEPARATOR() external view override returns (bytes32) {
		return _DOMAIN_SEPARATOR;
	}

	function permit
	(
		address owner,
		address spender,
		uint amount,
		uint deadline,
		uint8 v,
		bytes32 r,
		bytes32 s
	)
		external
		override
	{
		require(deadline >= block.timestamp, 'AUR: EXPIRED');
		bytes32 digest = keccak256(
			abi.encodePacked(
				'\x19\x01',
				_DOMAIN_SEPARATOR,
				keccak256(
					abi.encode(
						_PERMIT_TYPEHASH,
						owner,
						spender,
						amount,
						_nonces[owner]++,
						deadline
					)
				)
			)
		);
		address recoveredAddress = ecrecover(digest, v, r, s);
		require(recoveredAddress != address(0) && recoveredAddress == owner, 'AUR: INVALID_SIGNATURE');
		_approve(owner, spender, amount);
	}

	function permitTypeHash() external pure override returns (bytes32) {
		return _PERMIT_TYPEHASH;
	}

	function nonces(address owner) external view override returns (uint256) { // FOR EIP 2612
		return _nonces[owner];
	}

	// --- Internal operations ---

	function _approve(address owner, address spender, uint256 amount) internal {
		assert(owner != address(0));
		assert(spender != address(0));

		_allowed[owner][spender] = amount;
		emit Approval(owner, spender, amount);
	}

	function _burn(uint256 amount) internal {
		address account = teller;
		assert(account != address(0));

		_balances[account] = _balances[account].sub(amount, "ERC20: burn amount exceeds balance");
		_totalSupply = _totalSupply.sub(amount);
		emit Transfer(account, address(0), amount);
	}

	function _mint(uint256 amount) internal {
		address account = teller;
		assert(account != address(0));

		_totalSupply = _totalSupply.add(amount);
		_balances[account] = _balances[account].add(amount);
		emit Transfer(address(0), account, amount);
	}

	function _transfer(address sender, address recipient, uint256 amount) internal {
		assert(sender != address(0));
		assert(recipient != address(0));

		_balances[sender] = _balances[sender].sub(amount, "ERC20: transfer amount exceeds balance");
		_balances[recipient] = _balances[recipient].add(amount);
		emit Transfer(sender, recipient, amount);
	}

	// --- Modifiers ---

	/**
	 * @dev Ensure that msg.sender === Probity contract address.
	 */
	modifier onlyProbity {
		// require();
		_;
	}

	// --- 'require' functions ---

	function _requireValidRecipient(address _recipient) internal view {
		require(
			_recipient != address(0) &&
			_recipient != address(this),
			"AUR: Cannot transfer tokens directly to the AUR token contract or the zero address"
		);
	}
}
