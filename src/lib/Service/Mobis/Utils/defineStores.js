// Define measurement store definition as a function so that it can be used several times 

// script name
var scriptNm = process.scriptNm;

///// TRAFFIC STORES
// Define measurement store definition as a function so that it can be used several times 
var createTrafficStore = function (storeName, extraFields) {
    storeDef = [{
        "name": storeName,
        "fields": [
                //{ "name": "DateTime", "type": "datetime", "primary": true },
                { "name": "DateTime", "type": "datetime"},
                { "name": "NumOfCars", "type": "float", "null": true },
                { "name": "Gap", "type": "float", "null": true },
                { "name": "Occupancy", "type": "float", "null": true },
                { "name": "Speed", "type": "float", "null": true },
                { "name": "TrafficStatus", "type": "float", "null": true }
        ],
        "joins": [
            { "name": "measuredBy", "type": "field", "store": "CounterNode" },
            { "name": "Predictions", "type": "index", "store": "Predictions" }
        ]
    }];
    if (extraFields) {
        storeDef[0].fields = storeDef[0].fields.concat(extraFields);
    }
    qm.createStore(storeDef);
};

exports.defineStores = function () {

    // I defined it in def file, so it doesent needs to be defined here also.
    //qm.createStore([{
    //    "name": "Predictions",
    //    "fields": [
    //            { "name": "Name", "type": "string", "null": true }, // maybe something like dateTime od original rec in potem +n. To bi potem lahko blo primary
    //            { "name": "PredictionTime", "type": "datetime", "null": true }, //actual dateTime. Cannot be primary because they will overlap. But you can try latter, because it woul be usefull that we could query them by time.
    //            { "name": "PredictionHorizon", "type": "float", "null": true },
    //            { "name": "NumOfCars", "type": "float", "null": true },
    //            { "name": "Gap", "type": "float", "null": true },
    //            { "name": "Occupancy", "type": "float", "null": true },
    //            { "name": "Speed", "type": "float", "null": true },
    //            { "name": "TrafficStatus", "type": "float", "null": true }
    //    ]
    //}]);

    // Creating Store for measurements
    createTrafficStore("trafficLoadStore");
    createTrafficStore("trafficStore", [{ "name": "Replaced", "type": "bool", "null": true, "default": false }]);

    
    //TODO: Modify this store!!!!!!!!!!!!!!

    ///// RESAMPLING STORE
    // Define extra fields for resampled store
    var extraFields = [
                //{ "name": "Target", "type": "float", "null": true, "default": 0.0 },
                { "name": "Ema1", "type": "float", "null": true },
                { "name": "Ema2", "type": "float", "null": true },

                { "name": "SpeedLimit", "type": "float", "null": true },
                { "name": "PrevValPred", "type": "float", "null": true },
                { "name": "AvrValPred", "type": "float", "null": true },
                { "name": "LinregPred", "type": "float", "null": true },
                { "name": "RidgeRegPred", "type": "float", "null": true },
                { "name": "RidgeRegSVDPred", "type": "float", "null": true },
                { "name": "SvmrPred", "type": "float", "null": true },
                { "name": "NNPred", "type": "float", "null": true },
                { "name": "KNNPred", "type": "float", "null": true },

                { "name": "SpeedLimitMAE", "type": "float", "null": true },
                { "name": "PrevValPredMAE", "type": "float", "null": true },
                { "name": "AvrValPredMAE", "type": "float", "null": true },
                { "name": "LinregPredMAE", "type": "float", "null": true },
                { "name": "RidgeRegPredMAE", "type": "float", "null": true },
                { "name": "RidgeRegSVDPredMAE", "type": "float", "null": true },
                { "name": "SvmrPredMAE", "type": "float", "null": true },
                { "name": "NNPredMAE", "type": "float", "null": true },
                { "name": "KNNPredMAE", "type": "float", "null": true },
    ]

    createTrafficStore("resampledStore", extraFields);
}

