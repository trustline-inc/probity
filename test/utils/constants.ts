import { ethers, web3 } from "hardhat";
import { BigNumber } from "ethers";

const errorTypes = {
  ISSUER_EXISTS: "An issuer already exists with this address.",
  ISSUER_NON_EXISTENT: "The issuer does not exist.",
  ISSUER_NOT_PENDING: "The issuer is not in the PENDING state.",
  ONLY_ORIGINAL_SENDER: "Only the originating account can cancel this issuer.",
  NON_ZERO_AMOUNT: "Amount must be greater than zero.",
  AUR_NO_BALANCE: "ERC20: transfer amount exceeds balance",
  TX_ID_ALREADY_PROVEN: "The provided transaction has already been proved.",
  TX_ID_ALREADY_REDEEMED:
    "This transaction ID has already been used to redeem tokens.",
  TWO_HOURS_NOT_PASSED:
    "The previous redemption reservation for these parameters was submitted less than 2 hours ago.",
  NON_ZERO_DESTINATION_ADDRESS:
    "Destination address cannot be the zero address.",
  ONLY_REDEEMER:
    "Only the reservation holder can submit a redemption transaction.",
  PAYMENT_NOT_PROVEN: "The state connector did not prove this transaction.",
};
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
const BYTES32_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const WAD = ethers.BigNumber.from("1000000000000000000");
const RAY = ethers.BigNumber.from("1000000000000000000000000000");
const RAD = ethers.BigNumber.from(
  "1000000000000000000000000000000000000000000000"
);

const ASSET_ID = {
  FLR: web3.utils.keccak256("FLR"),
  FXRP: web3.utils.keccak256("FXRP"),
  USD: web3.utils.keccak256("USD"),
};

const ASSET_CATEGORY = {
  UNSUPPORTED: 0,
  UNDERLYING: 1,
  COLLATERAL: 2,
  BOTH: 3,
};

const bytes32 = (string: string) => ethers.utils.formatBytes32String(string);

const MAX_APR: BigNumber = WAD.mul(2).mul(1e9);

