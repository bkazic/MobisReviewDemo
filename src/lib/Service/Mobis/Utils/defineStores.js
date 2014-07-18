// Define measurement store definition as a function so that it can be used several times 
exports.defineStores = function () {
    // Loading store for counter Nodes
    var scriptNm = process.scriptNm;
    var filename_counters = "./sandbox/" + scriptNm + "/countersNodes.txt";
    //var CounterNode = qm.store("CounterNode");
    qm.load.jsonFile(qm.store("CounterNode"), filename_counters);

    // Define measurement store definition as a function so that it can be used several times 
    var createTrafficStore = function (storeName, extraFields) {
        storeDef = [{
            "name": storeName,
            "fields": [
                    { "name": "DateTime", "type": "datetime" },
                    { "name": "NumOfCars", "type": "float", "null": true },
                    { "name": "Gap", "type": "float", "null": true },
                    { "name": "Occupancy", "type": "float", "null": true },
                    { "name": "Speed", "type": "float", "null": true },
                    { "name": "TrafficStatus", "type": "float", "null": true }
            ],
            "joins": [
                { "name": "measuredBy", "type": "field", "store": "CounterNode" }
            ]
        }];
        if (extraFields) {
            storeDef[0].fields = storeDef[0].fields.concat(extraFields);
        }
        qm.createStore(storeDef);
    };

    // Creating Store for measurements
    createTrafficStore("trafficLoadStore");
    createTrafficStore("trafficStore", [{ "name": "Replaced", "type": "bool", "null": true, "default": false }]);
    createTrafficStore("trafficStoreNoDuplicates", [{ "name": "StringDateTime", "type": "string", "primary": true }]);


    // Load measurements from file to store
    var filename_measurements = "./sandbox/" + scriptNm + "/oneday_measurements_0016_21.txt";
    //var filename_measurements = "./sandbox/" + scriptNm + "/onemonth_measurements_0016_21.txt";
    qm.load.jsonFile(qm.store('trafficLoadStore'), filename_measurements);

    // Define measurement store definition as a function so that it can be used several times 
    var createWeatherStore = function (storeName, extraFields) {
        storeDef = [{
            "name": storeName,
            "fields": [
                    { "name": "time", "type": "datetime" },
                    { "name": "timeString", "type": "string", "null": true },
                    { "name": "summary", "type": "string", "null": true },
                    { "name": "icon", "type": "string", "null": true },
                    { "name": "temperature", "type": "float", "null": true },
                    { "name": "visibility", "type": "float", "null": true },
            ],
            "keys": [
                    { "field": "timeString", "type": "value" }
            ]
        }];
        if (extraFields) {
            storeDef[0].fields = storeDef[0].fields.concat(extraFields);
        }
        qm.createStore(storeDef);
    };
    // create weather store
    createWeatherStore("weatherLoadStore");
    createWeatherStore("weatherStore");
    //createWeatherStore("weatherStore", [{ "name": "StringDateTime", "type": "string", "primary": true }]);

    // Load measurements from file to store
    //var weatherLoadStore = qm.store('weatherLoadStore');
    //var weatherStore = qm.store('weatherStore');
    var filename_measurements = "./sandbox/" + scriptNm + "/weatherLog.txt";
    qm.load.jsonFile(qm.store('weatherLoadStore'), filename_measurements);

    // Define extra fields
    var extraFields = [
                { "name": "summary", "type": "string", "null": true },
                { "name": "icon", "type": "string", "null": true },
                { "name": "temperature", "type": "float", "null": true },
                { "name": "visibility", "type": "float", "null": true },

                { "name": "Target", "type": "float", "null": true, "default": 0.0 },
                { "name": "Ema1", "type": "float", "null": true },
                { "name": "Ema2", "type": "float", "null": true },

                { "name": "SpeedLimit", "type": "float", "null": true },
                { "name": "PrevValPred", "type": "float", "null": true },
                { "name": "AvrValPred", "type": "float", "null": true },
                { "name": "LinregPred", "type": "float", "null": true },
                { "name": "RidgeRegPred", "type": "float", "null": true },
                { "name": "SvmrPred", "type": "float", "null": true },
                { "name": "NNPred", "type": "float", "null": true },
                { "name": "KNNPred", "type": "float", "null": true },

                { "name": "SpeedLimitMAE", "type": "float", "null": true },
                { "name": "PrevValPredMAE", "type": "float", "null": true },
                { "name": "AvrValPredMAE", "type": "float", "null": true },
                { "name": "LinregPredMAE", "type": "float", "null": true },
                { "name": "RidgeRegPredMAE", "type": "float", "null": true },
                { "name": "SvmrPredMAE", "type": "float", "null": true },
                { "name": "NNPredMAE", "type": "float", "null": true },
                { "name": "KNNPredMAE", "type": "float", "null": true },
    ]
    createTrafficStore("resampledStore", extraFields);
    //var resampledStore = qm.store('resampledStore');
}

// About this module
exports.about = function () {
    var description = "Defines stores and loads data to it.";
    return description;
};