//// Define Stores
//Service.Mobis.Utils.Stores.defineStores(); //TODO: Later use .def file instead
var CounterNode = qm.store("CounterNode");
var trafficLoadStore = qm.store('trafficLoadStore');
var trafficStore = qm.store('trafficStore');

qm.load.jsonFile(CounterNode, "./sandbox/" + process.scriptNm + "/countersNodes.txt");
qm.load.jsonFile(trafficLoadStore, "./sandbox/" + process.scriptNm + "/measurements_9_sens.txt");
//qm.load.jsonFile(trafficLoadStore, "./sandbox/" + process.scriptNm + "/measurements_9_sens_3_mon.txt");
//qm.load.jsonFile(trafficLoadStore, "./sandbox/" + process.scriptNm + "/measurements_3_mon_0011_11.txt");

//var sendData = function (_data) {
//    var root = "http://localhost:8080/ServerReciever/reciever?data=";
//    var data = (_data == null) ? "" : JSON.stringify(_data);
//    var url = root + data;

//    var respCallBack = function (resp) { console.log(resp); eval(breakpoint); sendData(_data) }
//    var errCallBack = function (err) { console.log(err); eval(breakpoint); sendData(_data) }
//    //var respCallBack = function (resp) { console.log("Resp: " + resp); eval(breakpoint); pass = true }
//    //var errCallBack = function (err) { console.log("Err" + err); eval(breakpoint); pass = true }

//    http.getStr(url, respCallBack, errCallBack);
//}

var importData = function (inStores, outStores, limit) {
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
    //var dateTimeFields = getDateTimeFieldNames(loadStores);

    var respCallBack = function (resp) {
        var lowestRecIdx = findLowestRecIdx(currRecIdxs);
        try {
            var rec = loadStores[lowestRecIdx].recs[currRecIdxs[lowestRecIdx]]
        } catch (err) {
            throw "Reached to the end"
        }
        //var val = rec.toJSON(true);

        var val = rec.toJSON();
        delete val.$id;
        val["measuredBy"] = {"Name": rec.measuredBy.Name};

        console.log("Resonse: " + resp);
        //eval(breakpoint)

        sendData(val);
        currRecIdxs[lowestRecIdx]++
    }

    var errCallBack = function (err) { console.log(err); sendData(); }

    var sendData = function (_data) {
        //Check if there is any rec left
        var lowestRecIdx = findLowestRecIdx(currRecIdxs);
        if (lowestRecIdx == -1) { return; }

        // If input parameter limit is defined
        if (limit != null) {
            if (count > limit) {
                console.log("Reached count limit at " + limit);
                throw "Reached count limit at " + limit
                return;
            } else count++
        }

        //var root = "http://localhost:8080/ServerReciever/reciever?data=";
        var root = "http://localhost:8080/TrafficPrediction/importData?data=";
        //var root = "http://mustang.ijs.si:9569/TrafficPrediction/importData?data=";
        var data = (_data == null) ? null : JSON.stringify(_data);
        var url = root + data;
        console.log("Sending data...\n" + JSON.stringify(_data, undefined, 2));

        http.getStr(url, respCallBack, errCallBack);
        //currRecIdxs[lowestRecIdx]++
    }

    sendData() //Start the process
}

// Imports data from loadstores according to timestamp
var loadStores = [trafficLoadStore];
var targetStores = [trafficStore];
 
importData(loadStores, targetStores);
//importData(loadStores, targetStores, 10000);

// DEBUGGING
//console.log("Console mode...")
//eval(breakpoint)