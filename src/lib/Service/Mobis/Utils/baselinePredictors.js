Service.Mobis.Utils.tmFtr = require('Service/Mobis/Utils/dateTimeFtr.js');

/////////////////// 
// AVERAGE VAL
/////////////////// 
exports.newAvrVal = function () {
    createAvr = function () {
        this.count = 0;
        this.avr = 0;

        this.update = function (val) {
            this.count++;
            this.avr = this.avr + (val - this.avr) / this.count;
            return this.prevAvr;
        }

        this.getAvr = function () {
            return this.avr;
        }
    }
    return new createAvr();
}


/////////////////// 
// LOCALIZED AVERAGE
/////////////////// 
var createLocalizedAvrgs = function () {
    // create 2 * 24 avr models, for every hour, and for working/nonworking day
    avrgs = [];
    for (var i = 0; i < 2; i++) { // 2 models: working day or not
        avrgs[i] = [];
        for (var j = 0; j < 24; j++) {
            avrgs[i][j] = exports.newAvrVal();
            avrgs[i][j]["forHour"] = j; // asign new field "forHour" to model
        }
    }
    return avrgs;
};

var locAvrgs = function (field) {

    this.fieldNm = field.name;
    this.avrgs = createLocalizedAvrgs();
    var specificAvr = null;

    var selectAvr = function (rec) {

        var hour = rec.DateTime.hour;
        var work = Service.Mobis.Utils.tmFtr.isWorkingDay(rec);

        return this.avrgs[work][hour];
    }

    this.update = function (rec) {

        var avr = selectAvr(rec);
        avr.update(rec[this.fieldNm])
    }

    this.getVal = function (rec) {

        var avr = selectAvr(rec);
        return avr.getAvr()
    }
}

exports.newLocAvrgs = function (conf) {

    var field = conf.fields;

    var hours = (conf.includeHours == true) ? true : false;
    var days = (conf.includeDaysOfWeek == true) ? true : false;
    var working = (conf.includeWorkingDays == true) ? true : false;

    return new locAvrgs(field, hours, days, working);
}

// About this module
exports.about = function () {
    var description = "Module with baseline predictions.";
    return description;
};