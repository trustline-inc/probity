for i in {0..400}
do
  echo "========================"
  APR=$(echo "$i*0.25" | bc -l)
  MPR=$(bc -l <<< 'scale=27; e( l(('$APR'/100)+1)/31557600 )')
  U=$(bc -l <<< 'scale=4; (1 - (1 / '$APR')) * 100')
  U_scaled=$(bc -l <<< 'scale=27; (1 / '$MPR')')
  K=$(bc -l <<< 'scale=27; ( '$MPR' * '$U_scaled' )')

  echo "Annualized Rate: $APR%"
  echo "Momentized Rate: $MPR%"
  echo "Utilization:     $U%"
  echo "U. Scaled:       $U_scaled"
  echo "Product:         $K"
done
