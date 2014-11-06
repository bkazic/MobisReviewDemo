Service.Mobis.Utils.Ftr = require('Service/Mobis/Utils/specialDays.js');
var slovenianHolidayFtr = new Service.Mobis.Utils.Ftr.specialDaysFtrExtractor("Slovenian_holidays");

getTmFtrs = function (rec) {
    var h = rec.DateTime.hour;
    var d = rec.DateTime.dayOfWeekNum;
    var m = rec.DateTime.month;
    return la.newVec([h, d, m])
}

getCyclicTmFtrs = function (rec) {
    var ch = Math.cos(2 * Math.PI * rec.DateTime.hour / 24) //can be with Math.sin() also
    var cd = Math.cos(2 * Math.PI * rec.DateTime.dayOfWeekNum / 7) //can be with Math.sin() also
    var cm = Math.cos(2 * Math.PI * rec.DateTime.month / 12) //can be with Math.sin() also
    return la.newVec([ch, cd, cm])
}

isWeekend = function (rec) {
    return (rec.DateTime.dayOfWeekNum == 0 || rec.DateTime.dayOfWeekNum == 6) ? 1 : 0;
}

isWorkingDay = function (rec) {
    return (isWeekend(rec) || slovenianHolidayFtr.getFtr(rec) === 1) ? 0 : 1;
}


exports.getTmFtrs = getTmFtrs;
exports.getCyclicTmFtrs = getCyclicTmFtrs;
exports.isWeekend = isWeekend;
exports.isWorkingDay = isWorkingDay;