exports.createMeasurementStores = function (SensorsStore) {

    var result = {
        trafficStores: [],
        resampledStores: [],
        evaluationStores: [],
        predictionStores: []
    }

    var createStores = function (name) {

        name = name.replace("-", "_");

        var trafficStoreNm = "trafficStore_" + name;
        var resampledStoreNm = "resampledStore_" + name;
        var evaluationStoreNm = "Evaluation_" + name;
        var predictionStoreNm = "Predictions_" + name;

        var storeDef = [
        {
            "name": trafficStoreNm,
            "fields": [
                { "name": "DateTime", "type": "datetime", "primary": true },
                { "name": "NumOfCars", "type": "float", "null": true },
                { "name": "Gap", "type": "float", "null": true },
                { "name": "Occupancy", "type": "float", "null": true },
                { "name": "Speed", "type": "float", "null": true },
                { "name": "TrafficStatus", "type": "float", "null": true },
                { "name": "Replaced", "type": "bool", "null": true, "default": false }
            ],
            "joins": [
                { "name": "measuredBy", "type": "field", "store": "CounterNode" },
                { "name": "Predictions", "type": "index", "store": predictionStoreNm }
            ]
        },
        {
            "name": resampledStoreNm,
            "fields": [
                { "name": "DateTime", "type": "datetime", "primary": true },
                { "name": "NumOfCars", "type": "float", "null": true },
                { "name": "Gap", "type": "float", "null": true },
                { "name": "Occupancy", "type": "float", "null": true },
                { "name": "Speed", "type": "float", "null": true },
                { "name": "TrafficStatus", "type": "float", "null": true }
            ],
            "joins": [
                { "name": "measuredBy", "type": "field", "store": "CounterNode" },
                { "name": "Predictions", "type": "index", "store": predictionStoreNm }
            ]
        },
        {
            "name": evaluationStoreNm,
            "fields": [
                { "name": "Name", "type": "string", "null": true },

                { "name": "NumOfCars", "type": "float", "null": true },
                { "name": "Gap", "type": "float", "null": true },
                { "name": "Occupancy", "type": "float", "null": true },
                { "name": "Speed", "type": "float", "null": true },
                { "name": "TrafficStatus", "type": "float", "null": true }
            ]
        },
        {
            "name": predictionStoreNm,
            "fields": [
                { "name": "Name", "type": "string", "null": true },
                { "name": "OriginalTime", "type": "datetime", "null": true },
                { "name": "PredictionTime", "type": "datetime", "null": true },
                { "name": "PredictionHorizon", "type": "float", "null": true },
                { "name": "UpdateCount", "type": "float", "null": true},

                { "name": "NumOfCars", "type": "float", "null": true },
                { "name": "Gap", "type": "float", "null": true },
                { "name": "Occupancy", "type": "float", "null": true },
                { "name": "Speed", "type": "float", "null": true },
                { "name": "TrafficStatus", "type": "float", "null": true }
            ],
            "joins": [
                { "name": "Evaluation", "type": "index", "store": evaluationStoreNm },
                { "name": "Target", "type": "field", "store": resampledStoreNm }
            ]
        }
        ];
        qm.createStore(storeDef);

        //add store to return object
        //result.trafficStores.push(trafficStoreNm);
        //result.resampledStores.push(resampledStoreNm);
        //result.evaluationStores.push(evaluationStoreNm);
        //result.predictionStores.push(predictionStoreNm);

        //add store to return object
        result.trafficStores.push(qm.store(trafficStoreNm));
        result.resampledStores.push(qm.store(resampledStoreNm));
        result.evaluationStores.push(qm.store(evaluationStoreNm));
        result.predictionStores.push(qm.store(predictionStoreNm));
    }

    SensorsStore.each(function (sensor) { createStores(sensor.Name) })
    return result;
};

exports.loadStores = function() {
    // Load measurements from file to stores
    //qm.load.jsonFile(qm.store("CounterNode"), "./sandbox/" + scriptNm + "/countersNodes.txt");    
    //qm.load.jsonFile(qm.store('trafficLoadStore'), "./sandbox/" + scriptNm + "/measurements_0178_11.txt");
    //qm.load.jsonFile(qm.store('trafficLoadStore'), "./sandbox/" + scriptNm + "/measurements_0011_11.txt");
    qm.load.jsonFile(qm.store('trafficLoadStore'), "./sandbox/" + scriptNm + "/measurements_9_sens_3_mon.txt");
}

exports.createNewTrafficStore = function (storeNm, extraFld) {
    createTrafficStore(storeNm, extraFld);
    return qm.store(storeNm)
}

// About this module
exports.about = function () {
    var description = "Defines stores and loads data to it.";
    return description;
};