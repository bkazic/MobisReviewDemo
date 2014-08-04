// Module for Loop counters preprocessing
tm = require('time');

// Adds Date
exports.addPrimaryField = function (outStore) {
    var store = outStore;
    makePrimaryField = function (rec) {
        var val = rec.toJSON(true);
        delete val.$id;
        val.StringDateTime = rec.DateTime.string;
        store.add(val);
    }
    return makePrimaryField;
};


// If there is no cars, set speed to speed limit
//exports.makeCleanSpeedNoCars = function (replaceObj) {
//    var replace = replaceObj;
//    var cleanSpeedNoCars = function (rec) {
//        if (rec.NumOfCars === 0) {
//            //speed = rec.measuredBy.MaxSpeed;
//            rec["Speed"] = replace.getAvr();
//            rec["TrafficStatus"] = 1;
//        }
//    }
//    return cleanSpeedNoCars;
//};

// If there is no cars, set speed to speed limit
exports.makeCleanSpeedNoCars = function (replaceObj, outStore) {
    var replace = replaceObj;
    var cleanSpeedNoCars = function (rec) {
        if (rec.NumOfCars === 0) {
            var store = rec.$store;
            //speed = rec.measuredBy.MaxSpeed;           
            var val = rec.toJSON(true);
            if (outStore != null) {
                store = outStore;
                delete val.$id;
            }
            val["Speed"] = replace.getAvr();
            val["TrafficStatus"] = 1;
            store.add(val);
        } else {
            if (outStore != null) {
                var val = rec.toJSON(true);
                delete val.$id;
                outStore.add(val);
            }
        }
    }
    return cleanSpeedNoCars;
};

// Mark duplicates, so that they will be handeled later
exports.markAsDuplicate = function () {
    isDuplicate = function (rec) {
        var checkRecIdx = rec.$id-1;
        if (checkRecIdx > 0) {
            if (rec.DateTime.timestamp <= rec.$store[checkRecIdx].DateTime.timestamp) {
                rec["Replaced"] = true;
            }
        }
    }
    return isDuplicate;
}

exports.replaceMissingVals = function (addInterval, valsBack, unit) {
    var interval = addInterval;
    replaceVal = function (rec) {
        // only for records marked as "replaced"
        if (rec["Replaced"]) {
            var prevValIdx = rec.$id - 1;
            if (prevValIdx < 0) return;
            var store = rec.$store;
            var rs = store.recs;
            var currTime = store[prevValIdx].DateTime.add(interval).string;
            // if parameters are not initialized target val will be prev val
            var targetVal = store[prevValIdx].toJSON(true);
            if (valsBack && unit) { // checks if parameters are initialized
                var targetTime = tm.parse(currTime);
                targetTime.sub(valsBack, unit); // specify target time
                rs.filterByField("DateTime", targetTime.string, targetTime.string);
                if (rs.length) {
                    targetRec = rs[0];
                    targetVal = targetRec.toJSON(true);
                }
            }
            // replace rec with target rec
            targetVal["$id"] = rec.$id;
            targetVal["DateTime"] = currTime;
            targetVal["Replaced"] = true;
            store.add(targetVal);
        }
    }
    return replaceVal;
}

// About this module
exports.about = function () {
    var description = "This module contains functions for prreprocessing counter loop sensors.";
    return description;
};