# Rates

## Constants

`SECONDS_IN_YEAR = 31536000`

## Convert APR to MPR

Often times we need to convert an APR, or annual percentage rate, to an MPR, or a moment percentage rate. The MPR is measured as the rate at which interest is compounding per second.

Take `r^N = 1.02` as a 2% APR. To get the MPR, we say `N=SECONDS_IN_YEAR`. This gives us `r^SECONDS_IN_YEAR = 1.02`. We can then take the N-th root of the equation, for example, \sqrt[31535000]{1.02}.

This comes out to `MPR = 1.000000000627937192491029810%`, which is 2% per year.

To verify this, take the n-th root of 2% (in decimal form as 1.02).

https://captaincalculator.com/math/root/nth-root-calculator/, it calculates properly as: 1.0000000006 (although imprecise).

## Rate Accumulator

NEW_RATE_ACCUMULATOR = MARKET_RATE^(seconds since last order) x OLD_RATE_ACCUMULATOR

E.G., assuming rate is same for 2 executed orders that within 5 seconds of each other:

At protocol launch, INITIAL_RATE_ACCUMULATOR=1

NEW_RATE_ACCUMULATOR_T1= 1.00000000000627937192491029810^5 x 1=1.00000000003139685962494579

NEW_RATE_ACCUMULATOR_T2= 1.00000000000627937192491029810^5 x 1.00000000003139685962494579=1.000000000062793719250877348

And so forth
