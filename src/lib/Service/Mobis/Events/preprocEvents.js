// This has to be moved to module event preprocessing
exports.makeRadPriorotyToFloat = function () {
    var roadPriorotyToFloat = function (rec) {
        rec.RoadPriorityFlt = parseFloat(rec.RoadPrioroty);
        // Some values are strange (99). Maybe you could handel them here also.
    }
    return roadPriorotyToFloat;
}

// Discretize event cause
exports.makeEventCauseCategorization = function () {
    var eventCauseCateogrization = function (rec) {
        rec["TrafficJam"] = rec.Cause === "Traffic jam" ? 1 : 0;
        rec["RoadClosure"] = rec.Cause === "Road closure" ? 1 : 0;
        rec["TrafficAccident"] = rec.Cause === "Traffic accident" ? 1 : 0;
        rec["OtherEvents"] = rec.Cause === "Other events" ? 1 : 0;
        rec["Ice"] = rec.Cause === "Ice" ? 1 : 0;
        rec["Roadworks"] = rec.Cause === "Roadworks" ? 1 : 0;
        rec["Wind"] = rec.Cause === "Wind" ? 1 : 0;
        rec["NoFreightTraffic"] = rec.Cause === "No freight traffic" ? 1 : 0;
        rec["Snow"] = rec.icon === "Snow" ? 1 : 0;
    }
    return eventCauseCateogrization;
}

// About this module
exports.about = function () {
    var description = "This module contains functions for prreprocessing event logs.";
    return description;
};