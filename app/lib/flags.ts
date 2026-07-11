export type FlagOption = { code: string; name: string; emoji?: string };
export type FlagGroup = { continent: string; flags: FlagOption[] };

export const flagGroups: FlagGroup[] = [
  { continent: "Africa", flags: [
    ["DZ","Algeria"],["AO","Angola"],["BJ","Benin"],["BW","Botswana"],["BF","Burkina Faso"],["BI","Burundi"],["CM","Cameroon"],["CV","Cape Verde"],["CF","Central African Republic"],["TD","Chad"],["KM","Comoros"],["CG","Congo"],["CD","DR Congo"],["CI","Côte d’Ivoire"],["DJ","Djibouti"],["EG","Egypt"],["GQ","Equatorial Guinea"],["ER","Eritrea"],["SZ","Eswatini"],["ET","Ethiopia"],["GA","Gabon"],["GM","Gambia"],["GH","Ghana"],["GN","Guinea"],["GW","Guinea-Bissau"],["KE","Kenya"],["LS","Lesotho"],["LR","Liberia"],["LY","Libya"],["MG","Madagascar"],["MW","Malawi"],["ML","Mali"],["MR","Mauritania"],["MU","Mauritius"],["YT","Mayotte"],["MA","Morocco"],["MZ","Mozambique"],["NA","Namibia"],["NE","Niger"],["NG","Nigeria"],["RE","Réunion"],["RW","Rwanda"],["SH","Saint Helena"],["ST","São Tomé and Príncipe"],["SN","Senegal"],["SC","Seychelles"],["SL","Sierra Leone"],["SO","Somalia"],["ZA","South Africa"],["SS","South Sudan"],["SD","Sudan"],["TZ","Tanzania"],["TG","Togo"],["TN","Tunisia"],["UG","Uganda"],["EH","Western Sahara"],["ZM","Zambia"],["ZW","Zimbabwe"],
  ].map(([code, name]) => ({ code, name })) },
  { continent: "Americas", flags: [
    ["AI","Anguilla"],["AG","Antigua and Barbuda"],["AR","Argentina"],["AW","Aruba"],["BS","Bahamas"],["BB","Barbados"],["BZ","Belize"],["BM","Bermuda"],["BO","Bolivia"],["BQ","Caribbean Netherlands"],["BR","Brazil"],["VG","British Virgin Islands"],["CA","Canada"],["KY","Cayman Islands"],["CL","Chile"],["CO","Colombia"],["CR","Costa Rica"],["CU","Cuba"],["CW","Curaçao"],["DM","Dominica"],["DO","Dominican Republic"],["EC","Ecuador"],["SV","El Salvador"],["FK","Falkland Islands"],["GF","French Guiana"],["GL","Greenland"],["GD","Grenada"],["GP","Guadeloupe"],["GT","Guatemala"],["GY","Guyana"],["HT","Haiti"],["HN","Honduras"],["JM","Jamaica"],["MQ","Martinique"],["MX","Mexico"],["MS","Montserrat"],["NI","Nicaragua"],["PA","Panama"],["PY","Paraguay"],["PE","Peru"],["PR","Puerto Rico"],["BL","Saint Barthélemy"],["KN","Saint Kitts and Nevis"],["LC","Saint Lucia"],["MF","Saint Martin"],["PM","Saint Pierre and Miquelon"],["VC","Saint Vincent and the Grenadines"],["SX","Sint Maarten"],["GS","South Georgia and South Sandwich Islands"],["SR","Suriname"],["TT","Trinidad and Tobago"],["TC","Turks and Caicos Islands"],["US","United States"],["UY","Uruguay"],["VI","U.S. Virgin Islands"],["VE","Venezuela"],
  ].map(([code, name]) => ({ code, name })) },
  { continent: "Asia", flags: [
    ["AF","Afghanistan"],["AM","Armenia"],["AZ","Azerbaijan"],["BH","Bahrain"],["BD","Bangladesh"],["BT","Bhutan"],["BN","Brunei"],["KH","Cambodia"],["CN","China"],["CX","Christmas Island"],["CC","Cocos Islands"],["HK","Hong Kong"],["IN","India"],["ID","Indonesia"],["IR","Iran"],["IQ","Iraq"],["IL","Israel"],["JP","Japan"],["JO","Jordan"],["KZ","Kazakhstan"],["KW","Kuwait"],["KG","Kyrgyzstan"],["LA","Laos"],["LB","Lebanon"],["MO","Macao"],["MY","Malaysia"],["MV","Maldives"],["MN","Mongolia"],["MM","Myanmar"],["NP","Nepal"],["KP","North Korea"],["OM","Oman"],["PK","Pakistan"],["PS","Palestine"],["PH","Philippines"],["QA","Qatar"],["SA","Saudi Arabia"],["SG","Singapore"],["KR","South Korea"],["LK","Sri Lanka"],["SY","Syria"],["TW","Taiwan"],["TJ","Tajikistan"],["TH","Thailand"],["TL","Timor-Leste"],["TR","Türkiye"],["TM","Turkmenistan"],["AE","United Arab Emirates"],["UZ","Uzbekistan"],["VN","Vietnam"],["YE","Yemen"],
  ].map(([code, name]) => ({ code, name })) },
  { continent: "Europe", flags: [
    ["AX","Åland Islands"],["AL","Albania"],["AD","Andorra"],["AT","Austria"],["BY","Belarus"],["BE","Belgium"],["BA","Bosnia and Herzegovina"],["BG","Bulgaria"],["HR","Croatia"],["CY","Cyprus"],["CZ","Czechia"],["DK","Denmark"],["EE","Estonia"],["FO","Faroe Islands"],["FI","Finland"],["FR","France"],["DE","Germany"],["GI","Gibraltar"],["GR","Greece"],["GG","Guernsey"],["VA","Holy See"],["HU","Hungary"],["IS","Iceland"],["IE","Ireland"],["IM","Isle of Man"],["IT","Italy"],["JE","Jersey"],["XK","Kosovo"],["LV","Latvia"],["LI","Liechtenstein"],["LT","Lithuania"],["LU","Luxembourg"],["MT","Malta"],["MD","Moldova"],["MC","Monaco"],["ME","Montenegro"],["NL","Netherlands"],["MK","North Macedonia"],["NO","Norway"],["PL","Poland"],["PT","Portugal"],["RO","Romania"],["RU","Russia"],["SM","San Marino"],["RS","Serbia"],["SK","Slovakia"],["SI","Slovenia"],["ES","Spain"],["SJ","Svalbard and Jan Mayen"],["SE","Sweden"],["CH","Switzerland"],["UA","Ukraine"],["GB","United Kingdom"],
  ].map(([code, name]) => ({ code, name })) },
  { continent: "Oceania", flags: [
    ["AS","American Samoa"],["AU","Australia"],["CK","Cook Islands"],["FJ","Fiji"],["PF","French Polynesia"],["GU","Guam"],["KI","Kiribati"],["MH","Marshall Islands"],["FM","Micronesia"],["NR","Nauru"],["NC","New Caledonia"],["NZ","New Zealand"],["NU","Niue"],["NF","Norfolk Island"],["MP","Northern Mariana Islands"],["PW","Palau"],["PG","Papua New Guinea"],["PN","Pitcairn Islands"],["WS","Samoa"],["SB","Solomon Islands"],["TK","Tokelau"],["TO","Tonga"],["TV","Tuvalu"],["UM","U.S. Outlying Islands"],["VU","Vanuatu"],["WF","Wallis and Futuna"],
  ].map(([code, name]) => ({ code, name })) },
  { continent: "Antarctica", flags: [["AQ","Antarctica"],["BV","Bouvet Island"],["TF","French Southern Territories"],["HM","Heard Island and McDonald Islands"]].map(([code, name]) => ({ code, name })) },
  { continent: "Other", flags: [{ code: "pirate", name: "Pirate", emoji: "🏴‍☠️" }] },
];

export function flagEmoji(code: string) {
  return code.toUpperCase().replace(/./g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

export function flagOptionEmoji(flag: FlagOption) {
  return flag.emoji ?? flagEmoji(flag.code);
}
