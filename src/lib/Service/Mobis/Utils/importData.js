// Import data from different stores to various stores according to timestamp

// Used if traffic record has to be saved to different stores --> every rec to its own store
var saveToDifferentTrafficStores = function (rec) {
    id = rec.measuredBy.Name.replace("-", "_");
    trafficStore = qm.store("trafficStore_" + id);

    //console.log("Getting rec with id: " + id);
    //console.log("Saving it to store: " + trafficStore.name);

    // Moving rec to appropriate store
    trafficStore.add(rec.toJSON(true));
}

exports.importData = function (inStores, outStores, limit) {
    var loadStores = inStores;
    var targetStores = outStores;
    var count = 0; //counter used for counting iterations when limit is defined

    // Find and returns first datetime field from store
    getDateTimeFieldName = function (store) {
        var dateTimeFieldName = null;
        for (var ii = 0; ii < store.fields.length; ii++) {
            if (store.fields[ii].type == "datetime") {
                dateTimeFieldName = store.fields[ii].name;
                break;
            }
        }
        return dateTimeFieldName;
    };

    // Find and returns all datetime fields in store
    getDateTimeFieldNames = function (stores) {
        var result = []
        for (var ii = 0; ii < stores.length; ii++) {
            var store = stores[ii];
            result.push(getDateTimeFieldName(store));
        }
        return result;
    };

    // Returns index with lowest timestamp value from currRecIdxs array
    findLowestRecIdx = function (currRecIdxs) {
        var min = Number.MAX_VALUE;
        var idx = -1;
        var dateTimeFields = getDateTimeFieldNames(loadStores);

        for (var ii = 0; ii < currRecIdxs.length; ii++) {
            var currRec = loadStores[ii].recs[currRecIdxs[ii]];
            if (currRec == null) continue;
            if (currRec[dateTimeFields[ii]].timestamp < min) {
                min = currRec[dateTimeFields[ii]].timestamp;
                idx = ii;
            }
        }
        return idx;
    };

    var currRecIdxs = [];
    for (var ii = 0; ii < loadStores.length; ii++) {
        currRecIdxs.push(0);
    }
    //var lowestRecIdx = findLowestRecIdx(currRecIdxs);
    var dateTimeFields = getDateTimeFieldNames(loadStores);
    while (true) {
        var lowestRecIdx = findLowestRecIdx(currRecIdxs); 
        if (lowestRecIdx == -1) break;

        // If input parameter limit is defined
        if (limit != null) {
            if (count > limit) {
                console.log("Reached count limit at " + limit)
                break;
            } else count++
        }

        //console.log("\nDodal bomo: " + JSON.stringify(loadStores[lowestRecIdx].recs[currRecIdxs[lowestRecIdx]]));

        var rec = loadStores[lowestRecIdx].recs[currRecIdxs[lowestRecIdx]]
        var val = rec.toJSON(true);
        delete val.$id;
        //val.StringDateTime = rec[dateTimeFields[lowestRecIdx]].string; //have to add string version because, string fields can be uniqe. Thisway I delete duplicates.

        //targetStores[lowestRecIdx].add(val);

        // TODO:
        
        var store = targetStores[lowestRecIdx];
        if (store instanceof Array) {
            saveToDifferentTrafficStores(rec);
        } else {
            targetStores[lowestRecIdx].add(val);
        }

        //console.log("\nLast resampled rec: " + JSON.stringify(resampledStore.last));
        currRecIdxs[lowestRecIdx]++
       
    }
}

// About this module
exports.about = function () {
    var description = "Imports data according to timestamp. Instore and outstore are input parameters.";
    return description;
};