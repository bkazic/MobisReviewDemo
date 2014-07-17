

exports.importData = function (inStores, outStores) {
    var loadStores = inStores;
    var targetStores = outStores;

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

    //var loadStores = [trafficLoadStore, weatherLoadStore];
    //var targetStores = [trafficStore, weatherStore];

    //mors met array timestampov vseh storov, v istem vrstnem redu kot so stori v loadStores in targetStores
    //var currRecIdxs = [trafficLoadStore[0].DateTime.timestamp, weatherLoadStore[0].time.timestamp] // to kasneje avtomatiziraj
    var currRecIdxs = [];
    for (var ii = 0; ii < loadStores.length; ii++) {
        currRecIdxs.push(0);
    }
    //var currRecIdxs = [0, 0] //TODO: generiraj to avtomatsko
    //var lowestRecIdx = findLowestRecIdx(currRecIdxs);
    var dateTimeFields = getDateTimeFieldNames(loadStores);
    while (true) {
        var lowestRecIdx = findLowestRecIdx(currRecIdxs); //TODO, mora vracat -1 ce pride do konca. To isces glede na timestamp
        if (lowestRecIdx == -1) break;

        //console.log("\nDodal bomo: " + JSON.stringify(loadStores[lowestRecIdx].recs[currRecIdxs[lowestRecIdx]]));

        var rec = loadStores[lowestRecIdx].recs[currRecIdxs[lowestRecIdx]]
        var val = rec.toJSON(true);
        delete val.$id;
        val.StringDateTime = rec[dateTimeFields[lowestRecIdx]].string; //have to add string version because, string fields can be uniqe. Thisway I delete duplicates.
        targetStores[lowestRecIdx].add(val);

        //console.log("\nResampled store: " + JSON.stringify(resampledStore.recs[resampledStore.length - 1]));

        currRecIdxs[lowestRecIdx]++

        //console.start()
    }
}

// About this module
exports.about = function () {
    var description = "Imports data according to timestamp. Instore and outstore are input parameters.";
    return description;
};