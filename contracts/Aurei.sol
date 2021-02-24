// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IAurei.sol";
import "./Dependencies/SafeMath.sol";

contract Aurei is IAurei {
	using SafeMath for uint256;

	// --- Auth ---
	// TODO

	// --- ERC20 Data ---
	string 	public constant name 		 = "Aurei Stablecoin";
	string 	public constant symbol 	 = "AUR";
	string 	public constant version  = "1";
	uint8 	public constant decimals = 18;
	uint256 public totalSupply;

	mapping (address => uint) 										 public balanceOf;
	mapping (address => mapping (address => uint)) public allowance;
	mapping (address => uint) 										 public nonces;

	event Transfer(address indexed _from, address indexed _to, uint _value);
	event Approval(address indexed _owner, address indexed _spender, uint _value);
}
