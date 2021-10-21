// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract HighAPR {
    // Follows R^(1/31557600) * (1-U) * f(1/31557600) = 1
    ///////////////////////////////////
    // State Variables
    ///////////////////////////////////
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
        APR_TO_MPR[1502500000000000000000000000] = 1000000012901183551773820430; // 50.25%
        APR_TO_MPR[1505000000000000000000000000] = 1000000012953865339840898008; // 50.50%
        APR_TO_MPR[1507500000000000000000000000] = 1000000013006459689218171553; // 50.75%
        APR_TO_MPR[1510000000000000000000000000] = 1000000013058966889677798610; // 51.00%
        APR_TO_MPR[1512500000000000000000000000] = 1000000013111387229553860204; // 51.25%
        APR_TO_MPR[1515000000000000000000000000] = 1000000013163720995751860937; // 51.50%
        APR_TO_MPR[1517500000000000000000000000] = 1000000013215968473758150778; // 51.75%
        APR_TO_MPR[1520000000000000000000000000] = 1000000013268129947649269296; // 52.00%
        APR_TO_MPR[1522500000000000000000000000] = 1000000013320205700101213121; // 52.25%
        APR_TO_MPR[1525000000000000000000000000] = 1000000013372196012398627377; // 52.50%
        APR_TO_MPR[1527500000000000000000000000] = 1000000013424101164443921834; // 52.75%
        APR_TO_MPR[1530000000000000000000000000] = 1000000013475921434766312523; // 53.00%
        APR_TO_MPR[1532500000000000000000000000] = 1000000013527657100530789544; // 53.25%
        APR_TO_MPR[1535000000000000000000000000] = 1000000013579308437547011783; // 53.50%
        APR_TO_MPR[1537500000000000000000000000] = 1000000013630875720278129256; // 53.75%
        APR_TO_MPR[1540000000000000000000000000] = 1000000013682359221849533786; // 54.00%
        APR_TO_MPR[1542500000000000000000000000] = 1000000013733759214057538711; // 54.25%
        APR_TO_MPR[1545000000000000000000000000] = 1000000013785075967377988304; // 54.50%
        APR_TO_MPR[1547500000000000000000000000] = 1000000013836309750974797604; // 54.75%
        APR_TO_MPR[1550000000000000000000000000] = 1000000013887460832708423310; // 55.00%
        APR_TO_MPR[1552500000000000000000000000] = 1000000013938529479144266429; // 55.25%
        APR_TO_MPR[1555000000000000000000000000] = 1000000013989515955561007311; // 55.50%
        APR_TO_MPR[1557500000000000000000000000] = 1000000014040420525958873748; // 55.75%
        APR_TO_MPR[1560000000000000000000000000] = 1000000014091243453067842758; // 56.00%
        APR_TO_MPR[1562500000000000000000000000] = 1000000014141984998355776714; // 56.25%
        APR_TO_MPR[1565000000000000000000000000] = 1000000014192645422036494424; // 56.50%
        APR_TO_MPR[1567500000000000000000000000] = 1000000014243224983077777803; // 56.75%
        APR_TO_MPR[1570000000000000000000000000] = 1000000014293723939209314749; // 57.00%
        APR_TO_MPR[1572500000000000000000000000] = 1000000014344142546930578824; // 57.25%
        APR_TO_MPR[1575000000000000000000000000] = 1000000014394481061518646352; // 57.50%
        APR_TO_MPR[1577500000000000000000000000] = 1000000014444739737035951526; // 57.75%
        APR_TO_MPR[1580000000000000000000000000] = 1000000014494918826337980107; // 58.00%
        APR_TO_MPR[1582500000000000000000000000] = 1000000014545018581080902311; // 58.25%
        APR_TO_MPR[1585000000000000000000000000] = 1000000014595039251729145449; // 58.50%
        APR_TO_MPR[1587500000000000000000000000] = 1000000014644981087562906888; // 58.75%
        APR_TO_MPR[1590000000000000000000000000] = 1000000014694844336685607911; // 59.00%
        APR_TO_MPR[1592500000000000000000000000] = 1000000014744629246031289016; // 59.25%
        APR_TO_MPR[1595000000000000000000000000] = 1000000014794336061371947211; // 59.50%
        APR_TO_MPR[1597500000000000000000000000] = 1000000014843965027324815863; // 59.75%
        APR_TO_MPR[1600000000000000000000000000] = 1000000014893516387359587614; // 60.00%
        APR_TO_MPR[1602500000000000000000000000] = 1000000014942990383805580922; // 60.25%
        APR_TO_MPR[1605000000000000000000000000] = 1000000014992387257858850741; // 60.50%
        APR_TO_MPR[1607500000000000000000000000] = 1000000015041707249589243866; // 60.75%
        APR_TO_MPR[1610000000000000000000000000] = 1000000015090950597947399453; // 61.00%
        APR_TO_MPR[1612500000000000000000000000] = 1000000015140117540771695238; // 61.25%
        APR_TO_MPR[1615000000000000000000000000] = 1000000015189208314795139945; // 61.50%
        APR_TO_MPR[1617500000000000000000000000] = 1000000015238223155652212386; // 61.75%
        APR_TO_MPR[1620000000000000000000000000] = 1000000015287162297885647757; // 62.00%
        APR_TO_MPR[1622500000000000000000000000] = 1000000015336025974953171607; // 62.25%
        APR_TO_MPR[1625000000000000000000000000] = 1000000015384814419234181961; // 62.50%
        APR_TO_MPR[1627500000000000000000000000] = 1000000015433527862036380096; // 62.75%
        APR_TO_MPR[1630000000000000000000000000] = 1000000015482166533602350415; // 63.00%
        APR_TO_MPR[1632500000000000000000000000] = 1000000015530730663116089906; // 63.25%
        APR_TO_MPR[1635000000000000000000000000] = 1000000015579220478709487642; // 63.50%
        APR_TO_MPR[1637500000000000000000000000] = 1000000015627636207468754787; // 63.75%
        APR_TO_MPR[1640000000000000000000000000] = 1000000015675978075440805544; // 64.00%
        APR_TO_MPR[1642500000000000000000000000] = 1000000015724246307639589514; // 64.25%
        APR_TO_MPR[1645000000000000000000000000] = 1000000015772441128052375900; // 64.50%
        APR_TO_MPR[1647500000000000000000000000] = 1000000015820562759645989987; // 64.75%
        APR_TO_MPR[1650000000000000000000000000] = 1000000015868611424373002348; // 65.00%
        APR_TO_MPR[1652500000000000000000000000] = 1000000015916587343177871197; // 65.25%
        APR_TO_MPR[1655000000000000000000000000] = 1000000015964490736003038309; // 65.50%
        APR_TO_MPR[1657500000000000000000000000] = 1000000016012321821794978935; // 65.75%
        APR_TO_MPR[1660000000000000000000000000] = 1000000016060080818510206134; // 66.00%
        APR_TO_MPR[1662500000000000000000000000] = 1000000016107767943121229910; // 66.25%
        APR_TO_MPR[1665000000000000000000000000] = 1000000016155383411622471594; // 66.50%
        APR_TO_MPR[1667500000000000000000000000] = 1000000016202927439036133843; // 66.75%
        APR_TO_MPR[1670000000000000000000000000] = 1000000016250400239418026680; // 67.00%
        APR_TO_MPR[1672500000000000000000000000] = 1000000016297802025863349950; // 67.25%
        APR_TO_MPR[1675000000000000000000000000] = 1000000016345133010512432594; // 67.50%
        APR_TO_MPR[1677500000000000000000000000] = 1000000016392393404556429128; // 67.75%
        APR_TO_MPR[1680000000000000000000000000] = 1000000016439583418242973701; // 68.00%
        APR_TO_MPR[1682500000000000000000000000] = 1000000016486703260881792117; // 68.25%
        APR_TO_MPR[1685000000000000000000000000] = 1000000016533753140850272195; // 68.50%
        APR_TO_MPR[1687500000000000000000000000] = 1000000016580733265598992834; // 68.75%
        APR_TO_MPR[1690000000000000000000000000] = 1000000016627643841657212155; // 69.00%
        APR_TO_MPR[1692500000000000000000000000] = 1000000016674485074638315080; // 69.25%
        APR_TO_MPR[1695000000000000000000000000] = 1000000016721257169245220702; // 69.50%
        APR_TO_MPR[1697500000000000000000000000] = 1000000016767960329275749817; // 69.75%
        APR_TO_MPR[1700000000000000000000000000] = 1000000016814594757627952949; // 70.00%
        APR_TO_MPR[1702500000000000000000000000] = 1000000016861160656305399237; // 70.25%
        APR_TO_MPR[1705000000000000000000000000] = 1000000016907658226422426507; // 70.50%
        APR_TO_MPR[1707500000000000000000000000] = 1000000016954087668209352898; // 70.75%
        APR_TO_MPR[1710000000000000000000000000] = 1000000017000449181017650345; // 71.00%
        APR_TO_MPR[1712500000000000000000000000] = 1000000017046742963325080287; // 71.25%
        APR_TO_MPR[1715000000000000000000000000] = 1000000017092969212740791907; // 71.50%
        APR_TO_MPR[1717500000000000000000000000] = 1000000017139128126010383242; // 71.75%
        APR_TO_MPR[1720000000000000000000000000] = 1000000017185219899020925486; // 72.00%
        APR_TO_MPR[1722500000000000000000000000] = 1000000017231244726805950802; // 72.25%
        APR_TO_MPR[1725000000000000000000000000] = 1000000017277202803550403971; // 72.50%
        APR_TO_MPR[1727500000000000000000000000] = 1000000017323094322595558178; // 72.75%
        APR_TO_MPR[1730000000000000000000000000] = 1000000017368919476443895257; // 73.00%
        APR_TO_MPR[1732500000000000000000000000] = 1000000017414678456763950701; // 73.25%
        APR_TO_MPR[1735000000000000000000000000] = 1000000017460371454395123739; // 73.50%
        APR_TO_MPR[1737500000000000000000000000] = 1000000017505998659352452781; // 73.75%
        APR_TO_MPR[1740000000000000000000000000] = 1000000017551560260831356533; // 74.00%
        APR_TO_MPR[1742500000000000000000000000] = 1000000017597056447212341081; // 74.25%
        APR_TO_MPR[1745000000000000000000000000] = 1000000017642487406065673229; // 74.50%
        APR_TO_MPR[1747500000000000000000000000] = 1000000017687853324156020380; // 74.75%
        APR_TO_MPR[1750000000000000000000000000] = 1000000017733154387447057259; // 75.00%
        APR_TO_MPR[1752500000000000000000000000] = 1000000017778390781106039750; // 75.25%
        APR_TO_MPR[1755000000000000000000000000] = 1000000017823562689508346134; // 75.50%
        APR_TO_MPR[1757500000000000000000000000] = 1000000017868670296241986004; // 75.75%
        APR_TO_MPR[1760000000000000000000000000] = 1000000017913713784112077133; // 76.00%
        APR_TO_MPR[1762500000000000000000000000] = 1000000017958693335145290571; // 76.25%
        APR_TO_MPR[1765000000000000000000000000] = 1000000018003609130594264236; // 76.50%
        APR_TO_MPR[1767500000000000000000000000] = 1000000018048461350941985275; // 76.75%
        APR_TO_MPR[1770000000000000000000000000] = 1000000018093250175906141444; // 77.00%
        APR_TO_MPR[1772500000000000000000000000] = 1000000018137975784443441789; // 77.25%
        APR_TO_MPR[1775000000000000000000000000] = 1000000018182638354753906875; // 77.50%
        APR_TO_MPR[1777500000000000000000000000] = 1000000018227238064285128822; // 77.75%
        APR_TO_MPR[1780000000000000000000000000] = 1000000018271775089736501407; // 78.00%
        APR_TO_MPR[1782500000000000000000000000] = 1000000018316249607063420475; // 78.25%
        APR_TO_MPR[1785000000000000000000000000] = 1000000018360661791481454924; // 78.50%
        APR_TO_MPR[1787500000000000000000000000] = 1000000018405011817470488494; // 78.75%
        APR_TO_MPR[1790000000000000000000000000] = 1000000018449299858778832616; // 79.00%
        APR_TO_MPR[1792500000000000000000000000] = 1000000018493526088427310559; // 79.25%
        APR_TO_MPR[1795000000000000000000000000] = 1000000018537690678713313114; // 79.50%
        APR_TO_MPR[1797500000000000000000000000] = 1000000018581793801214826065; // 79.75%
        APR_TO_MPR[1800000000000000000000000000] = 1000000018625835626794429653; // 80.00%
        APR_TO_MPR[1802500000000000000000000000] = 1000000018669816325603270307; // 80.25%
        APR_TO_MPR[1805000000000000000000000000] = 1000000018713736067085004831; // 80.50%
        APR_TO_MPR[1807500000000000000000000000] = 1000000018757595019979717312; // 80.75%
        APR_TO_MPR[1810000000000000000000000000] = 1000000018801393352327808946; // 81.00%
        APR_TO_MPR[1812500000000000000000000000] = 1000000018845131231473861028; // 81.25%
        APR_TO_MPR[1815000000000000000000000000] = 1000000018888808824070471315; // 81.50%
        APR_TO_MPR[1817500000000000000000000000] = 1000000018932426296082063985; // 81.75%
        APR_TO_MPR[1820000000000000000000000000] = 1000000018975983812788673414; // 82.00%
        APR_TO_MPR[1822500000000000000000000000] = 1000000019019481538789701980; // 82.25%
        APR_TO_MPR[1825000000000000000000000000] = 1000000019062919638007652114; // 82.50%
        APR_TO_MPR[1827500000000000000000000000] = 1000000019106298273691832803; // 82.75%
        APR_TO_MPR[1830000000000000000000000000] = 1000000019149617608422040763; // 83.00%
        APR_TO_MPR[1832500000000000000000000000] = 1000000019192877804112216479; // 83.25%
        APR_TO_MPR[1835000000000000000000000000] = 1000000019236079022014075326; // 83.50%
        APR_TO_MPR[1837500000000000000000000000] = 1000000019279221422720713972; // 83.75%
        APR_TO_MPR[1840000000000000000000000000] = 1000000019322305166170192264; // 84.00%
        APR_TO_MPR[1842500000000000000000000000] = 1000000019365330411649090794; // 84.25%
        APR_TO_MPR[1845000000000000000000000000] = 1000000019408297317796044352; // 84.50%
        APR_TO_MPR[1847500000000000000000000000] = 1000000019451206042605251450; // 84.75%
        APR_TO_MPR[1850000000000000000000000000] = 1000000019494056743429960121; // 85.00%
        APR_TO_MPR[1852500000000000000000000000] = 1000000019536849576985930176; // 85.25%
        APR_TO_MPR[1855000000000000000000000000] = 1000000019579584699354872123; // 85.50%
        APR_TO_MPR[1857500000000000000000000000] = 1000000019622262265987862918; // 85.75%
        APR_TO_MPR[1860000000000000000000000000] = 1000000019664882431708738757; // 86.00%
        APR_TO_MPR[1862500000000000000000000000] = 1000000019707445350717465068; // 86.25%
        APR_TO_MPR[1865000000000000000000000000] = 1000000019749951176593483917; // 86.50%
        APR_TO_MPR[1867500000000000000000000000] = 1000000019792400062299038978; // 86.75%
        APR_TO_MPR[1870000000000000000000000000] = 1000000019834792160182478274; // 87.00%
        APR_TO_MPR[1872500000000000000000000000] = 1000000019877127621981534848; // 87.25%
        APR_TO_MPR[1875000000000000000000000000] = 1000000019919406598826585552; // 87.50%
        APR_TO_MPR[1877500000000000000000000000] = 1000000019961629241243888126; // 87.75%
        APR_TO_MPR[1880000000000000000000000000] = 1000000020003795699158796735; // 88.00%
        APR_TO_MPR[1882500000000000000000000000] = 1000000020045906121898956145; // 88.25%
        APR_TO_MPR[1885000000000000000000000000] = 1000000020087960658197474701; // 88.50%
        APR_TO_MPR[1887500000000000000000000000] = 1000000020129959456196076280; // 88.75%
        APR_TO_MPR[1890000000000000000000000000] = 1000000020171902663448231379; // 89.00%
        APR_TO_MPR[1892500000000000000000000000] = 1000000020213790426922267516; // 89.25%
        APR_TO_MPR[1895000000000000000000000000] = 1000000020255622893004459091; // 89.50%
        APR_TO_MPR[1897500000000000000000000000] = 1000000020297400207502096891; // 89.75%
        APR_TO_MPR[1900000000000000000000000000] = 1000000020339122515646537375; // 90.00%
        APR_TO_MPR[1902500000000000000000000000] = 1000000020380789962096231915; // 90.25%
        APR_TO_MPR[1905000000000000000000000000] = 1000000020422402690939736156; // 90.50%
        APR_TO_MPR[1907500000000000000000000000] = 1000000020463960845698699627; // 90.75%
        APR_TO_MPR[1910000000000000000000000000] = 1000000020505464569330835789; // 91.00%
        APR_TO_MPR[1912500000000000000000000000] = 1000000020546914004232872643; // 91.25%
        APR_TO_MPR[1915000000000000000000000000] = 1000000020588309292243484082; // 91.50%
        APR_TO_MPR[1917500000000000000000000000] = 1000000020629650574646202105; // 91.75%
        APR_TO_MPR[1920000000000000000000000000] = 1000000020670937992172310071; // 92.00%
        APR_TO_MPR[1922500000000000000000000000] = 1000000020712171685003717125; // 92.25%
        APR_TO_MPR[1925000000000000000000000000] = 1000000020753351792775813945; // 92.50%
        APR_TO_MPR[1927500000000000000000000000] = 1000000020794478454580309958; // 92.75%
        APR_TO_MPR[1930000000000000000000000000] = 1000000020835551808968052169; // 93.00%
        APR_TO_MPR[1932500000000000000000000000] = 1000000020876571993951825747; // 93.25%
        APR_TO_MPR[1935000000000000000000000000] = 1000000020917539147009136505; // 93.50%
        APR_TO_MPR[1937500000000000000000000000] = 1000000020958453405084975416; // 93.75%
        APR_TO_MPR[1940000000000000000000000000] = 1000000020999314904594565308; // 94.00%
        APR_TO_MPR[1942500000000000000000000000] = 1000000021040123781426089871; // 94.25%
        APR_TO_MPR[1945000000000000000000000000] = 1000000021080880170943405113; // 94.50%
        APR_TO_MPR[1947500000000000000000000000] = 1000000021121584207988733405; // 94.75%
        APR_TO_MPR[1950000000000000000000000000] = 1000000021162236026885340239; // 95.00%
        APR_TO_MPR[1952500000000000000000000000] = 1000000021202835761440193849; // 95.25%
        APR_TO_MPR[1955000000000000000000000000] = 1000000021243383544946607801; // 95.50%
        APR_TO_MPR[1957500000000000000000000000] = 1000000021283879510186866712; // 95.75%
        APR_TO_MPR[1960000000000000000000000000] = 1000000021324323789434835202; // 96.00%
        APR_TO_MPR[1962500000000000000000000000] = 1000000021364716514458550223; // 96.25%
        APR_TO_MPR[1965000000000000000000000000] = 1000000021405057816522796890; // 96.50%
        APR_TO_MPR[1967500000000000000000000000] = 1000000021445347826391667926; // 96.75%
        APR_TO_MPR[1970000000000000000000000000] = 1000000021485586674331106867; // 97.00%
        APR_TO_MPR[1972500000000000000000000000] = 1000000021525774490111435137; // 97.25%
        APR_TO_MPR[1975000000000000000000000000] = 1000000021565911403009863114; // 97.50%
        APR_TO_MPR[1977500000000000000000000000] = 1000000021605997541812985323; // 97.75%
        APR_TO_MPR[1980000000000000000000000000] = 1000000021646033034819259855; // 98.00%
        APR_TO_MPR[1982500000000000000000000000] = 1000000021686018009841472152; // 98.25%
        APR_TO_MPR[1985000000000000000000000000] = 1000000021725952594209183264; // 98.50%
        APR_TO_MPR[1987500000000000000000000000] = 1000000021765836914771162698; // 98.75%
        APR_TO_MPR[1990000000000000000000000000] = 1000000021805671097897805973; // 99.00%
        APR_TO_MPR[1992500000000000000000000000] = 1000000021845455269483537007; // 99.25%
        APR_TO_MPR[1995000000000000000000000000] = 1000000021885189554949195434; // 99.50%
        APR_TO_MPR[1997500000000000000000000000] = 1000000021924874079244408976; // 99.75%
        APR_TO_MPR[2000000000000000000000000000] = 1000000021964508966849950976; // 100.00%
    }
}