const APR_TO_MPR: { [key: string]: string } = {
  "1010000000000000000000000000": "1000000000315313692301234303", // 1.00%
  "1012500000000000000000000000": "1000000000393654312242017571", // 1.25%
  "1015000000000000000000000000": "1000000000471801736875857029", // 1.50%
  "1017500000000000000000000000": "1000000000549756916734594761", // 1.75%
  "1020000000000000000000000000": "1000000000627520795352278394", // 2.00%
  "1022500000000000000000000000": "1000000000705094309333683125", // 2.25%
  "1025000000000000000000000000": "1000000000782478388421997087", // 2.50%
  "1027500000000000000000000000": "1000000000859673955565682292", // 2.75%
  "1030000000000000000000000000": "1000000000936681926984523164", // 3.00%
  "1032500000000000000000000000": "1000000001013503212234874483", // 3.25%
  "1035000000000000000000000000": "1000000001090138714274120352", // 3.50%
  "1037500000000000000000000000": "1000000001166589329524355614", // 3.75%
  "1040000000000000000000000000": "1000000001242855947935300940", // 4.00%
  "1042500000000000000000000000": "1000000001318939453046462641", // 4.25%
  "1045000000000000000000000000": "1000000001394840722048548034", // 4.50%
  "1047500000000000000000000000": "1000000001470560625844147065", // 4.75%
  "1050000000000000000000000000": "1000000001546100029107690659", // 5.00%
  "1052500000000000000000000000": "1000000001621459790344696131", // 5.25%
  "1055000000000000000000000000": "1000000001696640761950309801", // 5.50%
  "1057500000000000000000000000": "1000000001771643790267156794", // 5.75%
  "1060000000000000000000000000": "1000000001846469715642507847", // 6.00%
  "1062500000000000000000000000": "1000000001921119372484772765", // 6.25%
  "1065000000000000000000000000": "1000000001995593589319330025", // 6.50%
  "1067500000000000000000000000": "1000000002069893188843701885", // 6.75%
  "1070000000000000000000000000": "1000000002144018987982084147", // 7.00%
  "1072500000000000000000000000": "1000000002217971797939239645", // 7.25%
  "1075000000000000000000000000": "1000000002291752424253764334", // 7.50%
  "1077500000000000000000000000": "1000000002365361666850734716", // 7.75%
  "1080000000000000000000000000": "1000000002438800320093745215", // 8.00%
  "1082500000000000000000000000": "1000000002512069172836343970", // 8.25%
  "1085000000000000000000000000": "1000000002585169008472875354", // 8.50%
  "1087500000000000000000000000": "1000000002658100604988737430", // 8.75%
  "1090000000000000000000000000": "1000000002730864735010062389", // 9.00%
  "1092500000000000000000000000": "1000000002803462165852827922", // 9.25%
  "1095000000000000000000000000": "1000000002875893659571407301", // 9.50%
  "1097500000000000000000000000": "1000000002948159973006565881", // 9.75%
  "1100000000000000000000000000": "1000000003020261857832911555", // 10.00%
  "1102500000000000000000000000": "1000000003092200060605806619", // 10.25%
  "1105000000000000000000000000": "1000000003163975322807748344", // 10.50%
  "1107500000000000000000000000": "1000000003235588380894225489", // 10.75%
  "1110000000000000000000000000": "1000000003307039966339057816", // 11.00%
  "1112500000000000000000000000": "1000000003378330805679225600", // 11.25%
  "1115000000000000000000000000": "1000000003449461620559196008", // 11.50%
  "1117500000000000000000000000": "1000000003520433127774753091", // 11.75%
  "1120000000000000000000000000": "1000000003591246039316338059", // 12.00%
  "1122500000000000000000000000": "1000000003661901062411906388", // 12.25%
  "1125000000000000000000000000": "1000000003732398899569308199", // 12.50%
  "1127500000000000000000000000": "1000000003802740248618198274", // 12.75%
  "1130000000000000000000000000": "1000000003872925802751481942", // 13.00%
  "1132500000000000000000000000": "1000000003942956250566303007", // 13.25%
  "1135000000000000000000000000": "1000000004012832276104579762", // 13.50%
  "1137500000000000000000000000": "1000000004082554558893095064", // 13.75%
  "1140000000000000000000000000": "1000000004152123773983146339", // 14.00%
  "1142500000000000000000000000": "1000000004221540591989761311", // 14.25%
  "1145000000000000000000000000": "1000000004290805679130485127", // 14.50%
  "1147500000000000000000000000": "1000000004359919697263744520", // 14.75%
  "1150000000000000000000000000": "1000000004428883303926794507", // 15.00%
  "1152500000000000000000000000": "1000000004497697152373253066", // 15.25%
  "1155000000000000000000000000": "1000000004566361891610229161", // 15.50%
  "1157500000000000000000000000": "1000000004634878166435049377", // 15.75%
  "1160000000000000000000000000": "1000000004703246617471588367", // 16.00%
  "1162500000000000000000000000": "1000000004771467881206208227", // 16.25%
  "1165000000000000000000000000": "1000000004839542590023311841", // 16.50%
  "1167500000000000000000000000": "1000000004907471372240515162", // 16.75%
  "1170000000000000000000000000": "1000000004975254852143443313", // 17.00%
  "1172500000000000000000000000": "1000000005042893650020155337", // 17.25%
  "1175000000000000000000000000": "1000000005110388382195202332", // 17.50%
  "1177500000000000000000000000": "1000000005177739661063323648", // 17.75%
  "1180000000000000000000000000": "1000000005244948095122785756", // 18.00%
  "1182500000000000000000000000": "1000000005312014289008368325", // 18.25%
  "1185000000000000000000000000": "1000000005378938843524001974", // 18.50%
  "1187500000000000000000000000": "1000000005445722355675062105", // 18.75%
  "1190000000000000000000000000": "1000000005512365418700323162", // 19.00%
  "1192500000000000000000000000": "1000000005578868622103577582", // 19.25%
  "1195000000000000000000000000": "1000000005645232551684923663", // 19.50%
  "1197500000000000000000000000": "1000000005711457789571726488", // 19.75%
  "1200000000000000000000000000": "1000000005777544914249256005", // 20.00%
  "1202500000000000000000000000": "1000000005843494500591006294", // 20.25%
  "1205000000000000000000000000": "1000000005909307119888699989", // 20.50%
  "1207500000000000000000000000": "1000000005974983339881981772", // 20.75%
  "1210000000000000000000000000": "1000000006040523724787804801", // 21.00%
  "1212500000000000000000000000": "1000000006105928835329513869", // 21.25%
  "1215000000000000000000000000": "1000000006171199228765629046", // 21.50%
  "1217500000000000000000000000": "1000000006236335458918333496", // 21.75%
  "1220000000000000000000000000": "1000000006301338076201669114", // 22.00%
  "1222500000000000000000000000": "1000000006366207627649443562", // 22.25%
  "1225000000000000000000000000": "1000000006430944656942852255", // 22.50%
  "1227500000000000000000000000": "1000000006495549704437818769", // 22.75%
  "1230000000000000000000000000": "1000000006560023307192057126", // 23.00%
  "1232500000000000000000000000": "1000000006624365998991859323", // 23.25%
  "1235000000000000000000000000": "1000000006688578310378611466", // 23.50%
  "1237500000000000000000000000": "1000000006752660768675041790", // 23.75%
  "1240000000000000000000000000": "1000000006816613898011203811", // 24.00%
  "1242500000000000000000000000": "1000000006880438219350197820", // 24.25%
  "1245000000000000000000000000": "1000000006944134250513633867", // 24.50%
  "1247500000000000000000000000": "1000000007007702506206839342", // 24.75%
  "1250000000000000000000000000": "1000000007071143498043814243", // 25.00%
  "1252500000000000000000000000": "1000000007134457734571937120", // 25.25%
  "1255000000000000000000000000": "1000000007197645721296424717", // 25.50%
  "1257500000000000000000000000": "1000000007260707960704548217", // 25.75%
  "1260000000000000000000000000": "1000000007323644952289609024", // 26.00%
  "1262500000000000000000000000": "1000000007386457192574676912", // 26.25%
  "1265000000000000000000000000": "1000000007449145175136093379", // 26.50%
  "1267500000000000000000000000": "1000000007511709390626742988", // 26.75%
  "1270000000000000000000000000": "1000000007574150326799095427", // 27.00%
  "1272500000000000000000000000": "1000000007636468468528021002", // 27.25%
  "1275000000000000000000000000": "1000000007698664297833382230", // 27.50%
  "1277500000000000000000000000": "1000000007760738293902404158", // 27.75%
  "1280000000000000000000000000": "1000000007822690933111826016", // 28.00%
  "1282500000000000000000000000": "1000000007884522689049836744", // 28.25%
  "1285000000000000000000000000": "1000000007946234032537796945", // 28.50%
  "1287500000000000000000000000": "1000000008007825431651749725", // 28.75%
  "1290000000000000000000000000": "1000000008069297351743722903", // 29.00%
  "1292500000000000000000000000": "1000000008130650255462824997", // 29.25%
  "1295000000000000000000000000": "1000000008191884602776137390", // 29.50%
  "1297500000000000000000000000": "1000000008253000850989405021", // 29.75%
  "1300000000000000000000000000": "1000000008313999454767527939", // 30.00%
  "1302500000000000000000000000": "1000000008374880866154856015", // 30.25%
  "1305000000000000000000000000": "1000000008435645534595289067", // 30.50%
  "1307500000000000000000000000": "1000000008496293906952184641", // 30.75%
  "1310000000000000000000000000": "1000000008556826427528075655", // 31.00%
  "1312500000000000000000000000": "1000000008617243538084200071", // 31.25%
  "1315000000000000000000000000": "1000000008677545677859844746", // 31.50%
  "1317500000000000000000000000": "1000000008737733283591505590", // 31.75%
  "1320000000000000000000000000": "1000000008797806789531866097", // 32.00%
  "1322500000000000000000000000": "1000000008857766627468596335", // 32.25%
  "1325000000000000000000000000": "1000000008917613226742974415", // 32.50%
  "1327500000000000000000000000": "1000000008977347014268332454", // 32.75%
  "1330000000000000000000000000": "1000000009036968414548329005", // 33.00%
  "1332500000000000000000000000": "1000000009096477849695049921", // 33.25%
  "1335000000000000000000000000": "1000000009155875739446939570", // 33.50%
  "1337500000000000000000000000": "1000000009215162501186564317", // 33.75%
  "1340000000000000000000000000": "1000000009274338549958210141", // 34.00%
  "1342500000000000000000000000": "1000000009333404298485316258", // 34.25%
  "1345000000000000000000000000": "1000000009392360157187746553", // 34.50%
  "1347500000000000000000000000": "1000000009451206534198900668", // 34.75%
  "1350000000000000000000000000": "1000000009509943835382666485", // 35.00%
  "1352500000000000000000000000": "1000000009568572464350215803", // 35.25%
  "1355000000000000000000000000": "1000000009627092822476644921", // 35.50%
  "1357500000000000000000000000": "1000000009685505308917461855", // 35.75%
  "1360000000000000000000000000": "1000000009743810320624921877", // 36.00%
  "1362500000000000000000000000": "1000000009802008252364213048", // 36.25%
  "1365000000000000000000000000": "1000000009860099496729493398", // 36.50%
  "1367500000000000000000000000": "1000000009918084444159781378", // 36.75%
  "1370000000000000000000000000": "1000000009975963482954701196", // 37.00%
  "1372500000000000000000000000": "1000000010033736999290084615", // 37.25%
  "1375000000000000000000000000": "1000000010091405377233430797", // 37.50%
  "1377500000000000000000000000": "1000000010148968998759225722", // 37.75%
  "1380000000000000000000000000": "1000000010206428243764122721", // 38.00%
  "1382500000000000000000000000": "1000000010263783490081985632", // 38.25%
  "1385000000000000000000000000": "1000000010321035113498796060", // 38.50%
  "1387500000000000000000000000": "1000000010378183487767426215", // 38.75%
  "1390000000000000000000000000": "1000000010435228984622278786", // 39.00%
  "1392500000000000000000000000": "1000000010492171973793795278", // 39.25%
  "1395000000000000000000000000": "1000000010549012823022834223", // 39.50%
  "1397500000000000000000000000": "1000000010605751898074920680", // 39.75%
  "1400000000000000000000000000": "1000000010662389562754368383", // 40.00%
  "1402500000000000000000000000": "1000000010718926178918275921", // 40.25%
  "1405000000000000000000000000": "1000000010775362106490398271", // 40.50%
  "1407500000000000000000000000": "1000000010831697703474895048", // 40.75%
  "1410000000000000000000000000": "1000000010887933325969956745", // 41.00%
  "1412500000000000000000000000": "1000000010944069328181310294", // 41.25%
  "1415000000000000000000000000": "1000000011000106062435605211", // 41.50%
  "1417500000000000000000000000": "1000000011056043879193681585", // 41.75%
  "1420000000000000000000000000": "1000000011111883127063721182", // 42.00%
  "1422500000000000000000000000": "1000000011167624152814282870", // 42.25%
  "1425000000000000000000000000": "1000000011223267301387223610", // 42.50%
  "1427500000000000000000000000": "1000000011278812915910506194", // 42.75%
  "1430000000000000000000000000": "1000000011334261337710894934", // 43.00%
  "1432500000000000000000000000": "1000000011389612906326540473", // 43.25%
  "1435000000000000000000000000": "1000000011444867959519454873", // 43.50%
  "1437500000000000000000000000": "1000000011500026833287878129", // 43.75%
  "1440000000000000000000000000": "1000000011555089861878537246", // 44.00%
  "1442500000000000000000000000": "1000000011610057377798798988", // 44.25%
  "1445000000000000000000000000": "1000000011664929711828717411", // 44.50%
  "1447500000000000000000000000": "1000000011719707193032977264", // 44.75%
  "1450000000000000000000000000": "1000000011774390148772734350", // 45.00%
  "1452500000000000000000000000": "1000000011828978904717353889", // 45.25%
  "1455000000000000000000000000": "1000000011883473784856047964", // 45.50%
  "1457500000000000000000000000": "1000000011937875111509413063", // 45.75%
  "1460000000000000000000000000": "1000000011992183205340868762", // 46.00%
  "1462500000000000000000000000": "1000000012046398385367998555", // 46.25%
  "1465000000000000000000000000": "1000000012100520968973793839", // 46.50%
  "1467500000000000000000000000": "1000000012154551271917802039", // 46.75%
  "1470000000000000000000000000": "1000000012208489608347179856", // 47.00%
  "1472500000000000000000000000": "1000000012262336290807652611", // 47.25%
  "1475000000000000000000000000": "1000000012316091630254380619", // 47.50%
  "1477500000000000000000000000": "1000000012369755936062733574", // 47.75%
  "1480000000000000000000000000": "1000000012423329516038973834", // 48.00%
  "1482500000000000000000000000": "1000000012476812676430849574", // 48.25%
  "1485000000000000000000000000": "1000000012530205721938098677", // 48.50%
  "1487500000000000000000000000": "1000000012583508955722864294", // 48.75%
  "1490000000000000000000000000": "1000000012636722679420022951", // 49.00%
  "1492500000000000000000000000": "1000000012689847193147426073", // 49.25%
  "1495000000000000000000000000": "1000000012742882795516055821", // 49.50%
  "1497500000000000000000000000": "1000000012795829783640096070", // 49.75%
  "1500000000000000000000000000": "1000000012848688453146919403", // 50.00%
  "1502500000000000000000000000": "1000000012901459098186990940", // 50.25%
  "1505000000000000000000000000": "1000000012954142011443689847", // 50.50%
  "1507500000000000000000000000": "1000000013006737484143049339", // 50.75%
  "1510000000000000000000000000": "1000000013059245806063415983", // 51.00%
  "1512500000000000000000000000": "1000000013111667265545029106", // 51.25%
  "1515000000000000000000000000": "1000000013164002149499521104", // 51.50%
  "1517500000000000000000000000": "1000000013216250743419339427", // 51.75%
  "1520000000000000000000000000": "1000000013268413331387091017", // 52.00%
  "1522500000000000000000000000": "1000000013320490196084809961", // 52.25%
  "1525000000000000000000000000": "1000000013372481618803149124", // 52.50%
  "1527500000000000000000000000": "1000000013424387879450496495", // 52.75%
  "1530000000000000000000000000": "1000000013476209256562016996", // 53.00%
  "1532500000000000000000000000": "1000000013527946027308620478", // 53.25%
  "1535000000000000000000000000": "1000000013579598467505856634", // 53.50%
  "1537500000000000000000000000": "1000000013631166851622737525", // 53.75%
  "1540000000000000000000000000": "1000000013682651452790488449", // 54.00%
  "1542500000000000000000000000": "1000000013734052542811227830", // 54.25%
  "1545000000000000000000000000": "1000000013785370392166576827", // 54.50%
  "1547500000000000000000000000": "1000000013836605270026199342", // 54.75%
  "1550000000000000000000000000": "1000000013887757444256273098", // 55.00%
  "1552500000000000000000000000": "1000000013938827181427892466", // 55.25%
  "1555000000000000000000000000": "1000000013989814746825403680", // 55.50%
  "1557500000000000000000000000": "1000000014040720404454673106", // 55.75%
  "1560000000000000000000000000": "1000000014091544417051289211", // 56.00%
  "1562500000000000000000000000": "1000000014142287046088698856", // 56.25%
  "1565000000000000000000000000": "1000000014192948551786278555", // 56.50%
  "1567500000000000000000000000": "1000000014243529193117341317", // 56.75%
  "1570000000000000000000000000": "1000000014294029227817079688", // 57.00%
  "1572500000000000000000000000": "1000000014344448912390445603", // 57.25%
  "1575000000000000000000000000": "1000000014394788502119967654", // 57.50%
  "1577500000000000000000000000": "1000000014445048251073506355", // 57.75%
  "1580000000000000000000000000": "1000000014495228412111948012", // 58.00%
  "1582500000000000000000000000": "1000000014545329236896837772", // 58.25%
  "1585000000000000000000000000": "1000000014595350975897952419", // 58.50%
  "1587500000000000000000000000": "1000000014645293878400813507", // 58.75%
  "1590000000000000000000000000": "1000000014695158192514141366", // 59.00%
  "1592500000000000000000000000": "1000000014744944165177250566", // 59.25%
  "1595000000000000000000000000": "1000000014794652042167387371", // 59.50%
  "1597500000000000000000000000": "1000000014844282068107009737", // 59.75%
  "1600000000000000000000000000": "1000000014893834486471010388", // 60.00%
  "1602500000000000000000000000": "1000000014943309539593883506", // 60.25%
  "1605000000000000000000000000": "1000000014992707468676835564", // 60.50%
  "1607500000000000000000000000": "1000000015042028513794840825", // 60.75%
  "1610000000000000000000000000": "1000000015091272913903642006", // 61.00%
  "1612500000000000000000000000": "1000000015140440906846696649", // 61.25%
  "1615000000000000000000000000": "1000000015189532729362069675", // 61.50%
  "1617500000000000000000000000": "1000000015238548617089272631", // 61.75%
  "1620000000000000000000000000": "1000000015287488804576050131", // 62.00%
  "1622500000000000000000000000": "1000000015336353525285113964", // 62.25%
  "1625000000000000000000000000": "1000000015385143011600825370", // 62.50%
  "1627500000000000000000000000": "1000000015433857494835825947", // 62.75%
  "1630000000000000000000000000": "1000000015482497205237617670", // 63.00%
  "1632500000000000000000000000": "1000000015531062371995092493", // 63.25%
  "1635000000000000000000000000": "1000000015579553223245011981", // 63.50%
  "1637500000000000000000000000": "1000000015627969986078437456", // 63.75%
  "1640000000000000000000000000": "1000000015676312886547111082", // 64.00%
  "1642500000000000000000000000": "1000000015724582149669788361", // 64.25%
  "1645000000000000000000000000": "1000000015772777999438522464", // 64.50%
  "1647500000000000000000000000": "1000000015820900658824900854", // 64.75%
  "1650000000000000000000000000": "1000000015868950349786234617", // 65.00%
  "1652500000000000000000000000": "1000000015916927293271700949", // 65.25%
  "1655000000000000000000000000": "1000000015964831709228439204", // 65.50%
  "1657500000000000000000000000": "1000000016012663816607600944", // 65.75%
  "1660000000000000000000000000": "1000000016060423833370354390", // 66.00%
  "1662500000000000000000000000": "1000000016108111976493843696", // 66.25%
  "1665000000000000000000000000": "1000000016155728461977103449", // 66.50%
  "1667500000000000000000000000": "1000000016203273504846928801", // 66.75%
  "1670000000000000000000000000": "1000000016250747319163701627", // 67.00%
  "1672500000000000000000000000": "1000000016298150118027173105", // 67.25%
  "1675000000000000000000000000": "1000000016345482113582203121", // 67.50%
  "1677500000000000000000000000": "1000000016392743517024456858", // 67.75%
  "1680000000000000000000000000": "1000000016439934538606058981", // 68.00%
  "1682500000000000000000000000": "1000000016487055387641205779", // 68.25%
  "1685000000000000000000000000": "1000000016534106272511735642", // 68.50%
  "1687500000000000000000000000": "1000000016581087400672658247", // 68.75%
  "1690000000000000000000000000": "1000000016627998978657642812", // 69.00%
  "1692500000000000000000000000": "1000000016674841212084465797", // 69.25%
  "1695000000000000000000000000": "1000000016721614305660418388", // 69.50%
  "1697500000000000000000000000": "1000000016768318463187674138", // 69.75%
  "1700000000000000000000000000": "1000000016814953887568617116", // 70.00%
  "1702500000000000000000000000": "1000000016861520780811130896", // 70.25%
  "1705000000000000000000000000": "1000000016908019344033848754", // 70.50%
  "1707500000000000000000000000": "1000000016954449777471365390", // 70.75%
  "1710000000000000000000000000": "1000000017000812280479410534", // 71.00%
  "1712500000000000000000000000": "1000000017047107051539984759", // 71.25%
  "1715000000000000000000000000": "1000000017093334288266457828", // 71.50%
  "1717500000000000000000000000": "1000000017139494187408629914", // 71.75%
  "1720000000000000000000000000": "1000000017185586944857756014", // 72.00%
  "1722500000000000000000000000": "1000000017231612755651533860", // 72.25%
  "1725000000000000000000000000": "1000000017277571813979055678", // 72.50%
  "1727500000000000000000000000": "1000000017323464313185724082", // 72.75%
  "1730000000000000000000000000": "1000000017369290445778132416", // 73.00%
  "1732500000000000000000000000": "1000000017415050403428909875", // 73.25%
  "1735000000000000000000000000": "1000000017460744376981531676", // 73.50%
  "1737500000000000000000000000": "1000000017506372556455094615", // 73.75%
  "1740000000000000000000000000": "1000000017551935131049058277", // 74.00%
  "1742500000000000000000000000": "1000000017597432289147952223", // 74.25%
  "1745000000000000000000000000": "1000000017642864218326049421", // 74.50%
  "1747500000000000000000000000": "1000000017688231105352006240", // 74.75%
  "1750000000000000000000000000": "1000000017733533136193469257", // 75.00%
  "1752500000000000000000000000": "1000000017778770496021649202", // 75.25%
  "1755000000000000000000000000": "1000000017823943369215862287", // 75.50%
  "1757500000000000000000000000": "1000000017869051939368039217", // 75.75%
  "1760000000000000000000000000": "1000000017914096389287202160", // 76.00%
  "1762500000000000000000000000": "1000000017959076901003909933", // 76.25%
  "1765000000000000000000000000": "1000000018003993655774671690", // 76.50%
  "1767500000000000000000000000": "1000000018048846834086329372", // 76.75%
  "1770000000000000000000000000": "1000000018093636615660409186", // 77.00%
  "1772500000000000000000000000": "1000000018138363179457442379", // 77.25%
  "1775000000000000000000000000": "1000000018183026703681255550", // 77.50%
  "1777500000000000000000000000": "1000000018227627365783230786", // 77.75%
  "1780000000000000000000000000": "1000000018272165342466535849", // 78.00%
  "1782500000000000000000000000": "1000000018316640809690324680", // 78.25%
  "1785000000000000000000000000": "1000000018361053942673908470", // 78.50%
  "1787500000000000000000000000": "1000000018405404915900897541", // 78.75%
  "1790000000000000000000000000": "1000000018449693903123314278", // 79.00%
  "1792500000000000000000000000": "1000000018493921077365677369", // 79.25%
  "1795000000000000000000000000": "1000000018538086610929057574", // 79.50%
  "1797500000000000000000000000": "1000000018582190675395105274", // 79.75%
  "1800000000000000000000000000": "1000000018626233441630050036", // 80.00%
  "1802500000000000000000000000": "1000000018670215079788672412", // 80.25%
  "1805000000000000000000000000": "1000000018714135759318248225", // 80.50%
  "1807500000000000000000000000": "1000000018757995648962465550", // 80.75%
  "1810000000000000000000000000": "1000000018801794916765314628", // 81.00%
  "1812500000000000000000000000": "1000000018845533730074950937", // 81.25%
  "1815000000000000000000000000": "1000000018889212255547531638", // 81.50%
  "1817500000000000000000000000": "1000000018932830659151025616", // 81.75%
  "1820000000000000000000000000": "1000000018976389106168997334", // 82.00%
  "1822500000000000000000000000": "1000000019019887761204364722", // 82.25%
  "1825000000000000000000000000": "1000000019063326788183131305", // 82.50%
  "1827500000000000000000000000": "1000000019106706350358092786", // 82.75%
  "1830000000000000000000000000": "1000000019150026610312518297", // 83.00%
  "1832500000000000000000000000": "1000000019193287729963806517", // 83.25%
  "1835000000000000000000000000": "1000000019236489870567116872", // 83.50%
  "1837500000000000000000000000": "1000000019279633192718976015", // 83.75%
  "1840000000000000000000000000": "1000000019322717856360859784", // 84.00%
  "1842500000000000000000000000": "1000000019365744020782750853", // 84.25%
  "1845000000000000000000000000": "1000000019408711844626672249", // 84.50%
  "1847500000000000000000000000": "1000000019451621485890196962", // 84.75%
  "1850000000000000000000000000": "1000000019494473101929933809", // 85.00%
  "1852500000000000000000000000": "1000000019537266849464989774", // 85.25%
  "1855000000000000000000000000": "1000000019580002884580408993", // 85.50%
  "1857500000000000000000000000": "1000000019622681362730588581", // 85.75%
  "1860000000000000000000000000": "1000000019665302438742671496", // 86.00%
  "1862500000000000000000000000": "1000000019707866266819916605", // 86.25%
  "1865000000000000000000000000": "1000000019750373000545046158", // 86.50%
  "1867500000000000000000000000": "1000000019792822792883570832", // 86.75%
  "1870000000000000000000000000": "1000000019835215796187092539", // 87.00%
  "1872500000000000000000000000": "1000000019877552162196585172", // 87.25%
  "1875000000000000000000000000": "1000000019919832042045653461", // 87.50%
  "1877500000000000000000000000": "1000000019962055586263770117", // 87.75%
  "1880000000000000000000000000": "1000000020004222944779491447", // 88.00%
  "1882500000000000000000000000": "1000000020046334266923651589", // 88.25%
  "1885000000000000000000000000": "1000000020088389701432535566", // 88.50%
  "1887500000000000000000000000": "1000000020130389396451031298", // 88.75%
  "1890000000000000000000000000": "1000000020172333499535760762", // 89.00%
  "1892500000000000000000000000": "1000000020214222157658190458", // 89.25%
  "1895000000000000000000000000": "1000000020256055517207721341", // 89.50%
  "1897500000000000000000000000": "1000000020297833723994758380", // 89.75%
  "1900000000000000000000000000": "1000000020339556923253759918", // 90.00%
  "1902500000000000000000000000": "1000000020381225259646266977", // 90.25%
  "1905000000000000000000000000": "1000000020422838877263912677", // 90.50%
  "1907500000000000000000000000": "1000000020464397919631411916", // 90.75%
  "1910000000000000000000000000": "1000000020505902529709531476", // 91.00%
  "1912500000000000000000000000": "1000000020547352849898040702", // 91.25%
  "1915000000000000000000000000": "1000000020588749022038642907", // 91.50%
  "1917500000000000000000000000": "1000000020630091187417887658", // 91.75%
  "1920000000000000000000000000": "1000000020671379486770064084", // 92.00%
  "1922500000000000000000000000": "1000000020712614060280075367", // 92.25%
  "1925000000000000000000000000": "1000000020753795047586294549", // 92.50%
  "1927500000000000000000000000": "1000000020794922587783401809", // 92.75%
  "1930000000000000000000000000": "1000000020835996819425203353", // 93.00%
  "1932500000000000000000000000": "1000000020877017880527432059", // 93.25%
  "1935000000000000000000000000": "1000000020917985908570530015", // 93.50%
  "1937500000000000000000000000": "1000000020958901040502413096", // 93.75%
  "1940000000000000000000000000": "1000000020999763412741217717", // 94.00%
  "1942500000000000000000000000": "1000000021040573161178029899", // 94.25%
  "1945000000000000000000000000": "1000000021081330421179596782", // 94.50%
  "1947500000000000000000000000": "1000000021122035327591020728", // 94.75%
  "1950000000000000000000000000": "1000000021162688014738436137", // 95.00%
  "1952500000000000000000000000": "1000000021203288616431669119", // 95.25%
  "1955000000000000000000000000": "1000000021243837265966880152", // 95.50%
  "1957500000000000000000000000": "1000000021284334096129189846", // 95.75%
  "1960000000000000000000000000": "1000000021324779239195287955", // 96.00%
  "1962500000000000000000000000": "1000000021365172826936025766", // 96.25%
  "1965000000000000000000000000": "1000000021405514990618991974", // 96.50%
  "1967500000000000000000000000": "1000000021445805861011072192", // 96.75%
  "1970000000000000000000000000": "1000000021486045568380992206", // 97.00%
  "1972500000000000000000000000": "1000000021526234242501845103", // 97.25%
  "1975000000000000000000000000": "1000000021566372012653602394", // 97.50%
  "1977500000000000000000000000": "1000000021606459007625609257", // 97.75%
  "1980000000000000000000000000": "1000000021646495355719064010", // 98.00%
  "1982500000000000000000000000": "1000000021686481184749481951", // 98.25%
  "1985000000000000000000000000": "1000000021726416622049143662", // 98.50%
  "1987500000000000000000000000": "1000000021766301794469527915", // 98.75%
  "1990000000000000000000000000": "1000000021806136828383729277", // 99.00%
  "1992500000000000000000000000": "1000000021845921849688860548", // 99.25%
  "1995000000000000000000000000": "1000000021885656983808440129", // 99.50%
  "1997500000000000000000000000": "1000000021925342355694764442", // 99.75%
  "2000000000000000000000000000": "1000000021964978089831265521", // 100.00%
};

export {
  errorTypes,
  APR_TO_MPR,
  MAX_APR,
  ADDRESS_ZERO,
  BYTES32_ZERO,
  WAD,
  RAD,
  RAY,
  bytes32,
  ASSET_ID,
  ASSET_CATEGORY,
};
