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
                    { "name": "DateTime", "type": "datetime", primary: true },
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
    createTrafficStore("trafficRawStore");
    createTrafficStore("trafficStore", [{ "name": "Replaced", "type": "bool", "null": true, "default": false }]);
    //createTrafficStore("trafficStore2", [{ "name": "Replaced", "type": "bool", "null": true, "default": false }]);
    //createTrafficStore("trafficStoreNoDuplicates", [{ "name": "StringDateTime", "type": "string", "primary": true }]);


    // Load measurements from file to store
    //var filename_measurements = "./sandbox/" + scriptNm + "/oneday_measurements_0016_21.txt";
    //var filename_measurements = "./sandbox/" + scriptNm + "/onemonth_measurements_0016_21.txt";
    //var filename_measurements = "./sandbox/" + scriptNm + "/measurements_0180_11.txt";
    var filename_measurements = "./sandbox/" + scriptNm + "/measurements_0178_11.txt";
    qm.load.jsonFile(qm.store('trafficLoadStore'), filename_measurements);

    // Define measurement store definition as a function so that it can be used several times 
    var createWeatherStore = function (storeName, extraFields) {
        storeDef = [{
            "name": storeName,
            "fields": [
                    { "name": "time", "type": "datetime", primary: true },
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
    createWeatherStore("weatherStore", [
                   { "name": "iconDiscretized", "type": "float_v", "null": true },
                   { "name": "clearDay", "type": "float", "null": true },
                   { "name": "clearNight", "type": "float", "null": true },
                   { "name": "rain", "type": "float", "null": true },
                   { "name": "snow", "type": "float", "null": true },
                   { "name": "sleet", "type": "float", "null": true },
                   { "name": "wind", "type": "float", "null": true },
                   { "name": "fog", "type": "float", "null": true },
                   { "name": "cloudy", "type": "float", "null": true },
                   { "name": "partlyCloudyDay", "type": "float", "null": true },
                   { "name": "parltlyCloudyNight", "type": "float", "null": true }
    ]);

    // Load measurements from file to store
    //var weatherLoadStore = qm.store('weatherLoadStore');
    //var weatherStore = qm.store('weatherStore');
    var filename_measurements = "./sandbox/" + scriptNm + "/weatherLog.txt";
    qm.load.jsonFile(qm.store('weatherLoadStore'), filename_measurements);

 

    // Define store for event descriptions
    var createEventInfoStore = function (storeName, extraFields) {
        storeDef = [{
            "name": storeName,
            "fields": [
                { "name": "Updated", "type": "datetime", "null": true },
                { "name": "Deleted", "type": "bool", "null": true },
                { "name": "Description", "type": "string", "null": true },
                { "name": "ValidFrom", "type": "datetime", "null": true },
                { "name": "Entered", "type": "datetime", "null": true },
                { "name": "EditingOperator", "type": "string", "null": true },
                { "name": "Location", "type": "float_pair", "null": true },
                { "name": "Stationing", "type": "string", "null": true },
                { "name": "DescriptionEn", "type": "string", "null": true },
                { "name": "Priority", "type": "float", "null": true },
                { "name": "Source", "type": "string", "null": true },
                { "name": "Name", "type": "string", "null": true },
                { "name": "Category", "type": "string", "null": true },
                { "name": "ValidUntil", "type": "datetime", "null": true },
                { "name": "Changed", "type": "datetime", "null": true },
                { "name": "BorderCrossing", "type": "bool", "null": true },
                { "name": "CancelingOperator", "type": "string", "null": true },
                { "name": "Id", "type": "float", "null": true },
                { "name": "IdString", "type": "string", "primary": true },
                { "name": "Road", "type": "string", "null": true },
                { "name": "RoadPrioroty", "type": "string", "null": true },
                { "name": "Cause", "type": "string", "null": true },
            ],
        }];
        if (extraFields) {
            storeDef[0].fields = storeDef[0].fields.concat(extraFields);
        }
        qm.createStore(storeDef);
    };

    createEventInfoStore("eventLoadStore");
    createEventInfoStore("eventStore", [
                { "name": "RoadPriorityFlt", "type": "float", "null": true },
                { "name": "TrafficJam", "type": "float", "null": true },
                { "name": "RoadClosure", "type": "float", "null": true },
                { "name": "TrafficAccident", "type": "float", "null": true },
                { "name": "OtherEvents", "type": "float", "null": true },
                { "name": "Ice", "type": "float", "null": true },
                { "name": "Roadworks", "type": "float", "null": true },
                { "name": "Wind", "type": "float", "null": true },
                { "name": "NoFreightTraffic", "type": "float", "null": true },
                { "name": "Snow", "type": "float", "null": true },
    ]);

    //var eventLoadStore = qm.store("eventLoadStore");
    //var eventStore = qm.store("eventStore");
    var filename_events = "./sandbox/" + scriptNm + "/events-0178-11.json";
    qm.load.jsonFile(qm.store('eventLoadStore'), filename_events);



    // Define store for event logs (with link to event description - EventInfo)
    var createEventStore = function (storeName, extraFields) {
        storeDef = [{
            "name": storeName,
            "fields": [
                { "name": "CounterId", "type": "string", "null": true },
                { "name": "CounterGroup", "type": "string", "null": true },
                { "name": "Distance", "type": "float", "null": true },
                //{ "name": "CounterUpdate", "type": "datetime", "null": true },
                //{ "name": "CounterFeedUpdate", "type": "datetime", "null": true },
                //{ "name": "EventFeedUpdate", "type": "datetime", "null": true },
                { "name": "EsperTime", "type": "datetime", "primary": true },
                //{ "name": "DateTime", "type": "datetime", "null": true },
            ],
            "joins": [
                { "name": "EventInfo", "type": "field", "store": "eventStore" },
                //{ "name": "CounterNode", "type": "field", "store": "counterNode" }
            ],
        }];
        if (extraFields) {
            storeDef[0].fields = storeDef[0].fields.concat(extraFields);
        }
        qm.createStore(storeDef);
    };

    createEventStore("eventLogsLoadStore");
    createEventStore("eventLogsStore");

    //var eventLogsLoadStore = qm.store("eventLogsLoadStore");
    //var eventLogsStore = qm.store("eventLogsStore");
    var filename_logs = "./sandbox/" + scriptNm + "/counter-events-0178-11.json";
    qm.load.jsonFile(qm.store('eventLogsLoadStore'), filename_logs);



    // Define merged store
    createTrafficStore("mergedStore", [
                { "name": "summary", "type": "string", "null": true },
                { "name": "icon", "type": "string", "null": true },
                { "name": "temperature", "type": "float", "null": true },
                { "name": "visibility", "type": "float", "null": true },

                { "name": "iconDiscretized", "type": "int_v", "null": true },
                { "name": "clearDay", "type": "float", "null": true },
                { "name": "clearNight", "type": "float", "null": true },
                { "name": "rain", "type": "float", "null": true },
                { "name": "snow", "type": "float", "null": true },
                { "name": "sleet", "type": "float", "null": true },
                { "name": "wind", "type": "float", "null": true },
                { "name": "fog", "type": "float", "null": true },
                { "name": "cloudy", "type": "float", "null": true },
                { "name": "partlyCloudyDay", "type": "float", "null": true },
                { "name": "parltlyCloudyNight", "type": "float", "null": true },

                { "name": "Priority", "type": "float", "null": true },
                { "name": "RoadPriorityFlt", "type": "float", "null": true },
                { "name": "TrafficJam", "type": "float", "null": true },
                { "name": "RoadClosure", "type": "float", "null": true },
                { "name": "TrafficAccident", "type": "float", "null": true },
                { "name": "OtherEvents", "type": "float", "null": true },
                { "name": "Ice", "type": "float", "null": true },
                { "name": "Roadworks", "type": "float", "null": true },
                { "name": "Wind", "type": "float", "null": true },
                { "name": "NoFreightTraffic", "type": "float", "null": true },
                { "name": "Snow", "type": "float", "null": true },
    ]);


    // Define extra fields for resampled store
    var extraFields = [
                { "name": "summary", "type": "string", "null": true },
                { "name": "icon", "type": "string", "null": true },
                { "name": "temperature", "type": "float", "null": true },
                { "name": "visibility", "type": "float", "null": true },

                { "name": "iconDiscretized", "type": "int_v", "null": true },
                { "name": "clearDay", "type": "float", "null": true },
                { "name": "clearNight", "type": "float", "null": true },
                { "name": "rain", "type": "float", "null": true },
                { "name": "snow", "type": "float", "null": true },
                { "name": "sleet", "type": "float", "null": true },
                { "name": "wind", "type": "float", "null": true },
                { "name": "fog", "type": "float", "null": true },
                { "name": "cloudy", "type": "float", "null": true },
                { "name": "partlyCloudyDay", "type": "float", "null": true },
                { "name": "parltlyCloudyNight", "type": "float", "null": true },

                { "name": "Priority", "type": "float", "null": true },
                { "name": "RoadPriorityFlt", "type": "float", "null": true },
                { "name": "TrafficJam", "type": "float", "null": true },
                { "name": "RoadClosure", "type": "float", "null": true },
                { "name": "TrafficAccident", "type": "float", "null": true },
                { "name": "OtherEvents", "type": "float", "null": true },
                { "name": "Ice", "type": "float", "null": true },
                { "name": "Roadworks", "type": "float", "null": true },
                { "name": "Wind", "type": "float", "null": true },
                { "name": "NoFreightTraffic", "type": "float", "null": true },
                { "name": "Snow", "type": "float", "null": true },

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