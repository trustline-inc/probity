# This script calculates interest rates (units of ray) in increments of 0.25%.
# The associated MPRs are calculated and displayed alongside the APRs.

for i in {0..400}
do
  RAY=1000000000000000000000000000
  APR=$(echo "$i * 0.25" | bc -l)
  MPR=$(bc -l <<< 'scale=28; e(l(('$APR'/100)+1)/31556926)')
  MPR_INT=$(bc -l <<< 'scale=27; ('$MPR' * '$RAY')')
  MPR_INT=$(bc -l <<< 'scale=0; '$MPR_INT'/1')
  APR_INT=$(bc -l <<< 'scale=4; (1 + ('$APR' / 100)) * '$RAY'')
  APR_INT=$(bc -l <<< 'scale=0; '$APR_INT'/1')

  if [[ $i > 1 ]]; then
    echo "APR_TO_MPR[$APR_INT] = $MPR_INT; // $APR%"
  fi
done
