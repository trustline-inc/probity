// SPDX-License-Identifier: MIT

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
        APR_TO_MPR[1010000000000000000000000000] = 1000000000315306957903541052; // 1.00%
        APR_TO_MPR[1012500000000000000000000000] = 1000000000393645904663288411; // 1.25%
        APR_TO_MPR[1015000000000000000000000000] = 1000000000471791660242312990; // 1.50%
        APR_TO_MPR[1017500000000000000000000000] = 1000000000549745175152155635; // 1.75%
        APR_TO_MPR[1020000000000000000000000000] = 1000000000627507392906712187; // 2.00%
        APR_TO_MPR[1022500000000000000000000000] = 1000000000705079250090754055; // 2.25%
        APR_TO_MPR[1025000000000000000000000000] = 1000000000782461676427612129; // 2.50%
        APR_TO_MPR[1027500000000000000000000000] = 1000000000859655594846036301; // 2.75%
        APR_TO_MPR[1030000000000000000000000000] = 1000000000936661921546242584; // 3.00%
        APR_TO_MPR[1032500000000000000000000000] = 1000000001013481566065159661; // 3.25%
        APR_TO_MPR[1035000000000000000000000000] = 1000000001090115431340886480; // 3.50%
        APR_TO_MPR[1037500000000000000000000000] = 1000000001166564413776372306; // 3.75%
        APR_TO_MPR[1040000000000000000000000000] = 1000000001242829403302330469; // 4.00%
        APR_TO_MPR[1042500000000000000000000000] = 1000000001318911283439396845; // 4.25%
        APR_TO_MPR[1045000000000000000000000000] = 1000000001394810931359543915; // 4.50%
        APR_TO_MPR[1047500000000000000000000000] = 1000000001470529217946761088; // 4.75%
        APR_TO_MPR[1050000000000000000000000000] = 1000000001546067007857011769; // 5.00%
        APR_TO_MPR[1052500000000000000000000000] = 1000000001621425159577477511; // 5.25%
        APR_TO_MPR[1055000000000000000000000000] = 1000000001696604525485099374; // 5.50%
        APR_TO_MPR[1057500000000000000000000000] = 1000000001771605951904426492; // 5.75%
        APR_TO_MPR[1060000000000000000000000000] = 1000000001846430279164781658; // 6.00%
        APR_TO_MPR[1062500000000000000000000000] = 1000000001921078341656753572; // 6.25%
        APR_TO_MPR[1065000000000000000000000000] = 1000000001995550967888025260; // 6.50%
        APR_TO_MPR[1067500000000000000000000000] = 1000000002069848980538547992; // 6.75%
        APR_TO_MPR[1070000000000000000000000000] = 1000000002143973196515069893; // 7.00%
        APR_TO_MPR[1072500000000000000000000000] = 1000000002217924427005028271; // 7.25%
        APR_TO_MPR[1075000000000000000000000000] = 1000000002291703477529814574; // 7.50%
        APR_TO_MPR[1077500000000000000000000000] = 1000000002365311147997420685; // 7.75%
        APR_TO_MPR[1080000000000000000000000000] = 1000000002438748232754475196; // 8.00%
        APR_TO_MPR[1082500000000000000000000000] = 1000000002512015520637678093; // 8.25%
        APR_TO_MPR[1085000000000000000000000000] = 1000000002585113795024642191; // 8.50%
        APR_TO_MPR[1087500000000000000000000000] = 1000000002658043833884149520; // 8.75%
        APR_TO_MPR[1090000000000000000000000000] = 1000000002730806409825830700; // 9.00%
        APR_TO_MPR[1092500000000000000000000000] = 1000000002803402290149275264; // 9.25%
        APR_TO_MPR[1095000000000000000000000000] = 1000000002875832236892580701; // 9.50%
        APR_TO_MPR[1097500000000000000000000000] = 1000000002948097006880347935; // 9.75%
        APR_TO_MPR[1100000000000000000000000000] = 1000000003020197351771130766; // 10.00%
        APR_TO_MPR[1102500000000000000000000000] = 1000000003092134018104346732; // 10.25%
        APR_TO_MPR[1105000000000000000000000000] = 1000000003163907747346656690; // 10.50%
        APR_TO_MPR[1107500000000000000000000000] = 1000000003235519275937820354; // 10.75%
        APR_TO_MPR[1110000000000000000000000000] = 1000000003306969335336034834; // 11.00%
        APR_TO_MPR[1112500000000000000000000000] = 1000000003378258652062763197; // 11.25%
        APR_TO_MPR[1115000000000000000000000000] = 1000000003449387947747059892; // 11.50%
        APR_TO_MPR[1117500000000000000000000000] = 1000000003520357939169399810; // 11.75%
        APR_TO_MPR[1120000000000000000000000000] = 1000000003591169338305017635; // 12.00%
        APR_TO_MPR[1122500000000000000000000000] = 1000000003661822852366764028; // 12.25%
        APR_TO_MPR[1125000000000000000000000000] = 1000000003732319183847485111; // 12.50%
        APR_TO_MPR[1127500000000000000000000000] = 1000000003802659030561931579; // 12.75%
        APR_TO_MPR[1130000000000000000000000000] = 1000000003872843085688203707; // 13.00%
        APR_TO_MPR[1132500000000000000000000000] = 1000000003942872037808738399; // 13.25%
        APR_TO_MPR[1135000000000000000000000000] = 1000000004012746570950844338; // 13.50%
        APR_TO_MPR[1137500000000000000000000000] = 1000000004082467364626791204; // 13.75%
        APR_TO_MPR[1140000000000000000000000000] = 1000000004152035093873458833; // 14.00%
        APR_TO_MPR[1142500000000000000000000000] = 1000000004221450429291552106; // 14.25%
        APR_TO_MPR[1145000000000000000000000000] = 1000000004290714037084387251; // 14.50%
        APR_TO_MPR[1147500000000000000000000000] = 1000000004359826579096255179; // 14.75%
        APR_TO_MPR[1150000000000000000000000000] = 1000000004428788712850367378; // 15.00%
        APR_TO_MPR[1152500000000000000000000000] = 1000000004497601091586389785; // 15.25%
        APR_TO_MPR[1155000000000000000000000000] = 1000000004566264364297570019; // 15.50%
        APR_TO_MPR[1157500000000000000000000000] = 1000000004634779175767463232; // 15.75%
        APR_TO_MPR[1160000000000000000000000000] = 1000000004703146166606261780; // 16.00%
        APR_TO_MPR[1162500000000000000000000000] = 1000000004771365973286733829; // 16.25%
        APR_TO_MPR[1165000000000000000000000000] = 1000000004839439228179775942; // 16.50%
        APR_TO_MPR[1167500000000000000000000000] = 1000000004907366559589584609; // 16.75%
        APR_TO_MPR[1170000000000000000000000000] = 1000000004975148591788451605; // 17.00%
        APR_TO_MPR[1172500000000000000000000000] = 1000000005042785945051188002; // 17.25%
        APR_TO_MPR[1175000000000000000000000000] = 1000000005110279235689181580; // 17.50%
        APR_TO_MPR[1177500000000000000000000000] = 1000000005177629076084092302; // 17.75%
        APR_TO_MPR[1180000000000000000000000000] = 1000000005244836074721190474; // 18.00%
        APR_TO_MPR[1182500000000000000000000000] = 1000000005311900836222342115; // 18.25%
        APR_TO_MPR[1185000000000000000000000000] = 1000000005378823961378646009; // 18.50%
        APR_TO_MPR[1187500000000000000000000000] = 1000000005445606047182726857; // 18.75%
        APR_TO_MPR[1190000000000000000000000000] = 1000000005512247686860688844; // 19.00%
        APR_TO_MPR[1192500000000000000000000000] = 1000000005578749469903733922; // 19.25%
        APR_TO_MPR[1195000000000000000000000000] = 1000000005645111982099449003; // 19.50%
        APR_TO_MPR[1197500000000000000000000000] = 1000000005711335805562766228; // 19.75%
        APR_TO_MPR[1200000000000000000000000000] = 1000000005777421518766600390; // 20.00%
        APR_TO_MPR[1202500000000000000000000000] = 1000000005843369696572167553; // 20.25%
        APR_TO_MPR[1205000000000000000000000000] = 1000000005909180910258988834; // 20.50%
        APR_TO_MPR[1207500000000000000000000000] = 1000000005974855727554583261; // 20.75%
        APR_TO_MPR[1210000000000000000000000000] = 1000000006040394712663853577; // 21.00%
        APR_TO_MPR[1212500000000000000000000000] = 1000000006105798426298168774; // 21.25%
        APR_TO_MPR[1215000000000000000000000000] = 1000000006171067425704147122; // 21.50%
        APR_TO_MPR[1217500000000000000000000000] = 1000000006236202264692143379; // 21.75%
        APR_TO_MPR[1220000000000000000000000000] = 1000000006301203493664443823; // 22.00%
        APR_TO_MPR[1222500000000000000000000000] = 1000000006366071659643172693; // 22.25%
        APR_TO_MPR[1225000000000000000000000000] = 1000000006430807306297913587; // 22.50%
        APR_TO_MPR[1227500000000000000000000000] = 1000000006495410973973049283; // 22.75%
        APR_TO_MPR[1230000000000000000000000000] = 1000000006559883199714823446; // 23.00%
        APR_TO_MPR[1232500000000000000000000000] = 1000000006624224517298127591; // 23.25%
        APR_TO_MPR[1235000000000000000000000000] = 1000000006688435457253016641; // 23.50%
        APR_TO_MPR[1237500000000000000000000000] = 1000000006752516546890956393; // 23.75%
        APR_TO_MPR[1240000000000000000000000000] = 1000000006816468310330806115; // 24.00%
        APR_TO_MPR[1242500000000000000000000000] = 1000000006880291268524539487; // 24.25%
        APR_TO_MPR[1245000000000000000000000000] = 1000000006943985939282707043; // 24.50%
        APR_TO_MPR[1247500000000000000000000000] = 1000000007007552837299643218; // 24.75%
        APR_TO_MPR[1250000000000000000000000000] = 1000000007070992474178421072; // 25.00%
        APR_TO_MPR[1252500000000000000000000000] = 1000000007134305358455557719; // 25.25%
        APR_TO_MPR[1255000000000000000000000000] = 1000000007197491995625473438; // 25.50%
        APR_TO_MPR[1257500000000000000000000000] = 1000000007260552888164707405; // 25.75%
        APR_TO_MPR[1260000000000000000000000000] = 1000000007323488535555892960; // 26.00%
        APR_TO_MPR[1262500000000000000000000000] = 1000000007386299434311495251; // 26.25%
        APR_TO_MPR[1265000000000000000000000000] = 1000000007448986077997314087; // 26.50%
        APR_TO_MPR[1267500000000000000000000000] = 1000000007511548957255754779; // 26.75%
        APR_TO_MPR[1270000000000000000000000000] = 1000000007573988559828869709; // 27.00%
        APR_TO_MPR[1272500000000000000000000000] = 1000000007636305370581173338; // 27.25%
        APR_TO_MPR[1275000000000000000000000000] = 1000000007698499871522233313; // 27.50%
        APR_TO_MPR[1277500000000000000000000000] = 1000000007760572541829040310; // 27.75%
        APR_TO_MPR[1280000000000000000000000000] = 1000000007822523857868159213; // 28.00%
        APR_TO_MPR[1282500000000000000000000000] = 1000000007884354293217664178; // 28.25%
        APR_TO_MPR[1285000000000000000000000000] = 1000000007946064318688860110; // 28.50%
        APR_TO_MPR[1287500000000000000000000000] = 1000000008007654402347793055; // 28.75%
        APR_TO_MPR[1290000000000000000000000000] = 1000000008069125009536551950; // 29.00%
        APR_TO_MPR[1292500000000000000000000000] = 1000000008130476602894364161; // 29.25%
        APR_TO_MPR[1295000000000000000000000000] = 1000000008191709642378487199; // 29.50%
        APR_TO_MPR[1297500000000000000000000000] = 1000000008252824585284898971; // 29.75%
        APR_TO_MPR[1300000000000000000000000000] = 1000000008313821886268788899; // 30.00%
        APR_TO_MPR[1302500000000000000000000000] = 1000000008374701997364852194; // 30.25%
        APR_TO_MPR[1305000000000000000000000000] = 1000000008435465368007389554; // 30.50%
        APR_TO_MPR[1307500000000000000000000000] = 1000000008496112445050214521; // 30.75%
        APR_TO_MPR[1310000000000000000000000000] = 1000000008556643672786370700; // 31.00%
        APR_TO_MPR[1312500000000000000000000000] = 1000000008617059492967661019; // 31.25%
        APR_TO_MPR[1315000000000000000000000000] = 1000000008677360344823991164; // 31.50%
        APR_TO_MPR[1317500000000000000000000000] = 1000000008737546665082529325; // 31.75%
        APR_TO_MPR[1320000000000000000000000000] = 1000000008797618887986684328; // 32.00%
        APR_TO_MPR[1322500000000000000000000000] = 1000000008857577445314904219; // 32.25%
        APR_TO_MPR[1325000000000000000000000000] = 1000000008917422766399297338; // 32.50%
        APR_TO_MPR[1327500000000000000000000000] = 1000000008977155278144077884; // 32.75%
        APR_TO_MPR[1330000000000000000000000000] = 1000000009036775405043837958; // 33.00%
        APR_TO_MPR[1332500000000000000000000000] = 1000000009096283569201648039; // 33.25%
        APR_TO_MPR[1335000000000000000000000000] = 1000000009155680190346987820; // 33.50%
        APR_TO_MPR[1337500000000000000000000000] = 1000000009214965685853509303; // 33.75%
        APR_TO_MPR[1340000000000000000000000000] = 1000000009274140470756634048; // 34.00%
        APR_TO_MPR[1342500000000000000000000000] = 1000000009333204957770986417; // 34.25%
        APR_TO_MPR[1345000000000000000000000000] = 1000000009392159557307664644; // 34.50%
        APR_TO_MPR[1347500000000000000000000000] = 1000000009451004677491351550; // 34.75%
        APR_TO_MPR[1350000000000000000000000000] = 1000000009509740724177266669; // 35.00%
        APR_TO_MPR[1352500000000000000000000000] = 1000000009568368100967961567; // 35.25%
        APR_TO_MPR[1355000000000000000000000000] = 1000000009626887209229960064; // 35.50%
        APR_TO_MPR[1357500000000000000000000000] = 1000000009685298448110245105; // 35.75%
        APR_TO_MPR[1360000000000000000000000000] = 1000000009743602214552593946; // 36.00%
        APR_TO_MPR[1362500000000000000000000000] = 1000000009801798903313763345; // 36.25%
        APR_TO_MPR[1365000000000000000000000000] = 1000000009859888906979526396; // 36.50%
        APR_TO_MPR[1367500000000000000000000000] = 1000000009917872615980562644; // 36.75%
        APR_TO_MPR[1370000000000000000000000000] = 1000000009975750418608203080; // 37.00%
        APR_TO_MPR[1372500000000000000000000000] = 1000000010033522701030031615; // 37.25%
        APR_TO_MPR[1375000000000000000000000000] = 1000000010091189847305344584; // 37.50%
        APR_TO_MPR[1377500000000000000000000000] = 1000000010148752239400469843; // 37.75%
        APR_TO_MPR[1380000000000000000000000000] = 1000000010206210257203946980; // 38.00%
        APR_TO_MPR[1382500000000000000000000000] = 1000000010263564278541570143; // 38.25%
        APR_TO_MPR[1385000000000000000000000000] = 1000000010320814679191294985; // 38.50%
        APR_TO_MPR[1387500000000000000000000000] = 1000000010377961832898011189; // 38.75%
        APR_TO_MPR[1390000000000000000000000000] = 1000000010435006111388182026; // 39.00%
        APR_TO_MPR[1392500000000000000000000000] = 1000000010491947884384352383; // 39.25%
        APR_TO_MPR[1395000000000000000000000000] = 1000000010548787519619526667; // 39.50%
        APR_TO_MPR[1397500000000000000000000000] = 1000000010605525382851418002; // 39.75%
        APR_TO_MPR[1400000000000000000000000000] = 1000000010662161837876570072; // 40.00%
        APR_TO_MPR[1402500000000000000000000000] = 1000000010718697246544353004; // 40.25%
        APR_TO_MPR[1405000000000000000000000000] = 1000000010775131968770834609; // 40.50%
        APR_TO_MPR[1407500000000000000000000000] = 1000000010831466362552528328; // 40.75%
        APR_TO_MPR[1410000000000000000000000000] = 1000000010887700783980019193; // 41.00%
        APR_TO_MPR[1412500000000000000000000000] = 1000000010943835587251469092; // 41.25%
        APR_TO_MPR[1415000000000000000000000000] = 1000000010999871124686002626; // 41.50%
        APR_TO_MPR[1417500000000000000000000000] = 1000000011055807746736974826; // 41.75%
        APR_TO_MPR[1420000000000000000000000000] = 1000000011111645802005121961; // 42.00%
        APR_TO_MPR[1422500000000000000000000000] = 1000000011167385637251596698; // 42.25%
        APR_TO_MPR[1425000000000000000000000000] = 1000000011223027597410888807; // 42.50%
        APR_TO_MPR[1427500000000000000000000000] = 1000000011278572025603632633; // 42.75%
        APR_TO_MPR[1430000000000000000000000000] = 1000000011334019263149302510; // 43.00%
        APR_TO_MPR[1432500000000000000000000000] = 1000000011389369649578797302; // 43.25%
        APR_TO_MPR[1435000000000000000000000000] = 1000000011444623522646915227; // 43.50%
        APR_TO_MPR[1437500000000000000000000000] = 1000000011499781218344720109; // 43.75%
        APR_TO_MPR[1440000000000000000000000000] = 1000000011554843070911800186; // 44.00%
        APR_TO_MPR[1442500000000000000000000000] = 1000000011609809412848420607; // 44.25%
        APR_TO_MPR[1445000000000000000000000000] = 1000000011664680574927570703; // 44.50%
        APR_TO_MPR[1447500000000000000000000000] = 1000000011719456886206907135; // 44.75%
        APR_TO_MPR[1450000000000000000000000000] = 1000000011774138674040594002; // 45.00%
        APR_TO_MPR[1452500000000000000000000000] = 1000000011828726264091040952; // 45.25%
        APR_TO_MPR[1455000000000000000000000000] = 1000000011883219980340540382; // 45.50%
        APR_TO_MPR[1457500000000000000000000000] = 1000000011937620145102804729; // 45.75%
        APR_TO_MPR[1460000000000000000000000000] = 1000000011991927079034404914; // 46.00%
        APR_TO_MPR[1462500000000000000000000000] = 1000000012046141101146110928; // 46.25%
        APR_TO_MPR[1465000000000000000000000000] = 1000000012100262528814135573; // 46.50%
        APR_TO_MPR[1467500000000000000000000000] = 1000000012154291677791282354; // 46.75%
        APR_TO_MPR[1470000000000000000000000000] = 1000000012208228862217998492; // 47.00%
        APR_TO_MPR[1472500000000000000000000000] = 1000000012262074394633334024; // 47.25%
        APR_TO_MPR[1475000000000000000000000000] = 1000000012315828585985807959; // 47.50%
        APR_TO_MPR[1477500000000000000000000000] = 1000000012369491745644182422; // 47.75%
        APR_TO_MPR[1480000000000000000000000000] = 1000000012423064181408145716; // 48.00%
        APR_TO_MPR[1482500000000000000000000000] = 1000000012476546199518905245; // 48.25%
        APR_TO_MPR[1485000000000000000000000000] = 1000000012529938104669691187; // 48.50%
        APR_TO_MPR[1487500000000000000000000000] = 1000000012583240200016171826; // 48.75%
        APR_TO_MPR[1490000000000000000000000000] = 1000000012636452787186781437; // 49.00%
        APR_TO_MPR[1492500000000000000000000000] = 1000000012689576166292961599; // 49.25%
        APR_TO_MPR[1495000000000000000000000000] = 1000000012742610635939316808; // 49.50%
        APR_TO_MPR[1497500000000000000000000000] = 1000000012795556493233685242; // 49.75%
        APR_TO_MPR[1500000000000000000000000000] = 1000000012848414033797125542; // 50.00%
    }
}
