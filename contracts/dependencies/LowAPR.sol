// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

/**
 * @title LowAPR contract
 * @notice Holds the constant array of APR_MPR mapping from 1.00% to 50% APR
 */
contract LowAPR {
    ///////////////////////////////////
    // State Variables
    ///////////////////////////////////
    // Follows R^(1/31557600) * (1-U) * f(1/31557600) = 1
    // solhint-disable-next-line
    mapping(uint256 => uint256) public APR_TO_MPR;

    ///////////////////////////////////
    // Constructor
    ///////////////////////////////////
    /**
     * Set storage for APR-MPR conversions at 0.25% APR increments.
     * @dev output generated from RATES.sh script
     */
    constructor() {
        APR_TO_MPR[1010000000000000000000000000] = 1000000000315313692301234303; // 1.00%
        APR_TO_MPR[1012500000000000000000000000] = 1000000000393654312242017571; // 1.25%
        APR_TO_MPR[1015000000000000000000000000] = 1000000000471801736875857029; // 1.50%
        APR_TO_MPR[1017500000000000000000000000] = 1000000000549756916734594761; // 1.75%
        APR_TO_MPR[1020000000000000000000000000] = 1000000000627520795352278394; // 2.00%
        APR_TO_MPR[1022500000000000000000000000] = 1000000000705094309333683125; // 2.25%
        APR_TO_MPR[1025000000000000000000000000] = 1000000000782478388421997087; // 2.50%
        APR_TO_MPR[1027500000000000000000000000] = 1000000000859673955565682292; // 2.75%
        APR_TO_MPR[1030000000000000000000000000] = 1000000000936681926984523164; // 3.00%
        APR_TO_MPR[1032500000000000000000000000] = 1000000001013503212234874483; // 3.25%
        APR_TO_MPR[1035000000000000000000000000] = 1000000001090138714274120352; // 3.50%
        APR_TO_MPR[1037500000000000000000000000] = 1000000001166589329524355614; // 3.75%
        APR_TO_MPR[1040000000000000000000000000] = 1000000001242855947935300940; // 4.00%
        APR_TO_MPR[1042500000000000000000000000] = 1000000001318939453046462641; // 4.25%
        APR_TO_MPR[1045000000000000000000000000] = 1000000001394840722048548034; // 4.50%
        APR_TO_MPR[1047500000000000000000000000] = 1000000001470560625844147065; // 4.75%
        APR_TO_MPR[1050000000000000000000000000] = 1000000001546100029107690659; // 5.00%
        APR_TO_MPR[1052500000000000000000000000] = 1000000001621459790344696131; // 5.25%
        APR_TO_MPR[1055000000000000000000000000] = 1000000001696640761950309801; // 5.50%
        APR_TO_MPR[1057500000000000000000000000] = 1000000001771643790267156794; // 5.75%
        APR_TO_MPR[1060000000000000000000000000] = 1000000001846469715642507847; // 6.00%
        APR_TO_MPR[1062500000000000000000000000] = 1000000001921119372484772765; // 6.25%
        APR_TO_MPR[1065000000000000000000000000] = 1000000001995593589319330025; // 6.50%
        APR_TO_MPR[1067500000000000000000000000] = 1000000002069893188843701885; // 6.75%
        APR_TO_MPR[1070000000000000000000000000] = 1000000002144018987982084147; // 7.00%
        APR_TO_MPR[1072500000000000000000000000] = 1000000002217971797939239645; // 7.25%
        APR_TO_MPR[1075000000000000000000000000] = 1000000002291752424253764334; // 7.50%
        APR_TO_MPR[1077500000000000000000000000] = 1000000002365361666850734716; // 7.75%
        APR_TO_MPR[1080000000000000000000000000] = 1000000002438800320093745215; // 8.00%
        APR_TO_MPR[1082500000000000000000000000] = 1000000002512069172836343970; // 8.25%
        APR_TO_MPR[1085000000000000000000000000] = 1000000002585169008472875354; // 8.50%
        APR_TO_MPR[1087500000000000000000000000] = 1000000002658100604988737430; // 8.75%
        APR_TO_MPR[1090000000000000000000000000] = 1000000002730864735010062389; // 9.00%
        APR_TO_MPR[1092500000000000000000000000] = 1000000002803462165852827922; // 9.25%
        APR_TO_MPR[1095000000000000000000000000] = 1000000002875893659571407301; // 9.50%
        APR_TO_MPR[1097500000000000000000000000] = 1000000002948159973006565881; // 9.75%
        APR_TO_MPR[1100000000000000000000000000] = 1000000003020261857832911555; // 10.00%
        APR_TO_MPR[1102500000000000000000000000] = 1000000003092200060605806619; // 10.25%
        APR_TO_MPR[1105000000000000000000000000] = 1000000003163975322807748344; // 10.50%
        APR_TO_MPR[1107500000000000000000000000] = 1000000003235588380894225489; // 10.75%
        APR_TO_MPR[1110000000000000000000000000] = 1000000003307039966339057816; // 11.00%
        APR_TO_MPR[1112500000000000000000000000] = 1000000003378330805679225600; // 11.25%
        APR_TO_MPR[1115000000000000000000000000] = 1000000003449461620559196008; // 11.50%
        APR_TO_MPR[1117500000000000000000000000] = 1000000003520433127774753091; // 11.75%
        APR_TO_MPR[1120000000000000000000000000] = 1000000003591246039316338059; // 12.00%
        APR_TO_MPR[1122500000000000000000000000] = 1000000003661901062411906388; // 12.25%
        APR_TO_MPR[1125000000000000000000000000] = 1000000003732398899569308199; // 12.50%
        APR_TO_MPR[1127500000000000000000000000] = 1000000003802740248618198274; // 12.75%
        APR_TO_MPR[1130000000000000000000000000] = 1000000003872925802751481942; // 13.00%
        APR_TO_MPR[1132500000000000000000000000] = 1000000003942956250566303007; // 13.25%
        APR_TO_MPR[1135000000000000000000000000] = 1000000004012832276104579762; // 13.50%
        APR_TO_MPR[1137500000000000000000000000] = 1000000004082554558893095064; // 13.75%
        APR_TO_MPR[1140000000000000000000000000] = 1000000004152123773983146339; // 14.00%
        APR_TO_MPR[1142500000000000000000000000] = 1000000004221540591989761311; // 14.25%
        APR_TO_MPR[1145000000000000000000000000] = 1000000004290805679130485127; // 14.50%
        APR_TO_MPR[1147500000000000000000000000] = 1000000004359919697263744520; // 14.75%
        APR_TO_MPR[1150000000000000000000000000] = 1000000004428883303926794507; // 15.00%
        APR_TO_MPR[1152500000000000000000000000] = 1000000004497697152373253066; // 15.25%
        APR_TO_MPR[1155000000000000000000000000] = 1000000004566361891610229161; // 15.50%
        APR_TO_MPR[1157500000000000000000000000] = 1000000004634878166435049377; // 15.75%
        APR_TO_MPR[1160000000000000000000000000] = 1000000004703246617471588367; // 16.00%
        APR_TO_MPR[1162500000000000000000000000] = 1000000004771467881206208227; // 16.25%
        APR_TO_MPR[1165000000000000000000000000] = 1000000004839542590023311841; // 16.50%
        APR_TO_MPR[1167500000000000000000000000] = 1000000004907471372240515162; // 16.75%
        APR_TO_MPR[1170000000000000000000000000] = 1000000004975254852143443313; // 17.00%
        APR_TO_MPR[1172500000000000000000000000] = 1000000005042893650020155337; // 17.25%
        APR_TO_MPR[1175000000000000000000000000] = 1000000005110388382195202332; // 17.50%
        APR_TO_MPR[1177500000000000000000000000] = 1000000005177739661063323648; // 17.75%
        APR_TO_MPR[1180000000000000000000000000] = 1000000005244948095122785756; // 18.00%
        APR_TO_MPR[1182500000000000000000000000] = 1000000005312014289008368325; // 18.25%
        APR_TO_MPR[1185000000000000000000000000] = 1000000005378938843524001974; // 18.50%
        APR_TO_MPR[1187500000000000000000000000] = 1000000005445722355675062105; // 18.75%
        APR_TO_MPR[1190000000000000000000000000] = 1000000005512365418700323162; // 19.00%
        APR_TO_MPR[1192500000000000000000000000] = 1000000005578868622103577582; // 19.25%
        APR_TO_MPR[1195000000000000000000000000] = 1000000005645232551684923663; // 19.50%
        APR_TO_MPR[1197500000000000000000000000] = 1000000005711457789571726488; // 19.75%
        APR_TO_MPR[1200000000000000000000000000] = 1000000005777544914249256005; // 20.00%
        APR_TO_MPR[1202500000000000000000000000] = 1000000005843494500591006294; // 20.25%
        APR_TO_MPR[1205000000000000000000000000] = 1000000005909307119888699989; // 20.50%
        APR_TO_MPR[1207500000000000000000000000] = 1000000005974983339881981772; // 20.75%
        APR_TO_MPR[1210000000000000000000000000] = 1000000006040523724787804801; // 21.00%
        APR_TO_MPR[1212500000000000000000000000] = 1000000006105928835329513869; // 21.25%
        APR_TO_MPR[1215000000000000000000000000] = 1000000006171199228765629046; // 21.50%
        APR_TO_MPR[1217500000000000000000000000] = 1000000006236335458918333496; // 21.75%
        APR_TO_MPR[1220000000000000000000000000] = 1000000006301338076201669114; // 22.00%
        APR_TO_MPR[1222500000000000000000000000] = 1000000006366207627649443562; // 22.25%
        APR_TO_MPR[1225000000000000000000000000] = 1000000006430944656942852255; // 22.50%
        APR_TO_MPR[1227500000000000000000000000] = 1000000006495549704437818769; // 22.75%
        APR_TO_MPR[1230000000000000000000000000] = 1000000006560023307192057126; // 23.00%
        APR_TO_MPR[1232500000000000000000000000] = 1000000006624365998991859323; // 23.25%
        APR_TO_MPR[1235000000000000000000000000] = 1000000006688578310378611466; // 23.50%
        APR_TO_MPR[1237500000000000000000000000] = 1000000006752660768675041790; // 23.75%
        APR_TO_MPR[1240000000000000000000000000] = 1000000006816613898011203811; // 24.00%
        APR_TO_MPR[1242500000000000000000000000] = 1000000006880438219350197820; // 24.25%
        APR_TO_MPR[1245000000000000000000000000] = 1000000006944134250513633867; // 24.50%
        APR_TO_MPR[1247500000000000000000000000] = 1000000007007702506206839342; // 24.75%
        APR_TO_MPR[1250000000000000000000000000] = 1000000007071143498043814243; // 25.00%
        APR_TO_MPR[1252500000000000000000000000] = 1000000007134457734571937120; // 25.25%
        APR_TO_MPR[1255000000000000000000000000] = 1000000007197645721296424717; // 25.50%
        APR_TO_MPR[1257500000000000000000000000] = 1000000007260707960704548217; // 25.75%
        APR_TO_MPR[1260000000000000000000000000] = 1000000007323644952289609024; // 26.00%
        APR_TO_MPR[1262500000000000000000000000] = 1000000007386457192574676912; // 26.25%
        APR_TO_MPR[1265000000000000000000000000] = 1000000007449145175136093379; // 26.50%
        APR_TO_MPR[1267500000000000000000000000] = 1000000007511709390626742988; // 26.75%
        APR_TO_MPR[1270000000000000000000000000] = 1000000007574150326799095427; // 27.00%
        APR_TO_MPR[1272500000000000000000000000] = 1000000007636468468528021002; // 27.25%
        APR_TO_MPR[1275000000000000000000000000] = 1000000007698664297833382230; // 27.50%
        APR_TO_MPR[1277500000000000000000000000] = 1000000007760738293902404158; // 27.75%
        APR_TO_MPR[1280000000000000000000000000] = 1000000007822690933111826016; // 28.00%
        APR_TO_MPR[1282500000000000000000000000] = 1000000007884522689049836744; // 28.25%
        APR_TO_MPR[1285000000000000000000000000] = 1000000007946234032537796945; // 28.50%
        APR_TO_MPR[1287500000000000000000000000] = 1000000008007825431651749725; // 28.75%
        APR_TO_MPR[1290000000000000000000000000] = 1000000008069297351743722903; // 29.00%
        APR_TO_MPR[1292500000000000000000000000] = 1000000008130650255462824997; // 29.25%
        APR_TO_MPR[1295000000000000000000000000] = 1000000008191884602776137390; // 29.50%
        APR_TO_MPR[1297500000000000000000000000] = 1000000008253000850989405021; // 29.75%
        APR_TO_MPR[1300000000000000000000000000] = 1000000008313999454767527939; // 30.00%
        APR_TO_MPR[1302500000000000000000000000] = 1000000008374880866154856015; // 30.25%
        APR_TO_MPR[1305000000000000000000000000] = 1000000008435645534595289067; // 30.50%
        APR_TO_MPR[1307500000000000000000000000] = 1000000008496293906952184641; // 30.75%
        APR_TO_MPR[1310000000000000000000000000] = 1000000008556826427528075655; // 31.00%
        APR_TO_MPR[1312500000000000000000000000] = 1000000008617243538084200071; // 31.25%
        APR_TO_MPR[1315000000000000000000000000] = 1000000008677545677859844746; // 31.50%
        APR_TO_MPR[1317500000000000000000000000] = 1000000008737733283591505590; // 31.75%
        APR_TO_MPR[1320000000000000000000000000] = 1000000008797806789531866097; // 32.00%
        APR_TO_MPR[1322500000000000000000000000] = 1000000008857766627468596335; // 32.25%
        APR_TO_MPR[1325000000000000000000000000] = 1000000008917613226742974415; // 32.50%
        APR_TO_MPR[1327500000000000000000000000] = 1000000008977347014268332454; // 32.75%
        APR_TO_MPR[1330000000000000000000000000] = 1000000009036968414548329005; // 33.00%
        APR_TO_MPR[1332500000000000000000000000] = 1000000009096477849695049921; // 33.25%
        APR_TO_MPR[1335000000000000000000000000] = 1000000009155875739446939570; // 33.50%
        APR_TO_MPR[1337500000000000000000000000] = 1000000009215162501186564317; // 33.75%
        APR_TO_MPR[1340000000000000000000000000] = 1000000009274338549958210141; // 34.00%
        APR_TO_MPR[1342500000000000000000000000] = 1000000009333404298485316258; // 34.25%
        APR_TO_MPR[1345000000000000000000000000] = 1000000009392360157187746553; // 34.50%
        APR_TO_MPR[1347500000000000000000000000] = 1000000009451206534198900668; // 34.75%
        APR_TO_MPR[1350000000000000000000000000] = 1000000009509943835382666485; // 35.00%
        APR_TO_MPR[1352500000000000000000000000] = 1000000009568572464350215803; // 35.25%
        APR_TO_MPR[1355000000000000000000000000] = 1000000009627092822476644921; // 35.50%
        APR_TO_MPR[1357500000000000000000000000] = 1000000009685505308917461855; // 35.75%
        APR_TO_MPR[1360000000000000000000000000] = 1000000009743810320624921877; // 36.00%
        APR_TO_MPR[1362500000000000000000000000] = 1000000009802008252364213048; // 36.25%
        APR_TO_MPR[1365000000000000000000000000] = 1000000009860099496729493398; // 36.50%
        APR_TO_MPR[1367500000000000000000000000] = 1000000009918084444159781378; // 36.75%
        APR_TO_MPR[1370000000000000000000000000] = 1000000009975963482954701196; // 37.00%
        APR_TO_MPR[1372500000000000000000000000] = 1000000010033736999290084615; // 37.25%
        APR_TO_MPR[1375000000000000000000000000] = 1000000010091405377233430797; // 37.50%
        APR_TO_MPR[1377500000000000000000000000] = 1000000010148968998759225722; // 37.75%
        APR_TO_MPR[1380000000000000000000000000] = 1000000010206428243764122721; // 38.00%
        APR_TO_MPR[1382500000000000000000000000] = 1000000010263783490081985632; // 38.25%
        APR_TO_MPR[1385000000000000000000000000] = 1000000010321035113498796060; // 38.50%
        APR_TO_MPR[1387500000000000000000000000] = 1000000010378183487767426215; // 38.75%
        APR_TO_MPR[1390000000000000000000000000] = 1000000010435228984622278786; // 39.00%
        APR_TO_MPR[1392500000000000000000000000] = 1000000010492171973793795278; // 39.25%
        APR_TO_MPR[1395000000000000000000000000] = 1000000010549012823022834223; // 39.50%
        APR_TO_MPR[1397500000000000000000000000] = 1000000010605751898074920680; // 39.75%
        APR_TO_MPR[1400000000000000000000000000] = 1000000010662389562754368383; // 40.00%
        APR_TO_MPR[1402500000000000000000000000] = 1000000010718926178918275921; // 40.25%
        APR_TO_MPR[1405000000000000000000000000] = 1000000010775362106490398271; // 40.50%
        APR_TO_MPR[1407500000000000000000000000] = 1000000010831697703474895048; // 40.75%
        APR_TO_MPR[1410000000000000000000000000] = 1000000010887933325969956745; // 41.00%
        APR_TO_MPR[1412500000000000000000000000] = 1000000010944069328181310294; // 41.25%
        APR_TO_MPR[1415000000000000000000000000] = 1000000011000106062435605211; // 41.50%
        APR_TO_MPR[1417500000000000000000000000] = 1000000011056043879193681585; // 41.75%
        APR_TO_MPR[1420000000000000000000000000] = 1000000011111883127063721182; // 42.00%
        APR_TO_MPR[1422500000000000000000000000] = 1000000011167624152814282870; // 42.25%
        APR_TO_MPR[1425000000000000000000000000] = 1000000011223267301387223610; // 42.50%
        APR_TO_MPR[1427500000000000000000000000] = 1000000011278812915910506194; // 42.75%
        APR_TO_MPR[1430000000000000000000000000] = 1000000011334261337710894934; // 43.00%
        APR_TO_MPR[1432500000000000000000000000] = 1000000011389612906326540473; // 43.25%
        APR_TO_MPR[1435000000000000000000000000] = 1000000011444867959519454873; // 43.50%
        APR_TO_MPR[1437500000000000000000000000] = 1000000011500026833287878129; // 43.75%
        APR_TO_MPR[1440000000000000000000000000] = 1000000011555089861878537246; // 44.00%
        APR_TO_MPR[1442500000000000000000000000] = 1000000011610057377798798988; // 44.25%
        APR_TO_MPR[1445000000000000000000000000] = 1000000011664929711828717411; // 44.50%
        APR_TO_MPR[1447500000000000000000000000] = 1000000011719707193032977264; // 44.75%
        APR_TO_MPR[1450000000000000000000000000] = 1000000011774390148772734350; // 45.00%
        APR_TO_MPR[1452500000000000000000000000] = 1000000011828978904717353889; // 45.25%
        APR_TO_MPR[1455000000000000000000000000] = 1000000011883473784856047964; // 45.50%
        APR_TO_MPR[1457500000000000000000000000] = 1000000011937875111509413063; // 45.75%
        APR_TO_MPR[1460000000000000000000000000] = 1000000011992183205340868762; // 46.00%
        APR_TO_MPR[1462500000000000000000000000] = 1000000012046398385367998555; // 46.25%
        APR_TO_MPR[1465000000000000000000000000] = 1000000012100520968973793839; // 46.50%
        APR_TO_MPR[1467500000000000000000000000] = 1000000012154551271917802039; // 46.75%
        APR_TO_MPR[1470000000000000000000000000] = 1000000012208489608347179856; // 47.00%
        APR_TO_MPR[1472500000000000000000000000] = 1000000012262336290807652611; // 47.25%
        APR_TO_MPR[1475000000000000000000000000] = 1000000012316091630254380619; // 47.50%
        APR_TO_MPR[1477500000000000000000000000] = 1000000012369755936062733574; // 47.75%
        APR_TO_MPR[1480000000000000000000000000] = 1000000012423329516038973834; // 48.00%
        APR_TO_MPR[1482500000000000000000000000] = 1000000012476812676430849574; // 48.25%
        APR_TO_MPR[1485000000000000000000000000] = 1000000012530205721938098677; // 48.50%
        APR_TO_MPR[1487500000000000000000000000] = 1000000012583508955722864294; // 48.75%
        APR_TO_MPR[1490000000000000000000000000] = 1000000012636722679420022951; // 49.00%
        APR_TO_MPR[1492500000000000000000000000] = 1000000012689847193147426073; // 49.25%
        APR_TO_MPR[1495000000000000000000000000] = 1000000012742882795516055821; // 49.50%
        APR_TO_MPR[1497500000000000000000000000] = 1000000012795829783640096070; // 49.75%
        APR_TO_MPR[1500000000000000000000000000] = 1000000012848688453146919403; // 50.00%
    }
}
