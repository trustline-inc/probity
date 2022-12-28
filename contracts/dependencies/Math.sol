// SPDX-License-Identifier: GPL-3.0-or-later

// These math functions comes from multiple files inside the MakerDao's DSS repository
// https://github.com/makerdao/dss

pragma solidity 0.8.4;

library Math {
    uint256 private constant RAY = 1e27;
    uint256 private constant WAD = 1e18;

    function _add(uint256 a, int256 b) internal pure returns (uint256 c) {
        unchecked {
            c = a + uint256(b);
        }
        require(b >= 0 || c <= a, "Math/add: add op failed");
        require(b <= 0 || c >= a, "Math/add: add op failed");
    }

    function _sub(uint256 a, int256 b) internal pure returns (uint256 c) {
        unchecked {
            c = a - uint256(b);
        }
        require(b <= 0 || c <= a, "Math/sub: sub op failed");
        require(b >= 0 || c >= a, "Math/sub: sub op failed");
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a > b) {
            return b;
        } else {
            return a;
        }
    }

    function _mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        require(b == 0 || (c = a * b) / b == a, "Math/mul: mul op failed");
    }

    function _mul(uint256 a, int256 b) internal pure returns (int256 c) {
        c = int256(a) * b;
        require(int256(a) >= 0, "Math/mul: mul op failed");
        require(b == 0 || c / b == int256(a), "Math/mul: mul op failed");
    }

    function _rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = ((x * RAY) + (y / 2)) / y;
    }

    function _rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = ((x * y) + (RAY / 2)) / RAY;
    }

    function _wdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = ((x * WAD) + (y / 2)) / y;
    }

    function _rpow(uint256 x, uint256 n) internal pure returns (uint256 z) {
        z = n % 2 != 0 ? x : RAY;

        for (n /= 2; n != 0; n /= 2) {
            x = _rmul(x, x);

            if (n % 2 != 0) {
                z = _rmul(z, x);
            }
        }
    }
}
