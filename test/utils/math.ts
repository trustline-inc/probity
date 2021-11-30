import { PRECISION_AUR, PRECISION_COLL, PRECISION_PRICE } from "./constants";

function wdiv(x, y) {
  return x.mul(PRECISION_COLL).add(y.div(2)).div(y);
}

function rdiv(x, y) {
  return x.mul(PRECISION_PRICE).add(y.div(2)).div(y);
}

function rmul(x, y) {
  return x.mul(y).add(PRECISION_PRICE.div(2)).div(PRECISION_PRICE);
}

function rpow(x, n) {
  let z = n % 2 != 0 ? x : PRECISION_PRICE;

  for (n /= 2; n != 0; n /= 2) {
    n = Math.floor(n);
    x = rmul(x, x);

    if (n % 2 != 0) {
      z = rmul(z, x);
    }
  }
  return z;
}

export { wdiv, rdiv, rmul, rpow };
