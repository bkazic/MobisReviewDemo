newDateTimeFtr = function () {
    var dateTimeFtr = function () {
        var size = 3;
        var vec = la.newVec({ "vals": size });

        // I THINK YOU DONT NEED THIS
        this.update = function (newTM) {
            var h = newTM.hour;
            var d = newTM.dayOfWeekNum;
            var m = newTM.month;
            vec = la.newVec([h, d, m])
        }

        // THIS IS DEPRICATED
        this.getFtrVec = function (rec) {
            return vec;
        }

        this.getSize = function () {
            return size;
        }
    }
    return new dateTimeFtr();
}

test = function (rec) {

    return 
}

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

exports.newDateTimeFtr = newDateTimeFtr;
exports.getTmFtrs = getTmFtrs;
exports.getCyclicTmFtrs = getCyclicTmFtrs;